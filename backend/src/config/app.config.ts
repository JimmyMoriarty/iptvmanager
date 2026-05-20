// =====================================================
// Application Configuration
// =====================================================

import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  appUrl: process.env.APP_URL || 'https://iptv.kukey.com',
  publicUrl: process.env.PUBLIC_URL || 'https://kukey.com',

  // Database
  databaseUrl: process.env.DATABASE_URL,

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },

  // JWT
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    playlistSecret: process.env.JWT_PLAYLIST_SECRET,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  // TOTP
  totp: {
    issuer: process.env.TOTP_ISSUER || 'IPTVManager',
    encryptionKey: process.env.TOTP_ENCRYPTION_KEY,
  },

  // Session / Cookies
  session: {
    secret: process.env.SESSION_SECRET,
    cookieDomain: process.env.COOKIE_DOMAIN || 'iptv.kukey.com',
    cookieSecure: process.env.COOKIE_SECURE !== 'false',
  },

  // Security
  security: {
    rateLimitTtl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    loginMaxAttempts: parseInt(process.env.LOGIN_MAX_ATTEMPTS || '5', 10),
    loginLockDuration: parseInt(process.env.LOGIN_LOCK_DURATION || '900', 10),
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    corsOrigin: process.env.CORS_ORIGIN || 'https://iptv.kukey.com',
  },

  // SSRF Protection / Fetch
  fetch: {
    timeoutMs: parseInt(process.env.FETCH_TIMEOUT_MS || '15000', 10),
    maxSizeMb: parseInt(process.env.FETCH_MAX_SIZE_MB || '50', 10),
    maxRedirects: parseInt(process.env.FETCH_MAX_REDIRECTS || '3', 10),
  },

  // Health Check
  healthCheck: {
    concurrency: parseInt(process.env.HEALTH_CHECK_CONCURRENCY || '10', 10),
    timeoutMs: parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS || '10000', 10),
    intervalMinutes: parseInt(process.env.HEALTH_CHECK_INTERVAL_MINUTES || '60', 10),
    retryCount: parseInt(process.env.HEALTH_CHECK_RETRY_COUNT || '3', 10),
    autoDisableAfter: parseInt(process.env.HEALTH_CHECK_AUTO_DISABLE_AFTER || '5', 10),
  },

  // Workers
  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  },
}));

export type AppConfig = ReturnType<typeof appConfig>;
