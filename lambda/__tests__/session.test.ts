import { handler } from '../session/index';
import { APIGatewayProxyEvent } from 'aws-lambda';

jest.mock('../../src/utils/helpers', () => {
  return {
    Logger: class { info(){} error(){} warn(){} },
    parseBody: (b: string | null) => (b ? JSON.parse(b) : null),
    successResponse: (data: any, message?: string) => ({ statusCode: 200, body: JSON.stringify({ success: true, ...(data||{}), message }) }),
    errorResponse: (code: number, error: string, message?: string) => ({ statusCode: code, body: JSON.stringify({ success: false, error, message }) }),
    getItem: jest.fn(() => Promise.resolve({ userId: 'user_1', phoneNumber: '0712345678', createdAt: '2025', lastLoginAt: '2025', status: 'active' })),
    updateItem: jest.fn(() => Promise.resolve()),
    putItem: jest.fn(() => Promise.resolve()),
    getCurrentTimestamp: () => '2025-01-01T00:00:00Z',
    verifyJWT: jest.fn((authHeader?: string, _requiredRole?: string) => {
      if (authHeader === 'Bearer admin-token') {
        return { valid: true, payload: { userId: 'admin_123', roles: ['admin'] }, userId: 'admin_123' };
      }
      return { valid: false };
    }),
  };
});

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      send: jest.fn(() => Promise.resolve({ Items: [] }))
    }))
  },
  ScanCommand: jest.fn(),
}));

function event(partial: Partial<APIGatewayProxyEvent>): APIGatewayProxyEvent {
  return {
    body: null,
    headers: { Authorization: 'Bearer admin-token' },
    httpMethod: 'GET',
    isBase64Encoded: false,
    multiValueHeaders: {},
    path: '/api/sessions',
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
  process.env.SESSIONS_TABLE = 'Sessions';
  process.env.USERS_TABLE = 'Users';
});

it('lists sessions with admin token', async () => {
  const res = await handler(event({}));
  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.body);
  expect(Array.isArray(body.sessions)).toBe(true);
});

it('terminates session with admin token', async () => {
  const terminateEvent = event({ path: '/api/sessions/terminate', httpMethod: 'POST', body: JSON.stringify({ sessionId: 'session_123' }) });
  const res = await handler(terminateEvent);
  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.body);
  expect(body.sessionId).toBe('session_123');
});

it('rejects requests without admin token', async () => {
  const noAuthEvent = event({ headers: {} });
  const res = await handler(noAuthEvent);
  expect(res.statusCode).toBe(403);
});
