/**
 * Fabric-backed data source.
 *
 * Every SQL string in the project is built here. The rule that makes that safe
 * is unchanged: values are always bound as parameters, and identifiers are only
 * ever interpolated after they came back from INFORMATION_SCHEMA verbatim (see
 * src/schema.js). Callers pass resolved column objects, never raw strings, so
 * this module never has to re-validate anything.
 */
import { query, healthCheck, closePool } from '../fabricClient.js';
import { quoteIdent } from '../identifiers.js';

const qualify = (table) => `${quoteIdent(table.schema)}.${quoteIdent(table.name)}`;

const COMPARISON_SQL = { eq: '=', ne: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' };

/** LIKE metacharacters, escaped against a declared ESCAPE character. */
const escapeLike = (value) => String(value).replace(/([%_[\]\\])/g, '\\$1');

/**
 * Compile normalized filters into a WHERE clause plus its bound parameters.
 * `counter` is a mutable box so several clauses in one statement (rows + total)
 * can share a parameter namespace without colliding.
 */
function buildWhere(filters = [], counter = { next: 0 }) {
  const conditions = [];
  const params = {};

  const bind = (value) => {
    const name = `p${counter.next++}`;
    params[name] = value;
    return `@${name}`;
  };

  for (const { column, op, value } of filters) {
    const identifier = quoteIdent(column.name);

    if (op === 'isnull') { conditions.push(`${identifier} IS NULL`); continue; }
    if (op === 'notnull') { conditions.push(`${identifier} IS NOT NULL`); continue; }

    if (op === 'in' || op === 'nin') {
      const placeholders = value.map(bind).join(', ');
      conditions.push(`${identifier} ${op === 'nin' ? 'NOT IN' : 'IN'} (${placeholders})`);
      continue;
    }

    if (op === 'between') {
      conditions.push(`${identifier} BETWEEN ${bind(value[0])} AND ${bind(value[1])}`);
      continue;
    }

    if (op === 'contains' || op === 'startswith') {
      const pattern = op === 'contains' ? `%${escapeLike(value)}%` : `${escapeLike(value)}%`;
      conditions.push(`${identifier} LIKE ${bind(pattern)} ESCAPE '\\'`);
      continue;
    }

    conditions.push(`${identifier} ${COMPARISON_SQL[op]} ${bind(value)}`);
  }

  return {
    clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

/** Collapse a timestamp to the start of its bucket. */
const BUCKETS = {
  day: (col) => `CAST(${col} AS date)`,
  week: (col) => `DATEADD(day, 1 - DATEPART(weekday, ${col}), CAST(${col} AS date))`,
  month: (col) => `DATEFROMPARTS(YEAR(${col}), MONTH(${col}), 1)`,
  quarter: (col) => `DATEFROMPARTS(YEAR(${col}), ((DATEPART(quarter, ${col}) - 1) * 3) + 1, 1)`,
  year: (col) => `DATEFROMPARTS(YEAR(${col}), 1, 1)`,
};

const AGGREGATE_SQL = {
  count: () => 'COUNT_BIG(*)',
  count_distinct: (col) => `COUNT(DISTINCT ${col})`,
  sum: (col) => `SUM(CAST(${col} AS decimal(38, 4)))`,
  avg: (col) => `AVG(CAST(${col} AS decimal(38, 4)))`,
  min: (col) => `MIN(${col})`,
  max: (col) => `MAX(${col})`,
};

export const fabricProvider = {
  name: 'fabric',

  async healthCheck() {
    return healthCheck();
  },

  /** Live schema from INFORMATION_SCHEMA. */
  async introspect() {
    const rows = await query(`
      SELECT
        c.TABLE_SCHEMA AS tableSchema,
        c.TABLE_NAME   AS tableName,
        c.COLUMN_NAME  AS columnName,
        c.DATA_TYPE    AS dataType,
        c.IS_NULLABLE  AS isNullable,
        c.ORDINAL_POSITION AS ordinal
      FROM INFORMATION_SCHEMA.COLUMNS c
      JOIN INFORMATION_SCHEMA.TABLES t
        ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
      WHERE t.TABLE_TYPE IN ('BASE TABLE', 'VIEW')
      ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION
    `);

    const tables = new Map();
    for (const row of rows) {
      const key = row.tableName.toLowerCase();
      if (!tables.has(key)) {
        tables.set(key, { schema: row.tableSchema, name: row.tableName, columns: [] });
      }
      tables.get(key).columns.push({
        name: row.columnName,
        dataType: row.dataType,
        nullable: row.isNullable === 'YES',
      });
    }
    return tables;
  },

  async count(table, filters = []) {
    const { clause, params } = buildWhere(filters);
    const rows = await query(`SELECT COUNT_BIG(*) AS total FROM ${qualify(table)} ${clause}`, params);
    return Number(rows[0]?.total ?? 0);
  },

  async groupBy(table, column, { filters = [], limit = 12 } = {}) {
    const { clause, params } = buildWhere(filters);
    const identifier = quoteIdent(column.name);
    const rows = await query(
      `SELECT TOP (@limit) ${identifier} AS label, COUNT_BIG(*) AS value
       FROM ${qualify(table)} ${clause}
       GROUP BY ${identifier}
       ORDER BY COUNT_BIG(*) DESC`,
      { ...params, limit }
    );
    return rows.map((row) => ({ label: row.label, value: Number(row.value) }));
  },

  async distinctCount(table, column, { filters = [] } = {}) {
    const { clause, params } = buildWhere(filters);
    const rows = await query(
      `SELECT COUNT(DISTINCT ${quoteIdent(column.name)}) AS total FROM ${qualify(table)} ${clause}`,
      params
    );
    return Number(rows[0]?.total ?? 0);
  },

  async timeseries(table, column, bucket, { filters = [] } = {}) {
    const { clause, params } = buildWhere(filters);
    const expression = BUCKETS[bucket](quoteIdent(column.name));
    const rows = await query(
      `SELECT ${expression} AS bucket, COUNT_BIG(*) AS value
       FROM ${qualify(table)} ${clause}
       GROUP BY ${expression}
       ORDER BY bucket ASC`,
      params
    );
    // The driver hands back a SQL `date` as a Date at UTC midnight, so read the
    // UTC parts - local formatting would shift the bucket in western offsets.
    return rows.map((row) => ({
      bucket: row.bucket instanceof Date ? row.bucket.toISOString().slice(0, 10) : String(row.bucket),
      value: Number(row.value),
    }));
  },

  async select(table, { filters = [], sort, order = 'DESC', offset = 0, limit = 50 } = {}) {
    // OFFSET/FETCH requires a deterministic ORDER BY.
    const counter = { next: 0 };
    const { clause, params } = buildWhere(filters, counter);

    const [rows, totals] = await Promise.all([
      query(
        `SELECT * FROM ${qualify(table)}
         ${clause}
         ORDER BY ${quoteIdent(sort.name)} ${order === 'ASC' ? 'ASC' : 'DESC'}
         OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
        { ...params, offset, limit }
      ),
      query(`SELECT COUNT_BIG(*) AS total FROM ${qualify(table)} ${clause}`, params),
    ]);

    return { rows, total: Number(totals[0]?.total ?? 0) };
  },

  /**
   * SUM/AVG/MIN/MAX (and counts) over one dataset, optionally grouped.
   * `metrics` is [{fn, column, alias}]; column is null for plain counts.
   */
  async aggregate(table, { metrics, groupBy = null, filters = [], limit = 12 } = {}) {
    const { clause, params } = buildWhere(filters);

    const projections = metrics.map(({ fn, column, alias }) => {
      const expression = AGGREGATE_SQL[fn](column ? quoteIdent(column.name) : null);
      return `${expression} AS ${quoteIdent(alias)}`;
    });

    if (!groupBy) {
      const rows = await query(`SELECT ${projections.join(', ')} FROM ${qualify(table)} ${clause}`, params);
      return rows;
    }

    const identifier = quoteIdent(groupBy.name);
    const rows = await query(
      `SELECT TOP (@limit) ${identifier} AS [group], ${projections.join(', ')}
       FROM ${qualify(table)} ${clause}
       GROUP BY ${identifier}
       ORDER BY ${quoteIdent(metrics[0].alias)} DESC`,
      { ...params, limit }
    );
    return rows;
  },

  async close() {
    await closePool();
  },
};
