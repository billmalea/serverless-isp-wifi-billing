import axios from 'axios';
console.log('--- MPesa OAuth standalone test starting ---');
import fs from 'fs';
import path from 'path';

// Load .env.local manually (simple parser) to avoid adding dependencies if not present
function loadEnvLocal(file: string) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.substring(0, eqIndex).trim();
    const value = trimmed.substring(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

const envPath = path.join(process.cwd(), '.env.local');
console.log('Loading env file:', envPath);
loadEnvLocal(envPath);

const consumerKey = (process.env.MPESA_CONSUMER_KEY || process.env.MPesaConsumerKey || '').trim();
const consumerSecret = (process.env.MPESA_CONSUMER_SECRET || process.env.MPesaConsumerSecret || '').trim();
const environment = (process.env.MPESA_ENVIRONMENT || process.env.MPesaEnvironment || 'sandbox').trim();

async function getAccessToken() {
  if (!consumerKey || !consumerSecret) {
    console.error('Missing consumer key/secret. Check .env.local');
    process.exit(1);
  }
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  console.log('Consumer Key length:', consumerKey.length, 'Secret length:', consumerSecret.length);
  const baseUrl = environment === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
  const url = `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`;
  console.log('Environment:', environment);
  console.log('OAuth URL:', url);
  console.log('Auth header (first 20 chars):', auth.substring(0, 20) + '...');

  try {
    const start = Date.now();
    const resp = await axios.get(url, { headers: { Authorization: `Basic ${auth}` } });
    const duration = Date.now() - start;
    console.log('Status:', resp.status);
    console.log('Duration(ms):', duration);
    console.log('Response body:', resp.data);
    if (resp.data.access_token) {
      console.log('\n✅ Access token retrieved successfully.');
    } else {
      console.log('\n⚠️ No access_token field in response.');
    }
  } catch (err: any) {
    console.error('\n❌ OAuth request failed');
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Headers:', err.response.headers);
      console.error('Body:', err.response.data);
    } else {
      console.error('Error message:', err.message);
    }
    process.exit(1);
  }
}

getAccessToken();
