# API Reference

Complete API documentation for the Serverless WiFi Billing System.

## Base URL

```
https://api.yourdomain.com
```

All API endpoints are served through AWS API Gateway with HTTPS only.

---

## Authentication

### JWT Token Authentication

Most endpoints require a JWT token in the `Authorization` header:

```http
Authorization: Bearer <jwt_token>
```

Token is obtained after successful login or voucher redemption.

**Token Expiry**: 24 hours  
**Refresh**: Not implemented (users must re-authenticate)

---

### Endpoints

#### `POST /api/auth/login`

Authenticate user with phone number and password.

**Request Body:**
```json
{
  "phoneNumber": "254712345678",
  "password": "userpassword"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "userId": "user_123",
    "phoneNumber": "254712345678",
    "status": "active",
    "activeSessions": 1
  }
}

// Note: Balance no longer stored on user. Check active sessions for time remaining.
```

**Error Responses:**
```json
// 401 Unauthorized
{
  "success": false,
  "error": "Invalid credentials"
  "error": "User not found"
```

---

#### `POST /api/auth/voucher`

Redeem a voucher code to activate internet access.

**Request Body:**
```json
{
  "voucherCode": "WIFI-ABC123-XYZ",
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "ipAddress": "192.168.1.100"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Voucher activated: Standard (3h @ 5Mbps)",
  "session": {
    "sessionId": "session_abc123",
    "userId": "user_voucher_456",
    "packageName": "Standard",
    "durationHours": 3,
    "bandwidthMbps": 5,
    "timeRemaining": 10800,
    "expiresAt": "2025-11-17T15:00:00Z"
  }
}

// Note: No data limit - unlimited data at 5 Mbps for 3 hours
```

**Error Responses:**
```json
// 400 Bad Request
{
  "success": false,
  "error": "Voucher already used"
}

// 404 Not Found
{
  "success": false,
  "error": "Invalid voucher code"
}

// 410 Gone
{
  "success": false,
  "error": "Voucher expired"
}
```

---

#### `POST /api/auth/validate`

Validate an active session token.

**Headers:**
```http
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "valid": true,
  "session": {
    "sessionId": "session_abc123",
    "userId": "user_123",
    "packageName": "Premium",
    "durationHours": 6,
    "bandwidthMbps": 10,
    "startTime": "2025-11-17T08:00:00Z",
    "expiresAt": "2025-11-17T14:00:00Z",
    "timeRemaining": 7200,
    "status": "active"
  }
}

// Note: timeRemaining in seconds, bandwidthMbps is allocated speed
```

**Error Responses:**
```json
// 401 Unauthorized
{
  "valid": false,
  "error": "Token expired"
}
```

---

### 💳 Payment

#### `POST /api/payment/initiate`

Initiate M-Pesa STK Push payment.

**Headers:**
```http
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "phoneNumber": "254712345678",
  "packageId": "pkg_standard_3h5mbps",
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "ipAddress": "192.168.1.100",
  "gatewayId": "gateway_main"
}

// macAddress required for device binding - one session per device
```

**Response (200 OK):**
```json
{
  "success": true,
  "transactionId": "tx_mpesa_789xyz",
  "checkoutRequestId": "ws_CO_17112025120000123456789",
  "message": "STK Push sent. Enter M-Pesa PIN on your phone.",
  "amount": 50,
  "phoneNumber": "254712345678"
}
```

**Error Responses:**
```json
// 400 Bad Request
{
  "success": false,
  "error": "Invalid package selected"
}

// 500 Internal Server Error
{
  "success": false,
  "error": "M-Pesa API error",
  "details": "Timeout connecting to Daraja API"
}
```

---

#### `POST /api/payment/callback`

M-Pesa callback endpoint (called by Safaricom).

**Headers:**
```http
Content-Type: application/json
```

**Request Body (from M-Pesa):**
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

**Response (200 OK):**
```json
{
  "ResultCode": 0,
  "ResultDesc": "Accepted"
}
```

---

#### `GET /api/payment/status/:transactionId`

Check payment status.

**Headers:**
```http
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "transaction": {
    "transactionId": "tx_mpesa_789xyz",
    "status": "completed",
    "amount": 50,
    "mpesaReceiptNumber": "RKL1234ABC",
    "phoneNumber": "254712345678",
    "timestamp": "2025-11-17T12:05:30Z"
  }
}
```

**Status Values:**
- `pending`: Payment initiated, waiting for user input
- `completed`: Payment successful
- `failed`: Payment failed or cancelled
- `expired`: Payment request timed out

---

### 📡 Session Management

#### `GET /api/session/status/:sessionId`

Get current session status and time remaining.

**Headers:**
```http
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "session": {
    "sessionId": "session_abc123",
    "userId": "user_123",
    "packageName": "Standard",
    "durationHours": 3,
    "bandwidthMbps": 5,
    "startTime": "2025-11-17T12:00:00Z",
    "expiresAt": "2025-11-17T15:00:00Z",
    "timeRemaining": 7200,
    "status": "active"
  }
}
```

**Note:** 
- Sessions are time-based only (no data tracking)
- `timeRemaining` is calculated from `expiresAt` timestamp
- Session auto-expires when time runs out
- One session per MAC address (device binding enforced)

---

#### `DELETE /api/session/terminate`

Terminate an active session.

**Headers:**
```http
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "sessionId": "session_abc123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Session terminated",
  "sessionId": "session_abc123"
}
```

---

### 🛡️ Admin Endpoints

All admin endpoints require admin role in JWT token.

#### `GET /api/admin/users`

List all users with pagination.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)
- `status` (optional): Filter by status (active/inactive)

**Headers:**
```http
Authorization: Bearer <admin_jwt_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "users": [
    {
      "userId": "user_123",
      "phoneNumber": "254712345678",
      "balance": {
        "data": 1073741824,
        "time": 86400
      },
      "plan": "standard",
      "status": "active",
      "createdAt": "2025-11-01T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "pages": 3
  }
}
```

---

#### `GET /api/admin/transactions`

List all transactions.

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `status` (optional): Filter by status
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Headers:**
```http
Authorization: Bearer <admin_jwt_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "transactions": [
    {
      "transactionId": "tx_mpesa_789xyz",
      "userId": "user_123",
      "amount": 50,
      "phoneNumber": "254712345678",
      "status": "completed",
      "mpesaReceiptNumber": "RKL1234ABC",
      "timestamp": "2025-11-17T12:05:30Z"
    }
  ],
  "summary": {
    "totalAmount": 15000,
    "successfulTransactions": 300,
    "failedTransactions": 15
  }
}
```

---

### 📦 Package Management

#### `GET /api/packages`

List all active packages (public endpoint).

**Response (200 OK):**
```json
{
  "success": true,
  "packages": [
    {
      "packageId": "pkg_quick_1h2mbps",
      "name": "Quick Access",
      "description": "Perfect for quick browsing",
      "durationHours": 1,
      "bandwidthMbps": 2,
      "priceKES": 15,
      "status": "active"
    },
    {
      "packageId": "pkg_standard_3h5mbps",
      "name": "Standard",
      "description": "Great for social media and streaming",
      "durationHours": 3,
      "bandwidthMbps": 5,
      "priceKES": 50,
      "status": "active"
    }
  ],
  "count": 7
}
```

---

#### `GET /api/admin/packages`

List all packages including inactive (admin only).

**Headers:**
```http
Authorization: Bearer <admin_jwt_token>
```

**Query Parameters:**
- `status` (optional): Filter by status (active/inactive)

**Response (200 OK):**
```json
{
  "success": true,
  "packages": [
    {
      "packageId": "pkg_premium_6h10mbps",
      "name": "Premium",
      "description": "High-speed internet",
      "durationHours": 6,
      "bandwidthMbps": 10,
      "priceKES": 100,
      "status": "active",
      "createdAt": "2025-11-01T10:00:00Z",
      "updatedAt": "2025-11-10T15:30:00Z"
    }
  ]
}
```

---

#### `POST /api/admin/packages`

Create a new package (admin only).

**Headers:**
```http
Authorization: Bearer <admin_jwt_token>
```

**Request Body:**
```json
{
  "name": "Super Premium",
  "description": "Ultra-fast 24-hour access",
  "durationHours": 24,
  "bandwidthMbps": 20,
  "priceKES": 200
}
```

**Validation:**
- `name`: 3-50 characters, required
- `durationHours`: 0.5 - 168 hours (7 days), required
- `bandwidthMbps`: 1 - 100 Mbps, required
- `priceKES`: 1 - 10000 KES, required

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Package created successfully",
  "package": {
    "packageId": "pkg_superpremium_24h20mbps",
    "name": "Super Premium",
    "description": "Ultra-fast 24-hour access",
    "durationHours": 24,
    "bandwidthMbps": 20,
    "priceKES": 200,
    "status": "active",
    "createdAt": "2025-11-17T12:00:00Z"
  }
}
```

---

#### `PUT /api/admin/packages/:packageId`

Update an existing package (admin only).

**Headers:**
```http
Authorization: Bearer <admin_jwt_token>
```

**Request Body (all fields optional):**
```json
{
  "name": "Premium Plus",
  "description": "Updated description",
  "priceKES": 120,
  "status": "inactive"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Package updated successfully",
  "package": {
    "packageId": "pkg_premium_6h10mbps",
    "name": "Premium Plus",
    "durationHours": 6,
    "bandwidthMbps": 10,
    "priceKES": 120,
    "status": "inactive",
    "updatedAt": "2025-11-17T12:30:00Z"
  }
}
```

---

#### `DELETE /api/admin/packages/:packageId`

Deactivate a package (admin only - soft delete).

**Headers:**
```http
Authorization: Bearer <admin_jwt_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Package deactivated successfully",
  "packageId": "pkg_premium_6h10mbps"
}
```

---

#### `POST /api/admin/voucher/generate`

Generate new vouchers.

**Headers:**
```http
Authorization: Bearer <admin_jwt_token>
```

**Request Body:**
```json
{
  "packageId": "pkg_standard_3h5mbps",
  "count": 100,
  "expiryDays": 30,
  "prefix": "WIFI"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "vouchers": [
    {
      "voucherCode": "WIFI-ABC123-XYZ",
      "package": "standard",
      "status": "unused",
      "expiresAt": "2025-12-17T00:00:00Z"
    }
  ],
  "count": 100,
  "downloadUrl": "https://s3.amazonaws.com/vouchers/batch_20251117.csv"
}
```

---

#### `GET /api/admin/stats`

Get system statistics and metrics.

**Headers:**
```http
Authorization: Bearer <admin_jwt_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "stats": {
    "users": {
      "total": 1500,
      "active": 450,
      "inactive": 1050
    },
    "sessions": {
      "active": 87,
      "today": 312,
      "thisMonth": 8450
    },
    "revenue": {
      "today": 15600,
      "thisWeek": 89500,
      "thisMonth": 345000
    },
    "vouchers": {
      "unused": 450,
      "used": 2340,
      "expired": 120
    }
  },
  "timestamp": "2025-11-17T12:00:00Z"
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists |
| 410 | Gone - Resource expired |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |
| 502 | Bad Gateway - External service error |
| 503 | Service Unavailable |

---

## Rate Limiting

API Gateway enforces the following rate limits:

- **Public Endpoints**: 100 requests/minute per IP
- **Authenticated Endpoints**: 500 requests/minute per user
- **Admin Endpoints**: 1000 requests/minute
- **Payment Callbacks**: 50 requests/minute (M-Pesa only)

**Rate Limit Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1700226000
```

---

## Webhooks

### M-Pesa Callback URL

Configure in Safaricom Daraja portal:

```
https://api.yourdomain.com/api/payment/callback
```

Ensure IP whitelisting for Safaricom servers.

---

## SDKs and Examples

### cURL Example

```bash
# Login
curl -X POST https://api.yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "254712345678",
    "password": "userpassword"
  }'

# Initiate Payment
curl -X POST https://api.yourdomain.com/api/payment/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "phoneNumber": "254712345678",
    "package": "standard",
    "macAddress": "AA:BB:CC:DD:EE:FF"
  }'
```

### JavaScript Example

```javascript
// Login
const response = await fetch('https://api.yourdomain.com/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    phoneNumber: '254712345678',
    password: 'userpassword'
  })
});

const data = await response.json();
console.log(data.token);
```

---

## Testing

### Sandbox Environment

**Base URL**: `https://api-sandbox.yourdomain.com`

Use M-Pesa Sandbox credentials for testing:
- Consumer Key: Provided by Safaricom
- Consumer Secret: Provided by Safaricom
- Test Phone: `254708374149`

### Postman Collection

Import the Postman collection from:
```
https://api.yourdomain.com/docs/postman-collection.json
```

---

## Support

For API support and questions:
- **Email**: api-support@yourdomain.com
- **Documentation**: https://docs.yourdomain.com
- **Status Page**: https://status.yourdomain.com
