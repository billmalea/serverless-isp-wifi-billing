import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { APIGatewayProxyResult } from 'aws-lambda';
import { APIResponse, HTTP_STATUS } from '../types';
import { CloudWatch } from '@aws-sdk/client-cloudwatch';

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
export const docClient = DynamoDBDocumentClient.from(dynamoClient);
export const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });
export const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const cloudWatchClient = new CloudWatch({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * Format API Gateway response
 */
export function formatResponse<T>(
  statusCode: number,
  body: APIResponse<T>
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

/**
 * Success response helper
 */
export function successResponse<T>(data: T, message?: string): APIGatewayProxyResult {
  return formatResponse(HTTP_STATUS.OK, {
    success: true,
    message,
    data,
  });
}

/**
 * Error response helper
 */
export function errorResponse(
  statusCode: number,
  error: string,
  message?: string
): APIGatewayProxyResult {
  return formatResponse(statusCode, {
    success: false,
    error,
    message,
  });
}

/**
 * Parse JSON body safely
 */
export function parseBody<T>(body: string | null): T | null {
  if (!body) return null;
  try {
    return JSON.parse(body) as T;
  } catch (error) {
    console.error('Failed to parse body:', error);
    return null;
  }
}

/**
 * Generate unique ID
 */
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Hash password
 */
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.hash(password, 10);
}

/**
 * Verify password
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT token
 */
export function generateToken(payload: object, expiresIn: string = '24h'): string {
  const jwt = require('jsonwebtoken');
  return jwt.sign(payload, process.env.JWT_SECRET || 'default-secret', { expiresIn });
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): any {
  const jwt = require('jsonwebtoken');
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
  } catch (error) {
    return null;
  }
}

/**
 * Verify JWT from Authorization header and check roles
 */
export function verifyJWT(authHeader: string | undefined, requiredRole?: string): { valid: boolean; payload?: any; userId?: string } {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false };
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    return { valid: false };
  }

  // Check role if required
  if (requiredRole) {
    const roles = payload.roles || [];
    if (!roles.includes(requiredRole)) {
      return { valid: false };
    }
  }

  return { valid: true, payload, userId: payload.userId };
}

/**
 * Get item from DynamoDB
 */
export async function getItem<T>(tableName: string, key: Record<string, any>): Promise<T | null> {
  const command = new GetCommand({
    TableName: tableName,
    Key: key,
  });

  const result = await docClient.send(command);
  return (result.Item as T) || null;
}

/**
 * Put item to DynamoDB
 */
export async function putItem(tableName: string, item: Record<string, any>): Promise<void> {
  const command = new PutCommand({
    TableName: tableName,
    Item: item,
  });

  await docClient.send(command);
}

/**
 * Update item in DynamoDB
 */
export async function updateItem(
  tableName: string,
  key: Record<string, any>,
  updates: Record<string, any>
): Promise<void> {
  const updateExpression =
    'SET ' + Object.keys(updates).map((_k, i) => `#attr${i} = :val${i}`).join(', ');

  const expressionAttributeNames = Object.keys(updates).reduce(
    (acc, k, i) => ({ ...acc, [`#attr${i}`]: k }),
    {}
  );

  const expressionAttributeValues = Object.keys(updates).reduce(
    (acc, k, i) => ({ ...acc, [`:val${i}`]: updates[k] }),
    {}
  );

  const command = new UpdateCommand({
    TableName: tableName,
    Key: key,
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
  });

  await docClient.send(command);
}

/**
 * Send message to SQS queue
 */
export async function sendToQueue(queueUrl: string, message: object): Promise<void> {
  const command = new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(message),
  });

  await sqsClient.send(command);
}

/**
 * Send SNS notification
 */
export async function sendNotification(topicArn: string, message: string, subject?: string): Promise<void> {
  const command = new PublishCommand({
    TopicArn: topicArn,
    Message: message,
    Subject: subject,
  });

  await snsClient.send(command);
}

/**
 * Publish custom CloudWatch metric
 */
export async function publishMetric(metricName: string, value: number, unit: 'Count' | 'Seconds' | 'Bytes' | 'None' = 'Count'): Promise<void> {
  try {
    await cloudWatchClient.putMetricData({
      Namespace: 'WiFiBilling',
      MetricData: [
        {
          MetricName: metricName,
          Value: value,
          Unit: unit as any,
          Timestamp: new Date(),
          Dimensions: [
            { Name: 'Environment', Value: process.env.NODE_ENV || 'dev' }
          ]
        }
      ]
    });
  } catch (e) {
    // non-fatal
    console.warn('Metric publish failed', (e as any)?.message || e);
  }
}

/**
 * Format phone number to Kenyan format
 */
export function formatPhoneNumber(phone: string): string {
  // Remove any spaces, dashes, or plus signs
  let cleaned = phone.replace(/[\s\-\+]/g, '');

  // If starts with 0, replace with 254
  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.substring(1);
  }

  // If doesn't start with 254, add it
  if (!cleaned.startsWith('254')) {
    cleaned = '254' + cleaned;
  }

  return cleaned;
}

/**
 * Validate Kenyan phone number
 */
export function isValidKenyanPhone(phone: string): boolean {
  const formatted = formatPhoneNumber(phone);
  // Kenyan numbers should be 254 followed by 9 digits (7XX, 1XX, etc.)
  return /^254[17]\d{8}$/.test(formatted);
}

/**
 * Convert MB to bytes
 */
export function mbToBytes(mb: number): number {
  return mb * 1024 * 1024;
}

/**
 * Convert bytes to MB
 */
export function bytesToMB(bytes: number): number {
  return bytes / (1024 * 1024);
}

/**
 * Format currency (KES)
 */
export function formatCurrency(amount: number): string {
  return `KES ${amount.toFixed(2)}`;
}

/**
 * Get current timestamp in ISO format
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Add seconds to current time
 */
export function addSecondsToNow(seconds: number): string {
  const date = new Date();
  date.setSeconds(date.getSeconds() + seconds);
  return date.toISOString();
}

/**
 * Check if date is expired
 */
export function isExpired(isoDate: string): boolean {
  return new Date(isoDate) < new Date();
}

/**
 * Logger utility
 */
export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  info(message: string, data?: any) {
    console.log(JSON.stringify({ level: 'INFO', context: this.context, message, data }));
  }

  error(message: string, error?: any) {
    console.error(JSON.stringify({ level: 'ERROR', context: this.context, message, error: error?.message || error }));
  }

  warn(message: string, data?: any) {
    console.warn(JSON.stringify({ level: 'WARN', context: this.context, message, data }));
  }

  debug(message: string, data?: any) {
    if (process.env.DEBUG === 'true') {
      console.debug(JSON.stringify({ level: 'DEBUG', context: this.context, message, data }));
    }
  }
}
export { HTTP_STATUS };

