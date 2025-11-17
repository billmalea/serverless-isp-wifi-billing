import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Session, User, HTTP_STATUS } from '../../src/types';
import { Logger, getItem, updateItem, putItem, parseBody, successResponse, errorResponse, getCurrentTimestamp, verifyJWT } from '../../src/utils/helpers';

const logger = new Logger('SessionLambda');

const SESSIONS_TABLE = process.env.SESSIONS_TABLE!;
const USERS_TABLE = process.env.USERS_TABLE!;

// Handler supports listing sessions, forcing termination, and heartbeat refresh (optional)
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  try {
    // Admin-only endpoints: require 'admin' role
    const authResult = verifyJWT(event.headers.Authorization, 'admin');
    if (!authResult.valid) {
      return errorResponse(HTTP_STATUS.FORBIDDEN, 'Admin access required');
    }

    if (method === 'GET' && path === '/api/sessions') {
      return await listActiveSessions();
    }

    if (method === 'POST' && path === '/api/sessions/terminate') {
      const body = parseBody<{ sessionId: string }>(event.body);
      if (!body?.sessionId) return errorResponse(HTTP_STATUS.BAD_REQUEST, 'sessionId required');
      await terminateSession(body.sessionId);
      return successResponse({ sessionId: body.sessionId }, 'Session terminated');
    }

    return errorResponse(HTTP_STATUS.NOT_FOUND, 'Endpoint not found');
  } catch (error: any) {
    logger.error('Unhandled error', error);
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Internal server error');
  }
}

// List active sessions using GSI queries
async function listActiveSessions(): Promise<APIGatewayProxyResult> {
  try {
    const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient, ScanCommand } = await import('@aws-sdk/lib-dynamodb');
    
    const client = new DynamoDBClient({});
    const docClient = DynamoDBDocumentClient.from(client);
    
    // Scan for active sessions (for admin view; filter by status)
    const result = await docClient.send(new ScanCommand({
      TableName: SESSIONS_TABLE,
      FilterExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'active'
      },
      Limit: 100
    }));
    
    const sessions = result.Items || [];
    
    return successResponse({
      sessions,
      count: sessions.length
    });
  } catch (error: any) {
    logger.error('Failed to list sessions', error);
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to list sessions');
  }
}

async function terminateSession(sessionId: string): Promise<void> {
  await updateItem(SESSIONS_TABLE, { sessionId }, { status: 'terminated', endTime: getCurrentTimestamp() });
}

// Utility to create a session (used by potential integration tests)
export async function createTestSession(userPhone: string, pkg: { packageId: string; name: string; durationHours: number; bandwidthMbps: number; }, mac: string): Promise<Session> {
  const user = await getItem<User>(USERS_TABLE, { phoneNumber: userPhone });
  if (!user) throw new Error('User not found');
  const session: Session = {
    sessionId: `session_${Date.now()}`,
    userId: userPhone,
    packageId: pkg.packageId,
    packageName: pkg.name,
    durationHours: pkg.durationHours,
    bandwidthMbps: pkg.bandwidthMbps,
    macAddress: mac,
    ipAddress: '0.0.0.0',
    gatewayId: 'gw-test',
    startTime: getCurrentTimestamp(),
    expiresAt: getCurrentTimestamp(),
    status: 'active'
  };
  await putItem(SESSIONS_TABLE, session);
  return session;
}
