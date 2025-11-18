'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Save, Key, Server, Shield, Bell } from 'lucide-react'

export default function SettingsPage() {
  const [mpesaSettings, setMpesaSettings] = useState({
    consumerKey: '••••••••••••••••',
    consumerSecret: '••••••••••••••••',
    shortcode: '174379',
    passkey: '••••••••••••••••',
    callbackUrl: 'https://nazc3828ml.execute-api.us-east-1.amazonaws.com/dev/payment/callback',
  })

  const [radiusSettings, setRadiusSettings] = useState({
    serverIp: '10.0.0.50',
    authPort: '1812',
    accountingPort: '1813',
    coaPort: '3799',
    secret: '••••••••••••••••',
  })

  const [systemSettings, setSystemSettings] = useState({
    siteName: 'WiFi Billing Portal',
    supportEmail: 'support@example.com',
    supportPhone: '+254700000000',
    sessionTimeout: '24',
    maxDevicesPerUser: '3',
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure system settings and integrations
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              <CardTitle>M-Pesa Configuration</CardTitle>
            </div>
            <CardDescription>
              Daraja API credentials for payment processing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Consumer Key</label>
              <Input
                type="password"
                value={mpesaSettings.consumerKey}
                onChange={(e) => setMpesaSettings({...mpesaSettings, consumerKey: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Consumer Secret</label>
              <Input
                type="password"
                value={mpesaSettings.consumerSecret}
                onChange={(e) => setMpesaSettings({...mpesaSettings, consumerSecret: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Business Shortcode</label>
              <Input
                value={mpesaSettings.shortcode}
                onChange={(e) => setMpesaSettings({...mpesaSettings, shortcode: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Passkey</label>
              <Input
                type="password"
                value={mpesaSettings.passkey}
                onChange={(e) => setMpesaSettings({...mpesaSettings, passkey: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Callback URL</label>
              <Input
                value={mpesaSettings.callbackUrl}
                onChange={(e) => setMpesaSettings({...mpesaSettings, callbackUrl: e.target.value})}
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Badge variant="success" className="flex items-center gap-1">
                <div className="h-2 w-2 bg-green-600 rounded-full animate-pulse" />
                Connected
              </Badge>
              <span className="text-xs text-muted-foreground">
                Last verified: 2 minutes ago
              </span>
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1">
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
              <Button variant="outline">Test Connection</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              <CardTitle>RADIUS Configuration</CardTitle>
            </div>
            <CardDescription>
              RADIUS server settings for gateway authentication
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Server IP Address</label>
              <Input
                value={radiusSettings.serverIp}
                onChange={(e) => setRadiusSettings({...radiusSettings, serverIp: e.target.value})}
                placeholder="10.0.0.50"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Auth Port</label>
                <Input
                  value={radiusSettings.authPort}
                  onChange={(e) => setRadiusSettings({...radiusSettings, authPort: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Acct Port</label>
                <Input
                  value={radiusSettings.accountingPort}
                  onChange={(e) => setRadiusSettings({...radiusSettings, accountingPort: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">CoA Port</label>
                <Input
                  value={radiusSettings.coaPort}
                  onChange={(e) => setRadiusSettings({...radiusSettings, coaPort: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">RADIUS Secret</label>
              <Input
                type="password"
                value={radiusSettings.secret}
                onChange={(e) => setRadiusSettings({...radiusSettings, secret: e.target.value})}
              />
              <p className="text-xs text-muted-foreground">
                Shared secret for gateway authentication
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Badge variant="success" className="flex items-center gap-1">
                <div className="h-2 w-2 bg-green-600 rounded-full animate-pulse" />
                Active
              </Badge>
              <span className="text-xs text-muted-foreground">
                12 gateways connected
              </span>
            </div>
            <Button className="w-full">
              <Save className="mr-2 h-4 w-4" />
              Save Configuration
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>System Settings</CardTitle>
          </div>
          <CardDescription>
            General system configuration and preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Site Name</label>
                <Input
                  value={systemSettings.siteName}
                  onChange={(e) => setSystemSettings({...systemSettings, siteName: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Support Email</label>
                <Input
                  type="email"
                  value={systemSettings.supportEmail}
                  onChange={(e) => setSystemSettings({...systemSettings, supportEmail: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Support Phone</label>
                <Input
                  value={systemSettings.supportPhone}
                  onChange={(e) => setSystemSettings({...systemSettings, supportPhone: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Default Session Timeout (hours)</label>
                <Input
                  type="number"
                  value={systemSettings.sessionTimeout}
                  onChange={(e) => setSystemSettings({...systemSettings, sessionTimeout: e.target.value})}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum session duration before auto-disconnect
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Max Devices Per User</label>
                <Input
                  type="number"
                  value={systemSettings.maxDevicesPerUser}
                  onChange={(e) => setSystemSettings({...systemSettings, maxDevicesPerUser: e.target.value})}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum concurrent devices allowed per user
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-6">
            <Button>
              <Save className="mr-2 h-4 w-4" />
              Save System Settings
            </Button>
            <Button variant="outline">Reset to Defaults</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle>Notification Settings</CardTitle>
          </div>
          <CardDescription>
            Configure email and SMS notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">Payment Success Notifications</p>
              <p className="text-sm text-muted-foreground">
                Send SMS to users after successful payment
              </p>
            </div>
            <Badge variant="success">Enabled</Badge>
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">Session Expiry Warnings</p>
              <p className="text-sm text-muted-foreground">
                Notify users 15 minutes before session expires
              </p>
            </div>
            <Badge variant="success">Enabled</Badge>
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">Admin Alert Emails</p>
              <p className="text-sm text-muted-foreground">
                Email alerts for system errors and issues
              </p>
            </div>
            <Badge variant="success">Enabled</Badge>
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">Daily Revenue Reports</p>
              <p className="text-sm text-muted-foreground">
                Daily summary of transactions and revenue
              </p>
            </div>
            <Badge variant="secondary">Disabled</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
