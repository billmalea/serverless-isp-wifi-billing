# Monitoring and Operations Guide

Comprehensive guide for monitoring, maintaining, and operating the WiFi billing system.

## Table of Contents

1. [CloudWatch Monitoring](#cloudwatch-monitoring)
2. [Metrics and KPIs](#metrics-and-kpis)
3. [Alarms and Alerts](#alarms-and-alerts)
4. [Logging](#logging)
5. [Operations](#operations)
6. [Incident Response](#incident-response)

---

## CloudWatch Monitoring

### Dashboard Setup

Create a comprehensive CloudWatch dashboard:

```bash
aws cloudwatch put-dashboard --dashboard-name WiFiBilling --dashboard-body file://dashboard.json
```

**dashboard.json:**
```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["WiFiBilling", "ActiveSessions"],
          [".", "NewSessions"],
          [".", "TerminatedSessions"]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-east-1",
        "title": "Active Sessions"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["WiFiBilling", "Revenue", {"stat": "Sum"}],
          [".", "Transactions", {"stat": "Sum"}]
        ],
        "period": 86400,
        "stat": "Sum",
        "region": "us-east-1",
        "title": "Daily Revenue & Transactions"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/Lambda", "Errors", {"stat": "Sum"}],
          [".", "Throttles", {"stat": "Sum"}]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "us-east-1",
        "title": "Lambda Errors"
      }
    }
  ]
}
```

### Custom Metrics

Publish custom metrics from Lambda:

```typescript
import { CloudWatch } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatch({ region: process.env.AWS_REGION });

async function publishMetric(metricName: string, value: number, unit: string = 'Count') {
  await cloudwatch.putMetricData({
    Namespace: 'WiFiBilling',
    MetricData: [{
      MetricName: metricName,
      Value: value,
      Unit: unit,
      Timestamp: new Date(),
      Dimensions: [{
        Name: 'Environment',
        Value: process.env.ENVIRONMENT || 'production'
      }]
    }]
  });
}

// Usage examples
await publishMetric('PaymentSuccess', 1);
await publishMetric('DataUsage', bytesUsed, 'Bytes');
await publishMetric('SessionDuration', seconds, 'Seconds');
```

---

## Metrics and KPIs

### Key Performance Indicators

#### 1. **Revenue Metrics**

```typescript
// Track daily revenue
await publishMetric('Revenue', amount, 'None');

// Track by package
await cloudwatch.putMetricData({
  Namespace: 'WiFiBilling',
  MetricData: [{
    MetricName: 'Revenue',
    Value: amount,
    Dimensions: [{
      Name: 'Package',
      Value: packageName
    }]
  }]
});
```

**CloudWatch Query:**
```sql
SELECT SUM(Revenue) 
FROM "WiFiBilling" 
WHERE Package = 'standard' 
GROUP BY BIN(1d)
```

#### 2. **User Metrics**

- Total active users
- New registrations per day
- Churn rate
- Average session duration

```typescript
// New user registration
await publishMetric('NewUsers', 1);

// Active sessions
const activeSessions = await getActiveSessionCount();
await publishMetric('ActiveSessions', activeSessions);
```

#### 3. **Payment Metrics**

- Payment success rate
- Average transaction value
- Failed payments by error code
- M-Pesa response time

```typescript
// Payment outcome
await cloudwatch.putMetricData({
  Namespace: 'WiFiBilling/Payment',
  MetricData: [{
    MetricName: 'PaymentOutcome',
    Value: 1,
    Dimensions: [
      { Name: 'Status', Value: status },  // success/failure
      { Name: 'ErrorCode', Value: String(errorCode) }
    ]
  }]
});
```

#### 4. **System Metrics**

- Lambda execution time
- API Gateway latency
- DynamoDB throttling
- Error rates

---

## Alarms and Alerts

### Critical Alarms

#### 1. **High Error Rate**

```yaml
HighErrorRateAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: WiFiBilling-HighErrorRate
    MetricName: Errors
    Namespace: AWS/Lambda
    Statistic: Sum
    Period: 300
    EvaluationPeriods: 2
    Threshold: 10
    ComparisonOperator: GreaterThanThreshold
    AlarmActions:
      - !Ref CriticalAlertTopic
    AlarmDescription: More than 10 Lambda errors in 10 minutes
```

#### 2. **Payment Failures**

```yaml
PaymentFailureAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: WiFiBilling-PaymentFailures
    MetricName: PaymentOutcome
    Namespace: WiFiBilling/Payment
    Dimensions:
      - Name: Status
        Value: failure
    Statistic: Sum
    Period: 300
    EvaluationPeriods: 1
    Threshold: 5
    ComparisonOperator: GreaterThanThreshold
    AlarmActions:
      - !Ref AlertTopic
```

#### 3. **API Latency**

```yaml
HighLatencyAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: WiFiBilling-HighLatency
    MetricName: Latency
    Namespace: AWS/ApiGateway
    Statistic: Average
    Period: 60
    EvaluationPeriods: 3
    Threshold: 1000
    ComparisonOperator: GreaterThanThreshold
    AlarmActions:
      - !Ref AlertTopic
```

#### 4. **DynamoDB Throttling**

```yaml
DynamoDBThrottleAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: WiFiBilling-DynamoDB-Throttle
    MetricName: SystemErrors
    Namespace: AWS/DynamoDB
    Dimensions:
      - Name: TableName
        Value: !Ref SessionsTable
    Statistic: Sum
    Period: 60
    EvaluationPeriods: 2
    Threshold: 0
    ComparisonOperator: GreaterThanThreshold
    AlarmActions:
      - !Ref CriticalAlertTopic
```

### SNS Alert Topics

```yaml
CriticalAlertTopic:
  Type: AWS::SNS::Topic
  Properties:
    DisplayName: WiFiBilling Critical Alerts
    Subscription:
      - Endpoint: admin@yourdomain.com
        Protocol: email
      - Endpoint: +254712345678
        Protocol: sms

AlertTopic:
  Type: AWS::SNS::Topic
  Properties:
    DisplayName: WiFiBilling Alerts
    Subscription:
      - Endpoint: ops@yourdomain.com
        Protocol: email
```

---

## Logging

### Log Groups

Each Lambda function has a dedicated log group:

```
/aws/lambda/AuthLambda
/aws/lambda/PaymentLambda
/aws/lambda/CoA_Lambda
/aws/lambda/SessionLambda
```

### Log Retention

Set retention policies:

```bash
aws logs put-retention-policy \
  --log-group-name /aws/lambda/AuthLambda \
  --retention-in-days 7

aws logs put-retention-policy \
  --log-group-name /aws/lambda/PaymentLambda \
  --retention-in-days 30
```

### Structured Logging

Use JSON format for better querying:

```typescript
interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  requestId?: string;
  userId?: string;
  details?: any;
}

function log(entry: LogEntry) {
  console.log(JSON.stringify({
    ...entry,
    timestamp: new Date().toISOString()
  }));
}

// Usage
log({
  level: 'INFO',
  message: 'Payment initiated',
  requestId: context.requestId,
  userId: 'user_123',
  details: { amount: 50, package: 'standard' }
});
```

### CloudWatch Insights Queries

#### Find Failed Payments

```sql
fields @timestamp, details.transactionId, details.errorCode, details.errorMessage
| filter level = "ERROR" and message like /payment failed/
| sort @timestamp desc
| limit 100
```

#### Calculate Average Session Duration

```sql
fields @timestamp, details.duration
| filter message = "Session terminated"
| stats avg(details.duration) as avgDuration by bin(1h)
```

#### Top Revenue Packages

```sql
fields @timestamp, details.package, details.amount
| filter message = "Payment completed"
| stats sum(details.amount) as revenue by details.package
| sort revenue desc
```

---

## Operations

### Daily Tasks

#### 1. **Check Dashboard**

Review CloudWatch dashboard for:
- Active sessions count
- Revenue today
- Error rates
- API latency

#### 2. **Review Alarms**

```bash
aws cloudwatch describe-alarms \
  --state-value ALARM \
  --query 'MetricAlarms[*].[AlarmName,StateReason]' \
  --output table
```

#### 3. **Check Recent Errors**

```bash
aws logs tail /aws/lambda/PaymentLambda \
  --since 1h \
  --filter-pattern "ERROR"
```

### Weekly Tasks

#### 1. **Generate Reports**

```bash
npm run generate-report -- --period weekly
```

#### 2. **Review Capacity**

Check DynamoDB and Lambda limits:

```bash
aws lambda get-account-settings
aws dynamodb describe-limits
```

#### 3. **Backup Verification**

Verify DynamoDB backups exist:

```bash
aws dynamodb list-backups \
  --table-name UsersTable \
  --time-range-lower-bound $(date -d '7 days ago' +%s)
```

### Monthly Tasks

#### 1. **Cost Analysis**

```bash
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '1 month ago' +%Y-%m-01),End=$(date +%Y-%m-01) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=SERVICE
```

#### 2. **Security Audit**

- Review IAM roles and permissions
- Check CloudTrail logs for unauthorized access
- Verify SSL certificates expiry
- Review API Gateway access logs

#### 3. **Performance Optimization**

- Analyze Lambda cold starts
- Review DynamoDB capacity utilization
- Check CloudFront cache hit ratio
- Optimize S3 storage classes

---

## Incident Response

### Response Procedures

#### Level 1: Minor Issues
- Single user unable to connect
- Isolated payment failure
- Non-critical error spikes

**Response:**
1. Check CloudWatch logs for error details
2. Verify user's specific transaction/session
3. Refund or manually activate if needed
4. Document issue in ticket system

#### Level 2: Service Degradation
- Elevated error rates (> 5%)
- API latency > 2 seconds
- Multiple payment failures

**Response:**
1. Acknowledge alert within 15 minutes
2. Check AWS Service Health Dashboard
3. Review recent deployments
4. Scale Lambda concurrency if needed
5. Enable enhanced monitoring
6. Post status update to users

#### Level 3: Critical Outage
- Complete service unavailable
- All payments failing
- Database unavailable

**Response:**
1. Immediate escalation to senior engineer
2. Activate incident response team
3. Check AWS service status
4. Failover to backup region (if configured)
5. Communicate to all users via SMS/email
6. Document timeline for post-mortem

### Rollback Procedure

```bash
# List previous deployments
sam list stack-outputs --stack-name wifi-billing-prod

# Rollback to previous version
sam deploy \
  --stack-name wifi-billing-prod \
  --parameter-overrides LambdaVersion=previous

# Verify rollback
aws lambda list-versions-by-function \
  --function-name PaymentLambda
```

### Communication Templates

**Status Page Update:**
```
[2025-11-17 14:30 UTC] INVESTIGATING
We are currently investigating reports of payment failures.
Our team is working to identify the root cause.

[2025-11-17 14:45 UTC] IDENTIFIED
The issue has been identified as a timeout with the M-Pesa API.
We are working with Safaricom to resolve this.

[2025-11-17 15:00 UTC] RESOLVED
The issue has been resolved. All systems are operating normally.
```

**User SMS Notification:**
```
WiFi Billing: Service restored. You can now purchase packages normally.
Apologies for the inconvenience. - Team
```

---

## Maintenance Windows

### Planned Maintenance

Schedule during low-traffic periods:

**Best Times:**
- Weekdays: 2:00 AM - 4:00 AM EAT
- Avoid: Weekends, holidays, evenings

**Maintenance Checklist:**
1. Announce 48 hours in advance
2. Deploy to staging first
3. Create database backups
4. Update monitoring thresholds
5. Have rollback plan ready
6. Verify in staging
7. Deploy to production
8. Monitor for 1 hour post-deployment
9. Send completion notification

---

## Performance Tuning

### Lambda Optimization

```typescript
// Enable X-Ray tracing
import { captureAWSv3Client } from 'aws-xray-sdk';
import { DynamoDB } from '@aws-sdk/client-dynamodb';

const dynamodb = captureAWSv3Client(new DynamoDB({}));
```

### DynamoDB Optimization

```bash
# Check table metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=SessionsTable \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

---

## Compliance and Auditing

### CloudTrail Logging

Enable CloudTrail for audit logs:

```bash
aws cloudtrail create-trail \
  --name wifi-billing-audit \
  --s3-bucket-name wifi-billing-audit-logs \
  --include-global-service-events
```

### Access Logging

```yaml
ApiGatewayAccessLogs:
  Type: AWS::Logs::LogGroup
  Properties:
    LogGroupName: /aws/apigateway/wifi-billing
    RetentionInDays: 30
```

---

## Best Practices

1. **Monitor Proactively**: Set up alerts before issues become critical
2. **Automate Responses**: Use Lambda to auto-scale or self-heal
3. **Document Everything**: Maintain runbooks for common issues
4. **Test Regularly**: Run disaster recovery drills
5. **Stay Updated**: Subscribe to AWS service health notifications
6. **Cost Optimize**: Review and optimize monthly
7. **Security First**: Regular security audits and penetration testing

---

## Tools and Resources

- **AWS CloudWatch**: https://console.aws.amazon.com/cloudwatch
- **AWS X-Ray**: https://console.aws.amazon.com/xray
- **AWS Personal Health Dashboard**: https://phd.aws.amazon.com
- **Status Page**: https://status.yourdomain.com
- **Runbooks**: Internal wiki or Confluence
