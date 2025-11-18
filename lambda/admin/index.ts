import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  Logger,
  parseBody,
  successResponse,
  errorResponse,
  verifyJWT,
  generateId,
  getCurrentTimestamp,
  HTTP_STATUS,
} from '../../src/utils/helpers';
import { Gateway, User, Transaction, Voucher } from '../../src/types';

const logger = new Logger('AdminLambda');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const USERS_TABLE = process.env.USERS_TABLE!;
const SESSIONS_TABLE = process.env.SESSIONS_TABLE!;
const TRANSACTIONS_TABLE = process.env.TRANSACTIONS_TABLE!;
const VOUCHERS_TABLE = process.env.VOUCHERS_TABLE!;
const PACKAGES_TABLE = process.env.PACKAGES_TABLE!;
const GATEWAYS_TABLE = process.env.GATEWAYS_TABLE!;

/**
 * Admin Lambda - Handles all admin management operations
 */
export async function handler(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  logger.info('Admin request received', { path: event.path, method: event.httpMethod });

  try {
    const path = event.path;
    const method = event.httpMethod;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return successResponse({});
    }

    // Verify admin authentication
    const authResult = verifyJWT(event.headers.Authorization, 'admin');
    if (!authResult.valid) {
      return errorResponse(HTTP_STATUS.FORBIDDEN, 'Admin access required');
    }

    // Route to appropriate handler
    if (path.includes('/admin/dashboard') && method === 'GET') {
      return await getDashboardStats();
    } else if (path.includes('/admin/users') && method === 'GET') {
      if (path.match(/\/admin\/users\/[^/]+$/)) {
        const userId = path.split('/').pop()!;
        return await getUserDetails(userId);
      }
      return await listUsers(event.queryStringParameters);
    } else if (path.includes('/admin/sessions') && method === 'GET') {
      return await listSessions(event.queryStringParameters);
    } else if (path.match(/\/admin\/sessions\/[^/]+\/terminate/) && method === 'POST') {
      const sessionId = path.split('/')[3];
      return await terminateSession(sessionId);
    } else if (path.includes('/admin/transactions') && method === 'GET') {
      return await listTransactions(event.queryStringParameters);
    } else if (path.includes('/admin/vouchers/generate') && method === 'POST') {
      return await generateVouchers(parseBody(event.body));
    } else if (path.includes('/admin/vouchers') && method === 'GET') {
      return await listVouchers(event.queryStringParameters);
    } else if (path.includes('/admin/gateways') && method === 'GET') {
      return await listGateways();
    } else if (path.includes('/admin/gateways') && method === 'POST') {
      return await createGateway(parseBody(event.body));
    } else if (path.match(/\/admin\/gateways\/[^/]+$/) && method === 'PUT') {
      const gatewayId = path.split('/').pop()!;
      return await updateGateway(gatewayId, parseBody(event.body));
    } else if (path.match(/\/admin\/gateways\/[^/]+$/) && method === 'DELETE') {
      const gatewayId = path.split('/').pop()!;
      return await deleteGateway(gatewayId);
    } else {
      return errorResponse(HTTP_STATUS.NOT_FOUND, 'Endpoint not found');
    }
  } catch (error: any) {
    logger.error('Unhandled error in admin lambda', error);
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Internal server error');
  }
}

/**
 * Get dashboard statistics
 */
async function getDashboardStats(): Promise<APIGatewayProxyResult> {
  try {
    // Get all transactions
    const transactionsResult = await docClient.send(
      new ScanCommand({ TableName: TRANSACTIONS_TABLE })
    );
    const transactions = (transactionsResult.Items || []) as Transaction[];

    // Calculate revenue (completed transactions only)
    const completedTransactions = transactions.filter(t => t.status === 'completed');
    const totalRevenue = completedTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

    // Get user count
    const usersResult = await docClient.send(
      new ScanCommand({ TableName: USERS_TABLE, Select: 'COUNT' })
    );
    const userCount = usersResult.Count || 0;

    // Get active sessions
    const sessionsResult = await docClient.send(
      new ScanCommand({
        TableName: SESSIONS_TABLE,
        FilterExpression: '#status = :active',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':active': 'active' },
      })
    );
    const activeSessions = sessionsResult.Items || [];

    // Get gateways
    const gatewaysResult = await docClient.send(
      new ScanCommand({ TableName: GATEWAYS_TABLE })
    );
    const gateways = gatewaysResult.Items || [];
    const onlineGateways = gateways.filter((g: any) => g.status === 'online').length;

    // Recent transactions (last 10)
    const recentTransactions = completedTransactions
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    return successResponse({
      revenue: {
        total: totalRevenue,
        today: completedTransactions
          .filter(t => {
            const txDate = new Date(t.timestamp);
            const today = new Date();
            return txDate.toDateString() === today.toDateString();
          })
          .reduce((sum, t) => sum + (t.amount || 0), 0),
        thisMonth: completedTransactions
          .filter(t => {
            const txDate = new Date(t.timestamp);
            const now = new Date();
            return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
          })
          .reduce((sum, t) => sum + (t.amount || 0), 0),
      },
      users: {
        total: userCount,
        active: activeSessions.length,
      },
      sessions: {
        active: activeSessions.length,
        total: (await docClient.send(new ScanCommand({ TableName: SESSIONS_TABLE, Select: 'COUNT' }))).Count || 0,
      },
      gateways: {
        total: gateways.length,
        online: onlineGateways,
      },
      transactions: {
        total: transactions.length,
        completed: completedTransactions.length,
        pending: transactions.filter(t => t.status === 'pending').length,
        failed: transactions.filter(t => t.status === 'failed').length,
      },
      recentTransactions,
    });
  } catch (error: any) {
    logger.error('Failed to get dashboard stats', error);
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to get dashboard stats');
  }
}

/**
 * List all users with optional search
 */
async function listUsers(queryParams: any = {}): Promise<APIGatewayProxyResult> {
  try {
    const result = await docClient.send(new ScanCommand({ TableName: USERS_TABLE }));
    let users = (result.Items || []) as User[];

    // Apply search filter
    if (queryParams?.search) {
      const searchLower = queryParams.search.toLowerCase();
      users = users.filter(u => u.phoneNumber.includes(searchLower));
    }

    // Enrich with session and transaction data
    const enrichedUsers = await Promise.all(
      users.map(async user => {
        const [sessionsResult, transactionsResult] = await Promise.all([
          docClient.send(
            new QueryCommand({
              TableName: SESSIONS_TABLE,
              IndexName: 'UserIdIndex',
              KeyConditionExpression: 'userId = :userId',
              ExpressionAttributeValues: { ':userId': user.userId },
            })
          ),
          docClient.send(
            new ScanCommand({
              TableName: TRANSACTIONS_TABLE,
              FilterExpression: 'phoneNumber = :phone',
              ExpressionAttributeValues: { ':phone': user.phoneNumber },
            })
          ),
        ]);

        const sessions = sessionsResult.Items || [];
        const transactions = transactionsResult.Items || [];
        const completedTxns = transactions.filter((t: any) => t.status === 'completed');

        return {
          ...user,
          activeSessions: sessions.filter((s: any) => s.status === 'active').length,
          totalSessions: sessions.length,
          totalSpent: completedTxns.reduce((sum: number, t: any) => sum + (t.amount || 0), 0),
          lastSeen: sessions.length > 0
            ? sessions.sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0].startTime
            : user.createdAt,
        };
      })
    );

    return successResponse({ users: enrichedUsers, count: enrichedUsers.length });
  } catch (error: any) {
    logger.error('Failed to list users', error);
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to list users');
  }
}

/**
 * Get detailed user information
 */
async function getUserDetails(userId: string): Promise<APIGatewayProxyResult> {
  try {
    const [userResult, sessionsResult, transactionsResult] = await Promise.all([
      docClient.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId } })),
      docClient.send(
        new QueryCommand({
          TableName: SESSIONS_TABLE,
          IndexName: 'UserIdIndex',
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: { ':userId': userId },
        })
      ),
      docClient.send(
        new ScanCommand({
          TableName: TRANSACTIONS_TABLE,
          FilterExpression: 'userId = :userId',
          ExpressionAttributeValues: { ':userId': userId },
        })
      ),
    ]);

    if (!userResult.Item) {
      return errorResponse(HTTP_STATUS.NOT_FOUND, 'User not found');
    }

    return successResponse({
      user: userResult.Item,
      sessions: sessionsResult.Items || [],
      transactions: transactionsResult.Items || [],
    });
  } catch (error: any) {
    logger.error('Failed to get user details', error);
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to get user details');
  }
}

/**
 * List sessions with filters
 */
async function listSessions(queryParams: any = {}): Promise<APIGatewayProxyResult> {
  try {
    const params: any = { TableName: SESSIONS_TABLE };

    // Filter by status if provided
    if (queryParams?.status) {
      params.FilterExpression = '#status = :status';
      params.ExpressionAttributeNames = { '#status': 'status' };
      params.ExpressionAttributeValues = { ':status': queryParams.status };
    }

    const result = await docClient.send(new ScanCommand(params));
    const sessions = result.Items || [];

    return successResponse({ sessions, count: sessions.length });
  } catch (error: any) {
    logger.error('Failed to list sessions', error);
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to list sessions');
  }
}

/**
 * Terminate a session
 */
async function terminateSession(sessionId: string): Promise<APIGatewayProxyResult> {
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: SESSIONS_TABLE,
        Key: { sessionId },
        UpdateExpression: 'SET #status = :terminated, endTime = :endTime',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':terminated': 'terminated',
          ':endTime': getCurrentTimestamp(),
        },
      })
    );

    return successResponse({ sessionId }, 'Session terminated successfully');
  } catch (error: any) {
    logger.error('Failed to terminate session', error);
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to terminate session');
  }
}

/**
 * List transactions with filters
 */
async function listTransactions(queryParams: any = {}): Promise<APIGatewayProxyResult> {
  try {
    const params: any = { TableName: TRANSACTIONS_TABLE };

    // Filter by status if provided
    if (queryParams?.status) {
      params.FilterExpression = '#status = :status';
      params.ExpressionAttributeNames = { '#status': 'status' };
      params.ExpressionAttributeValues = { ':status': queryParams.status };
    }

    const result = await docClient.send(new ScanCommand(params));
    const transactions = (result.Items || []).sort(
      (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return successResponse({ transactions, count: transactions.length });
  } catch (error: any) {
    logger.error('Failed to list transactions', error);
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to list transactions');
  }
}

/**
 * Generate voucher batch
 */
async function generateVouchers(data: any): Promise<APIGatewayProxyResult> {
  try {
    const { packageId, quantity = 10, expiryDays } = data;

    if (!packageId || !quantity) {
      return errorResponse(HTTP_STATUS.BAD_REQUEST, 'packageId and quantity required');
    }

    // Get package details
    const pkgResult = await docClient.send(
      new GetCommand({ TableName: PACKAGES_TABLE, Key: { packageId } })
    );

    if (!pkgResult.Item) {
      return errorResponse(HTTP_STATUS.NOT_FOUND, 'Package not found');
    }

    const pkg = pkgResult.Item;
    const batchId = `BATCH-${Date.now()}`;
    const vouchers: Voucher[] = [];

    // Generate vouchers
    for (let i = 0; i < quantity; i++) {
      const code = `WIFI-${generateVoucherCode()}`;
      const voucher: Voucher = {
        voucherId: generateId('voucher'),
        code,
        packageId,
        packageName: pkg.name,
        status: 'unused',
        batchId,
        createdAt: getCurrentTimestamp(),
        expiresAt: expiryDays ? addDaysToNow(expiryDays) : undefined,
      };
      vouchers.push(voucher);

      await docClient.send(
        new PutCommand({ TableName: VOUCHERS_TABLE, Item: voucher })
      );
    }

    return successResponse({ vouchers, batchId, count: vouchers.length }, 'Vouchers generated successfully');
  } catch (error: any) {
    logger.error('Failed to generate vouchers', error);
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to generate vouchers');
  }
}

/**
 * List all vouchers
 */
async function listVouchers(queryParams: any = {}): Promise<APIGatewayProxyResult> {
  try {
    const params: any = { TableName: VOUCHERS_TABLE };

    if (queryParams?.status) {
      params.FilterExpression = '#status = :status';
      params.ExpressionAttributeNames = { '#status': 'status' };
      params.ExpressionAttributeValues = { ':status': queryParams.status };
    }

    const result = await docClient.send(new ScanCommand(params));
    const vouchers = result.Items || [];

    return successResponse({ vouchers, count: vouchers.length });
  } catch (error: any) {
    logger.error('Failed to list vouchers', error);
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to list vouchers');
  }
}

/**
 * List all gateways
 */
async function listGateways(): Promise<APIGatewayProxyResult> {
  try {
    const result = await docClient.send(new ScanCommand({ TableName: GATEWAYS_TABLE }));
    const gateways = result.Items || [];

    return successResponse({ gateways, count: gateways.length });
  } catch (error: any) {
    logger.error('Failed to list gateways', error);
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to list gateways');
  }
}

/**
 * Create new gateway
 */
async function createGateway(data: any): Promise<APIGatewayProxyResult> {
  try {
    const { name, location, ipAddress, nasIdentifier, radiusSecret } = data;

    if (!name || !ipAddress || !nasIdentifier || !radiusSecret) {
      return errorResponse(HTTP_STATUS.BAD_REQUEST, 'name, ipAddress, nasIdentifier, and radiusSecret required');
    }

    const gateway: Gateway = {
      gatewayId: generateId('gateway'),
      name,
      location: location || '',
      ipAddress,
      nasIdentifier,
      radiusSecret,
      status: 'offline',
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp(),
    };

    await docClient.send(new PutCommand({ TableName: GATEWAYS_TABLE, Item: gateway }));

    return successResponse(gateway, 'Gateway created successfully');
  } catch (error: any) {
    logger.error('Failed to create gateway', error);
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to create gateway');
  }
}

/**
 * Update gateway
 */
async function updateGateway(gatewayId: string, data: any): Promise<APIGatewayProxyResult> {
  try {
    const updateExpressions: string[] = [];
    const attributeNames: any = {};
    const attributeValues: any = {};

    // Build dynamic update expression
    const allowedFields = ['name', 'location', 'ipAddress', 'nasIdentifier', 'radiusSecret', 'status'];
    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updateExpressions.push(`#${field} = :${field}`);
        attributeNames[`#${field}`] = field;
        attributeValues[`:${field}`] = data[field];
      }
    });

    if (updateExpressions.length === 0) {
      return errorResponse(HTTP_STATUS.BAD_REQUEST, 'No fields to update');
    }

    updateExpressions.push('#updatedAt = :updatedAt');
    attributeNames['#updatedAt'] = 'updatedAt';
    attributeValues[':updatedAt'] = getCurrentTimestamp();

    await docClient.send(
      new UpdateCommand({
        TableName: GATEWAYS_TABLE,
        Key: { gatewayId },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: attributeNames,
        ExpressionAttributeValues: attributeValues,
      })
    );

    return successResponse({ gatewayId }, 'Gateway updated successfully');
  } catch (error: any) {
    logger.error('Failed to update gateway', error);
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to update gateway');
  }
}

/**
 * Delete gateway
 */
async function deleteGateway(gatewayId: string): Promise<APIGatewayProxyResult> {
  try {
    await docClient.send(
      new DeleteCommand({ TableName: GATEWAYS_TABLE, Key: { gatewayId } })
    );

    return successResponse({ gatewayId }, 'Gateway deleted successfully');
  } catch (error: any) {
    logger.error('Failed to delete gateway', error);
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to delete gateway');
  }
}

// Helper functions
function generateVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function addDaysToNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}
