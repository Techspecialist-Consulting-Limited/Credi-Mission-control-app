import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { router } from './routes.js';
import { describe as describeDatasource, close as closeDatasource } from './datasource/index.js';
import { docsRouter } from './docs.js';

const app = express();

// Prototype: CORS is open by default so the dashboard frontend can call this
// from anywhere. Set CORS_ORIGIN to a comma-separated list to lock it down.
app.use(cors({
  origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((origin) => origin.trim()),
}));
app.use(express.json());

// Request id, echoed back so a frontend bug report can be traced to a log line.
let sequence = 0;
app.use((req, res, next) => {
  req.id = `r${(sequence += 1).toString(36)}`;
  res.set('x-request-id', req.id);
  const started = Date.now();
  res.on('finish', () => {
    console.log(`${req.id} ${res.statusCode} ${req.method} ${req.originalUrl} ${Date.now() - started}ms`);
  });
  next();
});

app.use('/api/v1', router);
app.use('/docs', docsRouter);

app.get('/', (_req, res) => {
  res.json({
    service: 'credo-fabric-ai',
    description: 'Analytics API over Microsoft Fabric for the CREDICORP executive dashboard',
    docs: '/docs',
    spec: '/docs/openapi.json',
    endpoints: [
      'GET  /api/v1/health',
      'POST /api/v1/health/reprobe',
      'GET  /api/v1/capabilities',
      'GET  /api/v1/roles',
      'GET  /api/v1/schema',
      'GET  /api/v1/schema/:table',
      'GET  /api/v1/schema/:table/values?column=&limit=',
      'GET  /api/v1/dashboard',
      'GET  /api/v1/dashboard/pulse?days=',
      'GET  /api/v1/metrics/overview?days=',
      'GET  /api/v1/metrics/:table/count',
      'GET  /api/v1/metrics/:table/aggregate?fn=&column=&groupBy=&limit=',
      'GET  /api/v1/metrics/:table/compare?fn=&column=&days=',
      'GET  /api/v1/metrics/:table/breakdown?column=&limit=',
      'GET  /api/v1/metrics/:table/timeseries?column=&bucket=&days=',
      'GET  /api/v1/data/:table?page=&pageSize=&sort=&order=&<column>=<filter>',
      'POST /api/v1/ai/ask  { question, role }',
      'POST /api/v1/cache/invalidate  { prefix }',
    ],
  });
});

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((error, req, res, _next) => {
  const status = error.status ?? 500;
  if (status >= 500) console.error(`${req.id} ${error.stack ?? error.message}`);
  res.status(status).json({ error: error.message, name: error.name, requestId: req.id });
});

const server = app.listen(config.port, async () => {
  console.log(`credo-fabric-ai listening on http://localhost:${config.port}`);
  console.log(`API docs:     http://localhost:${config.port}/docs`);

  // Resolve the data source at startup rather than on the dashboard's first
  // request, so the mode is visible in the logs before anyone loads the page.
  const source = await describeDatasource();
  if (source.synthetic) {
    console.warn(`Data source: SYNTHETIC (${source.reason}) - responses carry synthetic:true`);
  } else {
    console.log(`Data source: Fabric / ${config.fabric.database}`);
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(async () => {
      await closeDatasource().catch(() => {});
      process.exit(0);
    });
  });
}
