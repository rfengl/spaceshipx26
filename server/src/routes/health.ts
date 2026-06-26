import { Router } from 'express';

const router = Router();

const startedAt = Date.now();

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    startedAt: new Date(startedAt).toISOString(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
