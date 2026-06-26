import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import config from './config/index.js';
import apiRouter from './routes/index.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// The built frontend lives in <repo-root>/public. This file sits in
// server/src (dev) or server/dist (prod), so the repo root is two levels up.
const publicDir = path.join(__dirname, '..', '..', 'public');

const app = express();

// Trust the first proxy hop (needed for correct client IPs / rate limiting behind a proxy).
app.set('trust proxy', 1);

// Security headers.
app.use(helmet());

// CORS.
app.use(cors({ origin: config.cors.origin }));

// Gzip responses.
app.use(compression());

// Request logging.
app.use(morgan(config.isProduction ? 'combined' : 'dev'));

// Body parsing.
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

// API routes.
app.use('/api', apiRouter);

// Serve the static website (built React app) from <repo-root>/public.
app.use(express.static(publicDir));

// 404 and error handling (must be last).
app.use(notFound);
app.use(errorHandler);

export default app;
