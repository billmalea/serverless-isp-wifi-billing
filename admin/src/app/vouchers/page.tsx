'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search, Plus, Download, Copy, CheckCircle } from 'lucide-react'

interface Voucher {
  id: string
  code: string
  packageName: string
  status: 'unused' | 'used' | 'expired'
  batchId: string
  createdAt: string
  usedBy: string | null
  usedAt: string | null
}

interface Batch {
  id: string
  packageName: string
  quantity: number
  createdAt: string
  unused: number
}

export default function VouchersPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'unused' | 'used' | 'expired'>('all')
  
  const [vouchers] = useState<Voucher[]>([
    {
      id: '1',
      code: 'WIFI-ABCD-1234',
      packageName: 'Basic',
      status: 'unused',
      batchId: 'BATCH001',
      createdAt: '2024-03-15T10:00:00Z',
      usedBy: null,
      usedAt: null,
    },
    {
      id: '2',
      code: 'WIFI-EFGH-5678',
      packageName: 'Basic',
      status: 'used',
      batchId: 'BATCH001',
      createdAt: '2024-03-15T10:00:00Z',
      usedBy: '+254712345678',
      usedAt: '2024-03-18T14:30:00Z',
    },
    {
      id: '3',
      code: 'WIFI-IJKL-9012',
      packageName: 'Standard',
      status: 'unused',
      batchId: 'BATCH002',
      createdAt: '2024-03-16T10:00:00Z',
      usedBy: null,
      usedAt: null,
    },
    {
      id: '4',
      code: 'WIFI-MNOP-3456',
      packageName: 'Standard',
      status: 'used',
      batchId: 'BATCH002',
      createdAt: '2024-03-16T10:00:00Z',
      usedBy: '+254723456789',
      usedAt: '2024-03-19T09:15:00Z',
    },
    {
      id: '5',
      code: 'WIFI-QRST-7890',
      packageName: 'Premium',
      status: 'unused',
      batchId: 'BATCH003',
      createdAt: '2024-03-17T10:00:00Z',
      usedBy: null,
      usedAt: null,
    },
  ])

  const [batches] = useState<Batch[]>([
    {
      id: 'BATCH001',
      packageName: 'Basic',
      quantity: 50,
      createdAt: '2024-03-15T10:00:00Z',
      unused: 38,
    },
    {
      id: 'BATCH002',
      packageName: 'Standard',
      quantity: 30,
      createdAt: '2024-03-16T10:00:00Z',
      unused: 22,
    },
    {
      id: 'BATCH003',
      packageName: 'Premium',
      quantity: 20,
      createdAt: '2024-03-17T10:00:00Z',
      unused: 18,
    },
  ])

  const filteredVouchers = vouchers.filter(voucher => {
    const matchesSearch = 
      voucher.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      voucher.packageName.toLowerCase().includes(searchQuery.toLowerCase())
    
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
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Generate Batch
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Vouchers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vouchers.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {batches.length} batches
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Unused</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {vouchers.filter(v => v.status === 'unused').length}
            </div>
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
            <div className="text-2xl font-bold">
              {vouchers.filter(v => v.status === 'used').length}
            </div>
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
            <div className="text-2xl font-bold">
              {((vouchers.filter(v => v.status === 'used').length / vouchers.length) * 100).toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Usage percentage
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Batches</CardTitle>
          <CardDescription>
            Overview of voucher batches generated
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {batches.map((batch) => (
              <div
                key={batch.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{batch.id}</p>
                    <Badge variant="outline">{batch.packageName}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Created: {new Date(batch.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-6 text-sm">
                  <div className="text-right">
                    <p className="font-medium">{batch.quantity}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-green-600">{batch.unused}</p>
                    <p className="text-xs text-muted-foreground">Unused</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{batch.quantity - batch.unused}</p>
                    <p className="text-xs text-muted-foreground">Used</p>
                  </div>
                </div>

                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={filter === 'unused' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('unused')}
                >
                  Unused
                </Button>
                <Button
                  variant={filter === 'used' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('used')}
                >
                  Used
                </Button>
              </div>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredVouchers.map((voucher) => (
              <div
                key={voucher.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <code className="font-mono font-bold text-lg">{voucher.code}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(voucher.code)}
                    >
                      {copiedCode === voucher.code ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Batch: {voucher.batchId}</span>
                    <span>Package: {voucher.packageName}</span>
                    <span>Created: {new Date(voucher.createdAt).toLocaleDateString()}</span>
                  </div>
                  {voucher.usedBy && (
                    <div className="text-xs text-muted-foreground">
                      Used by {voucher.usedBy} on {new Date(voucher.usedAt!).toLocaleDateString()}
                    </div>
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
