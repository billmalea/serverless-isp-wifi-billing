# M-Pesa Integration Guide

Complete guide for integrating Safaricom M-Pesa Daraja API with the WiFi billing system.

## Table of Contents

1. [Overview](#overview)
2. [Daraja API Setup](#daraja-api-setup)
3. [STK Push Implementation](#stk-push-implementation)
4. [Callback Handling](#callback-handling)
5. [Testing](#testing)
6. [Production Deployment](#production-deployment)
7. [Troubleshooting](#troubleshooting)

---

## Overview

M-Pesa is Kenya's leading mobile money platform. The Daraja API allows businesses to integrate M-Pesa payments directly into their applications.

### Features Used

- **Lipa Na M-Pesa Online (STK Push)**: Prompts users to enter PIN on their phone
- **Payment Callback**: Async notification of payment status
- **Transaction Query**: Check status of pending payments

### Payment Flow

```
User → Select Package → Click Pay
    ↓
System initiates STK Push
    ↓
User receives prompt on phone
    ↓
User enters M-Pesa PIN
    ↓
Payment processed
    ↓
Safaricom sends callback to our system
    ↓
System activates internet access
```

### Extended Flow (Reliability Enhancements)

```
Initiate STK Push
   ↓
Inline safety polling (up to 2 STK Query attempts ~3s apart)
   ↓
If early success → synthesize callback & finalize session
Else remain pending
   ↓
Await official Safaricom callback
   ↓         ↘
Callback arrives  Manual `/payment/query` fallback (if delayed)
   ↓
Create OR extend time-based session (device MAC binding)
```

Key improvements:
- Reduced latency for successful payments (early confirmation path)
- Graceful handling of user cancellation (ResultCode `1032` → status `cancelled`)
- Manual recovery for delayed callbacks via `/payment/query` endpoint
- In-memory OAuth token caching reduces rate-limit and spike arrest errors

---

## Daraja API Setup

### Step 1: Create Daraja Account

1. Visit [Daraja Portal](https://developer.safaricom.co.ke/)
2. Click **Sign Up** and create account
3. Verify email address
4. Log in to dashboard

### Step 2: Create App

1. Navigate to **My Apps** → **Create New App**
2. Fill in details:
   - **App Name**: WiFi Billing System
   - **Description**: Serverless WiFi hotspot billing
   - **Products**: Select **Lipa Na M-Pesa Online**
3. Click **Create App**
4. Save the **Consumer Key** and **Consumer Secret**

### Step 3: Get Paybill/Till Number

**For Production:**
- Contact Safaricom Business Care
- Request M-Pesa Paybill/Till Number
- Provide:
  - Business registration documents
  - Bank account details
  - Expected transaction volume

**For Testing:**
- Use sandbox credentials provided by Daraja
- Shortcode: `174379`
- Test phone: `254708374149`

### Step 4: Configure Callback URL

1. In Daraja Portal, go to **App Settings**
2. Set **Callback URL**:
   ```
   https://api.yourdomain.com/api/payment/callback
   ```
3. Set **Validation URL** (optional):
   ```
   https://api.yourdomain.com/api/payment/validate
   ```
4. Click **Save**

### Step 5: Store Credentials

Add to your `.env` file or AWS Secrets Manager:

```env
# M-Pesa Credentials
MPESA_CONSUMER_KEY=your_consumer_key_here
MPESA_CONSUMER_SECRET=your_consumer_secret_here
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your_passkey_here
MPESA_CALLBACK_URL=https://api.yourdomain.com/api/payment/callback

# Environment
MPESA_ENVIRONMENT=sandbox  # or 'production'
```

---

## STK Push Implementation

### Generate Access Token

Before making any API call, get an OAuth token:

```typescript
import axios from 'axios';

async function getMpesaToken(): Promise<string> {
  const auth = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString('base64');

  const url = process.env.MPESA_ENVIRONMENT === 'production'
    ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
    : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

  const response = await axios.get(url, {
    headers: {
      'Authorization': `Basic ${auth}`
    }
  });

  return response.data.access_token;
}

// Production implementation caches token until close to expiry (<60s remaining)
// to minimize OAuth calls and avoid rate limiting.
```

### Generate Password

The password is a Base64-encoded string:

```typescript
function generatePassword(): string {
  const timestamp = getTimestamp();
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
  return password;
}

function getTimestamp(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}${hour}${minute}${second}`;
}
```

### Initiate STK Push

```typescript
interface STKPushRequest {
  phoneNumber: string;
  amount: number;
  accountReference: string;  // e.g., user ID
  transactionDesc: string;
}

async function initiateSTKPush(request: STKPushRequest): Promise<any> {
  const token = await getMpesaToken();
  const timestamp = getTimestamp();
  const password = generatePassword();

  const url = process.env.MPESA_ENVIRONMENT === 'production'
    ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
    : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

  const payload = {
    BusinessShortCode: process.env.MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: request.amount,
    PartyA: request.phoneNumber,  // Customer phone
    PartyB: process.env.MPESA_SHORTCODE,  // Your paybill
    PhoneNumber: request.phoneNumber,
    CallBackURL: process.env.MPESA_CALLBACK_URL,
    AccountReference: request.accountReference,
    TransactionDesc: request.transactionDesc
  };

  const response = await axios.post(url, payload, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  return response.data;
}
```

### Example Response

**Success:**
```json
{
  "MerchantRequestID": "29115-34620561-1",
  "CheckoutRequestID": "ws_CO_17112025120000123456789",
  "ResponseCode": "0",
  "ResponseDescription": "Success. Request accepted for processing",
  "CustomerMessage": "Success. Request accepted for processing"
}
```

**Error:**
```json
{
  "requestId": "12345-67890",
  "errorCode": "400.002.02",
  "errorMessage": "Bad Request - Invalid PhoneNumber"
}
```

---

## Callback Handling

### Callback Request Structure

Safaricom sends a POST request to your callback URL:

```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "29115-34620561-1",
      "CheckoutRequestID": "ws_CO_17112025120000123456789",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": {
        "Item": [
          {
            "Name": "Amount",
            "Value": 50
          },
          {
            "Name": "MpesaReceiptNumber",
            "Value": "RKL1234ABC"
          },
          {
            "Name": "Balance"
          },
          {
            "Name": "TransactionDate",
            "Value": 20251117120530
          },
          {
            "Name": "PhoneNumber",
            "Value": 254712345678
          }
        ]
      }
    }
  }
}
```

### Result Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | Insufficient funds |
| 1032 | Request cancelled by user |
| 1037 | Timeout (user didn't enter PIN) |
| 2001 | Wrong PIN |

### Callback Handler Implementation

```typescript
interface MpesaCallback {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value?: any;
        }>;
      };
    };
  };
}

export async function handleMpesaCallback(event: APIGatewayEvent): Promise<APIGatewayProxyResult> {
  try {
    const callback: MpesaCallback = JSON.parse(event.body || '{}');
    const stkCallback = callback.Body.stkCallback;

    // Log callback for debugging
    console.log('M-Pesa Callback:', JSON.stringify(callback));

    // Extract transaction details
    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const resultCode = stkCallback.ResultCode;
    const resultDesc = stkCallback.ResultDesc;

    if (resultCode === 0) {
      // Payment successful
      const metadata = stkCallback.CallbackMetadata!.Item;
      const amount = metadata.find(item => item.Name === 'Amount')?.Value;
      const mpesaReceiptNumber = metadata.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
      const phoneNumber = metadata.find(item => item.Name === 'PhoneNumber')?.Value;
      const transactionDate = metadata.find(item => item.Name === 'TransactionDate')?.Value;

      // Update transaction in DynamoDB
      await updateTransaction({
        checkoutRequestId,
        status: 'completed',
        mpesaReceiptNumber,
        amount,
        phoneNumber,
        transactionDate
      });

      // Enqueue CoA message to activate user
      await sendCoAMessage({
        userId: getUserIdFromCheckoutRequest(checkoutRequestId),
        action: 'authorize',
        package: getPackageFromCheckoutRequest(checkoutRequestId)
      });

      // Send success notification
      await sendSMS(phoneNumber, `Payment received. Receipt: ${mpesaReceiptNumber}`);

    } else {
      // Payment failed
      await updateTransaction({
        checkoutRequestId,
        status: 'failed',
        errorCode: resultCode,
        errorMessage: resultDesc
      });

      console.error(`Payment failed: ${resultDesc} (Code: ${resultCode})`);
    }

    // Always return 200 to acknowledge receipt
    return {
      statusCode: 200,
      body: JSON.stringify({
        ResultCode: 0,
        ResultDesc: 'Accepted'
      })
    };

  } catch (error) {
    console.error('Error processing callback:', error);
    
    // Still return 200 to prevent retries
    return {
      statusCode: 200,
      body: JSON.stringify({
        ResultCode: 1,
        ResultDesc: 'Failed to process'
      })
    };
  }
}
```

### Important Notes

1. **Always return 200**: Even if processing fails, return 200 to Safaricom to acknowledge receipt
2. **Idempotency**: Handle duplicate callbacks (Safaricom may retry)
3. **Timeout**: Callback must respond within 30 seconds
4. **IP Whitelist**: Only accept callbacks from Safaricom IPs
5. **Async Processing**: Use SQS queue for heavy processing
6. **Inline Polling**: Perform limited STK Query attempts immediately after initiation to catch fast successes or cancellations.
7. **Manual Query Fallback**: Provide `/payment/query` endpoint (requires `checkoutRequestID`) to finalize pending transactions if callback is delayed.
8. **Cancellation Persistence**: ResultCode `1032` stored as `cancelled` (distinct from `failed`).

---

## Testing

### Sandbox Testing

#### Step 1: Use Test Credentials

```env
MPESA_ENVIRONMENT=sandbox
MPESA_CONSUMER_KEY=<sandbox_key>
MPESA_CONSUMER_SECRET=<sandbox_secret>
MPESA_SHORTCODE=174379
MPESA_PASSKEY=<sandbox_passkey>
```

#### Step 2: Test Phone Numbers

- **Success**: `254708374149`
- **Insufficient Funds**: `254708374150`
- **Invalid Account**: `254708374151`

#### Step 3: Run Test Payment

```bash
npm run test:mpesa
```

```typescript
// scripts/test-mpesa.ts
async function testSTKPush() {
  const result = await initiateSTKPush({
    phoneNumber: '254708374149',
    amount: 1,  // Minimum amount
    accountReference: 'TEST-USER-001',
    transactionDesc: 'Test WiFi Package'
  });

  console.log('STK Push Result:', result);
  
  // Wait for callback (check logs)
  await new Promise(resolve => setTimeout(resolve, 30000));
}

testSTKPush();
```

### Local Testing with ngrok

To test callbacks locally:

```bash
# Install ngrok
npm install -g ngrok

# Start your local API
npm run dev

# Expose port 3000
ngrok http 3000

# Copy ngrok URL to Daraja Portal callback settings
# https://abc123.ngrok.io/api/payment/callback
```

---

## Production Deployment

### Pre-Production Checklist

- [ ] Obtain production Paybill/Till number from Safaricom
- [ ] Request production API credentials
- [ ] Configure production callback URL with SSL
- [ ] Set up IP whitelisting for Safaricom servers
- [ ] Test with real money (small amounts)
- [ ] Set up CloudWatch alarms for payment failures
- [ ] Configure SNS alerts for errors

### Safaricom IP Whitelist

Add these IPs to your API Gateway or WAF:

**Production:**
```
196.201.214.200
196.201.214.206
196.201.213.114
196.201.214.207
196.201.214.208
196.201.213.44
```

**Sandbox:**
```
196.201.214.200
```

### AWS Security Group (if using VPC)

```bash
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxx \
  --protocol tcp \
  --port 443 \
  --cidr 196.201.214.200/32
```

### Monitoring

**CloudWatch Metrics:**
```typescript
await cloudwatch.putMetricData({
  Namespace: 'WiFiBilling/MPesa',
  MetricData: [{
    MetricName: 'PaymentSuccess',
    Value: resultCode === 0 ? 1 : 0,
    Unit: 'Count',
    Dimensions: [{
      Name: 'ResultCode',
      Value: String(resultCode)
    }]
  }]
});
```

**CloudWatch Alarm:**
```yaml
PaymentFailureAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: MPesa-Payment-Failures
    MetricName: PaymentSuccess
    Namespace: WiFiBilling/MPesa
    Statistic: Sum
    Period: 300
    EvaluationPeriods: 1
    Threshold: 5
    ComparisonOperator: LessThanThreshold
    AlarmActions:
      - !Ref AlertsTopic
```

---

## Troubleshooting

### Common Issues

#### 1. "Invalid Access Token"

**Cause**: Token expired (valid for 1 hour)  
**Solution**: Regenerate token before each request

```typescript
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getMpesaToken(): Promise<string> {
  const now = Date.now();
  
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.token;
  }

  const token = await fetchNewToken();
  cachedToken = {
    token,
    expiresAt: now + (3500 * 1000)  // 58 minutes
  };

  return token;
}

// Tip: Always leave ~60 seconds buffer before expiry when deciding to reuse token.
```

#### 2. "Bad Request - Invalid PhoneNumber"

**Cause**: Phone number not in correct format  
**Solution**: Ensure format is `254XXXXXXXXX` (no +, no spaces)

```typescript
function formatPhoneNumber(phone: string): string {
  // Remove spaces, dashes, plus
  phone = phone.replace(/[\s\-+]/g, '');
  
  // Convert 07XX to 2547XX
  if (phone.startsWith('0')) {
    phone = '254' + phone.substring(1);
  }
  
  // Ensure starts with 254
  if (!phone.startsWith('254')) {
    phone = '254' + phone;
  }
  
  return phone;
}
```

#### 3. "Request Timeout"

**Cause**: User didn't enter PIN within 60 seconds  
**Solution**: Handle timeout gracefully

```typescript
// Set transaction status to expired
if (resultCode === 1037) {
  await updateTransaction({
    checkoutRequestId,
    status: 'expired',
    errorMessage: 'User did not complete payment'
  });
}

#### 6. "Transaction Still Pending"

**Cause**: Callback delayed or lost.

**Solution**:
1. Call `/payment/query` with the original `checkoutRequestID` and `transactionId`.
2. If `resultCode` returns `0`, system synthesizes callback and finalizes session.
3. If still pending, wait for callback or retry once after several seconds.
4. Log prolonged pending (>2 minutes) for investigation.

```json
POST /api/payment/query
{
  "checkoutRequestID": "ws_CO_17112025120000123456789",
  "transactionId": "txn_1763416039818_zjrnyzg53x"
}
```
```

#### 4. "Callback Not Received"

**Possible Causes:**
- Wrong callback URL
- SSL certificate issue
- Firewall blocking Safaricom IPs
- Lambda timeout (must respond < 30s)

**Debug Steps:**
```bash
# Check CloudWatch logs
aws logs tail /aws/lambda/PaymentLambda --follow

# Test callback URL manually
curl -X POST https://api.yourdomain.com/api/payment/callback \
  -H "Content-Type: application/json" \
  -d @test-callback.json

# Verify SSL certificate
curl -I https://api.yourdomain.com
```

#### 5. "Insufficient Funds"

**Cause**: User M-Pesa balance < amount  
**Solution**: Show user-friendly error

```typescript
const errorMessages: Record<number, string> = {
  1: 'Insufficient funds in your M-Pesa account',
  1032: 'Payment cancelled',
  1037: 'Payment timeout. Please try again.',
  2001: 'Wrong M-Pesa PIN entered'
};

const userMessage = errorMessages[resultCode] || 'Payment failed. Please try again.';
```

### Debug Mode

Enable detailed logging:

```typescript
// lambda/payment/index.ts
const DEBUG = process.env.DEBUG === 'true';

if (DEBUG) {
  console.log('Request:', JSON.stringify(event));
  console.log('M-Pesa Response:', JSON.stringify(mpesaResponse));
  console.log('Callback:', JSON.stringify(callback));
}
```

### Testing Checklist

- [ ] Valid phone number format
- [ ] Amount > 1 KES
- [ ] Access token not expired
- [ ] Callback URL accessible from internet
- [ ] SSL certificate valid
- [ ] Transaction ID stored before STK Push
- [ ] Idempotency key handled
- [ ] Timeout handling implemented
- [ ] Error codes mapped to user messages

---

## Best Practices

### 1. **Idempotency**

Store `CheckoutRequestID` before making STK Push:

```typescript
// Save transaction as 'pending' first
await dynamodb.put({
  TableName: 'Transactions',
  Item: {
    checkoutRequestId: 'generated-uuid',
    status: 'pending',
    createdAt: new Date().toISOString()
  }
});

// Then initiate STK Push
const result = await initiateSTKPush({...});

// Update with M-Pesa's CheckoutRequestID
await dynamodb.update({
  Key: { checkoutRequestId: 'generated-uuid' },
  UpdateExpression: 'SET mpesaCheckoutId = :id',
  ExpressionAttributeValues: {
    ':id': result.CheckoutRequestID
  }
});
```

### 2. **Retry Logic**

Implement exponential backoff for failed Daraja API calls:

```typescript
async function initiateSTKPushWithRetry(request: STKPushRequest, maxRetries = 3): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await initiateSTKPush(request);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      const delay = Math.pow(2, attempt) * 1000;  // 2s, 4s, 8s
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### 3. **Rate Limiting**

Respect Daraja API rate limits (120 requests/minute):

```typescript
import Bottleneck from 'bottleneck';

const limiter = new Bottleneck({
  minTime: 500,  // 500ms between requests
  maxConcurrent: 1
});

const initiateSTKPushRateLimited = limiter.wrap(initiateSTKPush);
```

### 4. **Webhook Security**

Validate callback source:

```typescript
export async function handleMpesaCallback(event: APIGatewayEvent): Promise<APIGatewayProxyResult> {
  // Check source IP
  const sourceIp = event.requestContext.identity.sourceIp;
  const allowedIps = process.env.MPESA_ALLOWED_IPS!.split(',');
  
  if (!allowedIps.includes(sourceIp)) {
    console.error(`Unauthorized callback from ${sourceIp}`);
    return { statusCode: 403, body: 'Forbidden' };
  }

  // Process callback...
}
```

---

## Additional Resources

- [Safaricom Daraja Portal](https://developer.safaricom.co.ke/)
- [Daraja API Documentation](https://developer.safaricom.co.ke/Documentation)
- [M-Pesa API Sandbox](https://developer.safaricom.co.ke/sandbox)
- [Daraja Community Forum](https://developer.safaricom.co.ke/community)
- [Safaricom Support](mailto:apisupport@safaricom.co.ke)

---

## Contact

For M-Pesa integration support:
- **Email**: apisupport@safaricom.co.ke
- **Phone**: +254 711 051 000
- **Business Care**: 0722 000 000 / 0734 000 000
