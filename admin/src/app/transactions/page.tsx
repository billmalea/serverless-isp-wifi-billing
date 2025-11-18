'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search, Download, CheckCircle, XCircle, Clock } from 'lucide-react'

interface Transaction {
  id: string
  phoneNumber: string
  amount: number
  packageName: string
  mpesaReceiptNumber: string
  status: 'completed' | 'failed' | 'pending'
  timestamp: string
}

export default function TransactionsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'completed' | 'failed' | 'pending'>('all')
  
  const [transactions] = useState<Transaction[]>([
    {
      id: '1',
      phoneNumber: '+254712345678',
      amount: 200,
      packageName: 'Standard',
      mpesaReceiptNumber: 'QGK8X7Y9Z2',
      status: 'completed',
      timestamp: '2024-03-20T14:30:00Z',
    },
    {
      id: '2',
      phoneNumber: '+254723456789',
      amount: 500,
      packageName: 'Premium',
      mpesaReceiptNumber: 'QHL9Y8Z0A3',
      status: 'completed',
      timestamp: '2024-03-20T13:15:00Z',
    },
    {
      id: '3',
      phoneNumber: '+254734567890',
      amount: 50,
      packageName: 'Basic',
      mpesaReceiptNumber: 'QIM0Z9A1B4',
      status: 'completed',
      timestamp: '2024-03-20T12:00:00Z',
    },
    {
      id: '4',
      phoneNumber: '+254745678901',
      amount: 200,
      packageName: 'Standard',
      mpesaReceiptNumber: 'QJN1A0B2C5',
      status: 'failed',
      timestamp: '2024-03-20T11:45:00Z',
    },
    {
      id: '5',
      phoneNumber: '+254756789012',
      amount: 1000,
      packageName: 'Weekly',
      mpesaReceiptNumber: 'QKO2B1C3D6',
      status: 'completed',
      timestamp: '2024-03-20T10:30:00Z',
    },
    {
      id: '6',
      phoneNumber: '+254767890123',
      amount: 200,
      packageName: 'Standard',
      mpesaReceiptNumber: '',
      status: 'pending',
      timestamp: '2024-03-20T14:50:00Z',
    },
  ])

  const filteredTransactions = transactions.filter(txn => {
    const matchesSearch = 
      txn.phoneNumber.includes(searchQuery) ||
      txn.mpesaReceiptNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.packageName.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesFilter = filter === 'all' || txn.status === filter

    return matchesSearch && matchesFilter
  })

  const totalRevenue = transactions
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />
      case 'failed':
        return <XCircle className="h-4 w-4" />
      case 'pending':
        return <Clock className="h-4 w-4" />
      default:
        return null
    }
  }

  const getStatusVariant = (status: string): 'success' | 'destructive' | 'warning' => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'failed':
        return 'destructive'
      case 'pending':
        return 'warning'
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
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
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
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={filter === 'completed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('completed')}
                >
                  Completed
                </Button>
                <Button
                  variant={filter === 'pending' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('pending')}
                >
                  Pending
                </Button>
                <Button
                  variant={filter === 'failed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('failed')}
                >
                  Failed
                </Button>
              </div>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredTransactions.map((txn) => (
              <div
                key={txn.id}
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
                      {txn.mpesaReceiptNumber && (
                        <span>Receipt: {txn.mpesaReceiptNumber}</span>
                      )}
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

      <Card>
        <CardHeader>
          <CardTitle>Revenue by Package</CardTitle>
          <CardDescription>
            Breakdown of revenue by package type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {['Basic', 'Standard', 'Premium', 'Weekly'].map((pkg) => {
              const pkgTransactions = transactions.filter(
                t => t.packageName === pkg && t.status === 'completed'
              )
              const pkgRevenue = pkgTransactions.reduce((sum, t) => sum + t.amount, 0)
              const percentage = totalRevenue > 0 ? (pkgRevenue / totalRevenue * 100).toFixed(1) : 0

              return (
                <div key={pkg} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{pkg}</span>
                    <span className="text-muted-foreground">
                      {pkgTransactions.length} sales · KES {pkgRevenue.toLocaleString()} ({percentage}%)
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
