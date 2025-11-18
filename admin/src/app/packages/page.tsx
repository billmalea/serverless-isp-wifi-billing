'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, Clock, Zap } from 'lucide-react'

import { api } from '@/lib/api'
import { EditPackageModal } from '@/components/modals/EditPackageModal'

interface AdminPackage {
  packageId: string
  name: string
  description: string
  durationHours: number
  bandwidthMbps: number
  priceKES: number
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

export default function PackagesPage() {
  const [packages, setPackages] = useState<AdminPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editingPackage, setEditingPackage] = useState<AdminPackage | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    durationHours: '',
    bandwidthMbps: '',
    priceKES: '',
    status: 'active'
  })

  async function fetchPackages() {
    try {
      setLoading(true)
      setError(null)
      const data = await api.admin.getPackages()
      setPackages(data.packages || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load packages')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPackages()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.durationHours || !form.bandwidthMbps || !form.priceKES) return
    try {
      setCreating(true)
      await api.admin.createPackage({
        name: form.name,
        description: form.description,
        durationHours: parseFloat(form.durationHours),
        bandwidthMbps: parseInt(form.bandwidthMbps),
        priceKES: parseFloat(form.priceKES),
        status: form.status
      })
      setForm({ name: '', description: '', durationHours: '', bandwidthMbps: '', priceKES: '', status: 'active' })
      await fetchPackages()
    } catch (err: any) {
      setError(err.message || 'Failed to create package')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Deactivate this package?')) return
    try {
      await api.admin.deletePackage(id)
      await fetchPackages()
    } catch (err: any) {
      setError(err.message || 'Failed to deactivate package')
    }
  }

  async function handleEdit(packageId: string, data: Partial<AdminPackage>) {
    await api.admin.updatePackage(packageId, data)
    await fetchPackages()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Packages</h1>
          <p className="text-muted-foreground">
            Manage WiFi data packages and pricing
          </p>
        </div>
        <Button onClick={() => {}} disabled>
          <Plus className="mr-2 h-4 w-4" />
          New Package
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Package</CardTitle>
          <CardDescription>Add a new data package</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-5">
            <input
              className="border rounded px-2 py-1 text-sm"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <input
              className="border rounded px-2 py-1 text-sm"
              placeholder="Hours"
              type="number"
              min={1}
              max={168}
              value={form.durationHours}
              onChange={(e) => setForm({ ...form, durationHours: e.target.value })}
              required
            />
            <input
              className="border rounded px-2 py-1 text-sm"
              placeholder="Bandwidth Mbps"
              type="number"
              min={1}
              max={100}
              value={form.bandwidthMbps}
              onChange={(e) => setForm({ ...form, bandwidthMbps: e.target.value })}
              required
            />
            <input
              className="border rounded px-2 py-1 text-sm"
              placeholder="Price KES"
              type="number"
              min={1}
              max={10000}
              value={form.priceKES}
              onChange={(e) => setForm({ ...form, priceKES: e.target.value })}
              required
            />
            <Button type="submit" disabled={creating}>
              {creating ? 'Creating...' : 'Create'}
            </Button>
            <textarea
              className="border rounded px-2 py-1 text-sm col-span-full"
              rows={2}
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </form>
        </CardContent>
      </Card>

      {error && (
        <div className="text-sm text-red-600">{error}</div>
      )}

      {loading && (
        <div className="text-sm">Loading packages...</div>
      )}

      {!loading && packages.length === 0 && !error && (
        <div className="text-sm text-muted-foreground">No packages found.</div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {!loading && packages.map((pkg) => {
          const durationDisplay = pkg.durationHours >= 24
            ? `${Math.round(pkg.durationHours / 24)} day${Math.round(pkg.durationHours / 24) > 1 ? 's' : ''}`
            : `${pkg.durationHours} hour${pkg.durationHours !== 1 ? 's' : ''}`
          return (
            <Card key={pkg.packageId} className="relative overflow-hidden">
              <CardHeader>
                <CardTitle className="text-xl">{pkg.name}</CardTitle>
                <CardDescription>{pkg.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">KES {pkg.priceKES}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{durationDisplay}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                      <span>{pkg.bandwidthMbps} Mbps</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={pkg.status === 'active' ? 'success' : 'secondary'}>
                      {pkg.status}
                    </Badge>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditingPackage(pkg)}>
                      <Edit className="mr-2 h-3 w-3" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(pkg.packageId)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Future: statistics component (requires transactions aggregation) */}

      {editingPackage && (
        <EditPackageModal
          package={{
            packageId: editingPackage.packageId,
            name: editingPackage.name,
            durationHours: editingPackage.durationHours,
            price: editingPackage.priceKES,
            bandwidth: `${editingPackage.bandwidthMbps}Mbps`
          }}
          onClose={() => setEditingPackage(null)}
          onSave={handleEdit}
        />
      )}
    </div>
  )
}
