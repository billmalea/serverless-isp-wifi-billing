# Deployment Guide - AWS SAM

This guide walks you through deploying the Serverless WiFi Billing System using AWS SAM.

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured
3. **AWS SAM CLI** installed ([Installation Guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html))
4. **Node.js 18+** and npm
5. **M-Pesa Daraja API credentials**

## Installation

### 1. Install AWS SAM CLI

**Windows (PowerShell):**
```powershell
# Using Chocolatey
choco install aws-sam-cli

# Or download MSI from AWS
# https://github.com/aws/aws-sam-cli/releases/latest
```

**macOS:**
```bash
brew install aws-sam-cli
```

**Linux:**
```bash
# Download and install
wget https://github.com/aws/aws-sam-cli/releases/latest/download/aws-sam-cli-linux-x86_64.zip
unzip aws-sam-cli-linux-x86_64.zip -d sam-installation
sudo ./sam-installation/install
```

### 2. Verify Installation

```bash
sam --version
# Should output: SAM CLI, version 1.x.x
```

### 3. Configure AWS Credentials

```bash
aws configure
# AWS Access Key ID: YOUR_ACCESS_KEY
# AWS Secret Access Key: YOUR_SECRET_KEY
# Default region name: us-east-1
# Default output format: json
```

## Project Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Build TypeScript

```bash
npm run build
```

### 3. Configure Environment Variables

Copy the example configuration:
```bash
cp config/example.env .env
```

Edit `.env` with your credentials:
```env
MPESA_CONSUMER_KEY=your_key_here
MPESA_CONSUMER_SECRET=your_secret_here
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your_passkey_here
JWT_SECRET=your_random_secret_key
```

## Deployment

### First Time Deployment (Guided)

```bash
npm run sam:deploy
```

This will prompt you for:
- Stack name (default: wifi-billing-system)
- AWS Region (default: us-east-1)
- Parameter values (M-Pesa credentials, JWT secret, etc.)
- Confirmation before deployment
- IAM capabilities

### Subsequent Deployments

After initial setup, deploy using:

```bash
npm run sam:build
sam deploy --config-env dev
```

### Payment Reliability Enhancements (No Extra Poller Lambda)

The stack now includes inline payment confirmation logic and a manual fallback endpoint—no separate poller function is required.

| Feature | Implementation |
|---------|----------------|
| Inline Safety Polling | 2 STK Query attempts right after `/payment/initiate` |
| Manual Fallback | `POST /payment/query` with `checkoutRequestID` (and optional `transactionId`) |
| Cancellation Persistence | ResultCode `1032` recorded as status `cancelled` |
| Expiration Handling | ResultCode `1037` recorded as status `expired` |
| Session Extension | Successful payment extends active device session instead of creating duplicate |
| OAuth Token Caching | Reuses token until <60s remaining, reduces rate-limit risk |

No extra deployment steps are needed—logic resides within `PaymentFunction`.
```

### Environment-Specific Deployments

**Development:**
```bash
sam deploy --config-env dev
```

**Staging:**
```bash
sam deploy --config-env staging
```

**Production:**
```bash
sam deploy --config-env prod \
  --parameter-overrides \
  MPesaConsumerKey=$MPESA_KEY \
  MPesaConsumerSecret=$MPESA_SECRET \
  MPesaPasskey=$MPESA_PASSKEY \
  JWTSecret=$JWT_SECRET
```

## Validate Template

Before deploying, validate your SAM template:

```bash
npm run sam:validate
```

## Local Testing

### Start Local API

```bash
npm run local:api
# API will be available at http://localhost:3000
```

### Invoke Function Locally

```bash
# Invoke AuthFunction
sam local invoke AuthFunction --event events/auth-event.json

# Invoke PaymentFunction
sam local invoke PaymentFunction --event events/payment-event.json
```

### Manual STK Query Test

Simulate delayed callback by invoking the query endpoint locally (adjust event JSON accordingly):

```bash
curl -X POST http://127.0.0.1:3000/payment/query \
  -H "Content-Type: application/json" \
  -d '{"checkoutRequestID":"ws_CO_17112025120000123456789","transactionId":"txn_test"}'
```
```

### Test with Local DynamoDB

```bash
# Start DynamoDB Local
docker run -p 8000:8000 amazon/dynamodb-local

# Update environment to point to local DynamoDB
export AWS_SAM_LOCAL=true
npm run local:api
```

## Deploy Frontend to S3

After deploying the backend, upload the captive portal:

```bash
# Get the bucket name from stack outputs
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name wifi-billing-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`PortalBucketName`].OutputValue' \
  --output text)

# Sync frontend files
aws s3 sync frontend/ s3://$BUCKET_NAME/ \
  --exclude "*.md" \
  --cache-control "max-age=31536000"
```

## Update API URL in Frontend

After deployment, update the API URL in `frontend/app.js`:

```bash
# Get API URL
API_URL=$(aws cloudformation describe-stacks \
  --stack-name wifi-billing-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
  --output text)

echo "Update API_BASE_URL in frontend/app.js to: $API_URL"
```

## Monitoring

### View Logs

```bash
# Auth function logs
sam logs -n AuthFunction --stack-name wifi-billing-dev --tail

# Payment function logs
sam logs -n PaymentFunction --stack-name wifi-billing-dev --tail

# All logs
aws logs tail /aws/lambda/WiFiBilling-Auth-dev --follow
```

### CloudWatch Insights

Query logs using CloudWatch Insights:
```
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 20
```

## Cleanup

To delete the entire stack:

```bash
sam delete --stack-name wifi-billing-dev
```

Or using AWS CLI:
```bash
aws cloudformation delete-stack --stack-name wifi-billing-dev
```

## Troubleshooting

### Build Errors

```bash
# Clean and rebuild
rm -rf .aws-sam dist
npm run build
sam build
```

### Deployment Fails

Check CloudFormation events:
```bash
aws cloudformation describe-stack-events \
  --stack-name wifi-billing-dev \
  --max-items 10
```

### Permission Issues

Ensure your IAM user has these policies:
- AWSCloudFormationFullAccess
- AWSLambdaFullAccess
- AmazonDynamoDBFullAccess
- AmazonS3FullAccess
- AmazonSQSFullAccess
- IAMFullAccess (for role creation)

### M-Pesa Sandbox Testing

Use these test credentials:
- Phone Number: 254708374149
- Amount: Any amount
- PIN: Will be prompted on phone

## Production Checklist

Before deploying to production:

- [ ] Update M-Pesa to production environment
- [ ] Use production consumer key and secret
- [ ] Set strong JWT secret
- [ ] Enable CloudWatch alarms
- [ ] Configure custom domain for API Gateway
- [ ] Enable AWS X-Ray tracing
- [ ] Set up CloudFront for portal assets
- [ ] Configure backup retention for DynamoDB
- [ ] Set up SNS alerts for errors
- [ ] Review and update CORS settings
- [ ] Enable API Gateway throttling
- [ ] Configure DynamoDB auto-scaling (if needed)

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - uses: aws-actions/setup-sam@v2
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - run: npm ci
      - run: npm run build
      - run: sam build
      - run: sam deploy --no-confirm-changeset --no-fail-on-empty-changeset
```

## Support

For issues and questions:
- Check [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- Review CloudWatch logs
- Check DynamoDB tables for data
- Verify SQS queues are processing messages

## Next Steps

1. Configure your hotspot gateway (see `docs/gateway-setup/`)
2. Generate initial vouchers
3. Test with M-Pesa sandbox
4. Monitor CloudWatch metrics
5. Set up custom domain
