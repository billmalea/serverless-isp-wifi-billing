import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { Package } from '../src/types';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const PACKAGES_TABLE = process.env.PACKAGES_TABLE || 'WiFiBilling-Packages-dev';

/**
 * Default time-based packages for WiFi billing
 */
const DEFAULT_PACKAGES: Omit<Package, 'packageId' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Quick Access',
    description: '1 hour unlimited internet at 2 Mbps',
    durationHours: 1,
    bandwidthMbps: 2,
    priceKES: 15,
    status: 'active',
    createdBy: 'system'
  },
  {
    name: 'Standard',
    description: '3 hours unlimited internet at 5 Mbps',
    durationHours: 3,
    bandwidthMbps: 5,
    priceKES: 50,
    status: 'active',
    createdBy: 'system'
  },
  {
    name: 'Premium',
    description: '6 hours unlimited internet at 10 Mbps',
    durationHours: 6,
    bandwidthMbps: 10,
    priceKES: 100,
    status: 'active',
    createdBy: 'system'
  },
  {
    name: 'Full Day',
    description: '24 hours unlimited internet at 20 Mbps',
    durationHours: 24,
    bandwidthMbps: 20,
    priceKES: 200,
    status: 'active',
    createdBy: 'system'
  },
  {
    name: 'Half Hour',
    description: '30 minutes unlimited internet at 2 Mbps',
    durationHours: 0.5,
    bandwidthMbps: 2,
    priceKES: 10,
    status: 'active',
    createdBy: 'system'
  },
  {
    name: 'Weekend Special',
    description: '48 hours unlimited internet at 15 Mbps',
    durationHours: 48,
    bandwidthMbps: 15,
    priceKES: 350,
    status: 'active',
    createdBy: 'system'
  },
  {
    name: 'Weekly',
    description: '7 days unlimited internet at 10 Mbps',
    durationHours: 168,
    bandwidthMbps: 10,
    priceKES: 1000,
    status: 'active',
    createdBy: 'system'
  }
];

/**
 * Seed packages to DynamoDB
 */
async function seedPackages() {
  console.log(`Seeding packages to table: ${PACKAGES_TABLE}\n`);

  const now = new Date().toISOString();
  let successCount = 0;
  let errorCount = 0;

  for (const pkg of DEFAULT_PACKAGES) {
    const packageId = `pkg_${pkg.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    
    const fullPackage: Package = {
      ...pkg,
      packageId,
      createdAt: now,
      updatedAt: now
    };

    try {
      await docClient.send(new PutCommand({
        TableName: PACKAGES_TABLE,
        Item: fullPackage,
        ConditionExpression: 'attribute_not_exists(packageId)'
      }));

      console.log(`✓ Created: ${pkg.name} (${pkg.durationHours}h @ ${pkg.bandwidthMbps}Mbps) - KES ${pkg.priceKES}`);
      successCount++;

    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        console.log(`⚠ Skipped: ${pkg.name} (already exists)`);
      } else {
        console.error(`✗ Failed: ${pkg.name} - ${error.message}`);
        errorCount++;
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total: ${DEFAULT_PACKAGES.length}`);
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Skipped: ${DEFAULT_PACKAGES.length - successCount - errorCount}`);
}

/**
 * List all packages
 */
async function listPackages() {
  console.log(`\nListing packages from: ${PACKAGES_TABLE}\n`);

  try {
    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [PACKAGES_TABLE]: []
      }
    }));

    console.log('Current packages:');
    // Add list logic here if needed
    
  } catch (error: any) {
    console.error('Error listing packages:', error.message);
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'seed';

  console.log('=================================');
  console.log('  Package Seeding Script');
  console.log('=================================\n');

  if (command === 'seed') {
    await seedPackages();
  } else if (command === 'list') {
    await listPackages();
  } else {
    console.log('Usage:');
    console.log('  npm run seed-packages          # Seed default packages');
    console.log('  npm run seed-packages list     # List existing packages');
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✓ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Script failed:', error);
      process.exit(1);
    });
}

export { seedPackages, DEFAULT_PACKAGES };
