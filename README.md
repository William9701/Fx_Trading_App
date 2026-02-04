# FX Trading App

A production-ready backend for a multi-currency FX trading platform built with NestJS, TypeORM, PostgreSQL, Redis, and BullMQ. Built as a backend engineering assessment for Credpal.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Setup & Running](#setup--running)
   - [Docker (Recommended)](#docker-recommended)
   - [Local Development](#local-development)
5. [How It Works — End-to-End Flow](#how-it-works--end-to-end-flow)
   - [Registration & Verification Flow](#registration--verification-flow)
   - [Wallet & Trading Flow](#wallet--trading-flow)
   - [Email Background Service Flow](#email-background-service-flow)
6. [API Endpoints](#api-endpoints)
7. [Testing with Swagger](#testing-with-swagger)
8. [Running Unit Tests](#running-unit-tests)
9. [Architecture Decisions](#architecture-decisions)
10. [Security](#security)
11. [Key Assumptions](#key-assumptions)
12. [Environment Variables](#environment-variables)

---

## Features

- **User Registration & Email Verification** — OTP-based verification via BullMQ background queue + Gmail SMTP. Only verified users can access trading.
- **Multi-Currency Wallets** — Each user holds independent balances in NGN, USD, EUR, GBP, and 160+ currencies. New currency wallets are auto-created on first use.
- **Real-Time FX Rates** — Fetched live from ExchangeRate API, cached in Redis (5 min TTL). Hardcoded fallback rates keep the app running if the external API is down.
- **Currency Conversion & Trading** — Atomic PostgreSQL transactions with row-level locking. Balance validation, insufficient-balance guards, and same-currency prevention built in.
- **Transaction History** — Paginated, filterable (by type), per-user isolated. Each user can only see their own transactions.
- **Role-Based Access** — `user` and `admin` roles with guard-level enforcement via `@Roles()` decorator.
- **JWT Authentication** — Access token (1h) + refresh token (7d) flow.
- **Idempotency** — Every wallet mutation gets a unique `idempotencyKey` stored on the transaction record — safe to retry without double-spending.
- **Background Email Service** — BullMQ queue backed by Redis. 3 retries with exponential backoff. Sends OTP, welcome, and transaction notification emails.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS |
| Language | TypeScript |
| ORM | TypeORM |
| Database | PostgreSQL 16 |
| Cache / Queue Broker | Redis 7 |
| Job Queue | BullMQ (`@nestjs/bull`) |
| Email | Nodemailer (Gmail SMTP) |
| Auth | Passport.js + JWT (`@nestjs/jwt`) |
| Containerization | Docker + Docker Compose |
| API Docs | Swagger / OpenAPI (`@nestjs/swagger`) |

---

## Project Structure

```
src/
├── main.ts                     # Bootstrap, Swagger setup, global pipes, CORS
├── app.module.ts               # Root module — wires everything together
├── config/
│   ├── configuration.ts        # Env-var → nested config object
│   └── database.config.ts      # TypeORM options (sync in dev, migrations in prod)
├── modules/
│   ├── auth/                   # Registration, OTP, login, JWT, refresh
│   │   ├── entities/           #   User, Otp
│   │   ├── repositories/       #   UserRepository, OtpRepository
│   │   ├── strategies/         #   JwtStrategy (Passport)
│   │   ├── dto/                #   RegisterDto, LoginDto, VerifyOtpDto, ResendOtpDto
│   │   ├── auth.service.ts     #   Core auth logic
│   │   ├── auth.controller.ts  #   HTTP routes
│   │   └── auth.service.spec.ts
│   ├── wallet/                 # Balances, funding, conversion, trading
│   │   ├── entities/           #   Wallet
│   │   ├── repositories/       #   WalletRepository (with FOR UPDATE locking)
│   │   ├── dto/                #   FundWalletDto, ConvertWalletDto, TradeWalletDto
│   │   ├── wallet.service.ts   #   Atomic fund / convert / trade logic
│   │   ├── wallet.controller.ts
│   │   ├── wallet.listener.ts  #   Listens for user.verified event → seeds wallet
│   │   └── wallet.service.spec.ts
│   ├── fx-rate/                # Live rate fetching + Redis cache
│   │   ├── fx-rate.service.ts  #   getRates, convertAmount, fallback logic
│   │   ├── fx-rate.controller.ts
│   │   └── fx-rate.service.spec.ts
│   ├── transaction/            # Transaction history & querying
│   │   ├── entities/           #   Transaction
│   │   ├── repositories/       #   TransactionRepository
│   │   ├── transaction.service.ts
│   │   ├── transaction.controller.ts
│   │   └── transaction.service.spec.ts
│   └── email/                  # BullMQ queue + Nodemailer processor
│       ├── email.service.ts    #   Enqueues OTP / welcome / transaction emails
│       ├── email.processor.ts  #   Bull @Process — renders HTML, calls sendMail
│       └── email.module.ts
└── common/
    ├── guards/                 # JwtAuthGuard, VerifiedGuard, RolesGuard
    ├── decorators/             # @CurrentUser, @Roles
    ├── filters/                # GlobalExceptionFilter
    ├── enums/                  # Currency, TransactionType, TransactionStatus, UserRole
    └── health/                 # GET /health
```

---

## Setup & Running

### Docker (Recommended)

```bash
# 1. Clone
git clone https://github.com/William9701/Fx_Trading_App.git
cd Fx_Trading_App

# 2. Environment — copy the example and fill in your secrets
cp .env.example .env
```

Open `.env` and set at minimum:

| Variable | What to put |
|---|---|
| `JWT_SECRET` | A long random string (e.g. run `openssl rand -hex 32`) |
| `JWT_REFRESH_SECRET` | Another long random string |
| `SMTP_USER` | Your Gmail address |
| `SMTP_PASSWORD` | A Gmail **App Password** (not your real password — see [Google App Passwords](https://myaccount.google.com/apppasswords)) |

```bash
# 3. Start everything (Postgres + Redis + App)
docker-compose up -d

# 4. Wait ~10 seconds for init, then confirm
curl http://localhost:3000/api/v1/health
# → { "status": "ok", "timestamp": "..." }
```

### Local Development

```bash
npm install
npm run start:dev
```

> Make sure `DB_HOST=localhost` and `REDIS_HOST=localhost` in your `.env` when running outside Docker. Postgres and Redis must already be running locally on their default ports.

---

## How It Works — End-to-End Flow

### Registration & Verification Flow

```
Client                          API Server                       Email (BullMQ)        Gmail
  │                                 │                                  │                  │
  │── POST /auth/register ─────────>│                                  │                  │
  │   { email, password }           │  hash password (bcrypt x10)      │                  │
  │                                 │  save User (isVerified=false)    │                  │
  │                                 │  generate 6-digit OTP            │                  │
  │                                 │  save OTP (expires in 10 min)    │                  │
  │                                 │── add job to Bull queue ────────>│                  │
  │<── 201 { message } ────────────│                                  │  pick up job     │
  │                                 │                                  │── sendMail ─────>│
  │                                 │                                  │                  │── deliver OTP
  │                                 │                                  │                  │
  │   (user checks inbox)           │                                  │                  │
  │                                 │                                  │                  │
  │── POST /auth/verify ───────────>│                                  │                  │
  │   { email, otp }                │  validate OTP + expiry           │                  │
  │                                 │  mark OTP as used                │                  │
  │                                 │  set isVerified = true           │                  │
  │                                 │  emit "user.verified" event      │                  │
  │                                 │    └─> WalletListener seeds      │                  │
  │                                 │         100 NGN wallet           │                  │
  │                                 │── add Welcome job to queue ─────>│                  │
  │<── 200 { accessToken,          │                                  │── sendMail ─────>│
  │         refreshToken } ────────│                                  │                  │
```

**Key points:**
- Unverified users **cannot** login — `auth.service` rejects with 401.
- Wallet, FX, and Transaction endpoints all require `JwtAuthGuard + VerifiedGuard`. An unverified token gets a 403 before reaching any controller logic.
- The initial 100 NGN wallet is seeded via an **event** (`user.verified`) — Auth and Wallet stay decoupled.

---

### Wallet & Trading Flow

```
Client                          API Server                       PostgreSQL
  │                                 │                                  │
  │── POST /wallet/convert ────────>│                                  │
  │   { amount: 1000,               │  BEGIN TRANSACTION               │
  │     fromCurrency: "NGN",        │── SELECT … FOR UPDATE ─────────>│  (lock NGN row)
  │     toCurrency: "USD" }         │<── NGN wallet (balance) ────────│
  │                                 │                                  │
  │                                 │  check balance >= amount         │
  │                                 │  call FxRateService.convertAmount│
  │                                 │    (Redis cache or live API)     │
  │                                 │                                  │
  │                                 │── UPDATE NGN balance ───────────>│  (debit)
  │                                 │── SELECT … FOR UPDATE ─────────>│  (lock USD row)
  │                                 │── UPDATE USD balance ───────────>│  (credit)
  │                                 │── INSERT transaction record ────>│
  │                                 │── COMMIT ───────────────────────>│
  │<── 200 { amountReceived,       │                                  │
  │         exchangeRate, … } ─────│                                  │
```

**Key points:**
- Both wallet rows are locked with `SELECT … FOR UPDATE` inside the same transaction — prevents race conditions and double-spend.
- If anything fails mid-way, the entire transaction rolls back — balances stay consistent.
- The trade endpoint has an extra constraint: **one side must be NGN** (direct USD→EUR is not supported; use convert for that).

---

### Email Background Service Flow

```
Any service                     Bull Queue (Redis)              EmailProcessor
  │                                      │                               │
  │── emailQueue.add("send-email", {    │                               │
  │     to, subject, template, context  │                               │
  │   }, { attempts: 3, backoff })─────>│                               │
  │                                      │── job available ─────────────>│
  │                                      │                               │  render HTML template
  │                                      │                               │  (otp | welcome | transaction)
  │                                      │                               │── nodemailer.sendMail()
  │                                      │                               │     (Gmail SMTP :587 STARTTLS)
  │                                      │<── mark completed ───────────│
```

- 3 automatic retries with exponential backoff (2s, 4s, 8s) if SMTP fails.
- Queue state persists in Redis — jobs survive app restarts.

---

## API Endpoints

### Authentication (public — no token needed)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Register with email + password. OTP is emailed. |
| POST | `/api/v1/auth/verify` | Submit OTP to verify email. Returns access + refresh tokens. |
| POST | `/api/v1/auth/login` | Login. Rejects unverified accounts with 401. |
| POST | `/api/v1/auth/resend-otp` | Re-send OTP if it expired or was lost. |
| POST | `/api/v1/auth/refresh` | Exchange a valid refresh token for a new token pair. |

### Authenticated (requires `Authorization: Bearer <accessToken>`)

| Method | Endpoint | Guard | Description |
|---|---|---|---|
| POST | `/api/v1/auth/me` | JWT | Current user profile. |
| GET | `/api/v1/wallet` | JWT + Verified | All wallet balances for the logged-in user. |
| POST | `/api/v1/wallet/fund` | JWT + Verified | Add funds to a currency wallet. Creates it if it does not exist. |
| POST | `/api/v1/wallet/convert` | JWT + Verified | Convert amount between any two supported currencies. |
| POST | `/api/v1/wallet/trade` | JWT + Verified | Trade NGN vs another currency (one side must be NGN). |
| GET | `/api/v1/fx/rates` | JWT + Verified | All current FX rates (base: NGN). |
| GET | `/api/v1/fx/rates/:currency` | JWT + Verified | Rate for a single currency vs NGN. |
| GET | `/api/v1/fx/supported` | JWT + Verified | List of all supported currency codes. |
| GET | `/api/v1/transactions` | JWT + Verified | Paginated history. Query params: `page`, `limit`, `type`. |
| GET | `/api/v1/transactions/:id` | JWT + Verified | Single transaction. Returns 404 if it belongs to another user. |

### Health

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/health` | Liveness probe — no auth required. Used by Docker healthcheck. |

---

## Testing with Swagger

Swagger UI is available at **`http://localhost:3000/docs`** (automatically disabled in production).

### Step-by-step walkthrough

1. **Open** `http://localhost:3000/docs` in your browser.

2. **Register a user** — find `POST /auth/register`, click *Try it out*, paste:
   ```json
   {
     "email": "you@example.com",
     "password": "YourPassword123!"
   }
   ```
   Click *Execute*. You will get `201 Registration successful`.

3. **Check your inbox** — the OTP email arrives within a few seconds (sent via BullMQ + Gmail SMTP).

4. **Verify your OTP** — find `POST /auth/verify`, paste:
   ```json
   {
     "email": "you@example.com",
     "otp": "123456"
   }
   ```
   You will get back `accessToken` and `refreshToken`. **Copy the `accessToken`.**

5. **Authorise Swagger** — click the green **Authorize** button at the top right of the page. Paste your `accessToken` into the `Bearer` field. Click *Authorize*, then *Close*.

6. **Fund your wallet** — `POST /wallet/fund`:
   ```json
   { "amount": 5000, "currency": "NGN" }
   ```

7. **Check rates** — `GET /fx/rates` returns all live rates. `GET /fx/rates/USD` returns just the USD rate.

8. **Convert** — `POST /wallet/convert`:
   ```json
   { "amount": 1000, "fromCurrency": "NGN", "toCurrency": "USD" }
   ```

9. **Trade** — `POST /wallet/trade` (one side must be NGN):
   ```json
   { "amount": 2000, "fromCurrency": "NGN", "toCurrency": "EUR" }
   ```

10. **View wallets** — `GET /wallet` — see your updated multi-currency balances.

11. **View transactions** — `GET /transactions` — see every action with amounts, rates, timestamps, and statuses.

> **Token expired?** Use `POST /auth/refresh` with your `refreshToken` to get a fresh pair, then re-authorise in Swagger.

---

## Running Unit Tests

```bash
npm test
```

### What is covered

| Suite | What it tests |
|---|---|
| `AuthService` | Registration duplicate check, OTP verification, expiry handling, login rejection for unverified users |
| `WalletService` | Fund (existing + new wallet creation), convert (success, same-currency error, insufficient balance), trade (success, non-NGN pair error, same currency error), wallet initialization on verify |
| `FxRateService` | Cache hit returns cached data, cache miss triggers API fetch + caches result, API failure falls back to hardcoded rates, single-rate lookup, unsupported currency throws, same-currency returns 1:1, NGN-to-USD and USD-to-NGN math |
| `TransactionService` | Paginated list with correct totals, type filtering passed to repo, single lookup by ID, null returned for missing ID |

---

## Architecture Decisions

### Event-driven wallet initialization

Auth and Wallet are separate bounded contexts. When a user verifies their email, Auth emits a `user.verified` event. `WalletListener` in the Wallet module subscribes and seeds the initial NGN balance. This avoids circular module imports and keeps each module independently testable and deployable.

### Atomic transactions with row-level locking

Currency conversion and trading debit one wallet and credit another. A failure midway would leave balances inconsistent. Every multi-wallet operation:
1. Opens a PostgreSQL transaction via TypeORM `QueryRunner`.
2. Locks both wallet rows with `SELECT … FOR UPDATE` (pessimistic write lock).
3. Commits or rolls back as a single unit.

This eliminates race conditions even under high concurrent load.

### Redis-backed FX rate cache

Rates are fetched from ExchangeRate API and stored in Redis with a configurable TTL (default 5 minutes). If Redis or the external API is unreachable, hardcoded fallback rates prevent the app from crashing and a warning is logged. All cache reads and writes are wrapped in try/catch so a Redis outage does not bring down rate lookups.

### BullMQ for email delivery

Emails are never sent inline — they are enqueued as jobs. This means:
- Registration responds immediately without waiting for SMTP round-trip.
- Failed sends are retried automatically (3 attempts, exponential backoff).
- The queue state persists in Redis, so jobs survive app restarts.

### Idempotency keys

Every fund, convert, and trade operation generates a UUID `idempotencyKey` stored on the transaction record. The unique constraint on this column makes it safe to retry failed requests without risk of double-spending.

### Guards layered on every trading endpoint

```
Request → JwtAuthGuard (valid token?) → VerifiedGuard (isVerified?) → Controller
```
- `JwtAuthGuard` — returns 401 if no valid JWT is provided.
- `VerifiedGuard` — returns 403 if the user has not verified their email.
- `login` itself also rejects unverified users, so there is no path to obtaining a valid token without completing verification.

---

## Security

| Concern | How it is handled |
|---|---|
| Password storage | bcrypt with 10 salt rounds |
| Token signing | HS256 with separate secrets for access and refresh tokens |
| Unverified access | `VerifiedGuard` blocks all trading / wallet / FX / transaction routes. `login` also rejects unverified users. |
| Race conditions | `SELECT … FOR UPDATE` row locks inside PostgreSQL transactions |
| Double-spend | Atomic transactions — either both wallets update or neither does |
| Duplicate transactions | `idempotencyKey` unique constraint on the transactions table |
| Input validation | Global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` |
| Transaction isolation | Each user can only read their own transactions — ownership check on `GET /transactions/:id` returns 404 for others |
| Container hardening | Production image runs as non-root user (`nestjs`, UID 1001) |
| API failure resilience | FX rate fallback rates + cache error swallowing prevent cascading failures |

---

## Key Assumptions

1. **Initial balance is 100 NGN** — credited automatically on email verification via the `user.verified` event.
2. **NGN is the base currency** — all FX rate calculations pivot through NGN (NGN rate = 1).
3. **Trading requires NGN on one side** — direct USD to EUR trades are blocked on the `/trade` endpoint. Use `/convert` for arbitrary pairs.
4. **Fallback rates are approximate** — they exist only to prevent crashes when the external API is down. Production deployments should alert on prolonged API unavailability.
5. **Email delivery is async** — OTP emails are queued via BullMQ. If Redis is down, the queue step will fail and registration will error. Redis health is a hard prerequisite for the app.
6. **Synchronize is on in development** — TypeORM auto-creates and updates tables. In production (`NODE_ENV=production`), `synchronize` is disabled and migrations should be used.
7. **Gmail App Password required** — Google blocks plain password SMTP access. Generate an App Password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
8. **Swagger is disabled in production** — the docs endpoint is only mounted when `NODE_ENV` is not `production`.

---

## Environment Variables

Full reference is in `.env.example`. Critical variables:

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Set to `production` to disable Swagger and enable migrations |
| `PORT` | `3000` | HTTP server port |
| `DB_HOST` | `postgres` | Postgres hostname (`localhost` outside Docker) |
| `DB_USERNAME` | `fx_user` | Postgres user |
| `DB_PASSWORD` | `fx_password` | Postgres password |
| `DB_NAME` | `fx_trading_db` | Postgres database name |
| `REDIS_HOST` | `redis` | Redis hostname (`localhost` outside Docker) |
| `REDIS_PORT` | `6379` | Redis port |
| `JWT_SECRET` | — | **Required.** Signs access tokens. |
| `JWT_EXPIRATION` | `1h` | Access token lifetime |
| `JWT_REFRESH_SECRET` | — | **Required.** Signs refresh tokens. |
| `JWT_REFRESH_EXPIRATION` | `7d` | Refresh token lifetime |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP port (STARTTLS) |
| `SMTP_USER` | — | **Required.** Gmail address |
| `SMTP_PASSWORD` | — | **Required.** Gmail App Password |
| `EMAIL_FROM` | `FX Trading <noreply@fxtrading.com>` | Sender name + address |
| `FX_RATE_API_URL` | `https://api.exchangerate-api.com/v4/latest` | Exchange rate API base URL |
| `FX_RATE_CACHE_TTL` | `300` | Seconds to cache FX rates in Redis |
| `OTP_EXPIRATION_MINUTES` | `10` | OTP validity window in minutes |
| `INITIAL_WALLET_BALANCE` | `100` | NGN amount credited on verification |
| `BASE_CURRENCY` | `NGN` | Base currency for all rate calculations |
