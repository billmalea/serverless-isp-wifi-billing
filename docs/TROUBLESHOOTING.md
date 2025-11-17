# Troubleshooting Guide

Common issues, solutions, and debugging procedures for the WiFi billing system.

## Table of Contents

1. [User Issues](#user-issues)
2. [Payment Issues](#payment-issues)
3. [Gateway Issues](#gateway-issues)
4. [System Issues](#system-issues)
5. [Debugging Tools](#debugging-tools)

---

## User Issues

### User Cannot Connect to WiFi

**Symptoms:**
- User connects to WiFi but no internet
- Captive portal doesn't appear
- Stuck on "loading" screen

**Diagnosis:**

1. **Check if captive portal redirect is working:**
```bash
# From user's device
curl -I http://example.com
# Should return 302 redirect to portal
```

2. **Verify walled garden rules:**
```routeros
# Mikrotik
/ip hotspot walled-garden print
# Ensure portal domain is whitelisted
```

3. **Test portal accessibility:**
```bash
curl https://portal.yourdomain.com
# Should return 200 OK
```

**Solutions:**

- **Portal not loading**: Check CloudFront distribution status
- **No redirect**: Verify gateway hotspot configuration
- **Walled garden**: Add missing domains to whitelist
- **SSL issues**: Check certificate validity

---

### User Sees "Session Expired"

**Symptoms:**
- Previously working connection stops
- "Your session has expired" message
- Cannot browse internet

**Diagnosis:**

1. **Check session in DynamoDB:**
```bash
aws dynamodb get-item \
  --table-name SessionsTable \
  --key '{"sessionId":{"S":"session_123"}}'
```

2. **Review session logs:**
```bash
aws logs filter-pattern "sessionId=session_123" \
  --log-group-name /aws/lambda/SessionLambda \
  --start-time $(date -d '1 hour ago' +%s)000
```

**Solutions:**

- **Data limit exceeded**: User consumed all data
  - Solution: Purchase new package
- **Time limit exceeded**: Session duration expired
  - Solution: Re-authenticate or buy new package
- **Gateway disconnected user**: CoA sent from system
  - Check why CoA was triggered in logs
- **Session manually terminated**: Admin action
  - Check admin logs for termination reason

---

### Voucher Code Not Working

**Symptoms:**
- "Invalid voucher" error
- "Voucher already used"
- "Voucher expired"

**Diagnosis:**

1. **Check voucher in DynamoDB:**
```bash
aws dynamodb get-item \
  --table-name VouchersTable \
  --key '{"voucherCode":{"S":"WIFI-ABC123-XYZ"}}'
```

2. **Common states:**
```json
// Unused (should work)
{
  "voucherCode": "WIFI-ABC123",
  "status": "unused",
  "expiresAt": "2025-12-31T23:59:59Z"
}

// Already used
{
  "voucherCode": "WIFI-ABC123",
  "status": "used",
  "usedBy": "user_456",
  "usedAt": "2025-11-17T10:00:00Z"
}

// Expired
{
  "voucherCode": "WIFI-ABC123",
  "status": "expired",
  "expiresAt": "2025-11-01T00:00:00Z"
}
```

**Solutions:**

- **Invalid voucher**: Code doesn't exist
  - Verify user typed correctly
  - Check if voucher was generated
- **Already used**: Can only be used once
  - Generate new voucher for user
- **Expired**: Past expiration date
  - Generate new voucher batch
- **Wrong format**: Must match `WIFI-XXXXXX-XXX` pattern
  - User may have typo

---

## Payment Issues

### M-Pesa Payment Not Going Through

**Symptoms:**
- STK Push not received on phone
- User enters PIN but payment fails
- Timeout waiting for payment

**Diagnosis:**

1. **Check transaction status:**
```bash
aws dynamodb query \
  --table-name TransactionsTable \
  --index-name userId-timestamp-index \
  --key-condition-expression "userId = :uid" \
  --expression-attribute-values '{":uid":{"S":"user_123"}}' \
  --scan-index-forward false \
  --limit 5
```

2. **Check M-Pesa API logs:**
```bash
aws logs filter-pattern "M-Pesa" \
  --log-group-name /aws/lambda/PaymentLambda \
  --start-time $(date -d '30 minutes ago' +%s)000
```

3. **Test M-Pesa connectivity:**
```bash
curl -X POST https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials \
  -H "Authorization: Basic $(echo -n 'KEY:SECRET' | base64)"
# Should return access token
```

**Solutions:**

#### Problem: STK Push Not Sent

**Possible Causes:**
- M-Pesa API down
- Invalid credentials
- Phone number format wrong
- Network timeout

**Resolution:**
```typescript
// Check phone format
const formatted = formatPhoneNumber('0712345678');
console.log(formatted);  // Should be: 254712345678

// Test with sandbox
MPESA_ENVIRONMENT=sandbox npm run test:mpesa
```

#### Problem: User Didn't Receive Prompt

**Causes:**
- Phone is off/out of coverage
- M-Pesa app not installed
- SIM card issues

**Resolution:**
- Ask user to check phone signal
- Retry payment
- Use alternative payment method

#### Problem: Payment Fails After PIN Entry

**Causes:**
- Insufficient funds (ResultCode: 1)
- Wrong PIN (ResultCode: 2001)
- Request cancelled (ResultCode: 1032)

**Resolution:**
```bash
# Check callback for error code
aws logs filter-pattern "ResultCode" \
  --log-group-name /aws/lambda/PaymentLambda

# Common error codes:
# 1 = Insufficient funds - user needs to top up
# 2001 = Wrong PIN - user to try again
# 1032 = Cancelled - user declined payment
# 1037 = Timeout - user didn't enter PIN
# (Use /payment/status?transactionId=... or POST /payment/query for manual fallback)
```

---

### Payment Callback Not Received

**Symptoms:**
- Payment deducted from M-Pesa
- No internet access granted
- Transaction stuck in "pending"
- User session not created or extended

**Diagnosis:**

1. **Check if callback was received:**
```bash
aws logs filter-pattern "CheckoutRequestID=ws_CO_123" \
  --log-group-name /aws/lambda/PaymentLambda
```

2. **Verify callback URL is accessible:**
```bash
curl -X POST https://api.yourdomain.com/api/payment/callback \
  -H "Content-Type: application/json" \
  -d @test-callback.json
```

3. **Check API Gateway logs:**
```bash
aws logs tail /aws/apigateway/wifi-billing --follow
```

**Solutions:**

#### Callback URL Not Reachable

**Causes:**
- SSL certificate expired
- API Gateway down
- Firewall blocking Safaricom IPs
- Lambda timeout

**Resolution:**
```bash
# Check SSL certificate
curl -I https://api.yourdomain.com
# Expiry should be in future

# Whitelist Safaricom IPs
aws wafv2 create-ip-set \
  --name safaricom-ips \
  --addresses 196.201.214.200/32 196.201.214.206/32
```

#### Callback Received But Not Processed

**Causes:**
- Lambda crashed
- DynamoDB write failed
- SQS queue full

**Resolution:**
```bash
# Check Lambda errors
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=PaymentLambda \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# Check DynamoDB throttling
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name SystemErrors \
  --dimensions Name=TableName,Value=TransactionsTable
```

#### Manual Refund Required

If payment deducted but service not provided:

```typescript
// scripts/manual-refund.ts

### Pending Transaction Remains Pending (>60s)

**Symptoms:**
- Transaction stays `pending` well after user approves payment
- Callback log absent
- User confirms debit SMS

**Actions:**
1. Identify `checkoutRequestID` from initiation response or logs.
2. Invoke manual query:
```bash
curl -X POST https://api.yourdomain.com/payment/query \
  -H "Content-Type: application/json" \
  -d '{"checkoutRequestID":"ws_CO_17112025120000123456789","transactionId":"txn_123"}'
```
3. Interpret `resultCode`:
   - `0` → System synthesizes callback; transaction becomes `completed`.
   - `1032` → User cancelled; mark `cancelled`.
   - `1037` → Timeout; mark `expired`.
   - Other / still pending → Wait for callback, optionally retry once.

**Escalate** if pending >2 minutes and manual query still pending: log anomaly, monitor callback latency metrics.

**Metrics to Watch:** `PendingQueryFallback`, `PaymentCancelled`, `PaymentExpired`, `OAuthTokenReuseHit` for token efficiency.

---
async function processRefund(transactionId: string) {
  // 1. Update transaction status
  await dynamodb.update({
    TableName: 'TransactionsTable',
    Key: { transactionId },
    UpdateExpression: 'SET #status = :refunded',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':refunded': 'refunded' }
  });

  // 2. Notify user
  await sendSMS(phoneNumber, 'Payment refund initiated. Allow 24-48hrs.');

  // 3. Log for manual processing
  console.log(`REFUND_REQUIRED: ${transactionId}`);
}
```

---

## Gateway Issues

### Gateway Not Sending CoA

**Symptoms:**
- Payment successful
- User not getting internet access
- Session created but gateway doesn't authorize

**Diagnosis:**

1. **Check CoA queue:**
```bash
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/.../CoA_Queue \
  --attribute-names All
```

2. **Check CoA Lambda logs:**
```bash
aws logs tail /aws/lambda/CoA_Lambda --follow
```

3. **Test gateway CoA port:**
```bash
# Test if port 3799 is open
nc -zv gateway-ip 3799

# Send test CoA
echo "User-Name=test" | radclient gateway-ip:3799 disconnect secret
```

**Solutions:**

- **CoA port closed**: Open port 3799 on gateway firewall
- **Wrong RADIUS secret**: Update in Lambda environment variables
- **Gateway doesn't support CoA**: Use HTTP API instead
- **Lambda can't reach gateway**: Check network connectivity

---

### Gateway Not Reporting Usage

**Symptoms:**
- Users staying connected past data limit
- Usage statistics not updating
- No disconnect when quota exceeded

**Diagnosis:**

1. **Check if usage updates are being received:**
```bash
aws logs filter-pattern "session/usage" \
  --log-group-name /aws/lambda/SessionLambda \
  --start-time $(date -d '10 minutes ago' +%s)000
```

2. **Verify gateway script is running:**
```routeros
# Mikrotik
/system scheduler print
/system script print
```

**Solutions:**

- **Scheduler not running**: Re-enable reporting script
- **API authentication failed**: Check API key
- **Network connectivity**: Test gateway to API connectivity
- **Script error**: Review script logs on gateway

---

## System Issues

### High Lambda Error Rate

**Symptoms:**
- Spike in CloudWatch errors
- Users reporting intermittent issues
- 500 errors from API

**Diagnosis:**

1. **Check error types:**
```bash
aws logs filter-pattern "ERROR" \
  --log-group-name /aws/lambda/PaymentLambda \
  --start-time $(date -d '1 hour ago' +%s)000 | \
  jq '.events[].message' | \
  sort | uniq -c
```

2. **Check Lambda metrics:**
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=PaymentLambda \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

**Common Errors:**

#### DynamoDB ProvisionedThroughputExceededException

**Solution:**
```bash
# Switch to on-demand billing mode
aws dynamodb update-table \
  --table-name SessionsTable \
  --billing-mode PAY_PER_REQUEST
```

#### Lambda Timeout

**Solution:**
```yaml
# Increase timeout in template.yaml
PaymentLambda:
  Type: AWS::Serverless::Function
  Properties:
    Timeout: 60  # Increase from 30
```

#### Out of Memory

**Solution:**
```yaml
# Increase memory in template.yaml
PaymentLambda:
  Type: AWS::Serverless::Function
  Properties:
    MemorySize: 1024  # Increase from 512
```

---

### DynamoDB Throttling

**Symptoms:**
- Slow API responses
- Intermittent errors
- "ProvisionedThroughputExceededException"

**Diagnosis:**

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=SessionsTable \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Sum
```

**Solutions:**

1. **Switch to on-demand:**
```bash
aws dynamodb update-table \
  --table-name SessionsTable \
  --billing-mode PAY_PER_REQUEST
```

2. **Increase provisioned capacity:**
```bash
aws dynamodb update-table \
  --table-name SessionsTable \
  --provisioned-throughput ReadCapacityUnits=100,WriteCapacityUnits=50
```

3. **Add caching:**
```typescript
import { createCache } from './cache';

const cache = createCache({ ttl: 300 });  // 5 minutes

async function getSession(sessionId: string) {
  const cached = cache.get(sessionId);
  if (cached) return cached;
  
  const session = await dynamodb.getItem({...});
  cache.set(sessionId, session);
  return session;
}
```

---

### API Gateway 429 Errors

**Symptoms:**
- Users getting "Too Many Requests"
- Rate limit exceeded messages
- Intermittent connection failures

**Diagnosis:**

```bash
aws logs filter-pattern "429" \
  --log-group-name /aws/apigateway/wifi-billing
```

**Solutions:**

1. **Increase throttle limits:**
```bash
aws apigateway update-usage \
  --usage-plan-id abcdef \
  --patch-operations op=replace,path=/throttle/rateLimit,value=1000
```

2. **Implement client-side retry:**
```typescript
async function apiCallWithRetry(url: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetch(url);
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        await sleep(Math.pow(2, i) * 1000);  // Exponential backoff
        continue;
      }
      throw error;
    }
  }
}
```

---

## Debugging Tools

### CloudWatch Logs Insights

**Find all payment failures:**
```sql
fields @timestamp, details.transactionId, details.errorCode
| filter message like /payment failed/
| sort @timestamp desc
| limit 100
```

**Calculate average session duration:**
```sql
fields details.duration
| filter message = "Session terminated"
| stats avg(details.duration) as avgDuration by bin(1h)
```

**Top error messages:**
```sql
fields @message
| filter level = "ERROR"
| stats count() as errorCount by @message
| sort errorCount desc
| limit 10
```

### AWS X-Ray

Enable tracing to debug slow requests:

```typescript
import AWSXRay from 'aws-xray-sdk-core';
import AWS from 'aws-sdk';

const dynamodb = AWSXRay.captureAWSClient(new AWS.DynamoDB());
```

View traces:
```bash
aws xray get-trace-summaries \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S)
```

### Local Testing

```bash
# Start SAM local
sam local start-api --port 3000

# Invoke function locally
sam local invoke PaymentLambda \
  --event events/payment-callback.json

# Debug with VS Code
sam local start-api --debug-port 5858
```

---

## Emergency Procedures

### System-Wide Outage

1. **Check AWS Service Health:**
   - https://status.aws.amazon.com/

2. **Rollback last deployment:**
```bash
sam deploy --stack-name wifi-billing-prod \
  --parameter-overrides Version=previous
```

3. **Enable maintenance mode:**
```typescript
// Update S3 portal with maintenance page
aws s3 cp maintenance.html s3://portal-bucket/index.html
```

4. **Notify users:**
```bash
# Send bulk SMS
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:123456:NotificationsTopic \
  --message "Service temporarily unavailable. We're working to restore it."
```

---

## Getting Help

### Support Channels

1. **AWS Support**: For infrastructure issues
2. **Safaricom Daraja**: For M-Pesa issues (apisupport@safaricom.co.ke)
3. **GitHub Issues**: For code bugs
4. **Community Forum**: For general questions

### Escalation Path

1. **Level 1**: Check logs, restart service
2. **Level 2**: Senior engineer review
3. **Level 3**: AWS Support ticket
4. **Level 4**: Emergency hotline

### Logging Best Practices

Always include:
- Request ID
- User ID
- Timestamp
- Error stack trace
- Relevant context

```typescript
console.error({
  level: 'ERROR',
  message: 'Payment failed',
  requestId: context.requestId,
  userId: user.userId,
  error: error.message,
  stack: error.stack,
  details: { transactionId, amount, phoneNumber }
});
```
