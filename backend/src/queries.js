/**
 * The read layer every endpoint and every agent tool goes through.
 *
 * Order of operations is always the same and matters:
 *   1. role check   - a denied request never reaches the data source
 *   2. resolve      - table/column names validated against the live schema
 *   3. parse        - filter values coerced to the column's type
 *   4. cache        - keyed on everything that changes the result
 *   5. provider     - Fabric or the in-memory mock, same interface
 */
import { datasource } from './datasource/index.js';
import { cached } from './cache.js';
import { config } from './config.js';
import { assertCanRead } from './permissions.js';
import {
  resolveTable,
  resolveColumn,
  defaultTemporalColumn,
  accessibleTables,
  measureColumns,
} from './schema.js';
import { parseFilter, dateRangeFilter, describeFilters, BadRequestError } from './filters.js';

const MAX_PAGE_SIZE = 500;
const DEFAULT_WINDOW_DAYS = 90;
const DAY_MS = 86_400_000;

export const BUCKETS = ['day', 'week', 'month', 'quarter', 'year'];
export const AGGREGATIONS = ['count', 'count_distinct', 'sum', 'avg', 'min', 'max'];

function clamp(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

/** Stable cache key fragment for a filter set. */
const filterKey = (filters) =>
  filters
    .map(({ column, op, value }) => `${column.name}${op}${value instanceof Date ? value.getTime() : JSON.stringify(value)}`)
    .join('|');

/**
 * Turn raw request input into resolved, coerced filters.
 * `raw` is column -> expression; `from`/`to` apply to the dataset's time axis.
 */
export async function buildFilters(table, { raw = {}, from, to, dateColumn } = {}) {
  const filters = [];

  for (const [name, expression] of Object.entries(raw)) {
    if (expression === undefined || expression === '') continue;
    const { column } = await resolveColumn(table, name);
    filters.push(parseFilter(column, expression));
  }

  if (from || to) {
    const column = dateColumn
      ? (await resolveColumn(table, dateColumn)).column
      : defaultTemporalColumn(table);
    if (!column) {
      throw new BadRequestError(`'${table.name}' has no date column, so from/to cannot be applied`);
    }
    if (column.kind !== 'temporal') {
      throw new BadRequestError(`'${column.name}' is not a date column`);
    }
    filters.push(dateRangeFilter(column, from, to));
  }

  return filters;
}

/** Row count for one dataset, with optional filters. */
export async function countRows(role, tableName, filters = []) {
  assertCanRead(role, tableName);
  const table = await resolveTable(tableName);

  return cached(`count:${table.name}:${filterKey(filters)}`, config.cache.metricsTtlMs, async () => {
    const provider = await datasource();
    return provider.count(table, filters);
  });
}

/**
 * Row counts across every dataset the role can see, each with a
 * period-over-period delta where the dataset has a time axis.
 *
 * This is what the top strip of KPI tiles renders from, so it has to answer
 * "how much, and is that up or down" in one request.
 */
export async function overview(role, { days } = {}) {
  const tables = await accessibleTables(role);
  const windowDays = clamp(days, 1, 3650, 30);

  const tiles = await Promise.all(
    tables.map(async (table) => {
      const temporal = defaultTemporalColumn(table);
      const [rows, delta] = await Promise.all([
        countRows(role, table.name),
        temporal ? compareWindows(role, table.name, { days: windowDays, temporal }) : null,
      ]);

      return {
        table: table.name,
        rows,
        columns: table.columns.length,
        temporalColumn: temporal?.name ?? null,
        measures: measureColumns(table).map((column) => column.name),
        trend: delta,
      };
    })
  );

  return { role, windowDays, tables: tiles, generatedAt: new Date().toISOString() };
}

/**
 * Current trailing window vs the window immediately before it.
 *
 * `metric` defaults to a row count; pass {fn, column} to compare a value
 * instead (total travel spend this month vs last, say).
 */
export async function compareWindows(role, tableName, opts = {}) {
  assertCanRead(role, tableName);
  const table = await resolveTable(tableName);

  const temporal = opts.temporal
    ?? (opts.dateColumn ? (await resolveColumn(table, opts.dateColumn)).column : defaultTemporalColumn(table));
  if (!temporal) return null;

  const days = clamp(opts.days, 1, 3650, 30);
  const fn = opts.fn ?? 'count';
  if (!AGGREGATIONS.includes(fn)) throw new BadRequestError(`Unknown aggregation '${fn}'`);

  const measure = opts.column ? (await resolveColumn(table, opts.column)).column : null;
  if (fn !== 'count' && !measure) throw new BadRequestError(`Aggregation '${fn}' needs a column`);

  const now = Date.now();
  const currentStart = new Date(now - days * DAY_MS);
  const previousStart = new Date(now - 2 * days * DAY_MS);

  const baseFilters = await buildFilters(table, { raw: opts.filters ?? {} });

  const windowFilters = (start, end) => [
    ...baseFilters,
    { column: temporal, op: 'between', value: [start, end] },
  ];

  const cacheKey = `compare:${table.name}:${temporal.name}:${fn}:${measure?.name ?? '-'}:${days}:${filterKey(baseFilters)}`;

  return cached(cacheKey, config.cache.metricsTtlMs, async () => {
    const provider = await datasource();

    const measureWindow = async (start, end) => {
      const filters = windowFilters(start, end);
      if (fn === 'count') return provider.count(table, filters);
      const [row] = await provider.aggregate(table, {
        metrics: [{ fn, column: measure, alias: 'value' }],
        filters,
      });
      return row?.value === null || row?.value === undefined ? null : Number(row.value);
    };

    const [current, previous] = await Promise.all([
      measureWindow(currentStart, new Date(now)),
      measureWindow(previousStart, currentStart),
    ]);

    // A change from zero has no meaningful percentage - the UI should render an
    // arrow with no figure rather than "+Infinity%".
    const change = current === null || previous === null ? null : current - previous;
    const percentChange = previous ? Math.round((change / previous) * 1000) / 10 : null;

    return {
      metric: fn === 'count' ? 'count' : `${fn}(${measure.name})`,
      dateColumn: temporal.name,
      windowDays: days,
      current,
      previous,
      change,
      percentChange,
      direction: change === null || change === 0 ? 'flat' : change > 0 ? 'up' : 'down',
      currentWindow: { from: currentStart.toISOString(), to: new Date(now).toISOString() },
      previousWindow: { from: previousStart.toISOString(), to: currentStart.toISOString() },
    };
  });
}

/** Paginated read with filters, for drill-down tables. */
export async function selectRows(role, tableName, opts = {}) {
  assertCanRead(role, tableName);
  const table = await resolveTable(tableName);

  const pageSize = clamp(opts.pageSize, 1, MAX_PAGE_SIZE, 50);
  const page = clamp(opts.page, 1, 100_000, 1);

  const sort = opts.sort
    ? (await resolveColumn(table, opts.sort)).column
    : (defaultTemporalColumn(table) ?? table.columns[0]);
  const order = String(opts.order ?? '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const filters = await buildFilters(table, {
    raw: opts.filters ?? {},
    from: opts.from,
    to: opts.to,
    dateColumn: opts.dateColumn,
  });

  const provider = await datasource();
  const { rows, total } = await provider.select(table, {
    filters,
    sort,
    order,
    offset: (page - 1) * pageSize,
    limit: pageSize,
  });

  return {
    table: table.name,
    rows,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    sort: sort.name,
    order,
    filters: describeFilters(filters),
  };
}

/** GROUP BY count on one column - the dashboard's donut/bar breakdowns. */
export async function breakdown(role, tableName, columnName, opts = {}) {
  assertCanRead(role, tableName);
  const { table, column } = await resolveColumn(tableName, columnName);
  const limit = clamp(opts.limit, 1, 100, 12);

  const filters = await buildFilters(table, {
    raw: opts.filters ?? {},
    from: opts.from,
    to: opts.to,
    dateColumn: opts.dateColumn,
  });

  const cacheKey = `breakdown:${table.name}:${column.name}:${limit}:${filterKey(filters)}`;
  return cached(cacheKey, config.cache.metricsTtlMs, async () => {
    const provider = await datasource();
    const series = await provider.groupBy(table, column, { filters, limit });
    const total = series.reduce((sum, point) => sum + point.value, 0);

    return {
      table: table.name,
      column: column.name,
      total,
      series: series.map((point) => ({
        // Null groups are real data, but an unlabelled chart slice is not - give
        // the frontend something printable while keeping the raw value.
        label: point.label ?? '(not set)',
        rawLabel: point.label ?? null,
        value: point.value,
        share: total ? Math.round((point.value / total) * 1000) / 10 : 0,
      })),
      filters: describeFilters(filters),
    };
  });
}

/**
 * SUM / AVG / MIN / MAX over a dataset, optionally grouped by a dimension.
 *
 * `metrics` is a list of `{fn, column}`. This is what turns the API from a row
 * counter into something that can show spend, exposure and averages.
 */
export async function aggregate(role, tableName, opts = {}) {
  assertCanRead(role, tableName);
  const table = await resolveTable(tableName);

  const requested = opts.metrics?.length ? opts.metrics : [{ fn: 'count' }];
  const metrics = [];

  for (const [index, entry] of requested.entries()) {
    const fn = String(entry.fn ?? 'count').toLowerCase();
    if (!AGGREGATIONS.includes(fn)) {
      throw new BadRequestError(`Unknown aggregation '${fn}'. Use one of: ${AGGREGATIONS.join(', ')}`);
    }

    let column = null;
    if (fn !== 'count') {
      if (!entry.column) throw new BadRequestError(`Aggregation '${fn}' needs a column`);
      column = (await resolveColumn(table, entry.column)).column;
      if (['sum', 'avg'].includes(fn) && column.kind !== 'numeric') {
        throw new BadRequestError(`'${fn}' needs a numeric column, and '${column.name}' is ${column.kind}`);
      }
    }

    // Predictable aliases so the frontend can address a metric by name; the
    // index only appears if the same fn/column pair is requested twice.
    const base = entry.alias ?? `${fn}_${column?.name ?? 'rows'}`;
    const alias = metrics.some((existing) => existing.alias === base) ? `${base}_${index}` : base;
    metrics.push({ fn, column, alias });
  }

  const groupBy = opts.groupBy ? (await resolveColumn(table, opts.groupBy)).column : null;
  const limit = clamp(opts.limit, 1, 100, 12);

  const filters = await buildFilters(table, {
    raw: opts.filters ?? {},
    from: opts.from,
    to: opts.to,
    dateColumn: opts.dateColumn,
  });

  // The alias is part of the key: it names the field in the response, so two
  // callers asking for the same sum under different aliases are not
  // interchangeable, and sharing a cache entry hands one of them the other's
  // field name.
  const metricKey = metrics.map((m) => `${m.fn}.${m.column?.name ?? '*'}.${m.alias}`).join(',');
  const cacheKey = `aggregate:${table.name}:${metricKey}:${groupBy?.name ?? '-'}:${limit}:${filterKey(filters)}`;

  return cached(cacheKey, config.cache.metricsTtlMs, async () => {
    const provider = await datasource();
    const rows = await provider.aggregate(table, { metrics, groupBy, filters, limit });

    const shape = (row) => {
      const values = {};
      for (const metric of metrics) {
        const raw = row[metric.alias];
        values[metric.alias] = raw === null || raw === undefined
          ? null
          : (metric.fn === 'min' || metric.fn === 'max') ? raw : Number(raw);
      }
      return values;
    };

    return {
      table: table.name,
      metrics: metrics.map((m) => ({ fn: m.fn, column: m.column?.name ?? null, alias: m.alias })),
      groupBy: groupBy?.name ?? null,
      results: groupBy
        ? rows.map((row) => ({ group: row.group ?? '(not set)', ...shape(row) }))
        : shape(rows[0] ?? {}),
      filters: describeFilters(filters),
    };
  });
}

/** Time series count, bucketed over a trailing window or an explicit range. */
export async function timeseries(role, tableName, opts = {}) {
  assertCanRead(role, tableName);
  const table = await resolveTable(tableName);

  const column = opts.column
    ? (await resolveColumn(table, opts.column)).column
    : defaultTemporalColumn(table);

  if (!column) {
    return { table: table.name, column: null, bucket: null, series: [], note: 'No temporal column on this table' };
  }
  if (column.kind !== 'temporal') {
    return { table: table.name, column: column.name, bucket: null, series: [], note: 'Column is not a date/datetime' };
  }

  const bucket = BUCKETS.includes(opts.bucket) ? opts.bucket : 'day';
  const explicitRange = Boolean(opts.from || opts.to);
  const days = explicitRange ? null : clamp(opts.days, 1, 3650, DEFAULT_WINDOW_DAYS);

  const filters = await buildFilters(table, {
    raw: opts.filters ?? {},
    from: opts.from ?? (days ? new Date(Date.now() - days * DAY_MS).toISOString() : undefined),
    to: opts.to,
    dateColumn: column.name,
  });

  const cacheKey = `timeseries:${table.name}:${column.name}:${bucket}:${days ?? 'range'}:${filterKey(filters)}`;
  return cached(cacheKey, config.cache.metricsTtlMs, async () => {
    const provider = await datasource();
    const series = await provider.timeseries(table, column, bucket, { filters });

    return {
      table: table.name,
      column: column.name,
      bucket,
      days,
      // Providers already emit YYYY-MM-DD, each in the timezone its driver uses.
      series,
      filters: describeFilters(filters),
    };
  });
}

/** Distinct values in a column - powers filter dropdowns in the UI. */
export async function distinctValues(role, tableName, columnName, opts = {}) {
  assertCanRead(role, tableName);
  const { table, column } = await resolveColumn(tableName, columnName);
  const limit = clamp(opts.limit, 1, 200, 50);

  const cacheKey = `distinct:${table.name}:${column.name}:${limit}`;
  return cached(cacheKey, config.cache.schemaTtlMs, async () => {
    const provider = await datasource();
    const groups = await provider.groupBy(table, column, { limit });
    return {
      table: table.name,
      column: column.name,
      values: groups.map((group) => ({ value: group.label, count: group.value })),
    };
  });
}
