'use client'

import { useState, useEffect } from 'react'
import { X, User, CreditCard, Clock, Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'

interface UserDetailsModalProps {
  userId: string
  onClose: () => void
}

interface UserDetails {
  userId: string
  phoneNumber: string
  status: 'active' | 'inactive' | 'suspended'
  balance: number
  totalSpent: number
  createdAt: string
  lastActive?: string
  sessions: Array<{
    sessionId: string
    packageName: string
    startTime: string
    endTime?: string
    status: 'active' | 'expired' | 'terminated'
    dataUsedMB: number
  }>
  transactions: Array<{
    transactionId: string
    type: string
    amount: number
    status: string
    timestamp: string
    packageName?: string
  }>
}

export function UserDetailsModal({ userId, onClose }: UserDetailsModalProps) {
  const [user, setUser] = useState<UserDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadUserDetails()
  }, [userId])

  async function loadUserDetails() {
    try {
      setLoading(true)
      const data = await api.admin.getUser(userId)
      setUser(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load user details')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">User Details</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {loading && (
          <div className="text-center py-8 text-muted-foreground">
            Loading user details...
          </div>
        )}

        {error && (
          <div className="text-center py-8 text-destructive">
            Error: {error}
          </div>
        )}

        {user && !loading && (
          <div className="space-y-6">
            {/* User Info */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <User className="h-4 w-4" />
                  <span className="text-xs font-medium">Phone Number</span>
                </div>
                <p className="text-lg font-semibold">{user.phoneNumber}</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Activity className="h-4 w-4" />
                  <span className="text-xs font-medium">Status</span>
                </div>
                <Badge variant={user.status === 'active' ? 'success' : 'secondary'}>
                  {user.status}
                </Badge>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <CreditCard className="h-4 w-4" />
                  <span className="text-xs font-medium">Total Spent</span>
                </div>
                <p className="text-lg font-semibold">KES {user.totalSpent}</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs font-medium">Member Since</span>
                </div>
                <p className="text-sm">
                  {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </Card>
            </div>

            {/* Sessions */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Recent Sessions</h3>
              {user.sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sessions found</p>
              ) : (
                <div className="space-y-2">
                  {user.sessions.slice(0, 5).map((session) => (
                    <Card key={session.sessionId} className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{session.packageName}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(session.startTime).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Data Used</p>
                            <p className="text-sm font-medium">{session.dataUsedMB} MB</p>
                          </div>
                          <Badge variant={
                            session.status === 'active' ? 'success' :
                            session.status === 'expired' ? 'secondary' : 'destructive'
                          }>
                            {session.status}
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Transactions */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Recent Transactions</h3>
              {user.transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No transactions found</p>
              ) : (
                <div className="space-y-2">
                  {user.transactions.slice(0, 5).map((tx) => (
                    <Card key={tx.transactionId} className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{tx.packageName || tx.type}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(tx.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="text-lg font-semibold">KES {tx.amount}</p>
                          <Badge variant={
                            tx.status === 'completed' ? 'success' :
                            tx.status === 'pending' ? 'secondary' : 'destructive'
                          }>
                            {tx.status}
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
