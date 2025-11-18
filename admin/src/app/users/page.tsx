'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Eye, Ban } from 'lucide-react'

interface User {
  id: string
  phoneNumber: string
  email: string | null
  totalSpent: number
  activeSessions: number
  totalSessions: number
  joinedAt: string
  lastSeen: string
  status: 'active' | 'blocked'
}

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [users] = useState<User[]>([
    {
      id: '1',
      phoneNumber: '+254712345678',
      email: 'user1@example.com',
      totalSpent: 1250,
      activeSessions: 1,
      totalSessions: 15,
      joinedAt: '2024-01-15',
      lastSeen: '2024-03-20',
      status: 'active',
    },
    {
      id: '2',
      phoneNumber: '+254723456789',
      email: null,
      totalSpent: 850,
      activeSessions: 0,
      totalSessions: 8,
      joinedAt: '2024-02-01',
      lastSeen: '2024-03-18',
      status: 'active',
    },
    {
      id: '3',
      phoneNumber: '+254734567890',
      email: 'user3@example.com',
      totalSpent: 2100,
      activeSessions: 2,
      totalSessions: 24,
      joinedAt: '2023-12-10',
      lastSeen: '2024-03-20',
      status: 'active',
    },
    {
      id: '4',
      phoneNumber: '+254745678901',
      email: null,
      totalSpent: 500,
      activeSessions: 0,
      totalSessions: 5,
      joinedAt: '2024-03-01',
      lastSeen: '2024-03-10',
      status: 'blocked',
    },
  ])

  const filteredUsers = users.filter(user =>
    user.phoneNumber.includes(searchQuery) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

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

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {users.filter(u => u.status === 'active').length} active
            </p>
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
            <div className="flex items-center gap-2 mt-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by phone or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{user.phoneNumber}</p>
                    <Badge variant={user.status === 'active' ? 'success' : 'destructive'}>
                      {user.status}
                    </Badge>
                  </div>
                  {user.email && (
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Joined: {new Date(user.joinedAt).toLocaleDateString()}</span>
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
                  <Button variant="outline" size="sm">
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Button>
                  {user.status === 'active' && (
                    <Button variant="outline" size="sm">
                      <Ban className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
