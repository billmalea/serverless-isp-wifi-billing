'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'

interface Gateway {
  gatewayId: string
  name: string
  ipAddress: string
  radiusSecret: string
  status: 'online' | 'offline'
}

interface EditGatewayModalProps {
  gateway: Gateway
  onClose: () => void
  onSave: (gatewayId: string, data: Partial<Gateway>) => Promise<void>
}

export function EditGatewayModal({ gateway, onClose, onSave }: EditGatewayModalProps) {
  const [formData, setFormData] = useState({
    name: gateway.name,
    ipAddress: gateway.ipAddress,
    radiusSecret: gateway.radiusSecret,
    status: gateway.status
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await onSave(gateway.gatewayId, formData)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to update gateway')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Edit Gateway</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Gateway Name</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="text-sm font-medium">IP Address</label>
            <Input
              value={formData.ipAddress}
              onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="text-sm font-medium">RADIUS Secret</label>
            <Input
              type="password"
              value={formData.radiusSecret}
              onChange={(e) => setFormData({ ...formData, radiusSecret: e.target.value })}
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'online' | 'offline' })}
              className="w-full px-3 py-2 border rounded-md"
              disabled={loading}
            >
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
