'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, Users, Activity, Wifi } from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

interface DashboardStats {
  revenue: {
    total: number
    today: number
    thisMonth: number
  }
  users: {
    total: number
    active: number
  }
  sessions: {
    active: number
    total: number
  }
  gateways: {
    online: number
    total: number
  }
  recentTransactions: any[]
  sessionsByPackage: Record<string, number>
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      setLoading(true)
      const data = await api.admin.getDashboard()
      setStats(data)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard')
      console.error('Dashboard error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-destructive">Error: {error}</div>
      </div>
    )
  }

  if (!stats) return null

  const statCards = [
    {
      title: 'Total Revenue',
      value: formatCurrency(stats.revenue.total),
      change: `KES ${stats.revenue.thisMonth} this month`,
      icon: DollarSign,
    },
    {
      title: 'Active Users',
      value: stats.users.active.toString(),
      change: `${stats.users.total} total users`,
      icon: Users,
    },
    {
      title: 'Active Sessions',
      value: stats.sessions.active.toString(),
      change: `${stats.sessions.total} total`,
      icon: Activity,
    },
    {
      title: 'Gateways Online',
      value: `${stats.gateways.online}/${stats.gateways.total}`,
      change: `${Math.round((stats.gateways.online / stats.gateways.total) * 100)}% uptime`,
      icon: Wifi,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your WiFi billing system
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.change} from last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
                {stats.recentTransactions.slice(0, 5).map((txn) => (
                  <div key={txn.transactionId} className="flex items-center">
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                        {txn.phoneNumber}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {txn.packageName} - {new Date(txn.timestamp).toLocaleString()}
                    </p>
                  </div>
                    <div className="font-medium text-primary">+{formatCurrency(txn.amount)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Active Sessions by Package</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
                {Object.entries(stats.sessionsByPackage).map(([packageName, count]) => {
                  const totalSessions = Object.values(stats.sessionsByPackage).reduce((a, b) => a + b, 0)
                  const percentage = totalSessions > 0 ? (count / totalSessions) * 100 : 0
                
                  return (
                    <div key={packageName} className="flex items-center">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{packageName}</p>
                        <div className="mt-2 h-2 w-full rounded-full bg-muted">
                          <div 
                            className="h-2 rounded-full bg-primary" 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                      <div className="ml-4 text-sm font-medium">{count}</div>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
