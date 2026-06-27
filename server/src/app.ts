import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import config from './config/index.js';
import type { Container } from './container.js';
import { createApiRouter } from './routes/index.js';
import { createAuthenticate } from './middleware/auth.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// The built frontend lives in <repo-root>/public. This file sits in
// server/src (dev) or server/dist (prod), so the repo root is two levels up.
const publicDir = path.join(__dirname, '..', '..', 'public');

export function createApp(container: Container): Express {
  const app = express();

  // Trust the first proxy hop (correct client IPs / rate limiting behind a proxy).
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: config.cors.origin }));
  app.use(compression());
  app.use(morgan(config.isProduction ? 'combined' : 'dev'));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Rate limit the API surface.
  app.use(
    '/api',
    rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  const authenticate = createAuthenticate(
    container.tokenService,
    container.userRepository,
  );
  app.use('/api', createApiRouter(container, authenticate));

  // Serve the static website (built React app) from <repo-root>/public.
  app.use(express.static(publicDir));

  // SPA fallback: serve index.html for non-API GET routes so client-side
  // routing (e.g. /resources) works on direct load / refresh.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  // 404 and error handling (must be last).
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
