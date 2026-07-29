/**
 * Filter parsing, shared by every read endpoint and by the agent tools.
 *
 * A filter arrives as `column=<expression>` on the query string. The bare form
 * is equality, so `?status=Open` still works exactly as before; anything richer
 * is prefixed with an operator:
 *
 *   ?status=Open                          status = 'Open'
 *   ?status=in:Open,Escalated             status IN ('Open','Escalated')
 *   ?amount_requested=gte:50000           amount_requested >= 50000
 *   ?created_at=between:2026-01-01,2026-04-01
 *   ?subject=contains:payment             subject LIKE '%payment%'
 *   ?resolved_at=isnull                   resolved_at IS NULL
 *   ?status=ne:Draft                      status <> 'Draft'
 *
 * Parsing produces a normalized {column, op, value} triple. The column is the
 * resolved schema object - never the caller's raw string - so the providers can
 * interpolate the identifier and bind the value without further checking.
 */

export class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BadRequestError';
    this.status = 400;
  }
}

/**
 * arity: how many operands the operator consumes.
 *   1 - single value, 0 - none (null checks), 'n' - a comma-separated list.
 */
export const OPERATORS = {
  eq: { arity: 1, sql: '=' },
  ne: { arity: 1, sql: '<>' },
  gt: { arity: 1, sql: '>' },
  gte: { arity: 1, sql: '>=' },
  lt: { arity: 1, sql: '<' },
  lte: { arity: 1, sql: '<=' },
  in: { arity: 'n' },
  nin: { arity: 'n' },
  between: { arity: 2 },
  contains: { arity: 1 },
  startswith: { arity: 1 },
  isnull: { arity: 0 },
  notnull: { arity: 0 },
};

// Operators that only make sense on an ordered column.
const ORDERED_ONLY = new Set(['gt', 'gte', 'lt', 'lte', 'between']);
const TEXT_ONLY = new Set(['contains', 'startswith']);

/** Coerce a raw string to the column's type so comparisons behave. */
export function coerce(column, raw) {
  if (raw === null || raw === undefined) return null;

  if (column.kind === 'numeric') {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      throw new BadRequestError(`'${raw}' is not a number (column '${column.name}')`);
    }
    return parsed;
  }

  if (column.kind === 'temporal') {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestError(`'${raw}' is not a date (column '${column.name}')`);
    }
    return parsed;
  }

  if (column.kind === 'boolean') {
    const value = String(raw).trim().toLowerCase();
    if (['true', '1', 'yes'].includes(value)) return true;
    if (['false', '0', 'no'].includes(value)) return false;
    throw new BadRequestError(`'${raw}' is not a boolean (column '${column.name}')`);
  }

  return String(raw);
}

/**
 * Turn one `column=<expression>` pair into a normalized filter.
 * `column` must already be resolved against the live schema.
 */
export function parseFilter(column, expression) {
  // Express gives an array when a param repeats; treat that as an IN list.
  if (Array.isArray(expression)) {
    return { column, op: 'in', value: expression.map((item) => coerce(column, item)) };
  }

  const raw = String(expression ?? '');
  const separator = raw.indexOf(':');
  const maybeOp = separator === -1 ? raw.toLowerCase() : raw.slice(0, separator).toLowerCase();
  const operator = OPERATORS[maybeOp];

  // No recognised prefix - the whole string is an equality value. This is what
  // keeps `?status=Open` working, and what stops a value that happens to
  // contain a colon (a timestamp, a URL) from being read as an operator.
  if (!operator) {
    return { column, op: 'eq', value: coerce(column, raw) };
  }

  const op = maybeOp;
  const rest = separator === -1 ? '' : raw.slice(separator + 1);

  if (ORDERED_ONLY.has(op) && !['numeric', 'temporal'].includes(column.kind)) {
    throw new BadRequestError(`Operator '${op}' needs a numeric or date column, not '${column.name}'`);
  }
  if (TEXT_ONLY.has(op) && column.kind !== 'text') {
    throw new BadRequestError(`Operator '${op}' needs a text column, not '${column.name}'`);
  }

  if (operator.arity === 0) {
    return { column, op, value: null };
  }

  if (operator.arity === 'n') {
    const items = rest.split(',').map((item) => item.trim()).filter(Boolean);
    if (items.length === 0) {
      throw new BadRequestError(`Operator '${op}' on '${column.name}' needs at least one value`);
    }
    return { column, op, value: items.map((item) => coerce(column, item)) };
  }

  if (operator.arity === 2) {
    const parts = rest.split(',').map((item) => item.trim());
    if (parts.length !== 2) {
      throw new BadRequestError(`Operator '${op}' on '${column.name}' needs exactly two values, comma-separated`);
    }
    return { column, op, value: parts.map((item) => coerce(column, item)) };
  }

  if (rest === '') {
    throw new BadRequestError(`Operator '${op}' on '${column.name}' needs a value`);
  }
  return { column, op, value: coerce(column, rest) };
}

/**
 * Build the implicit date-range filter from `?from=`/`?to=`, which apply to the
 * dataset's time axis without the caller needing to know its column name.
 */
export function dateRangeFilter(column, from, to) {
  if (!column) return null;
  if (from && to) return { column, op: 'between', value: [coerce(column, from), coerce(column, to)] };
  if (from) return { column, op: 'gte', value: coerce(column, from) };
  if (to) return { column, op: 'lte', value: coerce(column, to) };
  return null;
}

/** Compact description of applied filters, echoed back so the UI can show chips. */
export function describeFilters(filters) {
  return filters.map(({ column, op, value }) => ({
    column: column.name,
    op,
    value: value instanceof Date ? value.toISOString() : value,
  }));
}
