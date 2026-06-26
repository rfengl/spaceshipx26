import type { ErrorRequestHandler } from 'express';

import config from '../config/index.js';
import type { HttpError } from '../types.js';

// Centralized error handler. Express recognizes it by its four arguments.
const errorHandler: ErrorRequestHandler = (
  err: HttpError,
  _req,
  res,
  _next,
) => {
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({
    error: {
      message:
        status >= 500 && config.isProduction ? 'Internal server error' : err.message,
      status,
      ...(config.isProduction ? {} : { stack: err.stack }),
    },
  });
};

export default errorHandler;
