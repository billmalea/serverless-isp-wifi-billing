// Shared Types and Interfaces for the WiFi Billing System

export interface User {
  userId: string;
  phoneNumber: string;
  roles?: string[]; // e.g. ['user'] or ['admin']
  passwordHash?: string;
  createdAt: string;
  lastLoginAt: string;
  status: 'active' | 'suspended' | 'inactive';
}

export interface Session {
  sessionId: string;
  userId: string;
  phoneNumber?: string; // convenience for lookups
  packageId: string;
  packageName: string; // Display-friendly package name
  macAddress: string; // Device-specific: enforces one device per purchase
  ipAddress: string;
  gatewayId: string;
  startTime: string;
  expiresAt: string;
  endTime?: string;
  durationHours: number;
  bandwidthMbps: number;
  status: 'active' | 'expired' | 'terminated';
  ttl?: number; // epoch seconds for DynamoDB TTL
}

export interface Transaction {
  transactionId: string;
  userId: string;
  phoneNumber: string;
  amount: number;
  packageId: string;
  packageName: string;
  durationHours: number;
  bandwidthMbps: number;
  macAddress: string; // Device that made the purchase
  mpesaReceiptNumber?: string;
  mpesaTransactionId?: string;
  checkoutRequestId?: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  timestamp: string;
  completedAt?: string;
  metadata?: Record<string, any>;
}

export interface Voucher {
  voucherCode: string;
  packageId: string;
  status: 'unused' | 'used' | 'expired';
  createdAt: string;
  expiresAt?: string;
  usedAt?: string;
  usedBy?: string;
  usedByMac?: string; // MAC address of device that redeemed
  batchId?: string;
  ttl?: number; // epoch seconds for auto-expiry
}

export interface Package {
  packageId: string;
  name: string;
  description: string;
  durationHours: number; // e.g., 1, 3, 6, 24
  bandwidthMbps: number; // e.g., 2, 5, 10, 20
  priceKES: number;
  status: 'active' | 'inactive';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CoAMessage {
  action: 'authorize' | 'disconnect' | 'update';
  sessionId: string;
  userId: string;
  macAddress: string;
  ipAddress: string;
  gatewayId: string;
  bandwidthMbps: number;
  sessionTimeout: number; // in seconds
  timestamp: string;
}

export interface MPesaSTKPushRequest {
  BusinessShortCode: string;
  Password: string;
  Timestamp: string;
  TransactionType: 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline';
  Amount: string;
  PartyA: string; // Phone number
  PartyB: string; // Shortcode
  PhoneNumber: string;
  CallBackURL: string;
  AccountReference: string;
  TransactionDesc: string;
}

export interface MPesaSTKPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export interface MPesaCallbackPayload {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value: string | number;
        }>;
      };
    };
  };
}

export interface APIResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface AuthRequest {
  phoneNumber?: string;
  password?: string;
  macAddress: string;
  ipAddress: string;
  gatewayId: string;
}

export interface VoucherRequest {
  voucherCode: string;
  phoneNumber?: string;
  macAddress: string;
  ipAddress: string;
  gatewayId: string;
}

export interface PaymentInitiateRequest {
  phoneNumber: string;
  packageId: string;
  macAddress: string;
  ipAddress: string;
  gatewayId: string;
}

export interface SessionUsageUpdate {
  sessionId: string;
  dataUsed: number;
  timeUsed: number;
}

export interface GatewayConfig {
  gatewayId: string;
  name: string;
  type: 'mikrotik' | 'unifi' | 'pfsense' | 'openwrt';
  ipAddress: string;
  apiEndpoint?: string;
  radiusSecret?: string;
  coaPort: number;
  status: 'active' | 'inactive';
}

// Environment variables interface
export interface EnvironmentConfig {
  USERS_TABLE: string;
  SESSIONS_TABLE: string;
  TRANSACTIONS_TABLE: string;
  VOUCHERS_TABLE: string;
  GATEWAYS_TABLE: string;
  COA_QUEUE_URL: string;
  PAYMENT_CALLBACK_QUEUE_URL: string;
  MPESA_CONSUMER_KEY: string;
  MPESA_CONSUMER_SECRET: string;
  MPESA_SHORTCODE: string;
  MPESA_PASSKEY: string;
  MPESA_ENVIRONMENT: 'sandbox' | 'production';
  MPESA_CALLBACK_URL: string;
  JWT_SECRET: string;
  AWS_REGION: string;
}

// Helper type for DynamoDB operations
export type DynamoDBItem = Record<string, any>;

// Note: DATA_PACKAGES removed - now using database-driven time-based packages instead

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;
