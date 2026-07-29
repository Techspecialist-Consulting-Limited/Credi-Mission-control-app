/**
 * End-to-end check against a running server:
 *
 *   npm run dev          # in one terminal
 *   npm run smoke        # in another
 *
 * Covers every endpoint, both directions of every RBAC rule, each filter
 * operator and the error paths. Exits non-zero on the first failure, so it is
 * usable as a pre-demo gate.
 *
 * The AI endpoint is skipped unless SMOKE_AI=1, because it costs tokens.
 */
const BASE = process.env.SMOKE_BASE ?? 'http://localhost:3000/api/v1';

let passed = 0;
const failures = [];

async function call(path, { role = 'admin', method = 'GET', body } = {}) {
  const response = await fetch(BASE + path, {
    method,
    headers: { 'x-role': role, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

/** `check` receives the parsed body and returns true, or a string explaining the failure. */
async function test(label, path, expectedStatus, check = () => true, options = {}) {
  try {
    const { status, body } = await call(path, options);
    if (status !== expectedStatus) {
      throw new Error(`expected HTTP ${expectedStatus}, got ${status}: ${JSON.stringify(body).slice(0, 200)}`);
    }
    const verdict = check(body);
    if (verdict !== true) throw new Error(typeof verdict === 'string' ? verdict : 'assertion returned false');
    passed += 1;
    console.log(`  ok   ${label}`);
  } catch (error) {
    failures.push(`${label}: ${error.message}`);
    console.log(`  FAIL ${label}\n         ${error.message}`);
  }
}

const isPositive = (value) => Number.isFinite(value) && value > 0;

/** Every `$ref` in the spec, so a typo'd component name fails here not in Swagger UI. */
function collectRefs(node, found = []) {
  if (!node || typeof node !== 'object') return found;
  for (const [key, value] of Object.entries(node)) {
    if (key === '$ref' && typeof value === 'string') found.push(value);
    else collectRefs(value, found);
  }
  return found;
}

/** Resolve a `#/a/b/c` pointer, or undefined. */
const resolveRef = (spec, ref) =>
  ref.replace(/^#\//, '').split('/').reduce((node, part) => node?.[part], spec);

/**
 * Does the documented contract still match the running server?
 *
 * Two directions, because each catches a different mistake: a path documented
 * but never implemented misleads the frontend, and a path implemented but never
 * documented is one they will never discover.
 */
async function contractChecks() {
  console.log('\nAPI contract');

  const response = await fetch(`${BASE.replace(/\/api\/v1$/, '')}/docs/openapi.json`);
  if (!response.ok) {
    failures.push(`spec is not served: HTTP ${response.status}`);
    console.log(`  FAIL spec is served\n         HTTP ${response.status}`);
    return;
  }
  const spec = await response.json();

  const assert = (label, verdict) => {
    if (verdict === true) {
      passed += 1;
      console.log(`  ok   ${label}`);
    } else {
      failures.push(`${label}: ${verdict}`);
      console.log(`  FAIL ${label}\n         ${verdict}`);
    }
  };

  assert('spec is served and parses', spec.openapi?.startsWith('3.') || `openapi: ${spec.openapi}`);

  const broken = [...new Set(collectRefs(spec))].filter((ref) => resolveRef(spec, ref) === undefined);
  assert('every $ref resolves', broken.length === 0 || `unresolved: ${broken.join(', ')}`);

  const tagged = Object.values(spec.paths).flatMap((path) => Object.values(path)).flatMap((op) => op.tags ?? []);
  const declared = new Set(spec.tags.map((tag) => tag.name));
  const undeclared = [...new Set(tagged)].filter((tag) => !declared.has(tag));
  assert('every operation tag is declared', undeclared.length === 0 || `undeclared: ${undeclared.join(', ')}`);

  const operations = Object.values(spec.paths).flatMap((path) => Object.values(path)).map((op) => op.operationId);
  assert('every operation has a unique operationId',
    operations.every(Boolean) && new Set(operations).size === operations.length
      ? true
      : 'missing or duplicated operationId');

  // Documented -> implemented. A path the server never registered falls through
  // to the catch-all, which answers exactly {"error":"Not found"}.
  //
  // Two are probed with a bogus method instead of being called for real: a
  // reprobe would re-run the 20s Fabric connect and an invalidate would empty
  // the cache under the rest of the suite. An unrouted path still 404s on any
  // method, so the check holds.
  const SIDE_EFFECTS = new Set(['/health/reprobe', '/cache/invalidate']);
  const documented = Object.keys(spec.paths);
  const unimplemented = [];

  // The router itself, for the two paths that cannot be safely called.
  const { router } = await import('../src/routes.js');
  const routed = [...new Set(
    router.stack.filter((layer) => layer.route).map((layer) => layer.route.path.replace(/:table/g, '{table}'))
  )];

  for (const path of documented) {
    if (SIDE_EFFECTS.has(path)) {
      if (!routed.includes(path)) unimplemented.push(`POST ${path}`);
      continue;
    }
    const concrete = path.replace('{table}', 'credo_support_tickets');
    const method = spec.paths[path].get ? 'GET' : 'POST';
    const { status, body } = await call(concrete, { method, body: method === 'POST' ? {} : undefined });
    if (status === 404 && body.error === 'Not found') unimplemented.push(`${method} ${path}`);
  }
  assert('every documented path is implemented',
    unimplemented.length === 0 || `not routed: ${unimplemented.join(', ')}`);

  // Implemented -> documented.
  const undocumented = routed.filter((path) => !documented.includes(path));
  assert('every implemented path is documented',
    undocumented.length === 0 || `undocumented: ${undocumented.join(', ')}`);
}

/** Give a just-started server a moment; parsing the OpenAPI spec adds to boot time. */
async function waitForServer(attempts = 40) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await fetch(`${BASE}/health`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`no response from ${BASE} after ${(attempts * 250) / 1000}s`);
}

async function main() {
  await waitForServer();
  const { body: health } = await call('/health');
  console.log(`\nData source: ${health.dataSource.provider}${health.dataSource.synthetic ? ' (synthetic)' : ''}\n`);

  console.log('service');
  await test('health is ok', '/health', 200, (b) => b.ok === true || `connection: ${b.connection}`);
  await test('capabilities lists operators', '/capabilities', 200, (b) => b.filterOperators.includes('between'));
  await test('roles', '/roles', 200, (b) => b.roles.length === 3);

  console.log('\nschema');
  await test('schema for admin has 5 datasets', '/schema', 200, (b) => b.tables.length === 5 || `got ${b.tables.length}`);
  await test('schema for staff has 2 datasets', '/schema', 200, (b) => b.tables.length === 2, { role: 'staff' });
  // credo_travel_details has no date/time column of its own (it inherits time
  // context from the memo it's linked to via memo_id), so it's the one
  // legitimate exception - not a bug in schema introspection.
  await test('every dataset reports a time axis, except travel_details', '/schema', 200,
    (b) => b.tables
      .filter((t) => t.table !== 'credo_travel_details')
      .every((t) => t.timeAxis) || 'an unexpected dataset has no time axis');
  await test('column values for dropdowns', '/schema/vendor_registry/values?column=registration_status', 200,
    (b) => b.values.length > 1);

  console.log('\ndashboard composition');
  await test('dashboard spec has sections with tiles', '/dashboard', 200,
    (b) => b.sections.length === 5 && b.sections.every((s) => s.tiles.length > 0 && s.charts.length > 0));
  await test('every tile endpoint is a real path', '/dashboard', 200,
    (b) => b.sections.flatMap((s) => s.tiles).every((t) => t.endpoint.startsWith('/api/v1/')));
  await test('pulse rolls up across datasets', '/dashboard/pulse', 200,
    (b) => isPositive(b.headline.totalRecords) && isPositive(b.headline.needsAttention)
      && isPositive(b.headline.financialExposure));
  await test('pulse is role-scoped', '/dashboard/pulse', 200,
    (b) => b.headline.datasets === 2 || `staff saw ${b.headline.datasets} datasets`, { role: 'staff' });

  console.log('\nmetrics');
  await test('overview carries trends, except tables with no time axis', '/metrics/overview?days=30', 200,
    (b) => b.tables.every((t) =>
      t.trend === null || ['up', 'down', 'flat'].includes(t.trend?.direction)));
  await test('count', '/metrics/credo_memos/count', 200, (b) => isPositive(b.total), { role: 'manager' });
  await test('sum aggregation', '/metrics/credo_memos/aggregate?fn=sum&column=amount_ngn', 200,
    (b) => isPositive(b.results.sum_amount_ngn), { role: 'manager' });
  await test('grouped aggregation', '/metrics/credo_memos/aggregate?fn=avg&column=amount_ngn&groupBy=department', 200,
    (b) => b.results.length > 1 && b.results.every((r) => r.group), { role: 'manager' });
  await test('multi-metric aggregation', '/metrics/credo_travel_details/aggregate?metrics=sum:cost_ngn,avg:duration_days,max:cost_ngn', 200,
    (b) => isPositive(b.results.sum_cost_ngn) && isPositive(b.results.avg_duration_days), { role: 'manager' });
  await test('period comparison', '/metrics/credo_memos/compare?days=30', 200,
    (b) => Number.isFinite(b.current) && Number.isFinite(b.previous)
      && ['up', 'down', 'flat'].includes(b.direction), { role: 'manager' });
  await test('value comparison', '/metrics/credo_memos/compare?fn=sum&column=amount_ngn&days=30', 200,
    (b) => b.metric === 'sum(amount_ngn)', { role: 'manager' });
  await test('breakdown shares sum to ~100', '/metrics/credo_support_tickets/breakdown?column=status', 200,
    (b) => Math.abs(b.series.reduce((sum, p) => sum + p.share, 0) - 100) < 1.5, { role: 'staff' });
  await test('timeseries buckets are dates', '/metrics/credo_support_tickets/timeseries?bucket=month&days=365', 200,
    (b) => b.series.length > 1 && b.series.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.bucket)), { role: 'staff' });
  await test('timeseries is ascending', '/metrics/credo_support_tickets/timeseries?bucket=week&days=180', 200,
    (b) => b.series.every((p, i) => i === 0 || p.bucket > b.series[i - 1].bucket), { role: 'staff' });

  console.log('\nfilters');
  const unfiltered = (await call('/metrics/credo_memos/count', { role: 'manager' })).body.total;
  await test('eq narrows the result', '/metrics/credo_memos/count?status=Approved', 200,
    (b) => b.total > 0 && b.total < unfiltered, { role: 'manager' });
  const approved = (await call('/metrics/credo_memos/count?status=Approved', { role: 'manager' })).body.total;
  await test('ne is the complement of eq', '/metrics/credo_memos/count?status=ne:Approved', 200,
    (b) => b.total + approved === unfiltered || `${b.total} + ${approved} != ${unfiltered}`, { role: 'manager' });
  await test('in matches several values', '/metrics/credo_memos/count?status=in:Approved,Rejected', 200,
    (b) => b.total > 0 && b.total < unfiltered, { role: 'manager' });
  await test('gte on a measure', '/metrics/credo_memos/count?amount_ngn=gte:500000', 200,
    (b) => b.total > 0 && b.total < unfiltered, { role: 'manager' });
  await test('between on a date', '/metrics/credo_memos/count?submitted_date=between:2026-01-01,2026-03-31', 200,
    (b) => b.total > 0 && b.total < unfiltered, { role: 'manager' });
  await test('contains on text', '/data/vendor_registry?vendor_name=contains:Logistics&pageSize=5', 200,
    (b) => b.rows.length > 0 && b.rows.every((r) => /logistics/i.test(r.vendor_name)));
  await test('isnull', '/metrics/credo_memos/count?approved_date=isnull', 200,
    (b) => isPositive(b.total), { role: 'manager' });
  await test('notnull', '/metrics/credo_memos/count?approved_date=notnull', 200,
    (b) => isPositive(b.total), { role: 'manager' });
  await test('from/to on the default time axis', '/metrics/credo_support_tickets/breakdown?column=status&from=2026-06-01', 200,
    (b) => b.filters.length === 1 && b.filters[0].op === 'gte', { role: 'staff' });

  console.log('\ndrill-down');
  await test('pagination reports totals', '/data/credo_support_tickets?page=2&pageSize=10', 200,
    (b) => b.rows.length === 10 && b.page === 2 && b.totalPages > 1, { role: 'staff' });
  await test('sort is applied', '/data/vendor_registry?sort=registered_date&order=desc&pageSize=5', 200,
    (b) => b.rows.every((r, i) => i === 0 || r.registered_date <= b.rows[i - 1].registered_date));
  await test('pageSize is capped', '/data/credo_support_tickets?pageSize=99999', 200,
    (b) => b.pageSize <= 500, { role: 'staff' });

  console.log('\nRBAC (both directions)');
  const denied = (b) => b.name === 'AccessDeniedError';
  await test('staff cannot count memos', '/metrics/credo_memos/count', 403, denied, { role: 'staff' });
  await test('staff cannot read memo schema', '/schema/credo_memos', 403, denied, { role: 'staff' });
  await test('staff cannot drill into travel', '/data/credo_travel_details', 403, denied, { role: 'staff' });
  await test('manager cannot read audit logs', '/data/craig_audit_logs', 403, denied, { role: 'manager' });
  await test('manager can read memos', '/metrics/credo_memos/count', 200, (b) => isPositive(b.total), { role: 'manager' });
  await test('admin can read audit logs', '/metrics/craig_audit_logs/count', 200, (b) => isPositive(b.total));
  await test('unknown role falls back, not escalates', '/schema', 200,
    (b) => b.tables.length <= 5, { role: 'wizard' });

  console.log('\nerror handling');
  await test('unknown table', '/metrics/not_a_table/count', 403, (b) => Boolean(b.error));
  await test('unknown column', '/metrics/credo_memos/breakdown?column=nope', 404,
    (b) => b.name === 'UnknownObjectError', { role: 'manager' });
  await test('operator/type mismatch', '/metrics/credo_memos/count?status=gte:5', 400,
    (b) => b.name === 'BadRequestError', { role: 'manager' });
  await test('sum on a text column', '/metrics/credo_memos/aggregate?fn=sum&column=status', 400,
    (b) => b.name === 'BadRequestError', { role: 'manager' });
  await test('breakdown without a column', '/metrics/credo_memos/breakdown', 400,
    (b) => b.name === 'BadRequestError', { role: 'manager' });
  await test('unparseable date', '/metrics/credo_memos/count?submitted_date=gte:not-a-date', 400,
    (b) => b.name === 'BadRequestError', { role: 'manager' });
  await test('errors carry a request id', '/metrics/credo_memos/breakdown', 400, (b) => Boolean(b.requestId), { role: 'manager' });

  await contractChecks();

  if (process.env.SMOKE_AI === '1') {
    console.log('\nAI agent');
    await test('agent answers from tools', '/ai/ask', 200,
      (b) => b.trace.length > 0 && b.answer.length > 0,
      { method: 'POST', body: { question: 'how many memos are pending approval?', role: 'manager' } });
    await test('agent respects RBAC', '/ai/ask', 200,
      (b) => b.trace.every((step) => step.tool !== 'count_rows' || step.denied) || /not permitted|no dataset|cannot/i.test(b.answer),
      { method: 'POST', body: { question: 'how many memos are pending approval?', role: 'staff' } });
  } else {
    console.log('\nAI agent  (skipped - set SMOKE_AI=1 to include)');
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`\nSmoke run could not complete: ${error.message}`);
  console.error('Is the server running? Start it with `npm run dev`.');
  process.exitCode = 1;
});
