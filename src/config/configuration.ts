// Parse a redis:// or rediss:// URL into host/port/password/tls fields.
// Render and Upstash both expose Redis as a single URL env var.
function parseRedisUrl(url: string) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port, 10) : 6379,
      password: parsed.password || undefined,
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
    };
  } catch {
    return null;
  }
}

export default () => {
  // Render / managed Redis exposes a single connection URL.
  // Fall back to individual host/port/password for local Docker setup.
  const redisUrl = process.env.REDIS_URL;
  const redisParsed = redisUrl ? parseRedisUrl(redisUrl) : null;

  return {
    node_env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3000,
    api_prefix: process.env.API_PREFIX || 'api/v1',

    // DATABASE_URL is the standard connection string from Render / Neon / Supabase.
    // When present it takes priority; the individual fields are ignored.
    database: {
      url: process.env.DATABASE_URL || undefined,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      username: process.env.DB_USERNAME || 'fx_user',
      password: process.env.DB_PASSWORD || 'fx_password',
      database: process.env.DB_NAME || 'fx_trading_db',
    },

    redis: redisParsed || {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      tls: undefined,
    },

    jwt: {
      secret: process.env.JWT_SECRET || 'default-jwt-secret',
      expiresIn: process.env.JWT_EXPIRATION || '1h',
      refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d',
    },

    email: {
      smtp: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT, 10) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM || 'FX Trading <noreply@fxtrading.com>',
    },

    otp: {
      expirationMinutes: parseInt(process.env.OTP_EXPIRATION_MINUTES, 10) || 10,
    },

    fxRate: {
      apiUrl: process.env.FX_RATE_API_URL || 'https://api.exchangerate-api.com/v4/latest',
      cacheTtl: parseInt(process.env.FX_RATE_CACHE_TTL, 10) || 300,
    },

    wallet: {
      initialBalance: parseFloat(process.env.INITIAL_WALLET_BALANCE) || 100,
      baseCurrency: process.env.BASE_CURRENCY || 'NGN',
    },

    throttle: {
      ttl: parseInt(process.env.THROTTLE_TTL, 10) || 60,
      limit: parseInt(process.env.THROTTLE_LIMIT, 10) || 10,
    },
  };
};
