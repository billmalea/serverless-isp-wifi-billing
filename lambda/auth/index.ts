import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import jwt from 'jsonwebtoken';
import {
  User,
  Session,
  Voucher,
  Package,
  AuthRequest,
  VoucherRequest,
  CoAMessage,
  HTTP_STATUS,
} from '../../src/types';
import {
  Logger,
  parseBody,
  successResponse,
  errorResponse,
  getItem,
  putItem,
  updateItem,
  sendToQueue,
  formatPhoneNumber,
  isValidKenyanPhone,
  verifyPassword,
  generateId,
  getCurrentTimestamp,
  addSecondsToNow,
  isExpired,
  publishMetric,
} from '../../src/utils/helpers';

const logger = new Logger('AuthLambda');

const USERS_TABLE = process.env.USERS_TABLE!;
const SESSIONS_TABLE = process.env.SESSIONS_TABLE!;
const VOUCHERS_TABLE = process.env.VOUCHERS_TABLE!;
const PACKAGES_TABLE = process.env.PACKAGES_TABLE!;
const COA_QUEUE_URL = process.env.COA_QUEUE_URL!;

/**
 * Main Lambda handler for authentication
 */
export async function handler(
  event: APIGatewayProxyEvent,
 ): Promise<APIGatewayProxyResult> {
  logger.info('Authentication request received', { path: event.path, method: event.httpMethod });

  try {
    const path = event.path;
    const method = event.httpMethod;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return successResponse({});
    }

    // Route to appropriate handler
    if (path.includes('/auth/login') && method === 'POST') {
      return await handleLogin(event);
    } else if (path.includes('/auth/voucher') && method === 'POST') {
      return await handleVoucher(event);
    } else if (path.includes('/auth/validate') && method === 'POST') {
      return await handleValidate(event);
    } else if (path.includes('/auth/status') && method === 'GET') {
      return await handleStatus(event);
    } else if (path.includes('/auth/logout') && method === 'POST') {
      return await handleLogout(event);
    } else {
      return errorResponse(HTTP_STATUS.NOT_FOUND, 'Endpoint not found');
    }
  } catch (error: any) {
    logger.error('Unhandled error in authentication', error);
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Internal server error');
  }
}

/**
 * Handle user login with phone number
 */
async function handleLogin(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseBody<AuthRequest>(event.body);

  if (!body || !body.phoneNumber || !body.macAddress) {
    return errorResponse(HTTP_STATUS.BAD_REQUEST, 'Phone number and MAC address required');
  }

  try {
    const phoneNumber = formatPhoneNumber(body.phoneNumber);

    if (!isValidKenyanPhone(phoneNumber)) {
      return errorResponse(HTTP_STATUS.BAD_REQUEST, 'Invalid Kenyan phone number');
    }

    // Get or create user
    let user = await getItem<User>(USERS_TABLE, { phoneNumber });

    if (!user) {
      user = await createNewUser(phoneNumber);
      logger.info('New user created', { userId: user.userId });
    } else {
      // Verify password if provided
      if (body.password && user.passwordHash) {
        const isValid = await verifyPassword(body.password, user.passwordHash);
        if (!isValid) {
          return errorResponse(HTTP_STATUS.UNAUTHORIZED, 'Invalid credentials');
        }
      }

      // Update last login
      await updateItem(USERS_TABLE, { phoneNumber }, { lastLoginAt: getCurrentTimestamp() });
    }

    // Check if user has active session for this device
    const existingSession = await getActiveSessionForDevice(body.macAddress);
    if (existingSession && existingSession.userId !== user.userId) {
      return errorResponse(HTTP_STATUS.FORBIDDEN, 'This device is already in use by another account');
    }

    if (existingSession && !isExpired(existingSession.expiresAt)) {
      // Reuse existing session
      const token = jwt.sign({ sub: user.userId, phoneNumber: user.phoneNumber, roles: user.roles || ['user'] }, process.env.JWT_SECRET!, { expiresIn: '24h' });
      return successResponse(
        {
          token,
          sessionId: existingSession.sessionId,
          userId: user.userId,
          packageName: existingSession.packageName,
          timeRemaining: Math.max(0, Math.floor((new Date(existingSession.expiresAt).getTime() - Date.now()) / 1000)),
          bandwidthMbps: existingSession.bandwidthMbps,
          expiresAt: existingSession.expiresAt,
        },
        'Session active'
      );
    }

    return errorResponse(HTTP_STATUS.FORBIDDEN, 'No active package. Please purchase a package.', 'Payment required');
  } catch (error: any) {
    logger.error('Login failed', error);
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Authentication failed');
  }
}

/**
 * Handle voucher redemption
 */
async function handleVoucher(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseBody<VoucherRequest>(event.body);

  if (!body || !body.voucherCode || !body.macAddress) {
    return errorResponse(HTTP_STATUS.BAD_REQUEST, 'Voucher code and MAC address required');
  }

  try {
    const voucherCode = body.voucherCode.toUpperCase().trim();

    // Get voucher
    const voucher = await getItem<Voucher>(VOUCHERS_TABLE, { voucherCode });

    if (!voucher) {
      return errorResponse(HTTP_STATUS.NOT_FOUND, 'Invalid voucher code');
    }

    // Check voucher status
    if (voucher.status !== 'unused') {
      return errorResponse(HTTP_STATUS.FORBIDDEN, `Voucher already ${voucher.status}`);
    }

    // Check expiration
    if (voucher.expiresAt && isExpired(voucher.expiresAt)) {
      await updateItem(VOUCHERS_TABLE, { voucherCode }, { status: 'expired' });
      return errorResponse(HTTP_STATUS.FORBIDDEN, 'Voucher has expired');
    }

    // Check device binding for voucher
    if (voucher.usedByMac && voucher.usedByMac !== body.macAddress) {
      return errorResponse(HTTP_STATUS.FORBIDDEN, 'Voucher already used on another device');
    }

    // Check if device has another active session
    const existingSession = await getActiveSessionForDevice(body.macAddress);
    if (existingSession) {
      return errorResponse(HTTP_STATUS.FORBIDDEN, 'Device already has an active session');
    }

    // Get or create user
    let user: User;
    if (body.phoneNumber) {
      const phoneNumber = formatPhoneNumber(body.phoneNumber);
      user = (await getItem<User>(USERS_TABLE, { phoneNumber })) || (await createNewUser(phoneNumber));
    } else {
      // Anonymous voucher usage
      user = await createNewUser(`anonymous_${generateId('anon')}`);
    }

    // Get package details from database
    const packageData = await getItem<Package>(PACKAGES_TABLE, { packageId: voucher.packageId });

    if (!packageData || packageData.status !== 'active') {
      return errorResponse(HTTP_STATUS.BAD_REQUEST, 'Package not available');
    }

    // Create time-based session
    const session = await createSessionWithPackage(
      user,
      body.macAddress,
      body.ipAddress,
      body.gatewayId,
      packageData
    );

    // Mark voucher as used and bind to device
    await updateItem(VOUCHERS_TABLE, { voucherCode }, {
      status: 'used',
      usedAt: getCurrentTimestamp(),
      usedBy: user.userId,
      usedByMac: body.macAddress,
    });

    // Send CoA to gateway
    await sendCoA(session, user);

    logger.info('Voucher redeemed successfully', {
      voucherCode,
      userId: user.userId,
      packageId: packageData.packageId,
      packageName: packageData.name,
    });

    // Publish metric
    await publishMetric('VoucherRedeemed', 1);

    return successResponse(
      {
        sessionId: session.sessionId,
        userId: user.userId,
        packageName: packageData.name,
        durationHours: packageData.durationHours,
        bandwidthMbps: packageData.bandwidthMbps,
        timeRemaining: packageData.durationHours * 3600,
        expiresAt: session.expiresAt,
      },
      `Voucher activated: ${packageData.name} (${packageData.durationHours}h @ ${packageData.bandwidthMbps}Mbps)`
    );
  } catch (error: any) {
    logger.error('Voucher redemption failed', error);
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Voucher redemption failed');
  }
}

/**
 * Handle session validation
 */
async function handleValidate(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseBody<{ sessionId: string }>(event.body);

  if (!body || !body.sessionId) {
    return errorResponse(HTTP_STATUS.BAD_REQUEST, 'Session ID required');
  }

  try {
    const session = await getItem<Session>(SESSIONS_TABLE, { sessionId: body.sessionId });

    if (!session) {
      return errorResponse(HTTP_STATUS.NOT_FOUND, 'Session not found');
    }

    // Check if session is active
    if (session.status !== 'active') {
      return errorResponse(HTTP_STATUS.FORBIDDEN, `Session is ${session.status}`);
    }

    // Check expiration
    if (isExpired(session.expiresAt)) {
      await terminateSession(session.sessionId);
      return errorResponse(HTTP_STATUS.FORBIDDEN, 'Session expired');
    }

    // Get user (lookup by actual phoneNumber stored in session)
    const user = await getItem<User>(USERS_TABLE, { phoneNumber: session.phoneNumber });

    if (!user) {
      return errorResponse(HTTP_STATUS.NOT_FOUND, 'User not found');
    }

    const timeRemaining = Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000));

    return successResponse({
      valid: true,
      sessionId: session.sessionId,
      userId: user.userId,
      packageName: session.packageName,
      durationHours: session.durationHours,
      bandwidthMbps: session.bandwidthMbps,
      timeRemaining,
      startTime: session.startTime,
      expiresAt: session.expiresAt,
    });
  } catch (error: any) {
    logger.error('Session validation failed', error);
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Validation failed');
  }
}

/**
 * Handle user status check
 */
async function handleStatus(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const phoneNumber = event.queryStringParameters?.phoneNumber;
  const userId = event.queryStringParameters?.userId;
  const macAddress = event.queryStringParameters?.macAddress;

  if (!phoneNumber && !userId && !macAddress) {
    return errorResponse(HTTP_STATUS.BAD_REQUEST, 'Phone number, user ID, or MAC address required');
  }

  try {
    // If MAC address provided, find session by device directly
    if (macAddress) {
      const session = await getActiveSessionForDevice(macAddress);
      if (session) {
        const user = await getItem<User>(USERS_TABLE, { phoneNumber: session.phoneNumber });
        const timeRemaining = Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000));
        return successResponse({
          userId: user?.userId,
          phoneNumber: session.phoneNumber,
          status: user?.status || 'active',
          activeSessions: 1,
          sessions: [{
            sessionId: session.sessionId,
            packageName: session.packageName,
            macAddress: session.macAddress,
            timeRemaining,
            expiresAt: session.expiresAt,
            bandwidthMbps: session.bandwidthMbps,
          }],
          createdAt: user?.createdAt,
        });
      } else {
        return successResponse({
          userId: null,
          phoneNumber: null,
          status: 'inactive',
          activeSessions: 0,
          sessions: [],
        });
      }
    }

    let user: User | null;

    if (phoneNumber) {
      const formatted = formatPhoneNumber(phoneNumber);
      user = await getItem<User>(USERS_TABLE, { phoneNumber: formatted });
    } else {
      user = await getItem<User>(USERS_TABLE, { userId });
    }

    if (!user) {
      return errorResponse(HTTP_STATUS.NOT_FOUND, 'User not found');
    }

    // Get active sessions for user
    const activeSessions = await getActiveSessionsForUser(user.phoneNumber);

    return successResponse({
      userId: user.userId,
      phoneNumber: user.phoneNumber,
      status: user.status,
      activeSessions: activeSessions.length,
      sessions: activeSessions.map(s => ({
        sessionId: s.sessionId,
        packageName: s.packageName,
        macAddress: s.macAddress,
        timeRemaining: Math.max(0, Math.floor((new Date(s.expiresAt).getTime() - Date.now()) / 1000)),
        expiresAt: s.expiresAt,
      })),
      createdAt: user.createdAt,
    });
  } catch (error: any) {
    logger.error('Status check failed', error);
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Status check failed');
  }
}

/**
 * Handle logout
 */
async function handleLogout(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseBody<{ sessionId: string }>(event.body);

  if (!body || !body.sessionId) {
    return errorResponse(HTTP_STATUS.BAD_REQUEST, 'Session ID required');
  }

  try {
    await terminateSession(body.sessionId);

    return successResponse({ message: 'Logged out successfully' });
  } catch (error: any) {
    logger.error('Logout failed', error);
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Logout failed');
  }
}

/**
 * Create new user
 */
async function createNewUser(phoneNumber: string): Promise<User> {
  const user: User = {
    userId: generateId('user'),
    phoneNumber,
    roles: ['user'],
    createdAt: getCurrentTimestamp(),
    lastLoginAt: getCurrentTimestamp(),
    status: 'active',
  };

  await putItem(USERS_TABLE, user);
  return user;
}

/**
 * Create new session with package
 */
async function createSessionWithPackage(
  user: User,
  macAddress: string,
  ipAddress: string,
  gatewayId: string,
  packageData: Package
): Promise<Session> {
  const durationSeconds = packageData.durationHours * 3600;
  
  const session: Session = {
    sessionId: generateId('session'),
    userId: user.userId,
    phoneNumber: user.phoneNumber,
    packageId: packageData.packageId,
    packageName: packageData.name,
    durationHours: packageData.durationHours,
    bandwidthMbps: packageData.bandwidthMbps,
    macAddress,
    ipAddress,
    gatewayId,
    startTime: getCurrentTimestamp(),
    expiresAt: addSecondsToNow(durationSeconds),
    status: 'active',
    ttl: Math.floor(Date.now() / 1000) + durationSeconds,
  };

  await putItem(SESSIONS_TABLE, session);
  return session;
}

/**
 * Send Change of Authorization to gateway with bandwidth limits
 */
async function sendCoA(session: Session, user: User): Promise<void> {
  const durationSeconds = session.durationHours * 3600;
  
  const coaMessage: CoAMessage = {
    action: 'authorize',
    sessionId: session.sessionId,
    userId: user.userId,
    macAddress: session.macAddress,
    ipAddress: session.ipAddress,
    gatewayId: session.gatewayId,
    bandwidthMbps: session.bandwidthMbps,
    sessionTimeout: durationSeconds,
    timestamp: getCurrentTimestamp(),
  };

  await sendToQueue(COA_QUEUE_URL, coaMessage);
  logger.info('CoA message sent', { sessionId: session.sessionId, bandwidthMbps: session.bandwidthMbps });
}

/**
 * Terminate session
 */
async function terminateSession(sessionId: string): Promise<void> {
  const endTime = getCurrentTimestamp();
  await updateItem(SESSIONS_TABLE, { sessionId }, { status: 'terminated', endTime });
  // Send disconnect CoA minimal message
  await sendToQueue(COA_QUEUE_URL, { action: 'disconnect', sessionId, timestamp: endTime });
}

/**
 * Get active session for device (by MAC address)
 * Uses GSI if available, otherwise scans table
 */
async function getActiveSessionForDevice(macAddress: string): Promise<Session | null> {
  // In production, this would use a GSI on macAddress
  // For now, we'll use a simplified approach
  try {
    const { DynamoDBClient, QueryCommand } = await import('@aws-sdk/client-dynamodb');
    const { unmarshall } = await import('@aws-sdk/util-dynamodb');
    
    const client = new DynamoDBClient({});
    const command = new QueryCommand({
      TableName: SESSIONS_TABLE,
      IndexName: 'MacAddressIndex', // Assumes GSI exists
      KeyConditionExpression: 'macAddress = :mac',
      FilterExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':mac': { S: macAddress },
        ':status': { S: 'active' },
      },
      Limit: 1,
    });
    
    const result = await client.send(command);
    if (result.Items && result.Items.length > 0) {
      return unmarshall(result.Items[0]) as Session;
    }
    return null;
  } catch (error) {
    logger.warn('Error querying by MAC address, GSI may not exist', error);
    return null;
  }
}

/**
 * Get active sessions for user
 */
async function getActiveSessionsForUser(userId: string): Promise<Session[]> {
  try {
    const { DynamoDBClient, QueryCommand } = await import('@aws-sdk/client-dynamodb');
    const { unmarshall } = await import('@aws-sdk/util-dynamodb');
    
    const client = new DynamoDBClient({});
    const command = new QueryCommand({
      TableName: SESSIONS_TABLE,
      IndexName: 'UserIdIndex', // Assumes GSI exists
      KeyConditionExpression: 'userId = :userId',
      FilterExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':userId': { S: userId },
        ':status': { S: 'active' },
      },
    });
    
    const result = await client.send(command);
    if (result.Items) {
      return result.Items.map(item => unmarshall(item) as Session);
    }
    return [];
  } catch (error) {
    logger.warn('Error querying user sessions, GSI may not exist', error);
    return [];
  }
}
