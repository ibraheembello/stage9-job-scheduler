import { Request, Response } from 'express';
import pg from 'pg';
import { env } from '../config/env.js';
import { JOB_EVENTS_CHANNEL } from './notify.js';

const { Client } = pg;

const clients = new Set<Response>();

/** Register an SSE client (the GET /api/events endpoint). */
export function addSseClient(req: Request, res: Response): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write(`event: connected\ndata: {}\n\n`);
  clients.add(res);

  // Heartbeat keeps the connection (and any proxy) alive.
  const heartbeat = setInterval(() => res.write(`: ping\n\n`), 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
}

function broadcast(data: string): void {
  for (const res of clients) {
    res.write(`event: job_update\ndata: ${data}\n\n`);
  }
}

/**
 * Start the dedicated LISTEN connection. Called once at API startup.
 * Relays every Postgres notification on the job_events channel to all
 * connected SSE clients.
 */
export async function startSseListener(): Promise<void> {
  const listener = new Client({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
  });
  await listener.connect();
  await listener.query(`LISTEN ${JOB_EVENTS_CHANNEL}`);
  listener.on('notification', (msg) => {
    if (msg.payload) broadcast(msg.payload);
  });
}
