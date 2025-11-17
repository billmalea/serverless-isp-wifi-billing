import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Package} from '../../src/types';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const PACKAGES_TABLE = process.env.PACKAGES_TABLE!;

/**
 * Package Management Lambda
 * Handles CRUD operations for time-based billing packages
 */
export async function handler(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  console.log('Event:', JSON.stringify(event));

  const path = event.path;
  const method = event.httpMethod;

  try {
    // Public endpoint - List active packages
    if (method === 'GET' && path === '/api/packages') {
      return await listActivePackages();
    }

    // Admin endpoints - require authentication
    const isAdmin = await verifyAdminToken(event.headers.Authorization);
    if (!isAdmin) {
      return response(403, { success: false, error: 'Admin access required' });
    }

    // Admin: List all packages
    if (method === 'GET' && path === '/api/admin/packages') {
      return await listAllPackages(event.queryStringParameters);
    }

    // Admin: Create package
    if (method === 'POST' && path === '/api/admin/packages') {
      return await createPackage(JSON.parse(event.body || '{}'), event.headers.Authorization);
    }

    // Admin: Update package
    if (method === 'PUT' && path.startsWith('/api/admin/packages/')) {
      const packageId = path.split('/').pop()!;
      return await updatePackage(packageId, JSON.parse(event.body || '{}'));
    }

    // Admin: Delete (deactivate) package
    if (method === 'DELETE' && path.startsWith('/api/admin/packages/')) {
      const packageId = path.split('/').pop()!;
      return await deletePackage(packageId);
    }

    return response(404, { success: false, error: 'Endpoint not found' });

  } catch (error: any) {
    console.error('Error:', error);
    return response(500, {
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
}

/**
 * List active packages (public endpoint)
 */
async function listActivePackages(): Promise<APIGatewayProxyResult> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: PACKAGES_TABLE,
      IndexName: 'StatusPriceIndex',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'active'
      }
    }));

    const packages = (result.Items || []).map(formatPackage);

    return response(200, {
      success: true,
      packages,
      count: packages.length
    });

  } catch (error: any) {
    console.error('Error listing active packages:', error);
    throw error;
  }
}

/**
 * List all packages (admin only)
 */
async function listAllPackages(queryParams: any): Promise<APIGatewayProxyResult> {
  try {
    const status = queryParams?.status;

    let result;
    if (status) {
      result = await docClient.send(new QueryCommand({
        TableName: PACKAGES_TABLE,
        IndexName: 'StatusPriceIndex',
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': status
        }
      }));
    } else {
      result = await docClient.send(new ScanCommand({
        TableName: PACKAGES_TABLE
      }));
    }

    const packages = (result.Items || []).map(formatPackage);

    return response(200, {
      success: true,
      packages,
      count: packages.length
    });

  } catch (error: any) {
    console.error('Error listing all packages:', error);
    throw error;
  }
}

/**
 * Create new package (admin only)
 */
async function createPackage(body: any, authHeader?: string): Promise<APIGatewayProxyResult> {
  try {
    // Validate input
    const validation = validatePackageInput(body);
    if (!validation.valid) {
      return response(400, {
        success: false,
        error: validation.error
      });
    }

    const packageId = `pkg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const adminUserId = await getUserIdFromToken(authHeader);

    const packageData: Package = {
      packageId,
      name: body.name,
      description: body.description || '',
      durationHours: parseFloat(body.durationHours),
      bandwidthMbps: parseInt(body.bandwidthMbps),
      priceKES: parseFloat(body.priceKES),
      status: body.status || 'active',
      createdBy: adminUserId,
      createdAt: now,
      updatedAt: now
    };

    await docClient.send(new PutCommand({
      TableName: PACKAGES_TABLE,
      Item: packageData,
      ConditionExpression: 'attribute_not_exists(packageId)'
    }));

    console.log('Package created:', packageId);

    return response(201, {
      success: true,
      message: 'Package created successfully',
      package: formatPackage(packageData)
    });

  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      return response(409, {
        success: false,
        error: 'Package already exists'
      });
    }
    console.error('Error creating package:', error);
    throw error;
  }
}

/**
 * Update package (admin only)
 */
async function updatePackage(packageId: string, body: any, ): Promise<APIGatewayProxyResult> {
  try {
    // Get existing package
    const existing = await docClient.send(new GetCommand({
      TableName: PACKAGES_TABLE,
      Key: { packageId }
    }));

    if (!existing.Item) {
      return response(404, {
        success: false,
        error: 'Package not found'
      });
    }

    // Validate updates
    const updates: any = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.durationHours !== undefined) {
      const hours = parseFloat(body.durationHours);
      if (hours <= 0 || hours > 168) {
        return response(400, { success: false, error: 'Duration must be between 0 and 168 hours' });
      }
      updates.durationHours = hours;
    }
    if (body.bandwidthMbps !== undefined) {
      const bandwidth = parseInt(body.bandwidthMbps);
      if (bandwidth <= 0 || bandwidth > 100) {
        return response(400, { success: false, error: 'Bandwidth must be between 1 and 100 Mbps' });
      }
      updates.bandwidthMbps = bandwidth;
    }
    if (body.priceKES !== undefined) {
      const price = parseFloat(body.priceKES);
      if (price <= 0 || price > 10000) {
        return response(400, { success: false, error: 'Price must be between 1 and 10000 KES' });
      }
      updates.priceKES = price;
    }
    if (body.status !== undefined) {
      if (!['active', 'inactive'].includes(body.status)) {
        return response(400, { success: false, error: 'Status must be active or inactive' });
      }
      updates.status = body.status;
    }

    updates.updatedAt = new Date().toISOString();

    // Build update expression
    const updateExpression = 'SET ' + Object.keys(updates).map((key) => `#${key} = :${key}`).join(', ');
    const expressionAttributeNames = Object.keys(updates).reduce((acc, key) => {
      acc[`#${key}`] = key;
      return acc;
    }, {} as Record<string, string>);
    const expressionAttributeValues = Object.keys(updates).reduce((acc, key) => {
      acc[`:${key}`] = updates[key];
      return acc;
    }, {} as Record<string, any>);

    await docClient.send(new UpdateCommand({
      TableName: PACKAGES_TABLE,
      Key: { packageId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    }));

    console.log('Package updated:', packageId);

    return response(200, {
      success: true,
      message: 'Package updated successfully',
      packageId
    });

  } catch (error: any) {
    console.error('Error updating package:', error);
    throw error;
  }
}

/**
 * Delete (deactivate) package (admin only)
 */
async function deletePackage(packageId: string): Promise<APIGatewayProxyResult> {
  try {
    await docClient.send(new UpdateCommand({
      TableName: PACKAGES_TABLE,
      Key: { packageId },
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'inactive',
        ':updatedAt': new Date().toISOString()
      },
      ConditionExpression: 'attribute_exists(packageId)'
    }));

    console.log('Package deactivated:', packageId);

    return response(200, {
      success: true,
      message: 'Package deactivated successfully',
      packageId
    });

  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      return response(404, {
        success: false,
        error: 'Package not found'
      });
    }
    console.error('Error deactivating package:', error);
    throw error;
  }
}

/**
 * Validate package input
 */
function validatePackageInput(body: any): { valid: boolean; error?: string } {
  if (!body.name || body.name.length < 3 || body.name.length > 50) {
    return { valid: false, error: 'Package name must be between 3 and 50 characters' };
  }

  if (!body.durationHours || body.durationHours <= 0 || body.durationHours > 168) {
    return { valid: false, error: 'Duration must be between 0 and 168 hours (7 days)' };
  }

  if (!body.bandwidthMbps || body.bandwidthMbps <= 0 || body.bandwidthMbps > 100) {
    return { valid: false, error: 'Bandwidth must be between 1 and 100 Mbps' };
  }

  if (!body.priceKES || body.priceKES <= 0 || body.priceKES > 10000) {
    return { valid: false, error: 'Price must be between 1 and 10000 KES' };
  }

  return { valid: true };
}

/**
 * Format package for API response
 */
function formatPackage(pkg: any): any {
  return {
    packageId: pkg.packageId,
    name: pkg.name,
    description: pkg.description,
    duration: `${pkg.durationHours} hour${pkg.durationHours !== 1 ? 's' : ''}`,
    durationHours: pkg.durationHours,
    bandwidth: `${pkg.bandwidthMbps} Mbps`,
    bandwidthMbps: pkg.bandwidthMbps,
    price: `KES ${pkg.priceKES}`,
    priceKES: pkg.priceKES,
    status: pkg.status,
    createdAt: pkg.createdAt,
    updatedAt: pkg.updatedAt
  };
}

/**
 * Verify admin token using JWT
 */
async function verifyAdminToken(authHeader?: string): Promise<boolean> {
  const { verifyJWT } = await import('../../src/utils/helpers');
  const result = verifyJWT(authHeader, 'admin');
  return result.valid;
}

/**
 * Get user ID from token
 */
async function getUserIdFromToken(authHeader?: string): Promise<string> {
  const { verifyJWT } = await import('../../src/utils/helpers');
  const result = verifyJWT(authHeader);
  return result.userId || 'unknown';
}

/**
 * Create HTTP response
 */
function response(statusCode: number, body: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    },
    body: JSON.stringify(body)
  };
}
