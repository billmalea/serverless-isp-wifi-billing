'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, Wifi, WifiOff } from 'lucide-react'
import { api } from '@/lib/api'
import { EditGatewayModal } from '@/components/modals/EditGatewayModal'

interface Gateway {
  gatewayId: string
  name: string
  ipAddress: string
  nasIdentifier: string
  radiusSecret: string
  status: 'online' | 'offline'
  location: string
  coaPort?: number
}

export default function GatewaysPage() {
  const [gateways, setGateways] = useState<Gateway[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingGateway, setEditingGateway] = useState<Gateway | null>(null)

  useEffect(() => {
    loadGateways()
  }, [])

  async function loadGateways() {
    try {
      setLoading(true)
      const data = await api.admin.getGateways()
      setGateways(data)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to load gateways')
      console.error('Gateways error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this gateway?')) return
    
    try {
      await api.admin.deleteGateway(id)
      await loadGateways()
    } catch (err: any) {
      alert('Failed to delete gateway: ' + err.message)
    }
  }

  async function handleEdit(gatewayId: string, data: Partial<Gateway>) {
    await api.admin.updateGateway(gatewayId, data)
    await loadGateways()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading gateways...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="text-destructive">Error: {error}</div>
        <Button onClick={loadGateways}>Retry</Button>
      </div>
    )
  }

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

      {gateways.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wifi className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No gateways configured yet</p>
            <Button className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Gateway
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {gateways.map((gateway) => (
            <Card key={gateway.gatewayId}>
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
                  <p className="text-sm font-mono">{'*'.repeat(15)}</p>
                </div>
                {gateway.coaPort && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">CoA Port</p>
                    <p className="text-sm font-mono">{gateway.coaPort}</p>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => setEditingGateway(gateway)}
                  >
                    <Edit className="mr-2 h-3 w-3" />
                    Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleDelete(gateway.gatewayId)}
                  >
                    <Trash2 className="mr-2 h-3 w-3" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          ))}
        </div>
      )}

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
              <label className="text-sm font-medium">Auth Port</label>
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
          <p className="text-sm text-muted-foreground">
            These settings are used by all gateways to communicate with the billing system.
            Configure each MikroTik router to point to this RADIUS server.
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline">Reset</Button>
            <Button>Save Configuration</Button>
          </div>
        </CardContent>
      </Card>

      {editingGateway && (
        <EditGatewayModal
          gateway={{
            gatewayId: editingGateway.gatewayId,
            name: editingGateway.name,
            ipAddress: editingGateway.ipAddress,
            radiusSecret: editingGateway.radiusSecret,
            status: editingGateway.status
          }}
          onClose={() => setEditingGateway(null)}
          onSave={handleEdit}
        />
      )}
    </div>
  )
}
