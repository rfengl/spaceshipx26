import 'dotenv/config';

const parseOrigins = (value: string | undefined): string | string[] => {
  if (!value || value === '*') return '*';
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const isProduction = (process.env.NODE_ENV || 'development') === 'production';

// The dev fallback is convenient locally but forgeable (it's public, in-repo),
// so refuse to boot in production without a real secret rather than signing
// tokens with a known key.
const resolveJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (isProduction) {
    throw new Error('JWT_SECRET must be set in production');
  }
  return 'dev-insecure-secret-change-me';
};

export interface Config {
  env: string;
  isProduction: boolean;
  port: number;
  host: string;
  cors: { origin: string | string[] };
  rateLimit: { windowMs: number; max: number };
  db: { path: string };
  jwt: { secret: string; expiresIn: string };
}

const config: Config = {
  env: process.env.NODE_ENV || 'development',
  isProduction,
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || '0.0.0.0',
  cors: {
    origin: parseOrigins(process.env.CORS_ORIGIN),
  },
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
  },
  db: {
    // SQLite file path; use ':memory:' for an ephemeral DB (e.g. tests).
    path: process.env.DB_PATH || 'data/prms.db',
  },
  jwt: {
    secret: resolveJwtSecret(),
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  },
};

export default config;
