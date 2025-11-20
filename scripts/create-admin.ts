/**
 * Script to create admin users in DynamoDB
 * Usage: ts-node scripts/create-admin.ts <phoneNumber> [password]
 */

import { DynamoDBClient, ListTablesCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import * as crypto from 'crypto';

// Configuration
const REGION = process.env.AWS_REGION || 'us-east-1';
// We will resolve the Users table name dynamically; do not hardcode here
let USERS_TABLE: string; // assigned later

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Hash password using SHA-256
 */
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Generate unique ID with prefix
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Format phone number to E.164 format
 */
function formatPhoneNumber(phone: string): string {
  // Remove spaces, dashes, parentheses
  let cleaned = phone.replace(/[\s\-()]/g, '');
  
  // If starts with 0, replace with +254
  if (cleaned.startsWith('0')) {
    cleaned = '+254' + cleaned.substring(1);
  }
  
  // If starts with 254, add +
  if (cleaned.startsWith('254')) {
    cleaned = '+' + cleaned;
  }
  
  // If doesn't start with +, assume it needs +254
  if (!cleaned.startsWith('+')) {
    cleaned = '+254' + cleaned;
  }
  
  return cleaned;
}

/**
 * Attempt to resolve the Users table name.
 * Priority:
 * 1. Explicit --table argument
 * 2. Environment variable USERS_TABLE
 * 3. Environment argument -> pattern WiFiBilling-Users-<env>
 * 4. Scan all tables and choose one starting with 'WiFiBilling-Users-'
 */
async function resolveUsersTableName(explicitTable?: string, envName?: string): Promise<string> {
  if (explicitTable) return explicitTable;
  if (process.env.USERS_TABLE) return process.env.USERS_TABLE;
  const clientRaw = new DynamoDBClient({ region: REGION });
  if (envName) {
    const candidate = `WiFiBilling-Users-${envName}`;
    try {
      await clientRaw.send(new DescribeTableCommand({ TableName: candidate }));
      return candidate;
    } catch {}
  }
  // Fallback: list tables
  const list = await clientRaw.send(new ListTablesCommand({}));
  const match = list.TableNames?.find(t => /^WiFiBilling-Users-/.test(t));
  if (!match) {
    console.error("Available tables:", list.TableNames?.join(', ') || 'NONE');
    throw new Error("Could not locate Users table. Provide --table <TableName> or set USERS_TABLE env variable. Pattern expected: WiFiBilling-Users-<env>");
  }
  return match;
}

/**
 * Create or elevate admin user
 */
async function createAdmin(phoneNumber: string, password?: string, opts: { tableArg?: string; envArg?: string } = {}) {
  try {
    if (!USERS_TABLE) {
      USERS_TABLE = await resolveUsersTableName(opts.tableArg, opts.envArg);
      console.log(`Resolved Users table: ${USERS_TABLE}`);
    }
    const formattedPhone = formatPhoneNumber(phoneNumber);
    console.log(`Creating admin user: ${formattedPhone}`);

    // Check if user already exists
    const getResult = await docClient.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { phoneNumber: formattedPhone }
      })
    );

    if (getResult.Item) {
      console.log('User already exists. Updating to admin role...');
      
      // Update existing user to have admin role
      const existingUser = getResult.Item;
      const roles = existingUser.roles || ['user'];
      
      if (!roles.includes('admin')) {
        roles.push('admin');
      }

      const updatedUser = {
        ...existingUser,
        roles,
        passwordHash: password ? hashPassword(password) : existingUser.passwordHash,
        updatedAt: new Date().toISOString()
      };

      await docClient.send(
        new PutCommand({
          TableName: USERS_TABLE,
          Item: updatedUser
        })
      );

      console.log('✅ User updated to admin successfully!');
      console.log('Phone:', formattedPhone);
      console.log('Roles:', roles);
      if (password) {
        console.log('Password:', password);
      }
      return;
    }

    // Create new admin user
    const userId = generateId('user');
    const timestamp = new Date().toISOString();
    
    const adminUser = {
      userId,
      phoneNumber: formattedPhone,
      roles: ['user', 'admin'],
      passwordHash: password ? hashPassword(password) : undefined,
      createdAt: timestamp,
      lastLoginAt: timestamp,
      status: 'active'
    };

    await docClient.send(
      new PutCommand({
        TableName: USERS_TABLE,
        Item: adminUser
      })
    );

    console.log('✅ Admin user created successfully!');
    console.log('User ID:', userId);
    console.log('Phone:', formattedPhone);
    console.log('Roles:', ['user', 'admin']);
    if (password) {
      console.log('Password:', password);
    } else {
      console.log('⚠️  No password set - user can login with phone number only');
    }

  } catch (error) {
    if ((error as any)?.name === 'ResourceNotFoundException') {
      console.error('❌ DynamoDB table not found. Resolved table name:', USERS_TABLE);
      console.error('   Hint: Pass --env <yourEnvironment> or --table <ExactTableName>.');
      console.error('   Example: ts-node scripts/create-admin.ts 0712XXXXXX Pass123 --env dev');
    } else {
      console.error('❌ Error creating admin:', error);
    }
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

function printUsage() {
  console.log('Usage: ts-node scripts/create-admin.ts <phoneNumber> [password] [--env <environment>] [--table <TableName>]');
  console.log('Examples:');
  console.log('  ts-node scripts/create-admin.ts +254712345678 admin123 --env dev');
  console.log('  ts-node scripts/create-admin.ts 0712345678 SecurePass2024 --table WiFiBilling-Users-prod');
}

if (args.length === 0) {
  printUsage();
  process.exit(1);
}

// Extract positional args first (phone, password)
const positional: string[] = [];
const opts: { envArg?: string; tableArg?: string } = {};
for (let i = 0; i < args.length; i++) {
  const val = args[i];
  if (val === '--env') {
    opts.envArg = args[i + 1];
    i++;
    continue;
  }
  if (val === '--table') {
    opts.tableArg = args[i + 1];
    i++;
    continue;
  }
  positional.push(val);
}

const phoneNumber = positional[0];
const password = positional[1];

if (!phoneNumber) {
  printUsage();
  process.exit(1);
}

createAdmin(phoneNumber, password, opts)
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error.message);
    process.exit(1);
  });
