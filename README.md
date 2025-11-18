# 🌐 Serverless ISP WiFi Billing System 

A fully serverless, scalable, and production-ready WiFi hotspot billing system built on AWS, featuring M-Pesa payment integration optimized for the Kenyan market.

## 🎯 Overview

This system provides a complete **plug-and-play** solution for network providers to monetize WiFi hotspots with minimal infrastructure. Users connect to WiFi, get redirected to a captive portal, and can purchase internet access using M-Pesa STK Push.

### Key Features

✅ **Serverless Architecture** - No servers to manage, auto-scaling, pay-per-use  
✅ **M-Pesa Integration** - Safaricom Daraja API with STK Push  
✅ **Multi-Gateway Support** - Works with Mikrotik, UniFi, pfSense, etc.  
✅ **Time-Based Billing** - Unlimited data with time limits and bandwidth control  
✅ **JWT Authentication** - Secure user/admin role-based access  
✅ **Voucher System** - Generate and validate prepaid vouchers with MAC binding  
✅ **Next.js Admin Dashboard** - Modern UI for managing gateways, users, packages, sessions, and more  
✅ **CloudWatch Metrics** - Real-time monitoring of payments and sessions  
✅ **99.9% Uptime** - Built on AWS managed services  
✅ **Auto-Expiry** - DynamoDB TTL for automatic session cleanup  


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
3. **Payment** → STK Push initiated → Inline safety polling (2 quick STK queries) → Pending or early success
4. **Callback / Fallback** → M-Pesa webhook OR manual `/payment/query` (if delayed) → PaymentLambda finalizes
5. **Authorization** → Create OR extend session → CoA_Lambda updates gateway bandwidth/access
6. **Session Tracking** → Time-based session auto-expires (DynamoDB TTL)
# Install all dependencies
npm install
```

### Payment (Public)
- `POST /payment/initiate` - Start M-Pesa STK Push (with inline safety polling)
- `POST /payment/callback` - M-Pesa webhook (internal)
- `GET /payment/status?transactionId=` - Check payment status
- `POST /payment/query` - Manual STK query fallback (finalize pending)
- `GET /payment/packages` - List active packages
```

### TransactionsTable
- `transactionId` (PK) - Internal transaction ID
- `userId` - Reference to user
- `amount` - Payment amount (KES)
- `phoneNumber` - M-Pesa number
- `packageId` / `packageName` - Purchased package
- `status` - pending/completed/failed/cancelled/expired
- `mpesaTransactionId` / `checkoutRequestID` - STK identifiers
- `mpesaReceiptNumber` - Receipt (blank in sandbox until callback)
- `timestamp` - Initiation time
- `completedAt` - Finalization time
- `cancellationReason` / `cancelledAt` - Present when user cancels (ResultCode 1032)
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your_passkey
### Payment Metrics
- Payment success rate
- Cancellation rate (ResultCode 1032)
- Expiration rate (ResultCode 1037)
- Average transaction value
- Failed payments by error code
- Callback latency (initiate → completedAt)
- Manual query fallback count

# System Configuration
SYSTEM_NAME=MyHotspot
ADMIN_EMAIL=admin@example.com
```
**Built with ❤️ for the Kenyan WiFi market — now with resilient payment confirmation (inline polling + manual query fallback).**
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
├── frontend/                    # Captive portal UI (static)
│   ├── index.html              # User-facing portal with teal theme
│   ├── styles.css              # Responsive design, Manrope font
│   └── app.js                  # Payment flow, MAC-based session tracking
├── admin/                       # Next.js admin dashboard
│   ├── src/
│   │   ├── app/                # App router pages
│   │   │   ├── page.tsx       # Dashboard with stats
│   │   │   ├── gateways/      # MikroTik/RADIUS configuration
│   │   │   ├── packages/      # Package management
│   │   │   ├── users/         # User management
│   │   │   ├── sessions/      # Session monitoring
│   │   │   ├── transactions/  # Payment history
│   │   │   ├── vouchers/      # Voucher generation
│   │   │   └── settings/      # System settings
│   │   ├── components/        # UI components (shadcn-style)
│   │   └── lib/               # API client & utilities
│   ├── package.json
│   └── README.md              # Admin setup instructions
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

Time-based packages with bandwidth limits (unlimited data):

| Package | Duration | Bandwidth | Price (KES) |
|---------|----------|-----------|-------------|
| Basic   | 1 hour   | 2 Mbps    | 20 |
| Standard | 3 hours | 5 Mbps    | 50 |
| Premium | 6 hours | 10 Mbps   | 100 |
| Ultra | 24 hours | 20 Mbps   | 300 |

Packages are stored in DynamoDB and managed via admin API endpoints.

## 🔐 Security

- **HTTPS Only** - All communications encrypted
- **API Authentication** - JWT tokens with expiration
- **M-Pesa Validation** - Signature verification for callbacks
- **Rate Limiting** - DDoS protection via API Gateway
- **IAM Roles** - Least privilege access for Lambda functions
- **Secrets Manager** - Encrypted credential storage

## 📊 DynamoDB Tables

### UsersTable
- `phoneNumber` (PK) - M-Pesa phone number (primary key)
- `userId` - Unique UUID identifier
- `roles` - Array of roles (user/admin)
- `status` - active/suspended/inactive
- `createdAt` - Registration timestamp
- `lastLoginAt` - Last login time

### SessionsTable
- `sessionId` (PK) - Unique session identifier
- `userId` - UUID reference to user
- `phoneNumber` - Phone number for convenience
- `packageId` - Reference to package
- `packageName` - Package display name
- `macAddress` - Device MAC (enforces one session per device)
- `ipAddress` - Assigned IP
- `gatewayId` - Gateway identifier
- `startTime` - Session start
- `expiresAt` - Automatic expiration time
- `durationHours` - Package duration
- `bandwidthMbps` - Speed limit
- `status` - active/expired/terminated
- `ttl` - DynamoDB TTL for auto-cleanup

### TransactionsTable
- `transactionId` (PK) - M-Pesa transaction ID
- `userId` - Reference to user
- `amount` - Payment amount (KES)
- `phoneNumber` - M-Pesa number
- `status` - pending/completed/failed
- `timestamp` - Transaction time

### VouchersTable
- `voucherCode` (PK) - Unique voucher code
- `packageId` - Associated time-based package
- `status` - unused/used/expired
- `createdAt` - Generation time
- `expiresAt` - Optional expiration date
- `usedAt` - Redemption time
- `usedBy` - User ID who redeemed
- `usedByMac` - MAC address of redemption device
- `batchId` - Batch identifier for bulk generation
- `ttl` - DynamoDB TTL for auto-expiry

## 🔌 API Endpoints

### Authentication (Public)
- `POST /auth/login` - User login (returns JWT token)
- `POST /auth/voucher` - Redeem voucher with MAC binding
- `POST /auth/validate` - Validate active session
- `POST /auth/logout` - Terminate session
- `GET /auth/status` - Check session status

### Payment (Public)
- `POST /payment/initiate` - Start M-Pesa STK Push
- `POST /payment/callback` - M-Pesa webhook (internal)
- `GET /payment/status` - Check payment status
- `GET /payment/packages` - List active packages

### Admin Management
- `GET /admin/packages` - List all packages (admin only)
- `POST /admin/packages` - Create package (admin only)
- `PUT /admin/packages/{id}` - Update package (admin only)
- `DELETE /admin/packages/{id}` - Delete package (admin only)
- `GET /admin/users` - List users with activity (admin only)
- `GET /admin/sessions` - List all sessions (admin only)
- `POST /admin/sessions/{id}/terminate` - Disconnect session (admin only)
- `GET /admin/transactions` - Payment history (admin only)
- `POST /admin/vouchers/generate` - Generate voucher batch (admin only)
- `GET /admin/vouchers` - List all vouchers (admin only)
- `GET /admin/gateways` - List gateways (admin only)
- `POST /admin/gateways` - Add gateway (admin only)
- `GET /admin/dashboard` - Dashboard statistics (admin only)

**Note**: Admin endpoints require JWT with `admin` role in Authorization header.

## 🎨 Admin Dashboard

The Next.js admin dashboard provides a modern interface for system management:

**Features:**
- 📊 Dashboard with real-time statistics
- 🌐 MikroTik gateway & RADIUS configuration
- 📦 Package management (CRUD operations)
- 👥 User management with activity tracking
- 🔄 Active session monitoring & disconnect
- 💳 Transaction history with M-Pesa receipts
- 🎟️ Voucher generation & management
- ⚙️ System settings (M-Pesa, RADIUS, notifications)

**Quick Start:**
```bash
cd admin
npm install
npm run dev  # Runs on http://localhost:3001
```

See **[admin/README.md](admin/README.md)** for detailed setup and deployment instructions.

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
# First, get package IDs from DynamoDB
npm run seed-packages  # Seeds default packages

# Generate vouchers with package ID
npm run generate-vouchers -- --count 100 --package pkg_<id> --expiry 30 --export
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
Packages are managed via admin API endpoints:
```bash
# Create a new package via API
curl -X POST https://api.yourdomain.com/api/admin/packages \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Custom Package",
    "description": "Custom time-based package",
    "durationHours": 12,
    "bandwidthMbps": 15,
    "priceKES": 200
  }'

# Or use the seed script
npm run seed-packages
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
- **Email**: billmalea@gmail.com
- **WhatsApp**: +254 27800223

## 📄 License

AGPL-3.0 License - see [LICENSE](LICENSE) file

This project is licensed under the GNU Affero General Public License v3.0. If you modify this software and provide it as a service over a network, you must make the source code available.

## 🤝 Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md)

## 🙏 Acknowledgments

- AWS Serverless Application Model
- Safaricom Daraja API
- Mikrotik RouterOS
- OpenWrt Community

---

**Built with ❤️ for the Kenya**
