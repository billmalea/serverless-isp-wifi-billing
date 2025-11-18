'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Eye, Ban } from 'lucide-react'

import { api } from '@/lib/api'

interface AdminUser {
  userId: string
  phoneNumber: string
  createdAt: string
  lastLoginAt?: string
  status: 'active' | 'suspended' | 'inactive'
  // Enriched fields
  activeSessions: number
  totalSessions: number
  totalSpent: number
  lastSeen: string
}

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadUsers(search?: string) {
    try {
      setLoading(true)
      setError(null)
      const data = await api.admin.getUsers(search)
      setUsers(data.users || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    loadUsers(searchQuery.trim() || undefined)
  }

  const filteredUsers = users // backend search already applied optionally

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Manage users and view their activity
          </p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600">{error}</div>
      )}

      {loading && (
        <div className="text-sm">Loading users...</div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground mt-1">{users.filter(u => u.status === 'active').length} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.reduce((sum, u) => sum + u.activeSessions, 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently online
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              KES {users.reduce((sum, u) => sum + u.totalSpent, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              From all users
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Blocked Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.status === 'blocked').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Require attention
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            <form onSubmit={handleSearch} className="flex items-center gap-2 mt-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by phone number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button type="submit" variant="outline" size="sm">Search</Button>
              {searchQuery && (
                <Button type="button" variant="outline" size="sm" onClick={() => { setSearchQuery(''); loadUsers(); }}>Clear</Button>
              )}
            </form>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {!loading && filteredUsers.length === 0 && (
              <div className="text-sm text-muted-foreground">No users found.</div>
            )}
            {filteredUsers.map((user) => (
              <div
                key={user.userId}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{user.phoneNumber}</p>
                    <Badge variant={user.status === 'active' ? 'success' : 'secondary'}>
                      {user.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Joined: {new Date(user.createdAt).toLocaleDateString()}</span>
                    <span>Last seen: {new Date(user.lastSeen).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-right">
                    <p className="font-medium">KES {user.totalSpent.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total spent</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{user.activeSessions}</p>
                    <p className="text-xs text-muted-foreground">Active</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{user.totalSessions}</p>
                    <p className="text-xs text-muted-foreground">Total sessions</p>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button variant="outline" size="sm" disabled>
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
