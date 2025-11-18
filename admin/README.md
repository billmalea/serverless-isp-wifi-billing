# WiFi Billing Admin Dashboard

Modern admin dashboard for managing WiFi billing system built with Next.js 14, TypeScript, and Tailwind CSS.

## Features

- 📊 **Dashboard**: Real-time stats, revenue tracking, and system overview
- 🌐 **Gateway Management**: Configure MikroTik routers and RADIUS settings
- 📦 **Package Management**: Create and manage WiFi data packages
- 👥 **User Management**: View user activity, sessions, and spending
- 🔄 **Session Monitoring**: Track active sessions and disconnect users
- 💰 **Transaction History**: View M-Pesa payments and revenue analytics
- 🎟️ **Voucher Generation**: Create and manage WiFi access vouchers
- ⚙️ **Settings**: Configure M-Pesa, RADIUS, and system settings

## Tech Stack

- **Framework**: Next.js 14.2.5 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom teal theme
- **Icons**: Lucide React
- **Charts**: Recharts for data visualization
- **UI Components**: shadcn-inspired design system

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Navigate to the admin directory:
```bash
cd admin
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
# Create .env.local file with:
NEXT_PUBLIC_API_URL=""
```

### Development

Run the development server:
```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

### Build

Create production build:
```bash
npm run build
```

Start production server:
```bash
npm start
```

## Project Structure

```
admin/
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── layout.tsx         # Root layout with sidebar
│   │   ├── page.tsx           # Dashboard home
│   │   ├── gateways/          # Gateway management
│   │   ├── packages/          # Package management
│   │   ├── users/             # User management
│   │   ├── sessions/          # Session monitoring
│   │   ├── transactions/      # Payment history
│   │   ├── vouchers/          # Voucher generation
│   │   └── settings/          # System settings
│   ├── components/
│   │   ├── ui/                # UI components (Button, Card, etc.)
│   │   └── layout/            # Layout components (Sidebar, Header)
│   └── lib/
│       ├── api.ts             # API client
│       └── utils.ts           # Utility functions
├── public/                     # Static assets
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

## Design System

### Colors

- **Primary (Teal)**: `hsl(187 85% 26%)` - Main brand color
- **Background**: White (light mode) / Dark gray (dark mode)
- **Accent**: Lighter teal shades for hover states

### Components

All UI components follow shadcn design patterns with variants:
- `Button`: default, destructive, outline, secondary, ghost, link
- `Badge`: success, warning, destructive, secondary
- `Card`: Consistent card layout for content sections

## API Integration

The admin dashboard connects to the existing Lambda backend:
- Base URL: ``
- Endpoints: `/packages`, `/users`, `/sessions`, `/transactions`, `/vouchers`

**Note**: Admin-specific endpoints (`/admin/*`) need to be implemented in the Lambda backend.

## Pages Overview

### Dashboard (`/`)
- Revenue stats and trends
- Active users and sessions
- Recent transactions
- Quick actions

### Gateways (`/gateways`)
- MikroTik router configuration
- RADIUS server settings
- Gateway status monitoring
- Add/edit/delete gateways

### Packages (`/packages`)
- Data package CRUD operations
- Pricing and duration settings
- Bandwidth configuration
- Sales statistics

### Users (`/users`)
- User listing with search
- Activity history
- Session management
- Block/unblock users

### Sessions (`/sessions`)
- Active session monitoring
- Device information (MAC, IP)
- Disconnect active sessions
- Session history

### Transactions (`/transactions`)
- Payment history with filters
- M-Pesa receipt tracking
- Revenue analytics by package
- Export to CSV

### Vouchers (`/vouchers`)
- Generate voucher batches
- View all vouchers with status
- Copy voucher codes
- Export voucher lists

### Settings (`/settings`)
- M-Pesa/Daraja credentials
- RADIUS configuration
- System preferences
- Notification settings

## Environment Variables

```bash
# API Configuration
NEXT_PUBLIC_API_URL=your_api_gateway_url

# Optional: Authentication
NEXT_PUBLIC_AUTH_ENABLED=false
```

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Set environment variables
4. Deploy

### AWS Amplify

```bash
amplify init
amplify add hosting
amplify publish
```

### Docker

```bash
docker build -t wifi-admin .
docker run -p 3001:3001 wifi-admin
```

## Authentication

Currently, the admin dashboard does not include authentication. To add admin authentication:

1. Install next-auth: `npm install next-auth`
2. Create `src/app/api/auth/[...nextauth]/route.ts`
3. Add middleware for protected routes
4. Implement admin user management in backend

## TODO

- [ ] Implement admin backend endpoints in Lambda
- [ ] Add authentication/authorization
- [ ] Real-time session updates with WebSockets
- [ ] Advanced analytics and reporting
- [ ] Bulk operations for users/vouchers
- [ ] Export functionality for all data
- [ ] Dark mode toggle

## Contributing

1. Create feature branch
2. Make changes
3. Test thoroughly
4. Submit pull request

## License

See LICENSE file in root directory.

## Support

For issues or questions:
- Email: support@example.com
- Phone: +254700000000
