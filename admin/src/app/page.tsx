import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, Users, Activity, Wifi } from 'lucide-react'

export default function DashboardPage() {
  const stats = [
    {
      title: 'Total Revenue',
      value: 'KES 125,400',
      change: '+12.5%',
      icon: DollarSign,
    },
    {
      title: 'Active Users',
      value: '248',
      change: '+5.2%',
      icon: Users,
    },
    {
      title: 'Active Sessions',
      value: '186',
      change: '-2.1%',
      icon: Activity,
    },
    {
      title: 'Gateways Online',
      value: '12/15',
      change: '80%',
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
        {stats.map((stat) => (
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
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center">
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      Payment #{1000 + i}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Standard Package - 254727800{i}23
                    </p>
                  </div>
                  <div className="font-medium text-primary">+KES 500</div>
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
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium">Basic (2 Mbps)</p>
                  <div className="mt-2 h-2 w-full rounded-full bg-muted">
                    <div className="h-2 w-1/3 rounded-full bg-primary" />
                  </div>
                </div>
                <div className="ml-4 text-sm font-medium">45</div>
              </div>
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium">Standard (5 Mbps)</p>
                  <div className="mt-2 h-2 w-full rounded-full bg-muted">
                    <div className="h-2 w-2/3 rounded-full bg-primary" />
                  </div>
                </div>
                <div className="ml-4 text-sm font-medium">89</div>
              </div>
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium">Premium (10 Mbps)</p>
                  <div className="mt-2 h-2 w-full rounded-full bg-muted">
                    <div className="h-2 w-1/2 rounded-full bg-primary" />
                  </div>
                </div>
                <div className="ml-4 text-sm font-medium">52</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
