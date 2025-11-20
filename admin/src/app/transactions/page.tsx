'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search, Download, CheckCircle, XCircle, Clock } from 'lucide-react'
import { downloadCSV } from '@/lib/export'
import { api } from '@/lib/api'

interface AdminTransaction {
  transactionId: string
  userId: string
  phoneNumber: string
  amount: number
  packageId: string
  packageName: string
  durationHours: number
  bandwidthMbps: number
  mpesaReceiptNumber?: string
  mpesaTransactionId?: string
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  timestamp: string
  completedAt?: string
}

export default function TransactionsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'completed' | 'failed' | 'pending' | 'cancelled'>('all')
  const [transactions, setTransactions] = useState<AdminTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadTransactions() {
    try {
      setLoading(true)
      setError(null)
      const data = await api.admin.getTransactions()
      setTransactions(data.transactions || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTransactions()
  }, [])

  const filteredTransactions = transactions.filter(txn => {
    const q = searchQuery.trim().toLowerCase()
    const matchesSearch = !q ||
      txn.phoneNumber?.toLowerCase().includes(q) ||
      txn.mpesaReceiptNumber?.toLowerCase().includes(q) ||
      txn.packageName.toLowerCase().includes(q) ||
      txn.transactionId.toLowerCase().includes(q)
    const matchesFilter = filter === 'all' || txn.status === filter
    return matchesSearch && matchesFilter
  })

  const totalRevenue = transactions.filter(t => t.status === 'completed').reduce((sum, t) => sum + t.amount, 0)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />
      case 'failed':
        return <XCircle className="h-4 w-4" />
      case 'pending':
        return <Clock className="h-4 w-4" />
      case 'cancelled':
        return <XCircle className="h-4 w-4" />
      default:
        return null
    }
  }

  const getStatusVariant = (status: string): 'success' | 'destructive' | 'warning' | 'secondary' => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'failed':
        return 'destructive'
      case 'pending':
        return 'warning'
      case 'cancelled':
        return 'secondary'
      default:
        return 'success'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">
            View and manage payment transactions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadTransactions} disabled={loading}>
            <Download className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (transactions.length === 0) return;
              const rows = transactions.map(t => ({
                transactionId: t.transactionId,
                phoneNumber: t.phoneNumber,
                packageName: t.packageName,
                amount: t.amount,
                status: t.status,
                timestamp: t.timestamp,
                receipt: t.mpesaReceiptNumber || '',
              }));
              downloadCSV(rows, { filename: `transactions-${Date.now()}.csv` });
            }}
            disabled={transactions.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              KES {totalRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              From {transactions.filter(t => t.status === 'completed').length} transactions
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div className="text-2xl font-bold">
                {transactions.filter(t => t.status === 'completed').length}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              <div className="text-2xl font-bold">
                {transactions.filter(t => t.status === 'pending').length}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <div className="text-2xl font-bold">
                {transactions.filter(t => t.status === 'failed').length}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            <div className="flex items-center gap-4 mt-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by phone, receipt, or package..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <div className="flex gap-2">
                {['all','completed','pending','failed','cancelled'].map(f => (
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
            {loading && <div className="text-sm">Loading transactions...</div>}
            {!loading && filteredTransactions.length === 0 && !error && (
              <div className="text-sm text-muted-foreground">No transactions found.</div>
            )}
            {filteredTransactions.map((txn) => (
              <div
                key={txn.transactionId}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{txn.phoneNumber}</p>
                      <Badge variant={getStatusVariant(txn.status)} className="flex items-center gap-1">
                        {getStatusIcon(txn.status)}
                        {txn.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Package: {txn.packageName}</span>
                      {txn.mpesaReceiptNumber && <span>Receipt: {txn.mpesaReceiptNumber}</span>}
                      <span>ID: {txn.transactionId.slice(0,8)}...</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xl font-bold">KES {txn.amount}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium">
                      {new Date(txn.timestamp).toLocaleTimeString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(txn.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Future enhancement: dynamic revenue breakdown sourced from all packages */}
    </div>
  )
}
