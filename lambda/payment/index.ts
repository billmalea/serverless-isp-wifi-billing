import { APIGatewayProxyEvent, APIGatewayProxyResult} from 'aws-lambda';
import axios from 'axios';
import {
  Transaction,
  User,
  Package,
  Session,
  CoAMessage,
  MPesaSTKPushRequest,
  MPesaSTKPushResponse,
  MPesaCallbackPayload,
  PaymentInitiateRequest,
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
  generateId,
  getCurrentTimestamp,
  addSecondsToNow,
  publishMetric,
} from '../../src/utils/helpers';

const logger = new Logger('PaymentLambda');

const USERS_TABLE = process.env.USERS_TABLE!;
const SESSIONS_TABLE = process.env.SESSIONS_TABLE!;
const TRANSACTIONS_TABLE = process.env.TRANSACTIONS_TABLE!;
const PACKAGES_TABLE = process.env.PACKAGES_TABLE!;
const COA_QUEUE_URL = process.env.COA_QUEUE_URL!;
const PAYMENT_CALLBACK_QUEUE_URL = process.env.PAYMENT_CALLBACK_QUEUE_URL!;

// M-Pesa Configuration
const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY!;
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET!;
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE!;
const MPESA_PASSKEY = process.env.MPESA_PASSKEY!;
const MPESA_ENVIRONMENT = process.env.MPESA_ENVIRONMENT || 'sandbox';
const MPESA_CALLBACK_URL = process.env.MPESA_CALLBACK_URL!;

const MPESA_BASE_URL =
  MPESA_ENVIRONMENT === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

/**
 * Main Lambda handler for payments
 */
export async function handler(
  event: APIGatewayProxyEvent,
  ): Promise<APIGatewayProxyResult> {
  logger.info('Payment request received', { path: event.path, method: event.httpMethod });

  try {
    const path = event.path;
    const method = event.httpMethod;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return successResponse({});
    }

    // Route to appropriate handler
    if (path.includes('/payment/initiate') && method === 'POST') {
      return await handlePaymentInitiate(event);
    } else if (path.includes('/payment/callback') && method === 'POST') {
      return await handlePaymentCallback(event);
    } else if (path.includes('/payment/status') && method === 'GET') {
      return await handlePaymentStatus(event);
    } else if (path.includes('/payment/packages') && method === 'GET') {
      return await handleGetPackages();
    } else {
      return errorResponse(HTTP_STATUS.NOT_FOUND, 'Endpoint not found');
    }
  } catch (error: any) {
    logger.error('Unhandled error in payment processing', error);
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Internal server error');
  }
}

/**
 * Initiate M-Pesa STK Push payment
 */
async function handlePaymentInitiate(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = parseBody<PaymentInitiateRequest>(event.body);

  if (!body || !body.phoneNumber || !body.packageId) {
    return errorResponse(HTTP_STATUS.BAD_REQUEST, 'Phone number and package ID required');
  }

  try {
    const phoneNumber = formatPhoneNumber(body.phoneNumber);

    if (!isValidKenyanPhone(phoneNumber)) {
      return errorResponse(HTTP_STATUS.BAD_REQUEST, 'Invalid Kenyan phone number');
    }

    // Validate MAC address provided
    if (!body.macAddress) {
      return errorResponse(HTTP_STATUS.BAD_REQUEST, 'MAC address required for device binding');
    }

    // Check if device already has active session
    const existingSession = await getActiveSessionForDevice(body.macAddress);
    if (existingSession) {
      return errorResponse(HTTP_STATUS.FORBIDDEN, 'Device already has an active session. Please wait for it to expire.');
    }

    // Get package details from database
    const packageData = await getItem<Package>(PACKAGES_TABLE, { packageId: body.packageId });
    if (!packageData || packageData.status !== 'active') {
      return errorResponse(HTTP_STATUS.BAD_REQUEST, 'Package not available');
    }

    // Get or create user
    let user = await getItem<User>(USERS_TABLE, { phoneNumber });
    if (!user) {
      user = {
        userId: generateId('user'),
        phoneNumber,
        createdAt: getCurrentTimestamp(),
        lastLoginAt: getCurrentTimestamp(),
        status: 'active',
        roles: ['user'],
      };
      await putItem(USERS_TABLE, user);
    }

    // Create pending transaction with device binding
    const transactionId = generateId('txn');
    const transaction: Transaction = {
      transactionId,
      userId: user.userId,
      phoneNumber,
      amount: packageData.priceKES,
      packageId: body.packageId,
      packageName: packageData.name,
      durationHours: packageData.durationHours,
      bandwidthMbps: packageData.bandwidthMbps,
      macAddress: body.macAddress,
      status: 'pending',
      timestamp: getCurrentTimestamp(),
      metadata: {
        ipAddress: body.ipAddress,
        gatewayId: body.gatewayId,
      },
    };

    await putItem(TRANSACTIONS_TABLE, transaction);

    // Get M-Pesa access token
    const accessToken = await getMPesaAccessToken();

    // Initiate STK Push
    const stkResponse = await initiateSTKPush(
      accessToken,
      phoneNumber,
      packageData.priceKES,
      transactionId,
      packageData.name
    );

    // Update transaction with M-Pesa details
    await updateItem(TRANSACTIONS_TABLE, { transactionId }, {
      mpesaTransactionId: stkResponse.CheckoutRequestID,
      metadata: {
        ...transaction.metadata,
        merchantRequestID: stkResponse.MerchantRequestID,
        checkoutRequestID: stkResponse.CheckoutRequestID,
      },
    });

    logger.info('M-Pesa STK Push initiated', {
      transactionId,
      phoneNumber,
      amount: packageData.priceKES,
    });

    return successResponse(
      {
        transactionId,
        checkoutRequestID: stkResponse.CheckoutRequestID,
        message: stkResponse.CustomerMessage,
        package: packageData.name,
        amount: packageData.priceKES,
      },
      'Payment initiated. Please check your phone to complete the transaction.'
    );
  } catch (error: any) {
    logger.error('Payment initiation failed', error);
    return errorResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      'Payment initiation failed',
      error.message
    );
  }
}

/**
 * Handle M-Pesa callback webhook
 */
async function handlePaymentCallback(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = parseBody<MPesaCallbackPayload>(event.body);

  if (!body) {
    return errorResponse(HTTP_STATUS.BAD_REQUEST, 'Invalid callback payload');
  }

  try {
    logger.info('M-Pesa callback received', { body });

    // Queue the callback for processing (decouple from webhook response time)
    await sendToQueue(PAYMENT_CALLBACK_QUEUE_URL, body);

    // Process callback immediately (can also be done by separate Lambda)
    await processPaymentCallback(body);

    // Always return success to M-Pesa
    return successResponse({ message: 'Callback received' });
  } catch (error: any) {
    logger.error('Callback processing failed', error);
    // Still return success to M-Pesa to avoid retries
    return successResponse({ message: 'Callback queued for processing' });
  }
}

/**
 * Process M-Pesa payment callback
 */
async function processPaymentCallback(payload: MPesaCallbackPayload): Promise<void> {
  const callback = payload.Body.stkCallback;
  const checkoutRequestID = callback.CheckoutRequestID;
  const resultCode = callback.ResultCode;

  logger.info('Processing payment callback', { checkoutRequestID, resultCode });

  // Find transaction by CheckoutRequestID
  // Note: In production, you'd query by GSI on mpesaTransactionId
  // For simplicity, we'll use the AccountReference which is our transactionId
  const accountReference = callback.CallbackMetadata?.Item.find(
    (item) => item.Name === 'AccountReference'
  )?.Value as string;

  if (!accountReference) {
    logger.error('No account reference in callback');
    return;
  }

  const transaction = await getItem<Transaction>(TRANSACTIONS_TABLE, {
    transactionId: accountReference,
  });

  if (!transaction) {
    logger.error('Transaction not found', { accountReference });
    return;
  }

  if (resultCode === 0) {
    // Payment successful
    const mpesaReceiptNumber = callback.CallbackMetadata?.Item.find(
      (item) => item.Name === 'MpesaReceiptNumber'
    )?.Value as string;

    const amount = callback.CallbackMetadata?.Item.find((item) => item.Name === 'Amount')
      ?.Value as number;

        // Update transaction
    await updateItem(TRANSACTIONS_TABLE, { transactionId: transaction.transactionId }, {
      status: 'completed',
      mpesaReceiptNumber,
      completedAt: getCurrentTimestamp(),
    });

    // Get package details from database
    const packageData = await getItem<Package>(PACKAGES_TABLE, { packageId: transaction.packageId });

    if (!packageData) {
      logger.error('Package not found for completed transaction', { packageId: transaction.packageId });
      return;
    }

    // Get user
    const user = await getItem<User>(USERS_TABLE, { phoneNumber: transaction.phoneNumber });
    if (user) {
      // Create time-based session
      const session = await createSessionWithPackage(
        user,
        transaction.macAddress,
        transaction.metadata?.ipAddress,
        transaction.metadata?.gatewayId,
        packageData
      );

      logger.info('Session created after payment', {
        userId: user.userId,
        sessionId: session.sessionId,
        packageName: packageData.name,
        durationHours: packageData.durationHours,
        bandwidthMbps: packageData.bandwidthMbps,
        amount,
      });

      // Publish metrics
      await publishMetric('SessionCreated', 1);
      await publishMetric('PaymentSuccess', 1);
      await publishMetric('RevenueKES', amount);

      // Send CoA to gateway to authorize session
      await sendCoAForSession(session);
    }
  } else {
    // Payment failed
    await updateItem(TRANSACTIONS_TABLE, { transactionId: transaction.transactionId }, {
      status: 'failed',
      completedAt: getCurrentTimestamp(),
      metadata: {
        ...transaction.metadata,
        resultDesc: callback.ResultDesc,
      },
    });

    // Publish metric
    await publishMetric('PaymentFailed', 1);

    logger.info('Payment failed', {
      transactionId: transaction.transactionId,
      resultCode,
      resultDesc: callback.ResultDesc,
    });
  }
}

/**
 * Get payment status
 */
async function handlePaymentStatus(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const transactionId = event.pathParameters?.transactionId || event.queryStringParameters?.transactionId;

  if (!transactionId) {
    return errorResponse(HTTP_STATUS.BAD_REQUEST, 'Transaction ID required');
  }

  try {
    const transaction = await getItem<Transaction>(TRANSACTIONS_TABLE, { transactionId });

    if (!transaction) {
      return errorResponse(HTTP_STATUS.NOT_FOUND, 'Transaction not found');
    }

    return successResponse({
      transactionId: transaction.transactionId,
      status: transaction.status,
      amount: transaction.amount,
      packageId: transaction.packageId,
      phoneNumber: transaction.phoneNumber,
      timestamp: transaction.timestamp,
      completedAt: transaction.completedAt,
      mpesaReceiptNumber: transaction.mpesaReceiptNumber,
    });
  } catch (error: any) {
    logger.error('Status check failed', error);
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Status check failed');
  }
}

/**
 * Get available packages from database
 */
async function handleGetPackages(): Promise<APIGatewayProxyResult> {
  try {
    // Query packages with status = 'active', sorted by price
    const { DynamoDBClient, QueryCommand } = await import('@aws-sdk/client-dynamodb');
    const { unmarshall } = await import('@aws-sdk/util-dynamodb');
    
    const client = new DynamoDBClient({});
    const command = new QueryCommand({
      TableName: PACKAGES_TABLE,
      IndexName: 'StatusPriceIndex',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': { S: 'active' },
      },
    });
    
    const result = await client.send(command);
    const packages = result.Items ? result.Items.map(item => unmarshall(item)) : [];
    
    return successResponse({
      packages,
      count: packages.length,
    });
  } catch (error: any) {
    logger.error('Failed to fetch packages', error);
    return errorResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to fetch packages');
  }
}

/**
 * Get M-Pesa access token
 */
async function getMPesaAccessToken(): Promise<string> {
  const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');

  try {
    const response = await axios.get(`${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    return response.data.access_token;
  } catch (error: any) {
    logger.error('Failed to get M-Pesa access token', error);
    throw new Error('Failed to authenticate with M-Pesa');
  }
}

/**
 * Initiate STK Push
 */
async function initiateSTKPush(
  accessToken: string,
  phoneNumber: string,
  amount: number,
  accountReference: string,
  description: string
): Promise<MPesaSTKPushResponse> {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T.]/g, '')
    .slice(0, 14);
  const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');

  const payload: MPesaSTKPushRequest = {
    BusinessShortCode: MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: amount.toString(),
    PartyA: phoneNumber,
    PartyB: MPESA_SHORTCODE,
    PhoneNumber: phoneNumber,
    CallBackURL: MPESA_CALLBACK_URL,
    AccountReference: accountReference,
    TransactionDesc: `WiFi Package: ${description}`,
  };

  try {
    const response = await axios.post(
      `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.ResponseCode !== '0') {
      throw new Error(response.data.ResponseDescription || 'STK Push failed');
    }

    return response.data;
  } catch (error: any) {
    logger.error('STK Push failed', error.response?.data || error);
    throw new Error(error.response?.data?.errorMessage || 'Failed to initiate payment');
  }
}

/**
 * Create session with package after payment
 */
async function createSessionWithPackage(
  user: User,
  macAddress: string,
  ipAddress: string,
  gatewayId: string,
  packageData: Package
): Promise<Session> {
  const durationSeconds = packageData.durationHours * 3600;
  const expiresAt = addSecondsToNow(durationSeconds);
  const ttl = Math.floor(new Date(expiresAt).getTime() / 1000);

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
    expiresAt,
    status: 'active',
    ttl,
  };

  await putItem(SESSIONS_TABLE, session);
  return session;
}

/**
 * Send CoA to gateway after session creation
 */
async function sendCoAForSession(session: Session): Promise<void> {
  const durationSeconds = session.durationHours * 3600;
  
  const coaMessage: CoAMessage = {
    action: 'authorize',
    sessionId: session.sessionId,
    userId: session.userId,
    macAddress: session.macAddress,
    ipAddress: session.ipAddress,
    gatewayId: session.gatewayId,
    bandwidthMbps: session.bandwidthMbps,
    sessionTimeout: durationSeconds,
    timestamp: getCurrentTimestamp(),
  };

  await sendToQueue(COA_QUEUE_URL, coaMessage);
  logger.info('CoA message sent for session', { 
    sessionId: session.sessionId, 
    bandwidthMbps: session.bandwidthMbps,
    durationHours: session.durationHours,
  });
}

/**
 * Get active session for device (by MAC address)
 */
async function getActiveSessionForDevice(macAddress: string): Promise<Session | null> {
  try {
    const { DynamoDBClient, QueryCommand } = await import('@aws-sdk/client-dynamodb');
    const { unmarshall } = await import('@aws-sdk/util-dynamodb');
    
    const client = new DynamoDBClient({});
    const command = new QueryCommand({
      TableName: SESSIONS_TABLE,
      IndexName: 'MacAddressIndex',
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
    logger.warn('Error querying by MAC address', error);
    return null;
  }
}
