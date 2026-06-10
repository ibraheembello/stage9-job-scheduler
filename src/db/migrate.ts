import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { env } from '../config/env.js';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Idempotent migration:
 *  1. Connect to the default `postgres` database and CREATE the target DB
 *     if it does not exist.
 *  2. Connect to the target DB and apply schema.sql (all CREATE ... IF NOT EXISTS).
 */
async function migrate(): Promise<void> {
  const admin = new Client({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: 'postgres',
  });
  await admin.connect();

  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
    env.db.database,
  ]);
  if (exists.rowCount === 0) {
    await admin.query(`CREATE DATABASE ${env.db.database}`);
    console.log(`Created database "${env.db.database}"`);
  } else {
    console.log(`Database "${env.db.database}" already exists`);
  }
  await admin.end();

  const db = new Client({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
  });
  await db.connect();
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  await db.query(schema);
  await db.end();
  console.log('Schema applied successfully');
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
