'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search, Plus, Download, Copy, CheckCircle, RefreshCcw } from 'lucide-react'
import { downloadCSV } from '@/lib/export'
import { api } from '@/lib/api'

interface AdminVoucher {
  voucherId?: string
  code?: string
  packageId: string
  packageName?: string
  status: 'unused' | 'used' | 'expired'
  createdAt: string
  expiresAt?: string
  usedAt?: string
  usedBy?: string
  batchId?: string
}

interface GeneratedBatchSummary {
  batchId: string
  packageId: string
  packageName: string
  quantity: number
  createdAt: string
  unused: number
}

export default function VouchersPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'unused' | 'used' | 'expired'>('all')
  const [vouchers, setVouchers] = useState<AdminVoucher[]>([])
  const [packages, setPackages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [batchSummary, setBatchSummary] = useState<GeneratedBatchSummary[]>([])

  const [form, setForm] = useState({
    packageId: '',
    quantity: '10',
    expiryDays: '30'
  })

  async function loadData() {
    try {
      setLoading(true)
      setError(null)
      const [vData, pData] = await Promise.all([
        api.admin.getVouchers(),
        api.admin.getPackages('active')
      ])
      setVouchers(vData.vouchers || [])
      setPackages(pData.packages || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load vouchers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.packageId) return
    try {
      setGenerating(true)
      const res = await api.admin.generateVouchers({
        packageId: form.packageId,
        quantity: parseInt(form.quantity),
        expiryDays: parseInt(form.expiryDays)
      })
      setForm({ packageId: '', quantity: '10', expiryDays: '30' })
      setBatchSummary(prev => [{
        batchId: res.batchId,
        packageId: res.package.packageId,
        packageName: res.package.name,
        quantity: res.vouchers.length,
        createdAt: new Date().toISOString(),
        unused: res.vouchers.length
      }, ...prev])
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Failed to generate vouchers')
    } finally {
      setGenerating(false)
    }
  }

  const filteredVouchers = vouchers.filter(voucher => {
    const code = voucher.code || voucher.voucherId || ''
    const pkg = voucher.packageName || ''
    const matchesSearch = code.toLowerCase().includes(searchQuery.toLowerCase()) || pkg.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filter === 'all' || voucher.status === filter
    return matchesSearch && matchesFilter
  })

  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const getStatusVariant = (status: string): 'success' | 'secondary' | 'warning' => {
    switch (status) {
      case 'unused':
        return 'success'
      case 'used':
        return 'secondary'
      case 'expired':
        return 'warning'
      default:
        return 'success'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vouchers</h1>
          <p className="text-muted-foreground">
            Generate and manage WiFi access vouchers
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="outline"
            disabled={vouchers.length === 0}
            onClick={() => {
              if (vouchers.length === 0) return;
              const rows = vouchers.map(v => ({
                code: v.code || v.voucherId,
                package: v.packageName || v.packageId,
                status: v.status,
                createdAt: v.createdAt,
                expiresAt: v.expiresAt || '',
                usedAt: v.usedAt || '',
                usedBy: v.usedBy || '',
                batchId: v.batchId || ''
              }));
              downloadCSV(rows, { filename: `vouchers-${Date.now()}.csv` });
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Vouchers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vouchers.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Loaded vouchers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Unused</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{vouchers.filter(v => v.status === 'unused').length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Ready for use
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vouchers.filter(v => v.status === 'used').length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Redeemed vouchers
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Redemption Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vouchers.length ? ((vouchers.filter(v => v.status === 'used').length / vouchers.length) * 100).toFixed(0) : 0}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Usage percentage
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate Voucher Batch</CardTitle>
          <CardDescription>Create a new batch of vouchers for a package</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="grid gap-4 md:grid-cols-5">
            <select
              className="border rounded px-2 py-1 text-sm"
              value={form.packageId}
              onChange={(e) => setForm({ ...form, packageId: e.target.value })}
              required
            >
              <option value="">Select Package</option>
              {packages.map((p: any) => (
                <option key={p.packageId} value={p.packageId}>{p.name}</option>
              ))}
            </select>
            <input
              className="border rounded px-2 py-1 text-sm"
              type="number"
              min={1}
              max={500}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              placeholder="Quantity"
              required
            />
            <input
              className="border rounded px-2 py-1 text-sm"
              type="number"
              min={1}
              max={365}
              value={form.expiryDays}
              onChange={(e) => setForm({ ...form, expiryDays: e.target.value })}
              placeholder="Expiry (days)"
              required
            />
            <Button type="submit" disabled={generating}>{generating ? 'Generating...' : 'Generate'}</Button>
            <Button type="button" variant="outline" onClick={() => setForm({ packageId: '', quantity: '10', expiryDays: '30' })}>Reset</Button>
          </form>
        </CardContent>
      </Card>

      {batchSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Generated Batches</CardTitle>
            <CardDescription>Latest batches created this session</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {batchSummary.map(batch => (
                <div key={batch.batchId} className="flex items-center justify-between p-3 border rounded">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{batch.batchId}</p>
                      <Badge variant="outline">{batch.packageName}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Created: {new Date(batch.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-6 text-xs">
                    <span>Total: {batch.quantity}</span>
                    <span>Unused: {batch.unused}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Vouchers</CardTitle>
          <CardDescription>
            <div className="flex items-center gap-4 mt-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by code or package..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <div className="flex gap-2">
                {['all','unused','used','expired'].map(f => (
                  <Button
                    key={f}
                    variant={filter === f ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter(f as any)}
                  >
                    {f.charAt(0).toUpperCase()+f.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {error && <div className="text-sm text-red-600">{error}</div>}
            {loading && <div className="text-sm">Loading vouchers...</div>}
            {!loading && filteredVouchers.length === 0 && !error && (
              <div className="text-sm text-muted-foreground">No vouchers found.</div>
            )}
            {filteredVouchers.map((voucher) => (
              <div
                key={(voucher.voucherId || voucher.code)!}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <code className="font-mono font-bold text-lg">{voucher.code || voucher.voucherId}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(voucher.code || voucher.voucherId || '')}
                    >
                      {copiedCode === (voucher.code || voucher.voucherId) ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {voucher.batchId && <span>Batch: {voucher.batchId}</span>}
                    <span>Package: {voucher.packageName || voucher.packageId}</span>
                    <span>Created: {new Date(voucher.createdAt).toLocaleDateString()}</span>
                  </div>
                  {voucher.usedBy && voucher.usedAt && (
                    <div className="text-xs text-muted-foreground">Used by {voucher.usedBy} on {new Date(voucher.usedAt).toLocaleDateString()}</div>
                  )}
                </div>

                <Badge variant={getStatusVariant(voucher.status)}>
                  {voucher.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
