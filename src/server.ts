import { createApp } from './app.js';
import { env } from './config/env.js';
import { startSseListener } from './events/sse.js';

async function main(): Promise<void> {
  const app = createApp();

  // Start the Postgres LISTEN relay that powers SSE live updates.
  await startSseListener();

  app.listen(env.port, () => {
    process.stdout.write(
      JSON.stringify({
        event: 'api.started',
        port: env.port,
        docs: `http://localhost:${env.port}/api/docs`,
      }) + '\n',
    );
  });
}

main().catch((err) => {
  process.stderr.write(`Failed to start API: ${err}\n`);
  process.exit(1);
});
