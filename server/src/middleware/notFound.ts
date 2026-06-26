import type { RequestHandler } from 'express';

// Catches requests that didn't match any route.
const notFound: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      message: `Not found: ${req.method} ${req.originalUrl}`,
      status: 404,
    },
  });
};

export default notFound;
