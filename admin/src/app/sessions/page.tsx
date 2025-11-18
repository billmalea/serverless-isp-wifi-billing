'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search, Power, Wifi, WifiOff, Clock } from 'lucide-react'
import { formatDuration } from '@/lib/utils'

interface Session {
  id: string
  phoneNumber: string
  macAddress: string
  ipAddress: string
  packageName: string
  startTime: string
  endTime: string
  status: 'active' | 'expired'
  bytesUsed: number
  gateway: string
}

export default function SessionsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'expired'>('all')
  
  const [sessions] = useState<Session[]>([
    {
      id: '1',
      phoneNumber: '+254712345678',
      macAddress: 'AA:BB:CC:DD:EE:01',
      ipAddress: '192.168.1.101',
      packageName: 'Standard',
      startTime: '2024-03-20T10:00:00Z',
      endTime: '2024-03-20T16:00:00Z',
      status: 'active',
      bytesUsed: 2500000000,
      gateway: 'Main Gateway',
    },
    {
      id: '2',
      phoneNumber: '+254723456789',
      macAddress: 'AA:BB:CC:DD:EE:02',
      ipAddress: '192.168.1.102',
      packageName: 'Premium',
      startTime: '2024-03-20T08:00:00Z',
      endTime: '2024-03-21T08:00:00Z',
      status: 'active',
      bytesUsed: 5200000000,
      gateway: 'Main Gateway',
    },
    {
      id: '3',
      phoneNumber: '+254734567890',
      macAddress: 'AA:BB:CC:DD:EE:03',
      ipAddress: '192.168.2.101',
      packageName: 'Basic',
      startTime: '2024-03-19T14:00:00Z',
      endTime: '2024-03-19T15:00:00Z',
      status: 'expired',
      bytesUsed: 850000000,
      gateway: 'Branch Office',
    },
    {
      id: '4',
      phoneNumber: '+254745678901',
      macAddress: 'AA:BB:CC:DD:EE:04',
      ipAddress: '192.168.1.103',
      packageName: 'Standard',
      startTime: '2024-03-18T12:00:00Z',
      endTime: '2024-03-18T18:00:00Z',
      status: 'expired',
      bytesUsed: 3100000000,
      gateway: 'Main Gateway',
    },
  ])

  const filteredSessions = sessions.filter(session => {
    const matchesSearch = session.phoneNumber.includes(searchQuery) ||
      session.macAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.ipAddress.includes(searchQuery)
    
    const matchesFilter = filter === 'all' || session.status === filter

    return matchesSearch && matchesFilter
  })

  const activeSessions = sessions.filter(s => s.status === 'active')

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024)
    return gb >= 1 ? `${gb.toFixed(2)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  }

  const getRemainingTime = (endTime: string) => {
    const now = new Date()
    const end = new Date(endTime)
    const diff = end.getTime() - now.getTime()
    if (diff <= 0) return 'Expired'
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sessions</h1>
          <p className="text-muted-foreground">
            Monitor active and historical user sessions
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-primary" />
              <div className="text-2xl font-bold">{activeSessions.length}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sessions.length}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Data Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(sessions.reduce((sum, s) => sum + s.bytesUsed, 0))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total bandwidth</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Expired Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <WifiOff className="h-5 w-5 text-muted-foreground" />
              <div className="text-2xl font-bold">
                {sessions.filter(s => s.status === 'expired').length}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Session Management</CardTitle>
          <CardDescription>
            <div className="flex items-center gap-4 mt-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by phone, MAC, or IP..."
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
                  variant={filter === 'active' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('active')}
                >
                  Active
                </Button>
                <Button
                  variant={filter === 'expired' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('expired')}
                >
                  Expired
                </Button>
              </div>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {session.status === 'active' ? (
                    <Wifi className="h-5 w-5 text-primary" />
                  ) : (
                    <WifiOff className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{session.phoneNumber}</p>
                      <Badge variant={session.status === 'active' ? 'success' : 'secondary'}>
                        {session.status}
                      </Badge>
                      <Badge variant="outline">{session.packageName}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>MAC: {session.macAddress}</span>
                      <span>IP: {session.ipAddress}</span>
                      <span>{session.gateway}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-sm">
                  <div className="text-right">
                    <p className="font-medium">{formatBytes(session.bytesUsed)}</p>
                    <p className="text-xs text-muted-foreground">Data used</p>
                  </div>
                  {session.status === 'active' && (
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <p className="font-medium">{getRemainingTime(session.endTime)}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Remaining</p>
                    </div>
                  )}
                  <div className="text-right">
                    <p className="font-medium">
                      {new Date(session.startTime).toLocaleTimeString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(session.startTime).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {session.status === 'active' && (
                  <Button variant="destructive" size="sm" className="ml-4">
                    <Power className="mr-2 h-4 w-4" />
                    Disconnect
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
