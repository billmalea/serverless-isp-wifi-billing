# Testing Guide

Comprehensive testing guide for the WiFi billing system covering unit tests, integration tests, and end-to-end testing.

## Table of Contents

1. [Testing Overview](#testing-overview)
2. [Unit Testing](#unit-testing)
3. [Integration Testing](#integration-testing)
4. [End-to-End Testing](#end-to-end-testing)
5. [M-Pesa Sandbox Testing](#m-pesa-sandbox-testing)
6. [Load Testing](#load-testing)
7. [Security Testing](#security-testing)

---

## Testing Overview

### Test Stack

- **Framework**: Jest
- **Assertions**: Jest matchers
- **Mocking**: AWS SDK mocks
- **Coverage**: Istanbul (built into Jest)
- **E2E**: Postman/Newman

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- lambda/auth/index.test.ts

# Watch mode
npm run test:watch

# Integration tests only
npm run test:integration
```

---

## Unit Testing

### Lambda Function Tests

#### Auth Lambda Tests

```typescript
// lambda/auth/__tests__/index.test.ts
import { handler } from '../index';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

const dynamoMock = mockClient(DynamoDBClient);

describe('AuthLambda', () => {
  beforeEach(() => {
    dynamoMock.reset();
  });

  describe('Login', () => {
    it('should authenticate valid user', async () => {
      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          userId: { S: 'user_123' },
          phoneNumber: { S: '254712345678' },
          passwordHash: { S: '$2b$10$...' }
        }
      });

      const event = {
        httpMethod: 'POST',
        path: '/api/auth/login',
        body: JSON.stringify({
          phoneNumber: '254712345678',
          password: 'correctpassword'
        })
      };

      const result = await handler(event, {} as any);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.token).toBeDefined();
    });

    it('should reject invalid password', async () => {
      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          userId: { S: 'user_123' },
          phoneNumber: { S: '254712345678' },
          passwordHash: { S: '$2b$10$...' }
        }
      });

      const event = {
        httpMethod: 'POST',
        path: '/api/auth/login',
        body: JSON.stringify({
          phoneNumber: '254712345678',
          password: 'wrongpassword'
        })
      };

      const result = await handler(event, {} as any);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(401);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Invalid credentials');
    });

    it('should reject non-existent user', async () => {
      dynamoMock.on(GetItemCommand).resolves({});

      const event = {
        httpMethod: 'POST',
        path: '/api/auth/login',
        body: JSON.stringify({
          phoneNumber: '254712345678',
          password: 'password'
        })
      };

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(404);
    });
  });

  describe('Voucher Redemption', () => {
    it('should redeem valid unused voucher', async () => {
      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          voucherCode: { S: 'WIFI-ABC123' },
          status: { S: 'unused' },
          package: { S: 'standard' }
        }
      });

      dynamoMock.on(UpdateItemCommand).resolves({});

      const event = {
        httpMethod: 'POST',
        path: '/api/auth/voucher',
        body: JSON.stringify({
          voucherCode: 'WIFI-ABC123',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          ipAddress: '192.168.1.100'
        })
      };

      const result = await handler(event, {} as any);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.token).toBeDefined();
      expect(body.session).toBeDefined();
    });

    it('should reject already used voucher', async () => {
      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          voucherCode: { S: 'WIFI-ABC123' },
          status: { S: 'used' }
        }
      });

      const event = {
        httpMethod: 'POST',
        path: '/api/auth/voucher',
        body: JSON.stringify({
          voucherCode: 'WIFI-ABC123'
        })
      };

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(400);
    });
  });
});
```

#### Payment Lambda Tests

```typescript
// lambda/payment/__tests__/index.test.ts
import { handler } from '../index';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('PaymentLambda', () => {
  describe('Initiate STK Push (Time-Based)', () => {
    it('should initiate payment with time-based package', async () => {
      // Mock package fetch from database
      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          packageId: { S: 'pkg_standard_3h5mbps' },
          name: { S: 'Standard' },
          durationHours: { N: '3' },
          bandwidthMbps: { N: '5' },
          priceKES: { N: '50' },
          status: { S: 'active' }
        }
      });

      // Mock device check - no active session
      dynamoMock.on(QueryCommand).resolves({ Items: [] });

      mockedAxios.get.mockResolvedValue({
        data: { access_token: 'mock_token' }
      });

      mockedAxios.post.mockResolvedValue({
        data: {
          CheckoutRequestID: 'ws_CO_123',
          ResponseCode: '0',
          ResponseDescription: 'Success'
        }
      });

      const event = {
        httpMethod: 'POST',
        path: '/api/payment/initiate',
        headers: {
          Authorization: 'Bearer valid_token'
        },
        body: JSON.stringify({
          phoneNumber: '254712345678',
          packageId: 'pkg_standard_3h5mbps',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          ipAddress: '192.168.1.100',
          gatewayId: 'gateway_main'
        })
      };

      const result = await handler(event, {} as any);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.checkoutRequestId).toBeDefined();
    });

    it('should reject payment if device has active session', async () => {
      // Mock device check - active session exists
      dynamoMock.on(QueryCommand).resolves({
        Items: [{
          sessionId: { S: 'session_xyz' },
          macAddress: { S: 'AA:BB:CC:DD:EE:FF' },
          status: { S: 'active' },
          expiresAt: { S: new Date(Date.now() + 3600000).toISOString() }
        }]
      });

      const event = {
        httpMethod: 'POST',
        path: '/api/payment/initiate',
        body: JSON.stringify({
          phoneNumber: '254712345678',
          packageId: 'pkg_standard_3h5mbps',
          macAddress: 'AA:BB:CC:DD:EE:FF'
        })
      };

      const result = await handler(event, {} as any);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(403);
      expect(body.error).toContain('active session');
    });

    it('should handle M-Pesa API errors', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { access_token: 'mock_token' }
      });

      mockedAxios.post.mockRejectedValue({
        response: {
          data: {
            errorCode: '400.002.02',
            errorMessage: 'Invalid phone number'
          }
        }
      });

      const event = {
        httpMethod: 'POST',
        path: '/api/payment/initiate',
        body: JSON.stringify({
          phoneNumber: 'invalid',
          package: 'standard'
        })
      };

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(500);
    });
  });

  describe('Callback Handler (Creates Time-Based Session)', () => {
    it('should create session after successful payment', async () => {
      // Mock transaction lookup
      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          transactionId: { S: 'tx_123' },
          packageId: { S: 'pkg_standard_3h5mbps' },
          macAddress: { S: 'AA:BB:CC:DD:EE:FF' },
          phoneNumber: { S: '254712345678' }
        }
      });

      // Mock package lookup
      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          packageId: { S: 'pkg_standard_3h5mbps' },
          name: { S: 'Standard' },
          durationHours: { N: '3' },
          bandwidthMbps: { N: '5' },
          priceKES: { N: '50' }
        }
      });

      // Mock session creation
      dynamoMock.on(PutItemCommand).resolves({});

      const event = {
        httpMethod: 'POST',
        path: '/api/payment/callback',
        body: JSON.stringify({
          Body: {
            stkCallback: {
              CheckoutRequestID: 'ws_CO_123',
              ResultCode: 0,
              ResultDesc: 'Success',
              CallbackMetadata: {
                Item: [
                  { Name: 'Amount', Value: 50 },
                  { Name: 'MpesaReceiptNumber', Value: 'RKL123' },
                  { Name: 'PhoneNumber', Value: 254712345678 }
                ]
              }
            }
          }
        })
      };

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(200);
      // Verify session was created with correct time/bandwidth
      expect(dynamoMock.calls()).toContainEqual(
        expect.objectContaining({
          input: expect.objectContaining({
            Item: expect.objectContaining({
              durationHours: { N: '3' },
              bandwidthMbps: { N: '5' }
            })
          })
        })
      );
    });
  });
});
```

### Package Lambda Tests

```typescript
// lambda/package/__tests__/index.test.ts
import { handler } from '../index';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

const dynamoMock = mockClient(DynamoDBClient);

describe('PackageLambda', () => {
  beforeEach(() => {
    dynamoMock.reset();
  });

  describe('List Active Packages', () => {
    it('should return all active packages', async () => {
      dynamoMock.on(QueryCommand).resolves({
        Items: [
          {
            packageId: { S: 'pkg_standard_3h5mbps' },
            name: { S: 'Standard' },
            durationHours: { N: '3' },
            bandwidthMbps: { N: '5' },
            priceKES: { N: '50' },
            status: { S: 'active' }
          }
        ]
      });

      const event = {
        httpMethod: 'GET',
        path: '/api/packages'
      };

      const result = await handler(event, {} as any);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.packages).toHaveLength(1);
      expect(body.packages[0].status).toBe('active');
    });
  });

  describe('Create Package (Admin)', () => {
    it('should create valid package', async () => {
      dynamoMock.on(PutItemCommand).resolves({});

      const event = {
        httpMethod: 'POST',
        path: '/api/admin/packages',
        headers: { Authorization: 'Bearer admin_token' },
        body: JSON.stringify({
          name: 'Super Premium',
          description: 'Ultra-fast 24-hour access',
          durationHours: 24,
          bandwidthMbps: 20,
          priceKES: 200
        })
      };

      const result = await handler(event, {} as any);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(201);
      expect(body.package.packageId).toContain('pkg_');
      expect(body.package.status).toBe('active');
    });

    it('should reject invalid duration', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/api/admin/packages',
        body: JSON.stringify({
          name: 'Invalid',
          durationHours: 200, // Max is 168
          bandwidthMbps: 10,
          priceKES: 100
        })
      };

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('duration');
    });

    it('should reject invalid bandwidth', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/api/admin/packages',
        body: JSON.stringify({
          name: 'Invalid',
          durationHours: 24,
          bandwidthMbps: 150, // Max is 100
          priceKES: 100
        })
      };

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('bandwidth');
    });
  });

  describe('Update Package (Admin)', () => {
    it('should update package price', async () => {
      dynamoMock.on(UpdateItemCommand).resolves({
        Attributes: {
          packageId: { S: 'pkg_standard_3h5mbps' },
          priceKES: { N: '60' }
        }
      });

      const event = {
        httpMethod: 'PUT',
        path: '/api/admin/packages/pkg_standard_3h5mbps',
        body: JSON.stringify({ priceKES: 60 })
      };

      const result = await handler(event, {} as any);

      expect(result.statusCode).toBe(200);
    });
  });

  describe('Deactivate Package (Admin)', () => {
    it('should soft-delete package', async () => {
      dynamoMock.on(UpdateItemCommand).resolves({});

      const event = {
        httpMethod: 'DELETE',
        path: '/api/admin/packages/pkg_old_package'
      };

      const result = await handler(event, {} as any);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.message).toContain('deactivated');
    });
  });
});
```

### Utility Function Tests

```typescript
// src/utils/__tests__/helpers.test.ts
import { formatPhoneNumber, validateVoucher, calculateExpiry } from '../helpers';

describe('Helper Functions', () => {
  describe('formatPhoneNumber', () => {
    it('should format phone with leading zero', () => {
      expect(formatPhoneNumber('0712345678')).toBe('254712345678');
    });

    it('should remove spaces and dashes', () => {
      expect(formatPhoneNumber('0712-345-678')).toBe('254712345678');
    });

    it('should handle already formatted numbers', () => {
      expect(formatPhoneNumber('254712345678')).toBe('254712345678');
    });

    it('should remove plus sign', () => {
      expect(formatPhoneNumber('+254712345678')).toBe('254712345678');
    });
  });

  describe('validateVoucher', () => {
    it('should validate correct voucher format', () => {
      expect(validateVoucher('WIFI-ABC123-XYZ')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(validateVoucher('invalid')).toBe(false);
      expect(validateVoucher('')).toBe(false);
      expect(validateVoucher('WIFI-123')).toBe(false);
    });
  });

  describe('calculateExpiry', () => {
    it('should calculate correct expiry time', () => {
      const now = new Date('2025-11-17T12:00:00Z');
      const expiry = calculateExpiry(now, 24);
      
      expect(expiry.toISOString()).toBe('2025-11-18T12:00:00.000Z');
    });
  });
});
```

### Test Coverage

Aim for:
- **Unit Tests**: 80%+ coverage
- **Critical Paths**: 100% coverage (payment, auth)
- **Edge Cases**: All error scenarios covered

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/lcov-report/index.html
```

---

## Integration Testing

### DynamoDB Integration

```typescript
// tests/integration/dynamodb.test.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

describe('DynamoDB Integration', () => {
  let docClient: DynamoDBDocumentClient;

  beforeAll(() => {
    const client = new DynamoDBClient({
      endpoint: 'http://localhost:8000',  // DynamoDB Local
      region: 'us-east-1'
    });
    docClient = DynamoDBDocumentClient.from(client);
  });

  it('should create and retrieve user', async () => {
    const user = {
      userId: 'test_user_123',
      phoneNumber: '254712345678',
      balance: { data: 1073741824, time: 86400 }
    };

    await docClient.send(new PutCommand({
      TableName: 'UsersTable',
      Item: user
    }));

    const result = await docClient.send(new GetCommand({
      TableName: 'UsersTable',
      Key: { userId: 'test_user_123' }
    }));

    expect(result.Item).toMatchObject(user);
  });
});
```

### API Gateway Integration

```typescript
// tests/integration/api.test.ts
import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3000';

describe('API Integration', () => {
  let authToken: string;

  it('should login successfully', async () => {
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      phoneNumber: '254712345678',
      password: 'testpassword'
    });

    expect(response.status).toBe(200);
    expect(response.data.token).toBeDefined();
    authToken = response.data.token;
  });

  it('should access protected endpoint with token', async () => {
    const response = await axios.post(
      `${API_URL}/api/session/create`,
      {
        macAddress: 'AA:BB:CC:DD:EE:FF',
        ipAddress: '192.168.1.100'
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    expect(response.status).toBe(200);
  });
});
```

---

## End-to-End Testing

### Postman Collection

Create comprehensive E2E tests in Postman:

```json
{
  "info": {
    "name": "WiFi Billing E2E Tests",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "1. User Login",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "pm.test('Status is 200', () => {",
              "  pm.response.to.have.status(200);",
              "});",
              "",
              "pm.test('Token returned', () => {",
              "  const json = pm.response.json();",
              "  pm.expect(json.token).to.exist;",
              "  pm.environment.set('auth_token', json.token);",
              "});"
            ]
          }
        }
      ],
      "request": {
        "method": "POST",
        "header": [],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"phoneNumber\": \"254712345678\",\n  \"password\": \"testpassword\"\n}"
        },
        "url": "{{api_url}}/api/auth/login"
      }
    },
    {
      "name": "2. Initiate Payment",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "pm.test('Payment initiated', () => {",
              "  pm.response.to.have.status(200);",
              "  const json = pm.response.json();",
              "  pm.expect(json.checkoutRequestId).to.exist;",
              "  pm.environment.set('checkout_id', json.checkoutRequestId);",
              "});"
            ]
          }
        }
      ],
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{auth_token}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"phoneNumber\": \"254712345678\",\n  \"package\": \"standard\",\n  \"macAddress\": \"AA:BB:CC:DD:EE:FF\"\n}"
        },
        "url": "{{api_url}}/api/payment/initiate"
      }
    }
  ]
}
```

Run with Newman:

```bash
npm install -g newman

newman run postman-collection.json \
  --environment postman-environment.json \
  --reporters cli,json
```

---

## M-Pesa Sandbox Testing

### Setup Sandbox

```env
MPESA_ENVIRONMENT=sandbox
MPESA_CONSUMER_KEY=sandbox_key
MPESA_CONSUMER_SECRET=sandbox_secret
MPESA_SHORTCODE=174379
MPESA_PASSKEY=sandbox_passkey
```

### Test Script

```typescript
// scripts/test-mpesa.ts
import { initiateSTKPush } from '../lambda/payment';

async function testMpesaSandbox() {
  console.log('Testing M-Pesa Sandbox...\n');

  // Test 1: Successful payment
  console.log('Test 1: Successful payment');
  try {
    const result = await initiateSTKPush({
      phoneNumber: '254708374149',  // Test number
      amount: 1,
      accountReference: 'TEST-001',
      transactionDesc: 'Test payment'
    });
    console.log('✓ STK Push sent:', result.CheckoutRequestID);
  } catch (error) {
    console.error('✗ Failed:', error.message);
  }

  // Test 2: Invalid phone
  console.log('\nTest 2: Invalid phone number');
  try {
    await initiateSTKPush({
      phoneNumber: 'invalid',
      amount: 1,
      accountReference: 'TEST-002',
      transactionDesc: 'Test payment'
    });
  } catch (error) {
    console.log('✓ Error handled correctly:', error.message);
  }

  // Test 3: Insufficient funds
  console.log('\nTest 3: Insufficient funds');
  try {
    const result = await initiateSTKPush({
      phoneNumber: '254708374150',  // Insufficient funds test number
      amount: 1,
      accountReference: 'TEST-003',
      transactionDesc: 'Test payment'
    });
    console.log('✓ STK Push sent:', result.CheckoutRequestID);
    console.log('  (Will fail with insufficient funds callback)');
  } catch (error) {
    console.error('✗ Failed:', error.message);
  }
}

testMpesaSandbox();
```

Run tests:

```bash
npm run test:mpesa
```

---

## Load Testing

### Artillery Configuration

```yaml
# load-test.yml
config:
  target: "https://api.yourdomain.com"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Sustained load"
    - duration: 60
      arrivalRate: 100
      name: "Peak load"
  defaults:
    headers:
      Content-Type: "application/json"

scenarios:
  - name: "User login and payment flow"
    flow:
      - post:
          url: "/api/auth/login"
          json:
            phoneNumber: "254712345678"
            password: "testpassword"
          capture:
            - json: "$.token"
              as: "token"
      - post:
          url: "/api/payment/initiate"
          headers:
            Authorization: "Bearer {{ token }}"
          json:
            phoneNumber: "254712345678"
            package: "standard"
            macAddress: "AA:BB:CC:DD:EE:FF"
```

Run load tests:

```bash
npm install -g artillery

artillery run load-test.yml
```

### Expected Performance

- **API Latency**: < 500ms (p95)
- **Lambda Duration**: < 1000ms
- **DynamoDB Latency**: < 100ms
- **Throughput**: 1000 req/sec

---

## Security Testing

### OWASP ZAP Scan

```bash
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://api.yourdomain.com \
  -r zap-report.html
```

### Manual Security Tests

#### 1. **SQL Injection** (DynamoDB)
```bash
curl -X POST https://api.yourdomain.com/api/auth/login \
  -d '{"phoneNumber":"254712345678'\'' OR 1=1--","password":"test"}'
# Should reject invalid input
```

#### 2. **JWT Tampering**
```bash
# Modify token payload
curl -X GET https://api.yourdomain.com/api/session/validate \
  -H "Authorization: Bearer tampered.token.here"
# Should return 401 Unauthorized
```

#### 3. **Rate Limiting**
```bash
for i in {1..150}; do
  curl https://api.yourdomain.com/api/auth/login &
done
# Should throttle after 100 requests
```

---

## Continuous Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm test -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v2
        with:
          files: ./coverage/lcov.info
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          AWS_REGION: us-east-1
```

---

## Test Data Management

### Seed Data

```typescript
// scripts/seed-test-data.ts
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

async function seedTestData() {
  const testUsers = [
    {
      userId: 'test_user_1',
      phoneNumber: '254712345678',
      balance: { data: 1073741824, time: 86400 }
    },
    // ... more test users
  ];

  await docClient.send(new BatchWriteCommand({
    RequestItems: {
      UsersTable: testUsers.map(user => ({
        PutRequest: { Item: user }
      }))
    }
  }));

  console.log(`Seeded ${testUsers.length} test users`);
}

seedTestData();
```

### Cleanup

```typescript
// scripts/cleanup-test-data.ts
async function cleanupTestData() {
  const testItems = await docClient.send(new ScanCommand({
    TableName: 'UsersTable',
    FilterExpression: 'begins_with(userId, :prefix)',
    ExpressionAttributeValues: { ':prefix': 'test_' }
  }));

  // Delete test items...
}
```

---

## Best Practices

1. **Isolate Tests**: Use mocks for external services
2. **Fast Tests**: Unit tests should run in < 1s each
3. **Deterministic**: No reliance on external state
4. **Clear Names**: Test names describe behavior
5. **Arrange-Act-Assert**: Follow AAA pattern
6. **Clean Up**: Reset state between tests
7. **CI/CD**: Run tests on every commit
8. **Coverage**: Track and improve over time

---

## Troubleshooting Tests

### Common Issues

**Tests timing out:**
```typescript
jest.setTimeout(10000);  // Increase timeout
```

**Mock not working:**
```typescript
jest.clearAllMocks();  // Clear before each test
```

**DynamoDB Local not running:**
```bash
docker run -p 8000:8000 amazon/dynamodb-local
```
