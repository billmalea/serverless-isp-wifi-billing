import { handler } from '../coa/index';
import { SQSEvent } from 'aws-lambda';

jest.mock('../../src/utils/helpers', () => {
  return {
    Logger: class { info(){} error(){} warn(){} },
    getItem: jest.fn(() => Promise.resolve({ gatewayId: 'gw1', name: 'Gateway 1', type: 'mikrotik', ipAddress: '1.1.1.1', apiEndpoint: 'http://gw/api', coaPort: 3799, status: 'active' })),
  };
});

jest.mock('axios', () => ({ post: jest.fn(() => Promise.resolve({ data: {} })), get: jest.fn(() => Promise.resolve({ data: {} })) }));

beforeAll(() => {
  process.env.GATEWAYS_TABLE = 'Gateways';
});

it('processes CoA message for mikrotik gateway', async () => {
  const message = {
    action: 'authorize',
    sessionId: 'session1',
    userId: 'user1',
    macAddress: 'AA:BB',
    ipAddress: '10.0.0.5',
    gatewayId: 'gw1',
    bandwidthMbps: 5,
    sessionTimeout: 3600,
    timestamp: '2025-01-01T00:00:00Z'
  };

  const event: SQSEvent = {
    Records: [
      { messageId: 'm1', body: JSON.stringify(message), attributes: {} as any, awsRegion: 'us-east-1', eventSource: 'aws:sqs', eventSourceARN: 'arn', md5OfBody: '', receiptHandle: '', messageAttributes: {} }
    ]
  };

  await handler(event);
  const axios = require('axios');
  expect(axios.post).toHaveBeenCalled();
});
