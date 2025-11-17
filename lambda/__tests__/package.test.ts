import { handler } from '../package/index';
import { APIGatewayProxyEvent } from 'aws-lambda';

// Mock AWS SDK DynamoDB document client used inside the lambda
jest.mock('@aws-sdk/lib-dynamodb', () => {
  return {
    DynamoDBDocumentClient: { from: jest.fn(() => ({ send: jest.fn().mockResolvedValue({ Items: [] }) })) },
    PutCommand: class {},
    GetCommand: class {},
    UpdateCommand: class {},
    QueryCommand: class {},
    ScanCommand: class {},
  };
});

// Mock JWT verification helper
jest.mock('../../src/utils/helpers', () => {
  const actual = jest.requireActual('../../src/utils/helpers');
  return {
    ...actual,
    verifyJWT: jest.fn((authHeader?: string, _requiredRole?: string) => {
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { valid: false };
      }
      const token = authHeader.substring(7);
      if (token === 'admin-token') {
        return { valid: true, payload: { userId: 'admin_123', roles: ['admin'] }, userId: 'admin_123' };
      }
      return { valid: false };
    }),
  };
});

function createEvent(partial: Partial<APIGatewayProxyEvent>): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    multiValueHeaders: {},
    path: '/',
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
  process.env.PACKAGES_TABLE = 'PackagesTableTest';
  process.env.AWS_REGION = 'us-east-1';
});

test('Public endpoint /api/packages returns 200 with packages array', async () => {
  const event = createEvent({ path: '/api/packages', httpMethod: 'GET' });
  const result = await handler(event);
  expect(result.statusCode).toBe(200);
  const body = JSON.parse(result.body);
  expect(body.success).toBe(true);
  expect(Array.isArray(body.packages)).toBe(true);
});

test('Admin endpoint without Authorization returns 403', async () => {
  const event = createEvent({ path: '/api/admin/packages', httpMethod: 'GET' });
  const result = await handler(event);
  expect(result.statusCode).toBe(403);
});

test('Admin endpoint with valid admin token returns 200', async () => {
  const event = createEvent({ path: '/api/admin/packages', httpMethod: 'GET', headers: { Authorization: 'Bearer admin-token' } });
  const result = await handler(event);
  expect(result.statusCode).toBe(200);
  const body = JSON.parse(result.body);
  expect(body.success).toBe(true);
  expect(Array.isArray(body.packages)).toBe(true);
});
