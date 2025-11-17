import { handler } from '../auth/index';
import { APIGatewayProxyEvent } from 'aws-lambda';

jest.mock('../../src/utils/helpers', () => {
  return {
    Logger: class { info(){} error(){} warn(){} },
    parseBody: (b: string | null) => (b ? JSON.parse(b) : null),
    successResponse: (data: any, message?: string) => ({ statusCode: 200, body: JSON.stringify({ success: true, ...(data||{}), message }) }),
    errorResponse: (code: number, error: string, message?: string) => ({ statusCode: code, body: JSON.stringify({ success: false, error, message }) }),
    getItem: jest.fn((_table: string, key: any) => {
      if (key.voucherCode === 'TEST123') {
        return Promise.resolve({ voucherCode: 'TEST123', packageId: 'pkg1', status: 'unused', createdAt: '2025-01-01' });
      }
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
    verifyPassword: () => Promise.resolve(true),
    generateId: (p: string) => `${p}_id_123`,
    getCurrentTimestamp: () => '2025-01-01T00:00:00Z',
    addSecondsToNow: () => '2025-01-01T01:00:00Z',
    isExpired: () => false,
    publishMetric: jest.fn(() => Promise.resolve()),
  };
});

jest.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: class {}, QueryCommand: class {} }));
jest.mock('@aws-sdk/util-dynamodb', () => ({ unmarshall: (x: any) => x }));

function event(partial: Partial<APIGatewayProxyEvent>): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    multiValueHeaders: {},
    path: '/auth/login',
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
  process.env.VOUCHERS_TABLE = 'Vouchers';
  process.env.PACKAGES_TABLE = 'Packages';
  process.env.COA_QUEUE_URL = 'CoAQueue';
});

// Login with missing phone number
it('returns 400 for missing phone number', async () => {
  const res = await handler(event({ body: JSON.stringify({ macAddress: 'AA:BB', ipAddress: '1.1.1.1', gatewayId: 'gw1' }) }));
  expect(res.statusCode).toBe(400);
});

// Login with valid phone but no active session -> expects 403 Payment required
it('returns 403 when no active session exists', async () => {
  const res = await handler(event({ body: JSON.stringify({ phoneNumber: '0712345678', macAddress: 'AA:BB', ipAddress: '1.1.1.1', gatewayId: 'gw1' }) }));
  expect(res.statusCode).toBe(403);
  const body = JSON.parse(res.body);
  expect(body.error).toMatch(/No active package/);
});

// Voucher redemption success path
it('redeems voucher successfully', async () => {
  const voucherEvent = event({ path: '/auth/voucher', body: JSON.stringify({ voucherCode: 'TEST123', macAddress: 'AA:BB', ipAddress: '1.1.1.1', gatewayId: 'gw1', phoneNumber: '0712345678' }) });
  const res = await handler(voucherEvent);
  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.body);
  expect(body.sessionId).toBeDefined();
  expect(body.bandwidthMbps).toBe(5);
  expect(body.durationHours).toBe(1);
});
