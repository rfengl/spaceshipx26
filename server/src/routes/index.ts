import { Router } from 'express';

import healthRouter from './health.js';
import missionsRouter from './missions.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    name: 'SpaceshipX26 API',
    version: '1.0.0',
    endpoints: ['/api/health', '/api/missions'],
  });
});

router.use('/health', healthRouter);
router.use('/missions', missionsRouter);

export default router;
