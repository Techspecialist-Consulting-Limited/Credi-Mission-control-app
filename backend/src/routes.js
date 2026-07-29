import { Router } from 'express';
import { config } from './config.js';
import { stats as cacheStats, invalidate } from './cache.js';
import { describe as describeDatasource, reprobe, datasource } from './datasource/index.js';
import { normalizeRole, ROLES, canRead, AccessDeniedError } from './permissions.js';
import { accessibleTables, resolveTable, measureColumns, defaultTemporalColumn } from './schema.js';
import {
  overview, selectRows, breakdown, timeseries, countRows,
  aggregate, compareWindows, distinctValues, buildFilters, AGGREGATIONS, BUCKETS,
} from './queries.js';
import { dashboardSpec, pulse, activity } from './dashboard.js';
import { OPERATORS, BadRequestError } from './filters.js';
import { ask } from './agent.js';

export const router = Router();

/**
 * PROTOTYPE ONLY: the role is read from a header with no verification, so any
 * caller can claim any role. Replace with a validated token claim before this
 * is exposed beyond the demo.
 */
router.use((req, _res, next) => {
  req.role = normalizeRole(req.get('x-role') ?? req.query.role) ?? config.defaultRole;
  next();
});

const wrap = (handler) => (req, res, next) => handler(req, res, next).catch(next);

// Query keys the endpoints interpret themselves; everything else on a read
// endpoint is treated as a column filter.
const RESERVED = new Set([
  'page', 'pageSize', 'sort', 'order', 'role', 'column', 'limit', 'bucket',
  'days', 'from', 'to', 'dateColumn', 'fn', 'groupBy', 'metrics',
]);

const filtersFrom = (query) =>
  Object.fromEntries(Object.entries(query).filter(([key]) => !RESERVED.has(key)));

const readOptions = (req) => ({
  filters: filtersFrom(req.query),
  from: req.query.from,
  to: req.query.to,
  dateColumn: req.query.dateColumn,
});

/**
 * Permission first, existence second.
 *
 * Resolving the table before checking the role leaks which tables exist: a
 * caller who cannot read a dataset should not be able to tell a 404 from a 403.
 */
async function assertVisible(role, tableName) {
  if (!canRead(role, tableName)) throw new AccessDeniedError(role, tableName);
  return resolveTable(tableName);
}

/** Marks a payload as synthetic when the mock data source is live. */
async function tag(payload) {
  const { synthetic, provider } = await describeDatasource();
  return synthetic ? { ...payload, synthetic: true, source: provider } : payload;
}

// --- service ---------------------------------------------------------------

router.get('/health', wrap(async (_req, res) => {
  const source = await describeDatasource();
  const live = await datasource()
    .then((provider) => provider.healthCheck())
    .then(() => true)
    .catch((error) => error.message);

  res.json({
    ok: live === true,
    dataSource: source,
    connection: live === true ? 'connected' : live,
    database: config.fabric.database,
    cache: cacheStats(),
    aiConfigured: Boolean(config.openai.endpoint && config.openai.apiKey && config.openai.deployment),
  });
}));

/** Re-run data source selection, so a Fabric grant can be picked up live. */
router.post('/health/reprobe', wrap(async (_req, res) => {
  invalidate();
  res.json(await reprobe());
}));

router.get('/roles', (req, res) => {
  res.json({ roles: ROLES, activeRole: req.role, note: 'Prototype: role is unverified.' });
});

/** Self-describing contract, so the frontend can discover the query grammar. */
router.get('/capabilities', wrap(async (req, res) => {
  res.json({
    role: req.role,
    aggregations: AGGREGATIONS,
    buckets: BUCKETS,
    filterOperators: Object.keys(OPERATORS),
    filterSyntax: 'column=value | column=op:value | column=in:a,b | column=between:x,y | column=isnull',
    dataSource: await describeDatasource(),
  });
}));

// --- schema ---------------------------------------------------------------

router.get('/schema', wrap(async (req, res) => {
  const tables = await accessibleTables(req.role);
  res.json(await tag({
    role: req.role,
    tables: tables.map((table) => ({
      table: table.name,
      schema: table.schema,
      columns: table.columns,
      timeAxis: defaultTemporalColumn(table)?.name ?? null,
      measures: measureColumns(table).map((column) => column.name),
    })),
  }));
}));

router.get('/schema/:table', wrap(async (req, res) => {
  const table = await assertVisible(req.role, req.params.table);
  res.json(await tag({
    table: table.name,
    schema: table.schema,
    columns: table.columns,
    timeAxis: defaultTemporalColumn(table)?.name ?? null,
    measures: measureColumns(table).map((column) => column.name),
  }));
}));

/** Distinct values for a column - populates filter dropdowns. */
router.get('/schema/:table/values', wrap(async (req, res) => {
  if (!req.query.column) throw new BadRequestError("Query param 'column' is required");
  res.json(await tag(await distinctValues(req.role, req.params.table, req.query.column, {
    limit: req.query.limit,
  })));
}));

// --- dashboard composition -------------------------------------------------

/** The renderable layout: which tiles exist and which endpoint each one calls. */
router.get('/dashboard', wrap(async (req, res) => {
  res.json(await tag(await dashboardSpec(req.role)));
}));

/** Cross-platform rollup: totals, pressure and exposure across every dataset. */
router.get('/dashboard/pulse', wrap(async (req, res) => {
  res.json(await tag(await pulse(req.role, { days: Number(req.query.days) || 30 })));
}));

/** Daily record count across every dataset - powers the activity heatmap. */
router.get('/dashboard/activity', wrap(async (req, res) => {
  res.json(await tag(await activity(req.role, { days: Number(req.query.days) || 371 })));
}));

// --- dashboard metrics ----------------------------------------------------

router.get('/metrics/overview', wrap(async (req, res) => {
  res.json(await tag(await overview(req.role, { days: req.query.days })));
}));

router.get('/metrics/:table/count', wrap(async (req, res) => {
  const table = await assertVisible(req.role, req.params.table);
  const options = readOptions(req);
  const filters = await buildFilters(table, {
    raw: options.filters, from: options.from, to: options.to, dateColumn: options.dateColumn,
  });
  res.json(await tag({ table: table.name, total: await countRows(req.role, table.name, filters) }));
}));

/** SUM / AVG / MIN / MAX, optionally grouped - the value tiles. */
router.get('/metrics/:table/aggregate', wrap(async (req, res) => {
  // Either ?fn=sum&column=x for one metric, or ?metrics=sum:x,avg:y for several.
  const metrics = req.query.metrics
    ? String(req.query.metrics).split(',').map((entry) => {
        const [fn, column] = entry.split(':').map((part) => part.trim());
        return { fn, column };
      })
    : [{ fn: req.query.fn ?? 'count', column: req.query.column }];

  res.json(await tag(await aggregate(req.role, req.params.table, {
    metrics,
    groupBy: req.query.groupBy,
    limit: req.query.limit,
    ...readOptions(req),
  })));
}));

/** Trailing window vs the one before it - the trend arrow on a KPI tile. */
router.get('/metrics/:table/compare', wrap(async (req, res) => {
  const result = await compareWindows(req.role, req.params.table, {
    days: req.query.days,
    fn: req.query.fn,
    column: req.query.column,
    dateColumn: req.query.dateColumn,
    filters: filtersFrom(req.query),
  });
  if (!result) {
    return res.status(422).json({ error: `'${req.params.table}' has no date column to compare over` });
  }
  res.json(await tag({ table: req.params.table, ...result }));
}));

router.get('/metrics/:table/breakdown', wrap(async (req, res) => {
  if (!req.query.column) throw new BadRequestError("Query param 'column' is required");
  res.json(await tag(await breakdown(req.role, req.params.table, req.query.column, {
    limit: req.query.limit,
    ...readOptions(req),
  })));
}));

router.get('/metrics/:table/timeseries', wrap(async (req, res) => {
  res.json(await tag(await timeseries(req.role, req.params.table, {
    column: req.query.column,
    bucket: req.query.bucket,
    days: req.query.days,
    ...readOptions(req),
  })));
}));

// --- raw / drill-down data ------------------------------------------------

router.get('/data/:table', wrap(async (req, res) => {
  res.json(await tag(await selectRows(req.role, req.params.table, {
    page: req.query.page,
    pageSize: req.query.pageSize,
    sort: req.query.sort,
    order: req.query.order,
    ...readOptions(req),
  })));
}));

// --- natural language -----------------------------------------------------

router.post('/ai/ask', wrap(async (req, res) => {
  const question = req.body?.question;
  if (!question || typeof question !== 'string') {
    throw new BadRequestError("Body must include a 'question' string");
  }
  const role = normalizeRole(req.body.role) ?? req.role;
  // ask() re-sanitizes this itself (role/shape/length caps); the array check
  // here is just so a malformed body fails fast with a clear error.
  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  res.json(await tag(await ask(question, role, history)));
}));

// --- cache ----------------------------------------------------------------

router.post('/cache/invalidate', (req, res) => {
  invalidate(req.body?.prefix);
  res.json({ ok: true, cache: cacheStats() });
});
