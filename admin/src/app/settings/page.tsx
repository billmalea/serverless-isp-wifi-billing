'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Save, Key, Server, Shield, Bell, AlertCircle } from 'lucide-react'

export default function SettingsPage() {
  const [mpesaSettings] = useState({
    consumerKey: '••••••••••••••••',
    consumerSecret: '••••••••••••••••',
    shortcode: '174379',
    passkey: '••••••••••••••••',
    callbackUrl: 'https://nazc3828ml.execute-api.us-east-1.amazonaws.com/dev/payment/callback',
  })

  const [radiusSettings] = useState({
    serverIp: '10.0.0.50',
    authPort: '1812',
    accountingPort: '1813',
    coaPort: '3799',
    secret: '••••••••••••••••',
  })

  const [systemSettings] = useState({
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

      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-900">Configuration Management</p>
              <p className="text-sm text-amber-800">
                M-Pesa and RADIUS settings are managed via environment variables in the SAM template. 
                To modify these values, update the <code className="px-1 py-0.5 bg-amber-100 rounded text-xs">template.yaml</code> file and redeploy the stack using <code className="px-1 py-0.5 bg-amber-100 rounded text-xs">sam deploy</code>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Consumer Secret</label>
              <Input
                type="password"
                value={mpesaSettings.consumerSecret}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Business Shortcode</label>
              <Input
                value={mpesaSettings.shortcode}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Passkey</label>
              <Input
                type="password"
                value={mpesaSettings.passkey}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Callback URL</label>
              <Input
                value={mpesaSettings.callbackUrl}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Badge variant="success" className="flex items-center gap-1">
                <div className="h-2 w-2 bg-green-600 rounded-full animate-pulse" />
                Configured
              </Badge>
              <span className="text-xs text-muted-foreground">
                Via environment variables
              </span>
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
                disabled
                className="bg-muted"
                placeholder="10.0.0.50"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Auth Port</label>
                <Input
                  value={radiusSettings.authPort}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Acct Port</label>
                <Input
                  value={radiusSettings.accountingPort}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">CoA Port</label>
                <Input
                  value={radiusSettings.coaPort}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">RADIUS Secret</label>
              <Input
                type="password"
                value={radiusSettings.secret}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Shared secret configured per gateway
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Badge variant="success" className="flex items-center gap-1">
                <div className="h-2 w-2 bg-green-600 rounded-full animate-pulse" />
                Configured
              </Badge>
              <span className="text-xs text-muted-foreground">
                Managed via gateway settings
              </span>
            </div>
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
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Support Email</label>
                <Input
                  type="email"
                  value={systemSettings.supportEmail}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Support Phone</label>
                <Input
                  value={systemSettings.supportPhone}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Default Session Timeout (hours)</label>
                <Input
                  type="number"
                  value={systemSettings.sessionTimeout}
                  disabled
                  className="bg-muted"
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
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum concurrent devices allowed per user
                </p>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            System settings are read-only and configured during deployment. Future versions will support dynamic configuration.
          </p>
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
