import { Request, Response } from 'express';
import * as jobService from '../services/job.service.js';
import * as dlqService from '../services/dlq.service.js';
import { ValidationError } from '../services/job.service.js';
import { query } from '../config/db.js';

function handleError(res: Response, err: unknown): void {
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message });
    return;
  }
  const message = err instanceof Error ? err.message : 'Internal Server Error';
  res.status(500).json({ error: message });
}

export async function createJob(req: Request, res: Response): Promise<void> {
  try {
    const job = await jobService.createJob(req.body);
    res.status(201).json(job);
  } catch (err) {
    handleError(res, err);
  }
}

export async function listJobs(_req: Request, res: Response): Promise<void> {
  try {
    res.json(await jobService.listJobs());
  } catch (err) {
    handleError(res, err);
  }
}

export async function getJob(req: Request, res: Response): Promise<void> {
  try {
    const job = await jobService.getJob(req.params.id);
    if (!job) {
      res.status(404).json({ error: `job ${req.params.id} not found` });
      return;
    }
    res.json(job);
  } catch (err) {
    handleError(res, err);
  }
}

export async function getJobLogs(req: Request, res: Response): Promise<void> {
  try {
    const { rows } = await query(
      `SELECT id, event, level, details, created_at
         FROM job_logs WHERE job_id = $1 ORDER BY created_at ASC`,
      [req.params.id],
    );
    res.json(rows);
  } catch (err) {
    handleError(res, err);
  }
}

export async function cancelJob(req: Request, res: Response): Promise<void> {
  try {
    const result = await jobService.cancelJob(req.params.id);
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
}

export async function getStats(_req: Request, res: Response): Promise<void> {
  try {
    res.json(await jobService.getCounts());
  } catch (err) {
    handleError(res, err);
  }
}

export async function listDlq(_req: Request, res: Response): Promise<void> {
  try {
    res.json(await dlqService.listDlq());
  } catch (err) {
    handleError(res, err);
  }
}

export async function retryDlq(req: Request, res: Response): Promise<void> {
  try {
    const job = await dlqService.retryFromDlq(req.params.id);
    if (!job) {
      res.status(404).json({ error: `DLQ entry ${req.params.id} not found or already resolved` });
      return;
    }
    res.json(job);
  } catch (err) {
    handleError(res, err);
  }
}
