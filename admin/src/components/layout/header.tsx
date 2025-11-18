'use client'

import { Bell, Search, LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getUser, logout } from '@/lib/auth'
import { useState, useEffect } from 'react'

export function Header() {
  const [user, setUser] = useState<{ phoneNumber: string } | null>(null)

  useEffect(() => {
    setUser(getUser())
  }, [])

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-6">
      <div className="flex flex-1 items-center gap-4">
        <form className="w-full max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="w-full pl-10"
            />
          </div>
        </form>
      </div>
      
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon">
          <Bell className="h-5 w-5" />
        </Button>
        
        {user && (
          <div className="flex items-center gap-2 pl-2 border-l">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{user.phoneNumber}</span>
          </div>
        )}
        
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={logout}
          title="Logout"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  )
}
