/**
 * Identifier quoting and type classification.
 *
 * Split out from schema.js so the data-source providers can use them without
 * importing schema.js, which imports the providers back.
 */

// Column types grouped by what a dashboard can do with them.
const TEMPORAL_TYPES = new Set(['date', 'datetime', 'datetime2', 'smalldatetime', 'datetimeoffset', 'time']);
const NUMERIC_TYPES = new Set([
  'int', 'bigint', 'smallint', 'tinyint', 'decimal', 'numeric', 'float', 'real', 'money', 'smallmoney',
]);
const TEXT_TYPES = new Set(['varchar', 'nvarchar', 'char', 'nchar', 'text', 'ntext', 'uniqueidentifier']);

export function classify(dataType) {
  const type = String(dataType).toLowerCase();
  if (TEMPORAL_TYPES.has(type)) return 'temporal';
  if (NUMERIC_TYPES.has(type)) return 'numeric';
  if (TEXT_TYPES.has(type)) return 'text';
  if (type === 'bit') return 'boolean';
  return 'other';
}

/** Bracket-quote a name that has already been validated against the schema. */
export function quoteIdent(name) {
  return `[${String(name).replace(/]/g, ']]')}]`;
}
