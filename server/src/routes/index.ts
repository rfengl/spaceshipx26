import { Router } from 'express';

import healthRouter from './health.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    name: 'SpaceshipX26 PRMS API',
    version: '1.0.0',
    endpoints: ['/api/health'],
  });
});

router.use('/health', healthRouter);

export default router;
