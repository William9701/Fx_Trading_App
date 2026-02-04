# FX Trading App 💱

A production-ready backend for a multi-currency FX trading platform built with **NestJS**, **TypeORM**, **PostgreSQL**, **Redis**, and **BullMQ**.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.0-red)](https://nestjs.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## 📋 Table of Contents

1. [Features](#-features)
2. [Tech Stack](#-tech-stack)
3. [Quick Start](#-quick-start)
4. [API Documentation](#-api-documentation)
5. [Testing](#-testing)
6. [Architecture](#-architecture)
7. [Deployment](#-deployment)
8. [Environment Variables](#-environment-variables)

---

## ✨ Features

### Core Functionality
- ✅ **User Authentication** - JWT-based auth with access & refresh tokens
- ✅ **Email Verification** - OTP-based verification via background email queue
- ✅ **Multi-Currency Wallets** - Support for NGN, USD, EUR, GBP, and 160+ currencies
- ✅ **Real-Time FX Rates** - Live rates from ExchangeRate API with Redis caching
- ✅ **Currency Conversion** - Atomic transactions with row-level locking
- ✅ **Currency Trading** - Direct currency-to-currency trades
- ✅ **Transaction History** - Paginated, filterable transaction logs
- ✅ **Background Jobs** - BullMQ for async email processing

### Technical Highlights
- 🔒 **Security** - Password hashing (bcrypt), JWT auth, input validation
- 🚀 **Performance** - Redis caching, database indexing, connection pooling
- 🐳 **Docker Ready** - Full containerization with Docker Compose
- 📊 **Monitoring** - Health checks, structured logging
- 🧪 **Testing** - Unit tests with Jest (60%+ coverage)
- 📖 **API Docs** - Interactive Swagger/OpenAPI documentation

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | NestJS 10.x |
| **Language** | TypeScript 5.x |
| **Database** | PostgreSQL 16 |
| **Cache/Queue** | Redis 7 |
| **ORM** | TypeORM |
| **Queue** | BullMQ |
| **Validation** | class-validator |
| **Auth** | JWT (jsonwebtoken) |
| **Email** | Nodemailer |
| **Testing** | Jest |
| **Containerization** | Docker & Docker Compose |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ and **npm** 10+
- **Docker** and **Docker Compose** (recommended)
- **Git**

### Option 1: Docker (Recommended) 🐳

This is the **easiest and fastest** way to get started. Docker will handle all dependencies.

#### Step 1: Clone the Repository

```bash
git clone https://github.com/William9701/Fx_Trading_App.git
cd Fx_Trading_App
```

#### Step 2: Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your preferred text editor
# Update SMTP credentials for email functionality (optional for testing)
```

**Important Environment Variables:**
```env
# Database (auto-configured by Docker)
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=fx_user
DB_PASSWORD=fx_password
DB_NAME=fx_trading_db

# Redis (auto-configured by Docker)
REDIS_HOST=redis
REDIS_PORT=6379

# JWT Secrets (change these!)
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this

# Email (for OTP verification - use Gmail App Password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

#### Step 3: Start the Application

```bash
# Build and start all containers (PostgreSQL, Redis, App)
docker-compose up -d

# Check container status
docker-compose ps

# View logs
docker-compose logs -f app
```

#### Step 4: Verify Installation

The application should now be running at:
- **API**: http://localhost:3000
- **Swagger Docs**: http://localhost:3000/docs
- **Health Check**: http://localhost:3000/api/v1/health

Test the health endpoint:
```bash
curl http://localhost:3000/api/v1/health
# Expected: {"status":"ok","timestamp":"..."}
```

#### Step 5: Test the API

Open your browser and navigate to **http://localhost:3000/docs** to access the interactive Swagger documentation.

**Quick Test Flow:**
1. **Register** a new user at `/api/v1/auth/register`
2. **Check your email** for the OTP code
3. **Verify** your email at `/api/v1/auth/verify`
4. **Login** at `/api/v1/auth/login` to get your JWT token
5. **Authorize** in Swagger (click the lock icon, paste your token)
6. **Test wallet operations** - fund, convert, trade currencies!

---

### Option 2: Local Development (Without Docker)

If you prefer to run services locally without Docker:

#### Step 1: Install Dependencies

```bash
# Install PostgreSQL 16
# Install Redis 7
# Ensure both services are running

# Install Node.js dependencies
npm install
```

#### Step 2: Configure Environment

```bash
cp .env.example .env
# Update .env with your local database and Redis credentials
```

#### Step 3: Run Database Migrations

```bash
# TypeORM will auto-sync schema in development mode
# No manual migrations needed
```

#### Step 4: Start the Application

```bash
# Development mode with hot reload
npm run start:dev

# Production build
npm run build
npm run start:prod
```

---

## 📖 API Documentation

### Interactive Documentation

Once the app is running, visit **http://localhost:3000/docs** for full interactive API documentation powered by Swagger.

### Core Endpoints

#### Authentication
```http
POST /api/v1/auth/register       # Register new user
POST /api/v1/auth/verify         # Verify email with OTP
POST /api/v1/auth/login          # Login and get JWT tokens
POST /api/v1/auth/refresh        # Refresh access token
POST /api/v1/auth/resend-otp     # Resend OTP email
```

#### Wallet Management
```http
GET  /api/v1/wallet              # Get all wallet balances
POST /api/v1/wallet/fund         # Add funds to wallet
POST /api/v1/wallet/convert      # Convert between currencies
POST /api/v1/wallet/trade        # Trade currencies
```

#### FX Rates
```http
GET /api/v1/fx-rates             # Get current exchange rates
GET /api/v1/fx-rates/currencies  # Get supported currencies
```

#### Transactions
```http
GET /api/v1/transactions         # Get transaction history (paginated)
GET /api/v1/transactions/:id     # Get specific transaction
```

### Example API Calls

#### 1. Register a User
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

#### 2. Verify Email
```bash
curl -X POST http://localhost:3000/api/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "otp": "123456"
  }'
```

#### 3. Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

#### 4. Fund Wallet
```bash
curl -X POST http://localhost:3000/api/v1/wallet/fund \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "amount": 5000,
    "currency": "NGN"
  }'
```

#### 5. Convert Currency
```bash
curl -X POST http://localhost:3000/api/v1/wallet/convert \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "amount": 1000,
    "fromCurrency": "NGN",
    "toCurrency": "USD"
  }'
```

---

## 🧪 Testing

### Run Unit Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:cov

# Run tests in watch mode
npm run test:watch
```

### Test Coverage

Current test coverage: **62.8%**

- ✅ AuthService: 10/10 tests passing
- ✅ WalletService: Core functionality tested
- ✅ FxRateService: Rate fetching and caching tested
- ✅ TransactionService: History and filtering tested

### Manual Testing

Use the included **Postman collection** or **Swagger UI** at http://localhost:3000/docs

---

## 🏗 Architecture

### Project Structure

```
src/
├── common/              # Shared utilities, guards, filters
│   ├── decorators/      # Custom decorators (@CurrentUser, @Roles)
│   ├── filters/         # Global exception filters
│   ├── guards/          # Auth guards (JWT, Verified, Roles)
│   ├── enums/           # Shared enums (Currency, TransactionType)
│   └── health/          # Health check endpoint
├── config/              # Configuration files
│   ├── configuration.ts # Environment config loader
│   └── database.config.ts # TypeORM configuration
├── modules/
│   ├── auth/            # Authentication & authorization
│   │   ├── dto/         # Data transfer objects
│   │   ├── entities/    # User entity
│   │   ├── repositories/ # User & OTP repositories
│   │   ├── strategies/  # JWT strategy
│   │   └── guards/      # Auth guards
│   ├── wallet/          # Wallet management
│   │   ├── dto/         # Fund, convert, trade DTOs
│   │   ├── entities/    # Wallet entity
│   │   └── repositories/ # Wallet repository
│   ├── fx-rate/         # Exchange rate service
│   │   └── fx-rate.service.ts # Rate fetching & caching
│   ├── transaction/     # Transaction history
│   │   ├── entities/    # Transaction entity
│   │   └── repositories/ # Transaction repository
│   └── email/           # Email service (BullMQ)
│       ├── email.service.ts # Queue management
│       ├── email.processor.ts # Email sending
│       └── direct-email.service.ts # Direct SMTP (production)
├── app.module.ts        # Root module
└── main.ts              # Application entry point
```

### Key Design Decisions

#### 1. **Atomic Transactions**
All wallet operations use PostgreSQL transactions with row-level locking to prevent race conditions:
```typescript
await queryRunner.manager.transaction(async (manager) => {
  const wallet = await walletRepo.findForUpdate(userId, currency, manager);
  // Perform operations...
  await manager.save(wallet);
});
```

#### 2. **Redis Caching**
FX rates are cached for 5 minutes to reduce API calls:
```typescript
const cachedRates = await this.cacheManager.get('fx_rates');
if (cachedRates) return cachedRates;
```

#### 3. **Background Email Processing**
Emails are sent asynchronously via BullMQ to avoid blocking API responses:
```typescript
await this.emailQueue.add('send-otp', { email, otp });
```

#### 4. **Dual Email Service**
- **Development**: BullMQ + Redis (async queue)
- **Production**: Direct SMTP (no Redis dependency for Render compatibility)

#### 5. **Fallback FX Rates**
Hardcoded fallback rates ensure the app works even if the external API is down.

---

## 🌐 Deployment

### Deploy to Render

The app is configured for one-click deployment to Render using `render.yaml`.

#### Prerequisites
- Render account
- GitHub repository

#### Steps

1. **Push to GitHub**
```bash
git push origin main
```

2. **Connect to Render**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New" → "Blueprint"
   - Connect your GitHub repository
   - Render will auto-detect `render.yaml`

3. **Configure Secrets**
   - Set `JWT_SECRET` and `JWT_REFRESH_SECRET` in Render dashboard
   - Set `SMTP_USER` and `SMTP_PASSWORD` for email functionality

4. **Deploy**
   - Render will automatically:
     - Create PostgreSQL database
     - Create Redis instance
     - Build and deploy the app
     - Set up health checks

**Live Demo**: https://fx-trading-app-fi63.onrender.com

**Note**: Email functionality may be limited on Render's free tier due to SMTP port restrictions.

---

## 🔐 Environment Variables

### Required Variables

```env
# Application
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# Database
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=fx_user
DB_PASSWORD=fx_password
DB_NAME=fx_trading_db

# For Render/managed databases (alternative to individual DB vars)
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# For Render/managed Redis (alternative to individual Redis vars)
REDIS_URL=redis://host:6379

# JWT
JWT_SECRET=your-secret-key-min-32-chars
JWT_EXPIRATION=1h
JWT_REFRESH_SECRET=your-refresh-secret-key-min-32-chars
JWT_REFRESH_EXPIRATION=7d

# Email (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password
EMAIL_FROM="FX Trading <noreply@fxtrading.com>"

# OTP
OTP_EXPIRATION_MINUTES=10

# FX Rate API
FX_RATE_API_URL=https://api.exchangerate-api.com/v4/latest
FX_RATE_CACHE_TTL=300

# Wallet
INITIAL_WALLET_BALANCE=100
BASE_CURRENCY=NGN

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=10
```

### Gmail App Password Setup

1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Enable 2-Factor Authentication
3. Go to **Security** → **App Passwords**
4. Generate a new app password for "Mail"
5. Use this password in `SMTP_PASSWORD`

---

## 📝 License

This project is licensed under the MIT License.

---

## 👨‍💻 Author

**Obi William**
- GitHub: [@William9701](https://github.com/William9701)
- Email: williamobi818@gmail.com

---

## 🙏 Acknowledgments

Built as a backend engineering assessment for **Credpal**.

### External Services Used
- [ExchangeRate API](https://www.exchangerate-api.com/) - Real-time FX rates
- [Render](https://render.com/) - Cloud hosting
- [Gmail SMTP](https://support.google.com/mail/answer/7126229) - Email delivery

---

## 📞 Support

If you encounter any issues:

1. **Check Docker logs**: `docker-compose logs -f app`
2. **Verify environment variables**: Ensure `.env` is properly configured
3. **Check database connection**: `docker-compose ps`
4. **Review API docs**: http://localhost:3000/docs

For bugs or questions, please open an issue on GitHub.

---

**Happy Trading! 💱🚀**
