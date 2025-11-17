import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const VOUCHERS_TABLE = process.env.VOUCHERS_TABLE || 'WiFiBilling-Vouchers';
const PACKAGES_TABLE = process.env.PACKAGES_TABLE || 'WiFiBilling-Packages';

interface VoucherGenerationOptions {
  count: number;
  packageId: string;
  expiryDays?: number;
  batchId?: string;
}

/**
 * Generate voucher codes
 */
function generateVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous characters
  let code = '';
  
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
    if ((i + 1) % 4 === 0 && i < 11) {
      code += '-';
    }
  }
  
  return code;
}

/**
 * Generate vouchers and save to DynamoDB
 */
async function generateVouchers(options: VoucherGenerationOptions): Promise<string[]> {
  const { count, packageId, expiryDays, batchId } = options;
  
  // Validate package from DynamoDB
  const packageResult = await docClient.send(new GetCommand({
    TableName: PACKAGES_TABLE,
    Key: { packageId }
  }));
  
  const packageData = packageResult.Item;
  if (!packageData || packageData.status !== 'active') {
    throw new Error(`Invalid or inactive package ID: ${packageId}`);
  }
  
  console.log(`Generating ${count} vouchers for package: ${packageData.name}`);
  
  const voucherCodes: string[] = [];
  const batch = batchId || `batch_${Date.now()}`;
  const expiresAt = expiryDays
    ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
    : undefined;
  const ttl = expiresAt ? Math.floor(new Date(expiresAt).getTime() / 1000) : undefined;
  
  // Generate voucher codes
  for (let i = 0; i < count; i++) {
    voucherCodes.push(generateVoucherCode());
  }
  
  // Save to DynamoDB in batches of 25 (DynamoDB limit)
  const batchSize = 25;
  for (let i = 0; i < voucherCodes.length; i += batchSize) {
    const batchCodes = voucherCodes.slice(i, i + batchSize);
    
    const putRequests = batchCodes.map((code) => ({
      PutRequest: {
        Item: {
          voucherCode: code,
          packageId: packageData.packageId,
          status: 'unused',
          createdAt: new Date().toISOString(),
          expiresAt,
          batchId: batch,
          ttl,
        },
      },
    }));
    
    const command = new BatchWriteCommand({
      RequestItems: {
        [VOUCHERS_TABLE]: putRequests,
      },
    });
    
    await docClient.send(command);
    console.log(`Saved batch ${Math.floor(i / batchSize) + 1} (${batchCodes.length} vouchers)`);
  }
  
  console.log(`✅ Successfully generated ${count} vouchers`);
  return voucherCodes;
}

/**
 * Export vouchers to CSV
 */
function exportToCSV(vouchers: string[], packageName: string): void {
  const fs = require('fs');
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `vouchers_${packageName}_${timestamp}.csv`;
  
  let csv = 'Voucher Code,Package,Created Date,Status\n';
  vouchers.forEach((code) => {
    csv += `${code},${packageName},${timestamp},unused\n`;
  });
  
  fs.writeFileSync(filename, csv);
  console.log(`📄 Vouchers exported to: ${filename}`);
}

/**
 * Main CLI
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Voucher Generator

Usage:
  npm run generate-vouchers -- --count 100 --package pkg_xxx [options]

Options:
  --count <number>      Number of vouchers to generate (required)
  --package <id>        Package ID from DynamoDB (required)
  --expiry <days>       Expiry days (optional)
  --batch <id>          Batch ID (optional)
  --export              Export to CSV file

Example:
  npm run generate-vouchers -- --count 100 --package pkg_123 --expiry 30 --export

Note: Run 'npm run seed-packages' first to populate packages, then query PackagesTable for IDs.
    `);
    return;
  }
  
  const count = parseInt(args[args.indexOf('--count') + 1]);
  const packageId = args[args.indexOf('--package') + 1];
  const expiryDays = args.includes('--expiry')
    ? parseInt(args[args.indexOf('--expiry') + 1])
    : undefined;
  const batchId = args.includes('--batch') ? args[args.indexOf('--batch') + 1] : undefined;
  const shouldExport = args.includes('--export');
  
  if (!count || !packageId) {
    console.error('❌ Error: --count and --package are required');
    process.exit(1);
  }
  
  try {
    const vouchers = await generateVouchers({
      count,
      packageId,
      expiryDays,
      batchId,
    });
    
    if (shouldExport) {
      const pkgResult = await docClient.send(new GetCommand({
        TableName: PACKAGES_TABLE,
        Key: { packageId }
      }));
      exportToCSV(vouchers, pkgResult.Item?.name || packageId);
    }
    
    console.log('\n🎉 Voucher generation complete!');
    console.log(`\nSample vouchers:\n${vouchers.slice(0, 5).join('\n')}`);
    if (vouchers.length > 5) {
      console.log(`... and ${vouchers.length - 5} more`);
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
