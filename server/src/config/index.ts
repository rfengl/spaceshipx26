import 'dotenv/config';

const parseOrigins = (value: string | undefined): string | string[] => {
  if (!value || value === '*') return '*';
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

export interface Config {
  env: string;
  isProduction: boolean;
  port: number;
  host: string;
  cors: { origin: string | string[] };
  rateLimit: { windowMs: number; max: number };
}

const config: Config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || '0.0.0.0',
  cors: {
    origin: parseOrigins(process.env.CORS_ORIGIN),
  },
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
  },
};

export default config;
