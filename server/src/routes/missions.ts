import { Router } from 'express';

import asyncHandler from '../utils/asyncHandler.js';
import * as store from '../data/missionStore.js';
import type { HttpError } from '../types.js';

const router = Router();

const badRequest = (message: string): HttpError => {
  const err: HttpError = new Error(message);
  err.status = 400;
  return err;
};

const notFound = (): HttpError => {
  const err: HttpError = new Error('Mission not found');
  err.status = 404;
  return err;
};

// GET /api/missions
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ data: store.list() });
  }),
);

// GET /api/missions/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const mission = store.get(req.params.id);
    if (!mission) throw notFound();
    res.json({ data: mission });
  }),
);

// POST /api/missions
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name } = req.body ?? {};
    if (!name || typeof name !== 'string') {
      throw badRequest('`name` is required and must be a string');
    }
    const mission = store.create(req.body);
    res.status(201).json({ data: mission });
  }),
);

// PUT /api/missions/:id
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const mission = store.update(req.params.id, req.body ?? {});
    if (!mission) throw notFound();
    res.json({ data: mission });
  }),
);

// DELETE /api/missions/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const deleted = store.remove(req.params.id);
    if (!deleted) throw notFound();
    res.status(204).end();
  }),
);

export default router;
