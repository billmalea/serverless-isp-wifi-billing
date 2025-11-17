# 🌐 Serverless WiFi Billing System for Kenya

A fully serverless, scalable, and production-ready WiFi hotspot billing system built on AWS, featuring M-Pesa payment integration optimized for the Kenyan market.

## 🎯 Overview

This system provides a complete **plug-and-play** solution for network providers to monetize WiFi hotspots with minimal infrastructure. Users connect to WiFi, get redirected to a captive portal, and can purchase internet access using M-Pesa STK Push.

### Key Features

✅ **Serverless Architecture** - No servers to manage, auto-scaling, pay-per-use  
✅ **M-Pesa Integration** - Safaricom Daraja API with STK Push  
✅ **Multi-Gateway Support** - Works with Mikrotik, UniFi, pfSense, etc.  
✅ **Real-time Billing** - Track data usage, time limits, and bandwidth  
✅ **Voucher System** - Generate and validate prepaid vouchers  
✅ **Admin Dashboard** - Monitor users, transactions, and system health  
✅ **CloudFront CDN** - Fast captive portal loading globally  
✅ **99.9% Uptime** - Built on AWS managed services  
✅ **SMS Notifications** - Optional SMS alerts for payments and vouchers  


## 🏗️ Architecture

### Architecture Overview

The system is built entirely on AWS serverless services, ensuring automatic scaling, high availability, and minimal operational overhead.

For detailed architecture documentation, see **[Architecture Guide](docs/ARCHITECTURE.md)**.

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        AWS Cloud                                │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────────┐  │
│  │   CloudFront │────│  API Gateway │────│ Lambda Functions│  │
│  │     (CDN)    │    │   (REST API) │    │   - Auth        │  │
│  └──────────────┘    └──────────────┘    │   - Payment     │  │
│          │                                │   - CoA         │  │
│          │                                │   - Portal      │  │
│  ┌──────────────┐                        └─────────────────┘  │
│  │   S3 Bucket  │                                │             │
│  │ (Portal HTML)│                                │             │
│  └──────────────┘                        ┌───────▼──────────┐  │
│                                           │   DynamoDB       │  │
│  ┌──────────────┐    ┌──────────────┐    │  - Users        │  │
│  │     SQS      │    │     SNS      │    │  - Sessions     │  │
│  │   (Queues)   │    │  (Alerts)    │    │  - Vouchers     │  │
│  └──────────────┘    └──────────────┘    │  - Transactions │  │
│                                           └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  M-Pesa Daraja   │
                    │   API Gateway    │
                    └──────────────────┘
```

### Data Flow

1. **User Connection** → Hotspot Gateway redirects to Captive Portal (CloudFront/S3)
2. **Authentication** → User selects package → API Gateway → AuthLambda → DynamoDB
3. **Payment** → M-Pesa STK Push initiated → PaymentLambda → Daraja API
4. **Callback** → M-Pesa webhook → PaymentLambda → SQS → DynamoDB update
5. **Authorization** → CoA_Lambda → Gateway updates bandwidth/access
6. **Session Tracking** → Gateway polls usage → API updates DynamoDB

## 📋 Prerequisites

- AWS Account with appropriate permissions
- Safaricom Daraja API credentials (Consumer Key & Secret)
- M-Pesa Paybill or Till Number
- Domain name (optional but recommended)
- Hotspot Gateway (Mikrotik/UniFi/pfSense)

## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone <repository-url>
cd serverless-wifi-billing
```

### 2. Install Dependencies

```bash
# Install all dependencies
npm install
```

### 3. Configure Environment

```bash
cp config/example.env .env
```

Edit `.env` with your credentials:

```env
# M-Pesa Daraja API
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your_passkey
MPESA_CALLBACK_URL=https://api.yourdomain.com/payment/callback

# AWS Region
AWS_REGION=us-east-1

# System Configuration
SYSTEM_NAME=MyHotspot
ADMIN_EMAIL=admin@example.com
```

### 4. Deploy Infrastructure

```bash
# Using AWS SAM
npm run build
sam build
sam deploy --guided

# Or use the deployment script
.\scripts\deploy.ps1 -Environment dev
```


## 📚 Documentation

Comprehensive documentation is available in the `docs/` folder:

### Core Documentation

- **[Architecture Guide](docs/ARCHITECTURE.md)** - Detailed system design, component interactions, AWS services, data flows, and scalability patterns
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Step-by-step deployment using AWS SAM, from setup to production
- **[API Reference](docs/API.md)** - Complete API documentation with request/response schemas, authentication, and examples

### Integration Guides

- **[M-Pesa Integration](docs/MPESA_INTEGRATION.md)** - Safaricom Daraja API setup, STK Push implementation, callback handling, and testing
- **[Gateway Setup](docs/GATEWAY_SETUP.md)** - Configuration guides for Mikrotik, UniFi, pfSense, and generic RADIUS gateways

### Operations

- **[Monitoring & Operations](docs/MONITORING.md)** - CloudWatch dashboards, metrics, alarms, logging, and operational procedures
- **[Testing Guide](docs/TESTING.md)** - Unit tests, integration tests, E2E tests, load testing, and M-Pesa sandbox testing
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues, debugging procedures, and incident response

### Architecture Images

Visual diagrams are available in `docs/images/`:
- System architecture overview
- Component interactions
- Data flow diagrams
- Network topology

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed deployment instructions.

### 5. Configure Hotspot Gateway

#### For Mikrotik:
```
/ip hotspot profile
set default login-by=http-chap,http-pap
/ip hotspot user profile
set default shared-users=1 rate-limit=2M/2M
/ip hotspot
set [find] address-pool=hs-pool-1 profile=default
```

See **[Gateway Setup Guide](docs/GATEWAY_SETUP.md)** for detailed Mikrotik, UniFi, and pfSense configuration.

## 📦 Project Structure

```
serverless-wifi-billing/
├── lambda/                      # AWS Lambda functions (TypeScript)
│   ├── auth/                    # Authentication & voucher validation
│   ├── payment/                 # M-Pesa payment processing
│   └── coa/                     # Change of Authorization
├── frontend/                    # Captive portal UI
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── src/                         # Shared TypeScript code
│   ├── types/                   # Type definitions
│   └── utils/                   # Helper functions
├── docs/                        # Documentation
│   ├── DEPLOYMENT.md            # Deployment guide
│   ├── ARCHITECTURE.md          # System architecture
│   ├── API.md                   # API reference
│   ├── MPESA_INTEGRATION.md     # M-Pesa setup
│   ├── GATEWAY_SETUP.md         # Gateway configuration
│   ├── MONITORING.md            # Monitoring & ops
│   ├── TESTING.md               # Testing guide
│   ├── TROUBLESHOOTING.md       # Troubleshooting
│   └── images/                  # Architecture diagrams
├── config/                      # Configuration files
│   ├── example.env
│   └── packages.json            # Data packages & pricing
├── scripts/                     # Deployment & utility scripts
│   ├── deploy.ps1
│   └── generate-vouchers.ts
├── tests/                       # Unit & integration tests
├── template.yaml                # AWS SAM template
├── samconfig.toml              # SAM configuration
└── package.json                # Node.js dependencies
```

## 💰 Pricing Packages

Default packages (customizable in `config/packages.json`):

| Package | Data | Time | Price (KES) |
|---------|------|------|-------------|
| Basic   | 500MB | 24h | 20 |
| Standard | 1GB | 24h | 50 |
| Premium | 3GB | 48h | 100 |
| Ultra | 10GB | 7 days | 300 |

## 🔐 Security

- **HTTPS Only** - All communications encrypted
- **API Authentication** - JWT tokens with expiration
- **M-Pesa Validation** - Signature verification for callbacks
- **Rate Limiting** - DDoS protection via API Gateway
- **IAM Roles** - Least privilege access for Lambda functions
- **Secrets Manager** - Encrypted credential storage

## 📊 DynamoDB Tables

### UsersTable
- `userId` (PK) - Unique user identifier
- `phoneNumber` - M-Pesa phone number
- `balance` - Remaining data/time balance
- `plan` - Active subscription plan
- `createdAt` - Registration timestamp

### SessionsTable
- `sessionId` (PK) - Unique session identifier
- `userId` - Reference to user
- `macAddress` - Device MAC
- `ipAddress` - Assigned IP
- `startTime` - Session start
- `dataUsed` - Bytes consumed
- `status` - active/expired/terminated

### TransactionsTable
- `transactionId` (PK) - M-Pesa transaction ID
- `userId` - Reference to user
- `amount` - Payment amount (KES)
- `phoneNumber` - M-Pesa number
- `status` - pending/completed/failed
- `timestamp` - Transaction time

### VouchersTable
- `voucherCode` (PK) - Unique voucher code
- `package` - Associated data package
- `status` - unused/used/expired
- `createdAt` - Generation time
- `usedAt` - Redemption time

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/voucher` - Redeem voucher
- `POST /api/auth/validate` - Validate session

### Payment
- `POST /api/payment/initiate` - Start M-Pesa payment
- `POST /api/payment/callback` - M-Pesa webhook
- `GET /api/payment/status/:id` - Check payment status

### Session Management
- `POST /api/session/create` - Create new session
- `POST /api/session/usage` - Update data usage
- `DELETE /api/session/terminate` - End session

### Admin (Protected)
- `GET /api/admin/users` - List all users
- `GET /api/admin/transactions` - Transaction history
- `POST /api/admin/voucher/generate` - Create vouchers
- `GET /api/admin/stats` - System statistics

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Test M-Pesa integration (sandbox)
npx ts-node scripts/test-mpesa.ts
```

## 📈 Monitoring

- **CloudWatch Dashboards** - Real-time metrics
- **CloudWatch Alarms** - Alert on errors, high latency
- **X-Ray Tracing** - End-to-end request tracking
- **Custom Metrics** - Revenue, active users, success rates

## 🛠️ Maintenance

### Generate Vouchers
```bash
npm run generate-vouchers -- --count 100 --package standard --export
```

### Backup Database
```bash
aws dynamodb create-backup --table-name UsersTable --backup-name users-backup-$(date +%Y%m%d)
```

### View Logs
```bash
aws logs tail /aws/lambda/AuthLambda --follow
```

## 💡 Customization

### Change Portal Theme
Edit `frontend/styles.css` and upload to S3:
```bash
aws s3 sync frontend/ s3://your-portal-bucket/
```

### Add Payment Methods
Extend `lambda/payment/index.ts` to support:
- Airtel Money
- PayPal
- Credit Cards (Stripe)

### Custom Pricing
Edit `config/packages.json` and redeploy:
```bash
npm run build
sam build && sam deploy
```

## 🌍 Kenya-Specific Features

- **M-Pesa STK Push** - Native Safaricom integration
- **Sheng UI** - Optional Swahili/Sheng language support
- **Affordable Packages** - Pricing optimized for Kenyan market
- **Low Data Mode** - Optimized for slow connections
- **SMS Integration** - Voucher delivery via African's Talking

## 📞 Support

- **Documentation**: [Complete docs in /docs](docs/)
- **API Reference**: [API.md](docs/API.md)
- **Troubleshooting**: [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- **Issues**: GitHub Issues
- **Email**: support@example.com
- **WhatsApp**: +254 XXX XXX XXX

## 📄 License

MIT License - see [LICENSE](LICENSE) file

## 🤝 Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md)

## 🙏 Acknowledgments

- AWS Serverless Application Model
- Safaricom Daraja API
- Mikrotik RouterOS
- OpenWrt Community

---

**Built with ❤️ for the Kenyan WiFi market**
