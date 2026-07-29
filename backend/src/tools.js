import {
  overview, countRows, breakdown, timeseries, selectRows,
  aggregate, compareWindows, buildFilters, AGGREGATIONS,
} from './queries.js';
import { accessibleTables, loadSchema, resolveTable, measureColumns, defaultTemporalColumn } from './schema.js';
import { pulse } from './dashboard.js';
import { tablesFor } from './permissions.js';
import { datasource } from './datasource/index.js';
import { cached } from './cache.js';
import { config } from './config.js';

/**
 * The fixed set of functions the model may call.
 *
 * The model never writes SQL. It picks a tool and supplies arguments; the tool
 * checks the caller's role before touching the data source. A denied request
 * therefore never reaches the database, and a hallucinated table name fails
 * schema resolution rather than executing.
 *
 * Filters use the same grammar as the HTTP API (see src/filters.js), so an
 * answer the agent gives can be reproduced by a dashboard link.
 */

const FILTER_PARAM = {
  type: 'object',
  description:
    'Optional filters, column -> expression. Bare value means equals. Prefix for more: ' +
    "'gte:1000', 'lt:50', 'in:Open,Escalated', 'ne:Draft', 'between:2026-01-01,2026-04-01', " +
    "'contains:payment', 'isnull', 'notnull'.",
  additionalProperties: { type: 'string' },
};

const DATE_RANGE_PARAMS = {
  from: { type: 'string', description: 'ISO date; restricts to records on or after this, on the dataset time axis' },
  to: { type: 'string', description: 'ISO date; restricts to records on or before this' },
};

export const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'list_datasets',
      description:
        'List the datasets the current caller is allowed to read, with row counts, column names, which column is the time axis and which are numeric measures. Call this first when unsure what data exists.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'organisation_pulse',
      description:
        'Cross-dataset rollup: total records, how many are in a state needing attention, total financial exposure, and period-over-period movement. Use for broad questions like "how are we doing", "what needs attention", "give me a summary".',
      parameters: {
        type: 'object',
        properties: { days: { type: 'integer', description: 'Comparison window in days (default 30)' } },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'count_rows',
      description:
        'Number of records in one dataset, optionally filtered. Use for "how many X" including "how many X are pending" or "how many X over 50000".',
      parameters: {
        type: 'object',
        properties: {
          table: { type: 'string', description: 'Dataset name' },
          filters: FILTER_PARAM,
          ...DATE_RANGE_PARAMS,
        },
        required: ['table'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'aggregate_metric',
      description:
        'Compute sum, average, min, max or distinct count on a numeric column, optionally grouped by another column. Use for any question about value rather than volume: total spend, average resolution time, largest contract, cost by department.',
      parameters: {
        type: 'object',
        properties: {
          table: { type: 'string' },
          fn: { type: 'string', enum: AGGREGATIONS },
          column: { type: 'string', description: 'Column to aggregate (not needed for fn=count)' },
          groupBy: { type: 'string', description: 'Optional column to group the result by' },
          limit: { type: 'integer', description: 'Max groups when grouping (default 12)' },
          filters: FILTER_PARAM,
          ...DATE_RANGE_PARAMS,
        },
        required: ['table', 'fn'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compare_periods',
      description:
        'Compare a trailing window against the window immediately before it, returning both values, the change and the percentage change. Use for "is X up or down", "how does this month compare", "growth", "trend vs last period".',
      parameters: {
        type: 'object',
        properties: {
          table: { type: 'string' },
          days: { type: 'integer', description: 'Window length in days (default 30)' },
          fn: { type: 'string', enum: AGGREGATIONS, description: 'Defaults to count' },
          column: { type: 'string', description: 'Column to aggregate when fn is not count' },
          filters: FILTER_PARAM,
        },
        required: ['table'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'breakdown_by_column',
      description:
        'Count records grouped by one column, highest first, with each group\'s share of the total. Use for "how many by X", status splits, category splits.',
      parameters: {
        type: 'object',
        properties: {
          table: { type: 'string' },
          column: { type: 'string', description: 'Column to group by' },
          limit: { type: 'integer', description: 'Max groups to return (default 12)' },
          filters: FILTER_PARAM,
          ...DATE_RANGE_PARAMS,
        },
        required: ['table', 'column'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'trend_over_time',
      description:
        'Record counts bucketed by day, week, month, quarter or year over a trailing window. Use for questions about trends, volume over time or recent activity.',
      parameters: {
        type: 'object',
        properties: {
          table: { type: 'string' },
          column: { type: 'string', description: 'Date column; omit to use the dataset default' },
          bucket: { type: 'string', enum: ['day', 'week', 'month', 'quarter', 'year'] },
          days: { type: 'integer', description: 'Size of the trailing window in days (default 90)' },
          filters: FILTER_PARAM,
        },
        required: ['table'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sample_records',
      description:
        'Fetch a small page of individual records, filtered and sorted. Use when the question asks about specific items rather than aggregates - "which vendors", "show me the largest", "list the overdue ones".',
      parameters: {
        type: 'object',
        properties: {
          table: { type: 'string' },
          filters: FILTER_PARAM,
          sort: { type: 'string', description: 'Column to sort by' },
          order: { type: 'string', enum: ['asc', 'desc'] },
          pageSize: { type: 'integer', description: 'Records to return, max 25 for the agent' },
          ...DATE_RANGE_PARAMS,
        },
        required: ['table'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'present_findings',
      description:
        'End the turn with a structured, ranked executive summary instead of prose. Use this for broad requests - a briefing, "what needs attention", explaining a KPI, a board summary - where the answer is naturally more than one finding. Do not use it for a single direct factual question (a count, a specific value, a yes/no); answer those in plain text instead. Every number in every finding must come from a tool call earlier in this turn - never estimate or round from memory.',
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'One or two plain-language sentences a busy executive would read first.',
          },
          priorities: {
            type: 'array',
            description: 'Findings ranked most severe or urgent first.',
            items: {
              type: 'object',
              properties: {
                severity: { type: 'string', enum: ['critical', 'watch', 'good'] },
                title: { type: 'string', description: 'Short headline, e.g. "Finance memo backlog"' },
                detail: { type: 'string', description: 'The real numbers behind it: counts, values, comparisons, all traceable to a tool result from this turn' },
                recommendation: {
                  type: 'string',
                  description: 'Optional one-line suggested next step. Omit entirely if there is nothing actionable to suggest.',
                },
              },
              required: ['severity', 'title', 'detail'],
              additionalProperties: false,
            },
          },
        },
        required: ['summary', 'priorities'],
        additionalProperties: false,
      },
    },
  },
];

/** Executes a tool call for a given role. Every handler is role-gated downstream. */
export async function runTool(name, args, role) {
  const shared = { filters: args.filters ?? {}, from: args.from, to: args.to };

  switch (name) {
    case 'list_datasets': {
      const tables = await accessibleTables(role);
      const summary = await overview(role);
      return {
        datasets: tables.map((table) => ({
          table: table.name,
          columns: table.columns.map((c) => ({ name: c.name, kind: c.kind })),
          timeAxis: defaultTemporalColumn(table)?.name ?? null,
          measures: measureColumns(table).map((c) => c.name),
          rows: summary.tables.find((t) => t.table === table.name)?.rows ?? null,
        })),
      };
    }

    case 'organisation_pulse':
      return pulse(role, { days: args.days ?? 30 });

    case 'count_rows': {
      const table = await resolveTable(args.table);
      const filters = await buildFilters(table, { raw: shared.filters, from: shared.from, to: shared.to });
      return { table: args.table, filters: args.filters ?? {}, total: await countRows(role, args.table, filters) };
    }

    case 'aggregate_metric':
      return aggregate(role, args.table, {
        metrics: [{ fn: args.fn, column: args.column, alias: 'value' }],
        groupBy: args.groupBy,
        limit: args.limit,
        ...shared,
      });

    case 'compare_periods':
      return (await compareWindows(role, args.table, {
        days: args.days,
        fn: args.fn,
        column: args.column,
        filters: shared.filters,
      })) ?? { note: `'${args.table}' has no date column, so periods cannot be compared` };

    case 'breakdown_by_column':
      return breakdown(role, args.table, args.column, { limit: args.limit, ...shared });

    case 'trend_over_time':
      return timeseries(role, args.table, {
        column: args.column,
        bucket: args.bucket,
        days: args.days,
        filters: shared.filters,
      });

    case 'sample_records':
      return selectRows(role, args.table, {
        sort: args.sort,
        order: args.order,
        pageSize: Math.min(args.pageSize ?? 10, 25),
        page: 1,
        ...shared,
      });

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

const DIMENSION_PROBE_LIMIT = 25;

/**
 * Actual distinct values of a low-cardinality text column, e.g. status ->
 * ['Approved', 'Pending', 'Rejected']. Without this the model only knows a
 * column is text, not what's actually in it, and guesses a plausible-sounding
 * value ('Pending Approval') instead of the real one ('Pending') - a wrong
 * filter that silently returns zero rows rather than an error. Cached on the
 * schema TTL since dimension values change about as often as schema does.
 */
async function dimensionValues(table, column) {
  return cached(`dims:${table.schema}.${table.name}.${column.name}`, config.cache.schemaTtlMs, async () => {
    const provider = await datasource();
    const rows = await provider.groupBy(table, column, { limit: DIMENSION_PROBE_LIMIT });
    if (rows.length === 0 || rows.length >= DIMENSION_PROBE_LIMIT) return null; // too high-cardinality to enumerate
    return rows.map((r) => r.label).filter((v) => v !== null && v !== undefined);
  });
}

/** Role-scoped catalogue text for the system prompt, so the model isn't guessing names or values. */
export async function describeCatalogForRole(role) {
  const schema = await loadSchema();
  const allowed = tablesFor(role);

  const lines = [];
  for (const name of allowed) {
    const table = schema.get(name);
    if (!table) continue;

    const columnLines = [];
    for (const column of table.columns) {
      let line = `${column.name} (${column.kind})`;
      if (column.kind === 'text') {
        const values = await dimensionValues(table, column);
        if (values) line += ` - actual values: ${values.map((v) => `'${v}'`).join(', ')}`;
      }
      columnLines.push(line);
    }

    const axis = defaultTemporalColumn(table);
    lines.push(`- ${table.name}: ${columnLines.join(', ')}${axis ? `\n    time axis: ${axis.name}` : ''}`);
  }

  if (lines.length === 0) return 'You currently have access to no datasets.';
  return `Datasets available to this caller. Filter values must match "actual values" exactly (case-sensitive) - ` +
    `never guess or paraphrase a value:\n${lines.join('\n')}`;
}
