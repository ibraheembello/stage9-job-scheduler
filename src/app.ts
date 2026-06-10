import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { router } from './routes/job.routes.js';

export function createApp() {
  const app = express();

  // CORS: allow any origin (Access-Control-Allow-Origin: *)
  app.use(cors({ origin: '*' }));
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // Swagger UI from the OpenAPI spec, if present.
  const specPath = join(process.cwd(), 'docs', 'openapi.yaml');
  if (existsSync(specPath)) {
    const spec = YAML.load(specPath);
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec));
  }

  app.use('/api', router);

  return app;
}
