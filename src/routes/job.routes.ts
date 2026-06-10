import { Router } from 'express';
import * as controller from '../controllers/job.controller.js';
import { addSseClient } from '../events/sse.js';

export const router = Router();

// Live updates (SSE)
router.get('/events', addSseClient);

// Dashboard stats
router.get('/stats', controller.getStats);

// Dead-letter queue
router.get('/dlq', controller.listDlq);
router.post('/dlq/:id/retry', controller.retryDlq);

// Jobs
router.post('/jobs', controller.createJob);
router.get('/jobs', controller.listJobs);
router.get('/jobs/:id', controller.getJob);
router.get('/jobs/:id/logs', controller.getJobLogs);
router.post('/jobs/:id/cancel', controller.cancelJob);
