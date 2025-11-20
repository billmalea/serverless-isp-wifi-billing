# Admin User Management

This guide explains how to create and manage admin users for the WiFi Billing Admin Dashboard.

## Prerequisites

- AWS CLI configured with access to your DynamoDB tables
- Node.js and TypeScript installed
- AWS SDK dependencies installed (`npm install`)

## Creating Admin Users

### Method 1: Using the Script (Recommended)

We provide a script to create admin users directly in DynamoDB:

```bash
# Navigate to project root
cd /path/to/serverless-wifi-billing

# Install dependencies if not already done
npm install

# Create admin user with password
npx ts-node scripts/create-admin.ts <phoneNumber> <password>

# Examples:
npx ts-node scripts/create-admin.ts +254712345678 admin123
npx ts-node scripts/create-admin.ts 0712345678 SecurePass2024
```

**Phone Number Formats Supported:**
- `+254712345678` (E.164 format)
- `0712345678` (local format - will be converted to +254)
- `712345678` (without prefix - will be converted to +254)

### Method 2: Manual DynamoDB Entry

If you prefer to create admin users manually via AWS Console:

1. Open DynamoDB Console
2. Navigate to the `WifiBilling-Users` table
3. Create a new item with the following structure:

```json
{
  "phoneNumber": "+254712345678",
  "userId": "user_1234567890_abc123",
  "roles": ["user", "admin"],
  "passwordHash": "<SHA-256 hash of password>",
  "createdAt": "2024-11-20T10:00:00Z",
  "lastLoginAt": "2024-11-20T10:00:00Z",
  "status": "active"
}
```

To generate a password hash (SHA-256):
```bash
echo -n "your_password" | openssl dgst -sha256
```

### Method 3: Updating Existing User to Admin

If a user already exists and you want to grant admin access:

```bash
# The script will automatically detect existing users and add admin role
npx ts-node scripts/create-admin.ts +254712345678 newPassword
```

## Admin Login

After creating an admin user, they can login at:

**Admin Dashboard:** `http://localhost:3001/login` (development) or `https://your-domain.com/login` (production)

**Login Credentials:**
- Phone Number: The phone number used when creating the admin
- Password: The password set during creation

## Admin Roles & Permissions

Admin users have the following capabilities:

- View dashboard statistics (revenue, users, sessions)
- Manage users (view details, search, suspend)
- Monitor active sessions (view, terminate)
- View and filter transactions
- Generate and manage vouchers
- Configure gateways (add, edit, delete)
- Manage packages (create, edit, pricing)

## Security Best Practices

1. **Strong Passwords**: Use passwords with at least 12 characters, mixing letters, numbers, and symbols
2. **Unique Credentials**: Each admin should have their own unique account
3. **Regular Rotation**: Change admin passwords periodically
4. **Monitor Access**: Review admin activity logs regularly
5. **Limit Admin Accounts**: Only create admin accounts for authorized personnel

## Troubleshooting

### "Invalid credentials" Error
- Verify phone number format is correct (should start with +254)
- Check that the password matches exactly
- Confirm the user has the 'admin' role in DynamoDB

### "Admin access required" Error
- User exists but doesn't have admin role
- Run the create-admin script again to add the admin role

### "Password not set for this account" Error
- User was created without a password (e.g., via normal WiFi login)
- Run the create-admin script with a password to set one

## Script Output Example

```bash
$ npx ts-node scripts/create-admin.ts +254712345678 SecurePass123

Creating admin user: +254712345678
✅ Admin user created successfully!
User ID: user_1732089600_xyz789
Phone: +254712345678
Roles: [ 'user', 'admin' ]
Password: SecurePass123

✨ Done!
```

## Technical Details

### Authentication Flow

1. Admin enters phone number and password
2. Request sent to `/auth/admin/login` endpoint
3. Backend verifies:
   - User exists
   - User has 'admin' role
   - Password hash matches
4. JWT token generated with 24-hour expiration
5. Token includes user roles for authorization
6. Frontend stores token and redirects to dashboard

### Password Hashing

Passwords are hashed using SHA-256 before storage. The `verifyPassword` utility function compares the hash of the provided password with the stored hash.

### Token Management

- Tokens expire after 24 hours
- Stored in browser localStorage
- Automatically included in API requests via Authorization header
- Invalid/expired tokens trigger automatic redirect to login

## API Endpoint

**POST** `/auth/admin/login`

**Request Body:**
```json
{
  "phoneNumber": "+254712345678",
  "password": "your_password"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "userId": "user_123",
    "phoneNumber": "+254712345678",
    "roles": ["user", "admin"],
    "status": "active"
  }
}
```

## Support

For issues or questions about admin user management, please check:
- [Main Documentation](../docs/README.md)
- [Troubleshooting Guide](../docs/TROUBLESHOOTING.md)
- [Architecture Overview](../docs/ARCHITECTURE.md)
