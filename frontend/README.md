# DOMUS+ - Family Budget Management System

A complete family budget management system with WhatsApp integration for automatic receipt processing.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **UI**: React 19 + TailwindCSS
- **State Management**: Zustand
- **Receipt OCR**: OpenAI GPT-4 Vision
- **WhatsApp**: Twilio API

## Features

- 📊 Annual budget management by categories
- 👥 Family member management with role-based access
- 📱 WhatsApp integration for receipt submission
- 🤖 Automatic receipt processing with AI (OCR)
- 💰 Income and expense tracking
- 📈 Dashboard with visualizations and analytics

## Quick Start

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for server-side operations)
- `OPENAI_API_KEY` - OpenAI API key (for receipt OCR)
- `TWILIO_ACCOUNT_SID` - Twilio Account SID (for WhatsApp)
- `TWILIO_AUTH_TOKEN` - Twilio Auth Token
- `TWILIO_PHONE_NUMBER` - Twilio WhatsApp number

### 3. Setup Supabase Database

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor in your Supabase dashboard
3. Execute the SQL from `../supabase/schema.sql`
4. Execute additional SQL files for RLS policies and triggers

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
frontend/
├── app/
│   ├── api/                    # API Routes
│   │   ├── auth/               # Authentication endpoints
│   │   ├── budgets/            # Budget CRUD operations
│   │   ├── transactions/       # Transaction CRUD operations
│   │   ├── receipts/           # Receipt processing
│   │   ├── users/              # User management
│   │   ├── families/           # Family management
│   │   └── whatsapp/           # WhatsApp webhook
│   ├── dashboard/              # Dashboard page
│   ├── budgets/                # Budgets page
│   ├── transactions/           # Transactions page
│   ├── receipts/               # Receipts page
│   ├── login/                  # Login page
│   ├── register/               # Registration page
│   └── layout.tsx              # Root layout
├── components/                 # Reusable components
├── lib/
│   ├── supabase/               # Supabase client configuration
│   │   ├── client.ts           # Browser client
│   │   └── server.ts           # Server client
│   ├── services/               # Business logic services
│   │   └── receipt-processor.ts
│   ├── types.ts                # TypeScript types
│   └── api-supabase.ts         # API helper functions
├── middleware.ts               # Auth middleware
└── package.json
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

### Users
- `GET /api/users/me` - Get current user
- `PUT /api/users/me` - Update current user

### Budgets
- `GET /api/budgets` - List family budgets
- `POST /api/budgets` - Create budget
- `GET /api/budgets/[id]` - Get budget by ID
- `PUT /api/budgets/[id]` - Update budget
- `DELETE /api/budgets/[id]` - Delete budget
- `GET /api/budgets/summary` - Get budget summary

### Transactions
- `GET /api/transactions` - List transactions
- `POST /api/transactions` - Create transaction
- `GET /api/transactions/[id]` - Get transaction by ID
- `PUT /api/transactions/[id]` - Update transaction
- `DELETE /api/transactions/[id]` - Delete transaction

### Receipts
- `GET /api/receipts` - List receipts
- `POST /api/receipts/process` - Process receipt image with OCR
- `GET /api/receipts/[id]` - Get receipt by ID
- `DELETE /api/receipts/[id]` - Delete receipt
- `POST /api/receipts/[id]/assign` - Assign receipt to budget

### WhatsApp
- `POST /api/whatsapp/webhook` - Twilio webhook for incoming messages

## WhatsApp Integration

To enable WhatsApp receipt submission:

1. Create a Twilio account and enable WhatsApp Sandbox
2. Configure the webhook URL in Twilio: `https://your-domain.com/api/whatsapp/webhook`
3. Users can send receipt images via WhatsApp to automatically create transactions

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## Deployment

This project can be deployed to:
- Vercel (recommended)
- Netlify
- Any Node.js hosting platform

Make sure to set all environment variables in your deployment platform.

## License

MIT
