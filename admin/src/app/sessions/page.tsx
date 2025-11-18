'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search, Power, Wifi, WifiOff, Clock } from 'lucide-react'
import { formatDuration } from '@/lib/utils'

import { api } from '@/lib/api'

interface AdminSession {
  sessionId: string
  userId: string
  phoneNumber?: string
  macAddress: string
  ipAddress: string
  packageId: string
  packageName: string
  gatewayId: string
  startTime: string
  expiresAt: string
  endTime?: string
  durationHours: number
  bandwidthMbps: number
  status: 'active' | 'expired' | 'terminated'
}

export default function SessionsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'expired' | 'terminated'>('all')
  const [sessions, setSessions] = useState<AdminSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadSessions(statusFilter?: string) {
    try {
      setLoading(true)
      setError(null)
      const data = await api.admin.getSessions()
      let list: AdminSession[] = data.sessions || []
      if (statusFilter && statusFilter !== 'all') {
        list = list.filter(s => s.status === statusFilter)
      }
      setSessions(list)
    } catch (err: any) {
      setError(err.message || 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [])

  function applyFilters(localSessions: AdminSession[]) {
    return localSessions.filter(session => {
      const q = searchQuery.trim().toLowerCase()
      const matchesSearch = !q ||
        session.phoneNumber?.includes(q) ||
        session.macAddress.toLowerCase().includes(q) ||
        session.ipAddress.includes(q)
      const matchesFilter = filter === 'all' || session.status === filter
      return matchesSearch && matchesFilter
    })
  }

  const filteredSessions = applyFilters(sessions)
  const activeSessions = sessions.filter(s => s.status === 'active')

  const getRemainingTime = (expiresAt: string) => {
    const now = new Date()
    const end = new Date(expiresAt)
    const diff = end.getTime() - now.getTime()
    if (diff <= 0) return 'Expired'
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  async function handleTerminate(sessionId: string) {
    if (!confirm('Terminate this session?')) return
    try {
      await api.admin.terminateSession(sessionId)
      await loadSessions()
    } catch (err: any) {
      setError(err.message || 'Failed to terminate session')
    }
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
            <div className="text-2xl font-bold">{activeSessions.length ? activeSessions.length : sessions.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Sessions count</p>
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
                {['all','active','expired','terminated'].map(f => (
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
            {loading && <div className="text-sm">Loading sessions...</div>}
            {!loading && filteredSessions.length === 0 && !error && (
              <div className="text-sm text-muted-foreground">No sessions found.</div>
            )}
            {filteredSessions.map((session) => (
              <div
                key={session.sessionId}
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
                      <p className="font-medium">{session.phoneNumber || session.userId}</p>
                      <Badge variant={session.status === 'active' ? 'success' : 'secondary'}>
                        {session.status}
                      </Badge>
                      <Badge variant="outline">{session.packageName}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>MAC: {session.macAddress}</span>
                      <span>IP: {session.ipAddress}</span>
                      <span>Gateway: {session.gatewayId}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-sm">
                  <div className="text-right">
                    <p className="font-medium">{session.bandwidthMbps} Mbps</p>
                    <p className="text-xs text-muted-foreground">Bandwidth</p>
                  </div>
                  {session.status === 'active' && (
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <p className="font-medium">{getRemainingTime(session.expiresAt)}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Remaining</p>
                    </div>
                  )}
                  <div className="text-right">
                    <p className="font-medium">{new Date(session.startTime).toLocaleTimeString()}</p>
                    <p className="text-xs text-muted-foreground">{new Date(session.startTime).toLocaleDateString()}</p>
                  </div>
                </div>

                {session.status === 'active' && (
                  <Button variant="destructive" size="sm" className="ml-4" onClick={() => handleTerminate(session.sessionId)}>
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
