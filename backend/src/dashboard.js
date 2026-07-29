/**
 * Dashboard composition.
 *
 * Two things live here, and both exist so the frontend does not have to hold
 * opinions about the lakehouse:
 *
 *   dashboardSpec(role) - a renderable layout. For every dataset the role can
 *     read, it works out which columns are measures, which are dimensions worth
 *     charting, and which is the time axis, then emits tiles with the exact
 *     endpoint each one should call. The frontend loops over tiles; it never
 *     hardcodes a table or column name.
 *
 *   pulse(role) - the cross-platform rollup. Row counts per table are an admin
 *     panel; "what needs attention across every system, and what is it worth"
 *     is a command center. This is that second thing.
 *
 * Both are derived from the live schema, so a new table appearing in Fabric
 * shows up on the dashboard without a code change.
 */
import { cached } from './cache.js';
import { config } from './config.js';
import { datasource } from './datasource/index.js';
import { accessibleTables, defaultTemporalColumn, measureColumns } from './schema.js';
import { countRows, aggregate, compareWindows, breakdown, timeseries } from './queries.js';

// A text column is chartable if it has few enough distinct values to read as a
// donut or bar. Above this it is a free-text field, not a dimension.
const MAX_DIMENSION_CARDINALITY = 25;
const DONUT_THRESHOLD = 6;

// Columns whose values are unique per row - never a dimension.
const NOT_A_DIMENSION = /(^|_)(id|name|title|subject|description|comment|note|email|url|ip_address|address)$/i;

// Measures whose sum is a currency figure, so the UI can format accordingly.
const MONEY_LIKE = /(cost|amount|value|spend|price|total|revenue|budget|fee|salary)/i;

// Status values that mean "someone still has to do something about this".
// 'Rejected' and 'Terminated' are deliberately absent: they are closed states,
// and counting them as outstanding work inflates the headline figure.
const NEEDS_ATTENTION = /(pending|open|escalat|under review|in progress|awaiting|overdue|suspend|fail|denied|error|critical|high|flagged)/i;

const STATUS_LIKE = /(^|_)(status|state|stage|outcome|severity|priority|risk_rating)$/i;

/** "amount_requested" -> "Amount Requested" */
const humanize = (name) =>
  String(name)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());

/**
 * Which text columns are worth charting, measured once and cached with the
 * schema. On Fabric this is one COUNT(DISTINCT) per text column per dataset -
 * expensive enough to be worth the long TTL, cheap enough to do at startup.
 */
async function profileDimensions(table) {
  return cached(`profile:${table.name}`, config.cache.schemaTtlMs, async () => {
    const provider = await datasource();
    const candidates = table.columns.filter(
      (column) => column.kind === 'text' && !NOT_A_DIMENSION.test(column.name)
    );

    const profiled = await Promise.all(
      candidates.map(async (column) => ({
        column,
        distinct: await provider.distinctCount(table, column).catch(() => Infinity),
      }))
    );

    return profiled
      .filter(({ distinct }) => distinct >= 2 && distinct <= MAX_DIMENSION_CARDINALITY)
      .sort((a, b) => a.distinct - b.distinct);
  });
}

/** Boolean columns are dimensions too, and always exactly two slices. */
const booleanDimensions = (table) => table.columns.filter((column) => column.kind === 'boolean');

function measureTiles(table, temporal) {
  return measureColumns(table)
    .slice(0, 3)
    .map((column) => {
      const isMoney = MONEY_LIKE.test(column.name);
      const fn = isMoney ? 'sum' : 'avg';
      return {
        id: `${table.name}.${column.name}.${fn}`,
        type: 'kpi',
        title: `${isMoney ? 'Total' : 'Average'} ${humanize(column.name)}`,
        dataset: table.name,
        format: isMoney ? 'currency' : 'decimal',
        endpoint: `/api/v1/metrics/${table.name}/aggregate?fn=${fn}&column=${column.name}`,
        trendEndpoint: temporal
          ? `/api/v1/metrics/${table.name}/compare?fn=${fn}&column=${column.name}&days=30`
          : null,
      };
    });
}

/** The renderable layout for one role. */
export async function dashboardSpec(role) {
  const tables = await accessibleTables(role);

  const sections = await Promise.all(
    tables.map(async (table) => {
      const temporal = defaultTemporalColumn(table);
      const dimensions = await profileDimensions(table);
      const booleans = booleanDimensions(table);

      const tiles = [
        {
          id: `${table.name}.count`,
          type: 'kpi',
          title: `Total ${humanize(table.name.replace(/^credo_|^barrister_craig_/, ''))}`,
          dataset: table.name,
          format: 'integer',
          endpoint: `/api/v1/metrics/${table.name}/count`,
          trendEndpoint: temporal ? `/api/v1/metrics/${table.name}/compare?days=30` : null,
        },
        ...measureTiles(table, temporal),
      ];

      const charts = [
        ...(temporal
          ? [{
              id: `${table.name}.trend`,
              type: 'line',
              title: `${humanize(table.name)} over time`,
              dataset: table.name,
              endpoint: `/api/v1/metrics/${table.name}/timeseries?bucket=week&days=180`,
              xAxis: temporal.name,
            }]
          : []),
        ...dimensions.slice(0, 4).map(({ column, distinct }) => ({
          id: `${table.name}.${column.name}.breakdown`,
          type: distinct <= DONUT_THRESHOLD ? 'donut' : 'bar',
          title: `By ${humanize(column.name)}`,
          dataset: table.name,
          column: column.name,
          distinctValues: distinct,
          endpoint: `/api/v1/metrics/${table.name}/breakdown?column=${column.name}&limit=${MAX_DIMENSION_CARDINALITY}`,
        })),
        ...booleans.slice(0, 1).map((column) => ({
          id: `${table.name}.${column.name}.breakdown`,
          type: 'donut',
          title: `By ${humanize(column.name)}`,
          dataset: table.name,
          column: column.name,
          distinctValues: 2,
          endpoint: `/api/v1/metrics/${table.name}/breakdown?column=${column.name}`,
        })),
      ];

      return {
        id: table.name,
        title: humanize(table.name.replace(/^credo_|^barrister_craig_/, '')),
        dataset: table.name,
        timeAxis: temporal?.name ?? null,
        filterable: [...dimensions.map(({ column }) => column.name), ...booleans.map((c) => c.name)],
        tiles,
        charts,
        table: {
          id: `${table.name}.rows`,
          type: 'table',
          title: `${humanize(table.name)} records`,
          endpoint: `/api/v1/data/${table.name}?page=1&pageSize=25`,
          columns: table.columns.map((column) => ({
            name: column.name,
            label: humanize(column.name),
            kind: column.kind,
          })),
        },
      };
    })
  );

  return {
    role,
    generatedAt: new Date().toISOString(),
    summaryEndpoint: '/api/v1/dashboard/pulse',
    sections,
  };
}

/** Sum of the most money-like measure on a dataset, or null if it has none. */
async function exposureFor(role, table) {
  const measure = measureColumns(table).find((column) => MONEY_LIKE.test(column.name));
  if (!measure) return null;

  const result = await aggregate(role, table.name, { metrics: [{ fn: 'sum', column: measure.name, alias: 'total' }] });
  return { column: measure.name, measureLabel: humanize(measure.name), total: result.results.total ?? 0 };
}

/** Records sitting in a state that means someone still has to act. */
async function attentionFor(role, table) {
  const dimensions = await profileDimensions(table);
  // A dataset can have several status-like columns (status, priority, severity).
  // Prefer the lifecycle one - "302 pending approvals" is a truer read of
  // pressure than "1,260 high-priority tickets", most of which are closed.
  const candidates = dimensions.filter(({ column }) => STATUS_LIKE.test(column.name));
  const statusColumn = (
    candidates.find(({ column }) => /(^|_)(status|state|stage)$/i.test(column.name))
    ?? candidates[0]
  )?.column;
  if (!statusColumn) return null;

  const result = await breakdown(role, table.name, statusColumn.name, { limit: MAX_DIMENSION_CARDINALITY });
  const flagged = result.series.filter((point) => NEEDS_ATTENTION.test(String(point.rawLabel ?? '')));
  if (flagged.length === 0) return null;

  return {
    column: statusColumn.name,
    count: flagged.reduce((sum, point) => sum + point.value, 0),
    share: Math.round((flagged.reduce((sum, point) => sum + point.value, 0) / (result.total || 1)) * 1000) / 10,
    states: flagged.map((point) => ({ label: point.label, value: point.value })),
  };
}

/**
 * Cross-platform rollup: one number per question an executive actually asks.
 * Everything here spans datasets rather than describing one.
 */
export async function pulse(role, { days = 30 } = {}) {
  const tables = await accessibleTables(role);

  const perDataset = await Promise.all(
    tables.map(async (table) => {
      const temporal = defaultTemporalColumn(table);
      const [rows, trend, exposure, attention] = await Promise.all([
        countRows(role, table.name),
        temporal ? compareWindows(role, table.name, { days, temporal }) : null,
        exposureFor(role, table).catch(() => null),
        attentionFor(role, table).catch(() => null),
      ]);
      return { dataset: table.name, label: humanize(table.name), rows, trend, exposure, attention };
    })
  );

  const totalRecords = perDataset.reduce((sum, entry) => sum + entry.rows, 0);
  const newThisPeriod = perDataset.reduce((sum, entry) => sum + (entry.trend?.current ?? 0), 0);
  const previousPeriod = perDataset.reduce((sum, entry) => sum + (entry.trend?.previous ?? 0), 0);
  const needsAttention = perDataset.reduce((sum, entry) => sum + (entry.attention?.count ?? 0), 0);
  const financialExposure = perDataset.reduce((sum, entry) => sum + (entry.exposure?.total ?? 0), 0);

  return {
    role,
    windowDays: days,
    generatedAt: new Date().toISOString(),
    headline: {
      datasets: perDataset.length,
      totalRecords,
      newThisPeriod,
      previousPeriod,
      percentChange: previousPeriod
        ? Math.round(((newThisPeriod - previousPeriod) / previousPeriod) * 1000) / 10
        : null,
      needsAttention,
      financialExposure: Math.round(financialExposure * 100) / 100,
    },
    // Ranked so the UI can render "where the pressure is" without sorting.
    attention: perDataset
      .filter((entry) => entry.attention)
      .map((entry) => ({ dataset: entry.dataset, label: entry.label, ...entry.attention }))
      .sort((a, b) => b.count - a.count),
    exposure: perDataset
      .filter((entry) => entry.exposure)
      .map((entry) => ({ dataset: entry.dataset, label: entry.label, ...entry.exposure }))
      .sort((a, b) => b.total - a.total),
    datasets: perDataset,
  };
}

/**
 * Daily record count, summed across every dataset the role can read.
 *
 * Powers the activity heatmap: one real number per day, not a per-dataset
 * breakdown, so a table with no temporal column simply contributes nothing
 * rather than needing a special case.
 */
export async function activity(role, { days = 371 } = {}) {
  const tables = await accessibleTables(role);
  const temporalTables = tables.filter((table) => defaultTemporalColumn(table));

  const perTable = await Promise.all(
    temporalTables.map((table) => timeseries(role, table.name, { bucket: 'day', days }))
  );

  const byDate = new Map();
  for (const result of perTable) {
    for (const point of result.series) {
      byDate.set(point.bucket, (byDate.get(point.bucket) ?? 0) + point.value);
    }
  }

  return {
    windowDays: days,
    datasets: temporalTables.length,
    series: [...byDate.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, count]) => ({ date, count })),
  };
}
