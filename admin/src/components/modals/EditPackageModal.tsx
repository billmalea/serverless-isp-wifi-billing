'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'

interface Package {
  packageId: string
  name: string
  durationHours: number
  price: number
  bandwidth?: string
}

interface EditPackageModalProps {
  package: Package
  onClose: () => void
  onSave: (packageId: string, data: Partial<Package>) => Promise<void>
}

export function EditPackageModal({ package: pkg, onClose, onSave }: EditPackageModalProps) {
  const [formData, setFormData] = useState({
    name: pkg.name,
    durationHours: pkg.durationHours,
    price: pkg.price,
    bandwidth: pkg.bandwidth || ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await onSave(pkg.packageId, formData)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to update package')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Edit Package</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Package Name</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Duration (hours)</label>
            <Input
              type="number"
              value={formData.durationHours}
              onChange={(e) => setFormData({ ...formData, durationHours: parseInt(e.target.value) })}
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Price (KES)</label>
            <Input
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Bandwidth (optional)</label>
            <Input
              value={formData.bandwidth}
              onChange={(e) => setFormData({ ...formData, bandwidth: e.target.value })}
              placeholder="e.g., 10Mbps"
              disabled={loading}
            />
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
