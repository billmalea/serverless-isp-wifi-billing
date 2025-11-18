'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Router,
  Package,
  Users,
  Activity,
  CreditCard,
  Ticket,
  Settings,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Gateways', href: '/gateways', icon: Router },
  { name: 'Packages', href: '/packages', icon: Package },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Sessions', href: '/sessions', icon: Activity },
  { name: 'Transactions', href: '/transactions', icon: CreditCard },
  { name: 'Vouchers', href: '/vouchers', icon: Ticket },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/" className="flex items-center space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Router className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold">WiFi Billing</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>
      <div className="border-t p-4">
        <div className="flex items-center gap-3 rounded-md px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
            AD
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium">Admin User</p>
            <p className="text-xs text-muted-foreground truncate">admin@wifi.com</p>
          </div>
        </div>
      </div>
    </div>
  )
}
