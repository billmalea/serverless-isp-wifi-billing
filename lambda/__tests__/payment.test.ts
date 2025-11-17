import { handler } from '../payment/index';
import { APIGatewayProxyEvent } from 'aws-lambda';

jest.mock('../../src/utils/helpers', () => {
  return {
    Logger: class { info(){} error(){} warn(){} },
    parseBody: (b: string | null) => (b ? JSON.parse(b) : null),
    successResponse: (data: any, message?: string) => ({ statusCode: 200, body: JSON.stringify({ success: true, ...(data||{}), message }) }),
    errorResponse: (code: number, error: string, message?: string) => ({ statusCode: code, body: JSON.stringify({ success: false, error, message }) }),
    getItem: jest.fn((_table: string, key: any) => {
      if (key.packageId === 'pkg1') {
        return Promise.resolve({ packageId: 'pkg1', name: '1 Hour', description: '', durationHours: 1, bandwidthMbps: 5, priceKES: 20, status: 'active', createdBy: 'admin', createdAt: '2025-01-01', updatedAt: '2025-01-01' });
      }
      return Promise.resolve(null);
    }),
    putItem: jest.fn(() => Promise.resolve()),
    updateItem: jest.fn(() => Promise.resolve()),
    sendToQueue: jest.fn(() => Promise.resolve()),
    formatPhoneNumber: (p: string) => p,
    isValidKenyanPhone: () => true,
    generateId: (p: string) => `${p}_id_123`,
    getCurrentTimestamp: () => '2025-01-01T00:00:00Z',
    addSecondsToNow: () => '2025-01-01T01:00:00Z',
    publishMetric: jest.fn(() => Promise.resolve()),
  };
});

jest.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: class {}, QueryCommand: class {} }));
jest.mock('@aws-sdk/util-dynamodb', () => ({ unmarshall: (x: any) => x }));

jest.mock('axios', () => ({
  get: jest.fn(() => Promise.resolve({ data: { access_token: 'token123' } })),
  post: jest.fn(() => Promise.resolve({ data: { ResponseCode: '0', MerchantRequestID: 'MRID', CheckoutRequestID: 'CRID', CustomerMessage: 'Complete payment' } })),
}));

function event(partial: Partial<APIGatewayProxyEvent>): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    multiValueHeaders: {},
    path: '/payment/initiate',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: '/',
    requestContext: {} as any,
    ...partial,
  };
}

beforeAll(() => {
  process.env.USERS_TABLE = 'Users';
  process.env.SESSIONS_TABLE = 'Sessions';
  process.env.TRANSACTIONS_TABLE = 'Transactions';
  process.env.PACKAGES_TABLE = 'Packages';
  process.env.COA_QUEUE_URL = 'CoAQueue';
  process.env.PAYMENT_CALLBACK_QUEUE_URL = 'PaymentCbQueue';
  process.env.MPESA_CONSUMER_KEY = 'ck';
  process.env.MPESA_CONSUMER_SECRET = 'cs';
  process.env.MPESA_SHORTCODE = '123456';
  process.env.MPESA_PASSKEY = 'passkey';
  process.env.MPESA_CALLBACK_URL = 'https://callback';
});

it('returns 400 if missing phoneNumber', async () => {
  const res = await handler(event({ body: JSON.stringify({ packageId: 'pkg1', macAddress: 'AA:BB' }) }));
  expect(res.statusCode).toBe(400);
});

it('initiates payment successfully', async () => {
  const res = await handler(event({ body: JSON.stringify({ phoneNumber: '0712345678', packageId: 'pkg1', macAddress: 'AA:BB', ipAddress: '1.1.1.1', gatewayId: 'gw1' }) }));
  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.body);
  expect(body.transactionId).toBeDefined();
  expect(body.package).toBe('1 Hour');
});
