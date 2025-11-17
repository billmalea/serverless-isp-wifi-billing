import { SQSEvent, SQSRecord } from 'aws-lambda';
import axios from 'axios';
import { CoAMessage, GatewayConfig } from '../../src/types';
import { Logger, getItem } from '../../src/utils/helpers';

const logger = new Logger('CoALambda');

const GATEWAYS_TABLE = process.env.GATEWAYS_TABLE!;

/**
 * Main Lambda handler for Change of Authorization
 * Processes messages from SQS queue and sends CoA to gateways
 */
export async function handler(event: SQSEvent): Promise<void> {
  logger.info('CoA Lambda invoked', { recordCount: event.Records.length });

  for (const record of event.Records) {
    try {
      await processCoAMessage(record);
    } catch (error: any) {
      logger.error('Failed to process CoA message', { error, messageId: record.messageId });
      // In production, you might want to send to DLQ
      throw error;
    }
  }
}

/**
 * Process individual CoA message
 */
async function processCoAMessage(record: SQSRecord): Promise<void> {
  const message = JSON.parse(record.body) as CoAMessage;

  logger.info('Processing CoA message', {
    action: message.action,
    userId: message.userId,
    gatewayId: message.gatewayId,
  });

  // Get gateway configuration
  const gateway = await getItem<GatewayConfig>(GATEWAYS_TABLE, {
    gatewayId: message.gatewayId,
  });

  if (!gateway) {
    logger.error('Gateway not found', { gatewayId: message.gatewayId });
    return;
  }

  if (gateway.status !== 'active') {
    logger.warn('Gateway is not active', { gatewayId: message.gatewayId, status: gateway.status });
    return;
  }

  // Route to appropriate gateway handler
  switch (gateway.type) {
    case 'mikrotik':
      await sendMikrotikCoA(gateway, message);
      break;
    case 'unifi':
      await sendUniFiCoA(gateway, message);
      break;
    case 'pfsense':
      await sendPfSenseCoA(gateway, message);
      break;
    case 'openwrt':
      await sendOpenWrtCoA(gateway, message);
      break;
    default:
      logger.error('Unknown gateway type', { type: gateway.type });
  }
}

/**
 * Send CoA to Mikrotik gateway
 */
async function sendMikrotikCoA(gateway: GatewayConfig, message: CoAMessage): Promise<void> {
  logger.info('Sending CoA to Mikrotik', { gatewayId: gateway.gatewayId });

  try {
    // Mikrotik RouterOS API endpoint
    const endpoint = `${gateway.apiEndpoint}/rest/ip/hotspot/active`;

    // Time-based billing: Set rate limit (bandwidth) and time limit only
    const bandwidthStr = `${message.bandwidthMbps}M`;
    const payload = {
      user: message.userId,
      address: message.ipAddress,
      'mac-address': message.macAddress,
      uptime: message.sessionTimeout, // Time in seconds
      'rate-limit': `${bandwidthStr}/${bandwidthStr}`, // Format: upload/download (e.g., 5M/5M)
    };

    await axios.post(endpoint, payload, {
      auth: {
        username: gateway.apiEndpoint?.split('@')[0] || 'admin',
        password: gateway.radiusSecret || '',
      },
      timeout: 5000,
    });

    logger.info('Mikrotik CoA sent successfully', { userId: message.userId });
  } catch (error: any) {
    logger.error('Failed to send Mikrotik CoA', {
      error: error.message,
      gateway: gateway.gatewayId,
    });
    throw error;
  }
}

/**
 * Send CoA to UniFi gateway
 */
async function sendUniFiCoA(gateway: GatewayConfig, message: CoAMessage): Promise<void> {
  logger.info('Sending CoA to UniFi', { gatewayId: gateway.gatewayId });

  try {
    // UniFi Controller API
    const endpoint = `${gateway.apiEndpoint}/api/s/default/cmd/stamgr`;

    // Time-based billing: Set bandwidth limits and duration
    const bandwidthKbps = message.bandwidthMbps * 1024; // Convert Mbps to Kbps
    const payload = {
      cmd: 'authorize-guest',
      mac: message.macAddress,
      minutes: Math.floor(message.sessionTimeout / 60), // Convert seconds to minutes
      up: bandwidthKbps, // Upload speed in Kbps
      down: bandwidthKbps, // Download speed in Kbps
      // No data limit - unlimited data per time period
    };

    await axios.post(endpoint, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });

    logger.info('UniFi CoA sent successfully', { userId: message.userId });
  } catch (error: any) {
    logger.error('Failed to send UniFi CoA', {
      error: error.message,
      gateway: gateway.gatewayId,
    });
    throw error;
  }
}

/**
 * Send CoA to pfSense gateway
 */
async function sendPfSenseCoA(gateway: GatewayConfig, message: CoAMessage): Promise<void> {
  logger.info('Sending CoA to pfSense', { gatewayId: gateway.gatewayId });

  try {
    // pfSense Captive Portal API
    const endpoint = `${gateway.apiEndpoint}/api/v1/services/captiveportal`;

    const bandwidthKbps = message.bandwidthMbps * 1024; // Convert Mbps to Kbps
    const payload = {
      action: 'authorize',
      mac: message.macAddress,
      ip: message.ipAddress,
      bandwidth_up: bandwidthKbps,
      bandwidth_down: bandwidthKbps,
      timeout: message.sessionTimeout,
    };

    await axios.post(endpoint, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });

    logger.info('pfSense CoA sent successfully', { userId: message.userId });
  } catch (error: any) {
    logger.error('Failed to send pfSense CoA', {
      error: error.message,
      gateway: gateway.gatewayId,
    });
    throw error;
  }
}

/**
 * Send CoA to OpenWrt gateway
 */
async function sendOpenWrtCoA(gateway: GatewayConfig, message: CoAMessage): Promise<void> {
  logger.info('Sending CoA to OpenWrt', { gatewayId: gateway.gatewayId });

  try {
    // OpenWrt nodogsplash or CoovaChilli
    const endpoint = `${gateway.apiEndpoint}/cgi-bin/nodogsplash/auth`;

    const bandwidthStr = `${message.bandwidthMbps}M`;
    const params = {
      mac: message.macAddress,
      ip: message.ipAddress,
      token: message.sessionId,
      upload: bandwidthStr,
      download: bandwidthStr,
    };

    await axios.get(endpoint, {
      params,
      timeout: 5000,
    });

    logger.info('OpenWrt CoA sent successfully', { userId: message.userId });
  } catch (error: any) {
    logger.error('Failed to send OpenWrt CoA', {
      error: error.message,
      gateway: gateway.gatewayId,
    });
    throw error;
  }
}
