'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, Clock, Zap } from 'lucide-react'

interface Package {
  id: string
  name: string
  description: string
  price: number
  duration: number
  bandwidth: number
  status: 'active' | 'inactive'
  sales: number
}

export default function PackagesPage() {
  const [packages] = useState<Package[]>([
    {
      id: '1',
      name: 'Basic',
      description: 'Perfect for browsing and social media',
      price: 50,
      duration: 1,
      bandwidth: 2,
      status: 'active',
      sales: 156,
    },
    {
      id: '2',
      name: 'Standard',
      description: 'Great for streaming and downloads',
      price: 200,
      duration: 6,
      bandwidth: 5,
      status: 'active',
      sales: 234,
    },
    {
      id: '3',
      name: 'Premium',
      description: 'Ultimate speed for power users',
      price: 500,
      duration: 24,
      bandwidth: 10,
      status: 'active',
      sales: 89,
    },
    {
      id: '4',
      name: 'Weekly',
      description: '7 days of connectivity',
      price: 1000,
      duration: 168,
      bandwidth: 5,
      status: 'active',
      sales: 45,
    },
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Packages</h1>
          <p className="text-muted-foreground">
            Manage WiFi data packages and pricing
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Package
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {packages.map((pkg) => (
          <Card key={pkg.id} className="relative overflow-hidden">
            {pkg.name === 'Standard' && (
              <div className="absolute top-0 right-0 bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                POPULAR
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-xl">{pkg.name}</CardTitle>
              <CardDescription>{pkg.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">KES {pkg.price}</span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {pkg.duration >= 24 
                        ? `${pkg.duration / 24} day${pkg.duration / 24 > 1 ? 's' : ''}`
                        : `${pkg.duration} hour${pkg.duration > 1 ? 's' : ''}`
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    <span>{pkg.bandwidth} Mbps</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t text-sm">
                  <span className="text-muted-foreground">Total Sales</span>
                  <span className="font-semibold">{pkg.sales}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={pkg.status === 'active' ? 'success' : 'secondary'}>
                    {pkg.status}
                  </Badge>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Edit className="mr-2 h-3 w-3" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Package Statistics</CardTitle>
          <CardDescription>
            Revenue and usage statistics by package type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {packages.map((pkg) => (
              <div key={pkg.id} className="flex items-center">
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">{pkg.name}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{pkg.sales} sales</span>
                    <span>KES {pkg.sales * pkg.price} revenue</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">KES {pkg.price}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
