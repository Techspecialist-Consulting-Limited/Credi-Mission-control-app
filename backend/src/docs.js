/**
 * Serves the OpenAPI contract.
 *
 *   GET /docs              Swagger UI, bundled locally - works with no internet
 *   GET /docs/openapi.json the spec as JSON, for codegen
 *   GET /docs/openapi.yaml the spec as written, the source of truth
 *
 * docs/openapi.yaml is hand-maintained rather than generated from the routes.
 * A generated spec documents what the code does; this one documents what the
 * frontend is promised, including the parts a decorator cannot express - why
 * `results` changes shape when you group, what a null `percentChange` means,
 * which query keys are reserved.
 *
 * Read once at startup: it is a static file, and a bad edit should break the
 * server loudly at boot rather than 500 on whoever opens the docs.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { parse } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = join(here, '..', 'docs', 'openapi.yaml');

const source = readFileSync(SPEC_PATH, 'utf8');

export const spec = parse(source);

export const docsRouter = Router();

docsRouter.get('/openapi.yaml', (_req, res) => {
  res.type('text/yaml').send(source);
});

docsRouter.get('/openapi.json', (_req, res) => {
  res.json(spec);
});

docsRouter.use(
  '/',
  swaggerUi.serve,
  swaggerUi.setup(spec, {
    customSiteTitle: 'credo-fabric-ai API',
    swaggerOptions: {
      // Endpoints are grouped by tag; leave the groups collapsed so the shape of
      // the API is visible before any one endpoint is.
      docExpansion: 'none',
      defaultModelsExpandDepth: 2,
      displayRequestDuration: true,
      tryItOutEnabled: true,
      persistAuthorization: true,
      filter: true,
    },
  })
);
