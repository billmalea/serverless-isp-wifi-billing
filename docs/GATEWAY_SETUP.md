# Gateway Setup Guide

Complete guide for configuring hotspot gateways to work with the serverless billing system.

## Table of Contents

1. [Overview](#overview)
2. [Mikrotik Configuration](#mikrotik-configuration)
3. [UniFi Configuration](#unifi-configuration)
4. [pfSense Configuration](#pfsense-configuration)
5. [Generic RADIUS Setup](#generic-radius-setup)
6. [Testing](#testing)

---

## Overview

The billing system supports any hotspot gateway that can:
- Redirect unauthenticated users to a captive portal
- Accept RADIUS or HTTP authentication
- Send Change of Authorization (CoA) disconnect messages
- Report usage statistics via API

---

## Mikrotik Configuration

### Prerequisites

- Mikrotik RouterOS 6.x or 7.x
- Public IP address or DDNS
- Internet connection

### Step 1: Create IP Pool

```routeros
/ip pool
add name=hotspot-pool ranges=192.168.1.100-192.168.1.250
```

### Step 2: Configure Hotspot

```routeros
/ip hotspot
add name=wifi-hotspot interface=wlan1 address-pool=hotspot-pool profile=default
```

### Step 3: Set Profile

```routeros
/ip hotspot profile
set default \
  login-by=http-chap \
  http-cookie-lifetime=1d \
  trial-uptime-limit=none \
  trial-user-profile=none
```

### Step 4: Configure Walled Garden

```routeros
/ip hotspot walled-garden
add dst-host=portal.yourdomain.com comment="Captive Portal"
add dst-host=api.yourdomain.com comment="API Gateway"
add dst-host=*.cloudfront.net comment="CDN"
add dst-host=*.safaricom.co.ke comment="M-Pesa"
```

### Step 5: Set Redirect URL

```routeros
/ip hotspot profile
set default \
  http-cookie-lifetime=1d \
  login-by=http-chap \
  use-radius=no
  
/ip hotspot
set wifi-hotspot html-directory=hotspot
```

Create redirect script:
```routeros
/file print file=redirect.html
/file set redirect.html contents="<html><head><meta http-equiv='refresh' content='0; url=https://portal.yourdomain.com'></head></html>"
```

### Step 6: Configure API Authentication

```routeros
/system script
add name=authorize-user source={
  :local mac $"mac-address"
  :local ip $"ip-address"
  
  /tool fetch \
    url="https://api.yourdomain.com/api/session/create" \
    http-method=post \
    http-header-field="Authorization: Bearer YOUR_API_KEY" \
    http-data="{\"macAddress\":\"$mac\",\"ipAddress\":\"$ip\"}" \
    keep-result=no
}
```

### Step 7: Set User Profiles (Time-Based with Bandwidth)

```routeros
/ip hotspot user profile
add name=quick-access rate-limit=2M/2M shared-users=1 session-timeout=1h idle-timeout=15m
add name=standard rate-limit=5M/5M shared-users=1 session-timeout=3h idle-timeout=30m
add name=premium rate-limit=10M/10M shared-users=1 session-timeout=6h idle-timeout=1h
add name=full-day rate-limit=20M/20M shared-users=1 session-timeout=24h idle-timeout=2h
add name=weekly rate-limit=15M/15M shared-users=1 session-timeout=168h idle-timeout=4h

# Note: session-timeout enforces time limit
# rate-limit enforces bandwidth allocation
# shared-users=1 prevents hotspot sharing (device binding)
```

### Step 8: Configure CoA

```routeros
# Enable RADIUS CoA
/radius
add service=hotspot address=0.0.0.0/0 secret=YOUR_RADIUS_SECRET

# Set up dynamic user authorization
/ip hotspot user
# Users will be added dynamically via API
```

### Step 9: Session Monitoring (Time-Based)

```routeros
# Time-based billing doesn't require periodic usage reporting
# Sessions auto-expire based on session-timeout configured in user profile
# Gateway enforces time limit locally

# Optional: Monitor active sessions
/system scheduler
add name=check-sessions interval=1m on-event=check-sessions-script

/system script
add name=check-sessions-script source={
  :log info "Active sessions: $[/ip hotspot active print count-only]"
  
  # Sessions exceeding time limit are automatically disconnected
  # by Mikrotik session-timeout setting
}

# Note: No data usage reporting needed
# Bandwidth is rate-limited via user profile
# Time expiry handled by session-timeout
```

---

## UniFi Configuration

### Prerequisites

- UniFi Controller 6.x or newer
- UniFi Gateway (USG/UDM)
- Network application access

### Step 1: Enable Guest Portal

1. Open UniFi Network Controller
2. Navigate to **Settings** → **Guest Control**
3. Enable **Guest Portal**
4. Select WiFi network

### Step 2: Configure Portal

1. **Authentication**: Select **External Portal Server**
2. **URL**: `https://portal.yourdomain.com`
3. **Key**: Generate and save API key

### Step 3: Set Portal Redirect

```json
{
  "guest_control": {
    "portal_customization": {
      "enabled": true,
      "redirect_https": true,
      "redirect_url": "https://portal.yourdomain.com",
      "x_password": "YOUR_API_KEY"
    }
  }
}
```

### Step 4: Configure API Integration

Create custom controller script:

```javascript
// /usr/lib/unifi/data/sites/default/scripts/authorize.js
const https = require('https');

function authorizeUser(mac, ap) {
  const data = JSON.stringify({
    macAddress: mac,
    apId: ap
  });

  const options = {
    hostname: 'api.yourdomain.com',
    path: '/api/session/create',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Length': data.length
    }
  };

  const req = https.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
  });

  req.write(data);
  req.end();
}
```

### Step 5: Set Bandwidth Limits

1. Navigate to **Settings** → **Profiles**
2. Create guest profiles:
   - **Basic**: 2 Mbps down/up
   - **Standard**: 5 Mbps down/up
   - **Premium**: 10 Mbps down/up
   - **Ultra**: 20 Mbps down/up

### Step 6: Enable RADIUS (Optional)

1. **Settings** → **Profiles** → **RADIUS**
2. Add RADIUS server:
   - **IP**: Your RADIUS server IP
   - **Port**: 1812
   - **Secret**: YOUR_RADIUS_SECRET
3. Enable CoA/DM on port 3799

---

## pfSense Configuration

### Prerequisites

- pfSense 2.5.x or newer
- Captive Portal package installed
- Public IP or DDNS

### Step 1: Install Packages

Navigate to **System** → **Package Manager** → **Available Packages**

Install:
- **freeradius3**
- **nmap** (optional, for monitoring)

### Step 2: Configure Captive Portal

1. **Services** → **Captive Portal**
2. Click **Add** to create new zone
3. **Zone Name**: `wifi-billing`
4. **Interface**: Select WiFi interface (e.g., LAN)

### Step 3: Portal Settings

**Configuration Tab:**
```
Enable Captive Portal: ✓
Interfaces: LAN
Maximum concurrent connections: 500
Idle timeout: 0 (managed by billing system)
Hard timeout: 0 (managed by billing system)
```

**Authentication Tab:**
```
Authentication Method: No Authentication
  (We handle auth via external portal)

Reauthentication: Every minute
  (Check session validity)
```

**Portal Page Contents:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0; url=https://portal.yourdomain.com?mac=$MAC$&ip=$IP$">
</head>
<body>
  <p>Redirecting to login portal...</p>
</body>
</html>
```

### Step 4: Configure Allowed Hostnames

**Allowed Hostnames (Walled Garden):**
```
portal.yourdomain.com
api.yourdomain.com
*.cloudfront.net
*.safaricom.co.ke
```

### Step 5: Setup RADIUS

**Services** → **FreeRADIUS** → **Interfaces**

```
Interface: LAN
IP Address: 127.0.0.1
Port: 1812
CoA Port: 3799
```

**NAS/Clients:**
```
Client IP: 127.0.0.1
Shared Secret: YOUR_RADIUS_SECRET
```

### Step 6: API Integration Script

Create PHP script at `/usr/local/www/authorize.php`:

```php
<?php
// authorize.php
$mac = $_POST['mac'];
$ip = $_POST['ip'];
$sessionId = $_POST['session_id'];

$apiUrl = 'https://api.yourdomain.com/api/session/create';
$apiKey = 'YOUR_API_KEY';

$data = json_encode([
  'macAddress' => $mac,
  'ipAddress' => $ip,
  'sessionId' => $sessionId
]);

$ch = curl_init($apiUrl);
curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  'Content-Type: application/json',
  'Authorization: Bearer ' . $apiKey
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
curl_close($ch);

$result = json_decode($response, true);
if ($result['success']) {
  echo "ALLOW";
} else {
  echo "DENY";
}
?>
```

### Step 7: Usage Monitoring

Create cron job: **System** → **Cron**

```
*/5 * * * * /usr/local/bin/php /usr/local/www/report-usage.php
```

`report-usage.php`:
```php
<?php
$sessions = shell_exec('ipfw table 1 list');
foreach (explode("\n", $sessions) as $line) {
  // Parse IP and MAC
  // Query traffic counters
  // POST to API
}
?>
```

---

## Generic RADIUS Setup

For gateways supporting standard RADIUS:

### RADIUS Configuration

**Server Details:**
```
IP Address: Your Lambda endpoint or RADIUS proxy
Port: 1812 (auth), 1813 (accounting)
Secret: YOUR_RADIUS_SECRET
```

**Attributes:**
```
NAS-Identifier: gateway-id
NAS-IP-Address: gateway-public-ip
```

### CoA Configuration

**Enable Dynamic Authorization:**
```
CoA Port: 3799
DM Port: 3799 (Disconnect Messages)
```

### RADIUS Proxy (Optional)

Use FreeRADIUS as proxy to Lambda:

```conf
# /etc/raddb/proxy.conf
home_server billing_system {
  type = auth+acct
  ipaddr = api.yourdomain.com
  port = 1812
  secret = YOUR_RADIUS_SECRET
  response_window = 30
  zombie_period = 40
  status_check = status-server
}

home_server_pool billing_pool {
  type = fail-over
  home_server = billing_system
}

realm billing {
  auth_pool = billing_pool
  acct_pool = billing_pool
}
```

---

## Testing

### Test Captive Portal Redirect

```bash
# Connect to WiFi
# Open browser
# Navigate to http://example.com
# Should redirect to https://portal.yourdomain.com
```

### Test API Authentication

```bash
curl -X POST https://api.yourdomain.com/api/session/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "macAddress": "AA:BB:CC:DD:EE:FF",
    "ipAddress": "192.168.1.100",
    "package": "standard"
  }'
```

### Test CoA

```bash
# Install radclient
sudo apt-get install freeradius-utils

# Send CoA disconnect
echo "User-Name=test-user" | radclient \
  192.168.1.1:3799 disconnect YOUR_RADIUS_SECRET
```

### Test Usage Reporting

```bash
curl -X POST https://api.yourdomain.com/api/session/usage \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "sessionId": "session_123",
    "dataUsed": 10485760,
    "timestamp": "2025-11-17T12:00:00Z"
  }'
```

---

## Troubleshooting

### Users Not Redirected

1. Check walled garden rules
2. Verify portal URL is accessible
3. Test DNS resolution
4. Check firewall rules

### Authentication Fails

1. Verify API key is correct
2. Check Lambda logs in CloudWatch
3. Test API endpoint manually
4. Verify gateway can reach API

### CoA Not Working

1. Check CoA port is open (3799)
2. Verify RADIUS secret matches
3. Test with radclient tool
4. Check gateway CoA support

### Usage Not Reported

1. Check scheduler/cron is running
2. Verify API endpoint URL
3. Check authentication headers
4. Review gateway logs

---

## Best Practices

1. **Use HTTPS**: Always use SSL for portal and API
2. **Walled Garden**: Whitelist only necessary domains
3. **API Keys**: Rotate regularly, store securely
4. **Monitoring**: Set up alerts for failed auth
5. **Backups**: Export gateway config regularly
6. **Updates**: Keep gateway firmware updated
7. **Rate Limiting**: Implement on gateway side
8. **Logging**: Enable detailed logs during setup

---

## Support

For gateway-specific support:
- **Mikrotik**: https://forum.mikrotik.com
- **UniFi**: https://community.ui.com
- **pfSense**: https://forum.netgate.com
