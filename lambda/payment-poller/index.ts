import { Handler } from 'aws-lambda';
import axios from 'axios';
import { Logger } from '../../src/utils/helpers';

const logger = new Logger('PaymentPollerLambda');

const API_GATEWAY_URL = process.env.API_GATEWAY_URL!;
// Safety window: we only check quickly (≈3s and ≈6s) then stop.
const MAX_POLL_ATTEMPTS = 2; // Attempt 1 (immediate), Attempt 2 (after 3s)
const POLL_INTERVAL_MS = 3000; // 3 seconds between the two quick checks

interface PollerEvent {
  checkoutRequestID: string;
  transactionId: string;
  attempt?: number;
}

/**
 * Lambda that polls M-Pesa transaction status
 * Invoked asynchronously after STK push initiation
 */
export const handler: Handler<PollerEvent> = async (event) => {
  const { checkoutRequestID, transactionId } = event;
  let attempt = 1;
  let lastStatus: string | undefined;
  let lastResultCode: string | number | undefined;
  let lastResultDesc: string | undefined;

  while (attempt <= MAX_POLL_ATTEMPTS) {
    logger.info('Polling transaction status', { transactionId, checkoutRequestID, attempt });
    try {
      const response = await axios.post(
        `${API_GATEWAY_URL}/payment/query`,
        { checkoutRequestID, transactionId },
        { headers: { 'Content-Type': 'application/json' } }
      );

      const { resultCode, resultDesc, status } = response.data.data;
      lastStatus = status;
      lastResultCode = resultCode;
      lastResultDesc = resultDesc;

      logger.info('Query response', { resultCode, resultDesc, status, attempt });

      if (status === 'completed' || status === 'cancelled') {
        logger.info('Transaction finalized early', { status, attempt });
        return { status, attempts: attempt };
      }
    } catch (error: any) {
      logger.error('Polling error', { error: error.message, attempt });
      // On error we just proceed to next attempt (if any)
    }

    if (attempt === MAX_POLL_ATTEMPTS) {
      break; // Stop after final attempt regardless of status
    }
    await sleep(POLL_INTERVAL_MS);
    attempt += 1;
  }

  logger.info('Safety window ended; deferring to callback', {
    transactionId,
    attempts: attempt,
    lastStatus,
    lastResultCode,
    lastResultDesc,
  });

  return { status: lastStatus || 'pending', attempts: attempt };
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
