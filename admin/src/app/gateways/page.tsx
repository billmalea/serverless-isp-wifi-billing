'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, Wifi, WifiOff } from 'lucide-react'

interface Gateway {
  id: string
  name: string
  ipAddress: string
  nasIdentifier: string
  radiusSecret: string
  status: 'online' | 'offline'
  location: string
  activeUsers: number
}

export default function GatewaysPage() {
  const [gateways] = useState<Gateway[]>([
    {
      id: '1',
      name: 'MikroTik Main Gateway',
      ipAddress: '192.168.1.1',
      nasIdentifier: 'main-gateway',
      radiusSecret: '***************',
      status: 'online',
      location: 'Main Building',
      activeUsers: 45,
    },
    {
      id: '2',
      name: 'MikroTik Branch Office',
      ipAddress: '192.168.2.1',
      nasIdentifier: 'branch-gateway',
      radiusSecret: '***************',
      status: 'online',
      location: 'Branch Office',
      activeUsers: 23,
    },
    {
      id: '3',
      name: 'MikroTik Warehouse',
      ipAddress: '192.168.3.1',
      nasIdentifier: 'warehouse-gateway',
      radiusSecret: '***************',
      status: 'offline',
      location: 'Warehouse',
      activeUsers: 0,
    },
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gateways</h1>
          <p className="text-muted-foreground">
            Manage MikroTik routers and RADIUS configuration
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Gateway
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {gateways.map((gateway) => (
          <Card key={gateway.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{gateway.name}</CardTitle>
                  <CardDescription>{gateway.location}</CardDescription>
                </div>
                <Badge variant={gateway.status === 'online' ? 'success' : 'destructive'}>
                  {gateway.status === 'online' ? (
                    <Wifi className="mr-1 h-3 w-3" />
                  ) : (
                    <WifiOff className="mr-1 h-3 w-3" />
                  )}
                  {gateway.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">IP Address</p>
                  <p className="text-sm font-mono">{gateway.ipAddress}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">NAS Identifier</p>
                  <p className="text-sm font-mono">{gateway.nasIdentifier}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">RADIUS Secret</p>
                  <p className="text-sm font-mono">{gateway.radiusSecret}</p>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Active Users</span>
                    <span className="font-semibold">{gateway.activeUsers}</span>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Edit className="mr-2 h-3 w-3" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Trash2 className="mr-2 h-3 w-3" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>RADIUS Configuration</CardTitle>
          <CardDescription>
            Settings for integrating MikroTik routers with the billing system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">RADIUS Server IP</label>
              <Input defaultValue="10.0.0.50" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">RADIUS Port</label>
              <Input defaultValue="1812" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Accounting Port</label>
              <Input defaultValue="1813" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">CoA Port</label>
              <Input defaultValue="3799" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline">Reset</Button>
            <Button>Save Configuration</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
