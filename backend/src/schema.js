import { datasource } from './datasource/index.js';
import { cached } from './cache.js';
import { config } from './config.js';
import { tablesFor } from './permissions.js';
import { classify, quoteIdent } from './identifiers.js';

export { classify, quoteIdent };

const SCHEMA_CACHE_KEY = 'schema:all';

/**
 * Live schema, read from the active data source and cached.
 *
 * Everything downstream is driven off this rather than hardcoded column names,
 * which is what lets the dashboard endpoints work against the lakehouse without
 * anyone having documented its columns first.
 *
 * Returns: Map<lowercaseTableName, { schema, name, columns: [{name, dataType, kind, nullable}] }>
 */
export async function loadSchema() {
  return cached(SCHEMA_CACHE_KEY, config.cache.schemaTtlMs, async () => {
    const provider = await datasource();
    const tables = await provider.introspect();

    for (const table of tables.values()) {
      table.columns = table.columns.map((column) => ({
        ...column,
        kind: classify(column.dataType),
      }));
    }
    return tables;
  });
}

export class UnknownObjectError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnknownObjectError';
    this.status = 404;
  }
}

/**
 * Resolve a caller-supplied table name to a real object.
 *
 * This is the injection boundary. Identifiers cannot be bound as parameters, so
 * the only safe interpolation is a name that came back from the source schema
 * verbatim - never the raw request string.
 */
export async function resolveTable(table) {
  const schema = await loadSchema();
  const found = schema.get(String(table ?? '').toLowerCase());
  if (!found) throw new UnknownObjectError(`Unknown table: ${table}`);
  return found;
}

export async function resolveColumn(table, column) {
  const resolved = typeof table === 'string' ? await resolveTable(table) : table;
  const found = resolved.columns.find(
    (c) => c.name.toLowerCase() === String(column ?? '').toLowerCase()
  );
  if (!found) throw new UnknownObjectError(`Unknown column '${column}' on '${resolved.name}'`);
  return { table: resolved, column: found };
}

export function qualify(table) {
  return `${quoteIdent(table.schema)}.${quoteIdent(table.name)}`;
}

/** Tables the role may read that actually exist in the source right now. */
export async function accessibleTables(role) {
  const schema = await loadSchema();
  return tablesFor(role)
    .map((name) => schema.get(name))
    .filter(Boolean);
}

/** Best guess at the column a time series should bucket on. */
export function defaultTemporalColumn(table) {
  const temporal = table.columns.filter((c) => c.kind === 'temporal');
  if (temporal.length === 0) return null;
  const preferred = temporal.find((c) => /created|submitted|opened|occurred|onboarded|logged/i.test(c.name));
  return preferred ?? temporal[0];
}

/**
 * Numeric columns worth aggregating on a tile.
 *
 * Ids and reference numbers are numeric but meaningless in aggregate, so they
 * are excluded by name - the dashboard spec is generated from this, and a tile
 * reading "Total ticket_id: 482,000,000" would discredit the whole page.
 */
const ID_LIKE = /(^|_)(id|no|num|number|code|zip|postcode|year|month|day)$/i;

export function measureColumns(table) {
  return table.columns.filter((column) => column.kind === 'numeric' && !ID_LIKE.test(column.name));
}
