# credo-fabric-ai

Read-only analytics API over data flowing into Microsoft Fabric (`Credicorp_lakehouse`). It backs the CREDICORP executive dashboard: the frontend consumes JSON endpoints for KPI tiles, value aggregations, period-over-period deltas, breakdowns, trends and drill-down tables, plus one natural-language endpoint where a model answers questions by calling a fixed set of parameterized tools (`src/tools.js`) rather than writing raw SQL.

Two things make it a command center rather than a table browser:

- `GET /dashboard` returns a **renderable layout** — for every dataset the caller can read, which columns are measures, which are chartable dimensions, which is the time axis, and the exact endpoint each tile should call. The frontend loops over tiles; it never hardcodes a table or column name.
- `GET /dashboard/pulse` returns the **cross-platform rollup** — total records, how many are sitting in a state that needs someone to act, total financial exposure, and period-over-period movement, aggregated across every system the caller can see.

Every dataset access is checked against the caller's role (`src/permissions.js`) before it touches the data source, so a denied request never reaches the database.

**Prototype status:** there is no authentication. The role arrives in an unverified `x-role` header and CORS is open by default. That is deliberate for the demo, but it means anyone who can reach the API can read anything. See [Before this is more than a demo](#before-this-is-more-than-a-demo).

## Quick start

```
npm install
npm run dev
npm run smoke      # in a second terminal - 53 checks across every endpoint
```

Then open **<http://localhost:3000/docs>** for the interactive API reference.

That works with **no Azure setup at all**. On startup the API probes Fabric; if it cannot connect, it falls back to a built-in synthetic dataset and says so loudly. Every response then carries `"synthetic": true`, `/health` reports the mode, and the AI agent appends a note to each answer — so a demo can never quietly pass fake numbers off as real ones.

### Data source modes

Set `FABRIC_MODE`:

| Mode | Behaviour |
| --- | --- |
| `auto` (default) | Probe Fabric once at startup. Unreachable → synthetic dataset, marked as such. |
| `fabric` | Always Fabric. A connection failure is an error, not a fallback. Use this wherever wrong-but-plausible data is worse than a visible outage. |
| `mock` | Always synthetic. Needs no Azure credentials, so the frontend can be built with zero access to CREDICORP tenancy. |

The fallback is a **startup** decision, never a per-query one. A query that fails mid-flight against Fabric surfaces as an error rather than switching to synthetic data underneath you.

Once a Fabric grant lands, `POST /api/v1/health/reprobe` re-runs the selection and clears the cache — no restart needed.

## Connecting to Fabric

Auth is Entra ID, never an API key. `DefaultAzureCredential` resolves, in order: service-principal env vars → managed identity → your Azure CLI session. So pick one:

- *Deployment:* set `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` in `.env` (see `.env.example`).
- *Local development:* install the [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) and run `az login`.

Either way, **that identity must be a member of the Fabric workspace that owns `Credicorp_lakehouse`** — Viewer at minimum, ideally Member.

### If the connection dies with "socket hang up"

This is the failure mode to expect, and it is **not** a network problem. Fabric completes the TLS handshake, reads the login packet and then drops the socket without returning an error. It means one of:

1. The identity is not a member of the workspace that owns the lakehouse, or
2. the tenant setting **"Service principals can use Fabric APIs"** is off, or the app registration is not in the security group it allows.

`src/fabricClient.js` rewrites the driver's bare `socket hang up` into that explanation, and names the identity it tried. Verify the token itself is fine before chasing networking:

```
npm run discover        # prints the active source, then every table and column
```

## API documentation

The contract lives in [`docs/openapi.yaml`](docs/openapi.yaml) — OpenAPI 3.1, grouped into seven tags, with request/response schemas, examples and the full filter grammar.

| | |
| --- | --- |
| `GET /docs` | Swagger UI — try any endpoint in the browser, with a role selector |
| `GET /docs/openapi.json` | The spec as JSON, for client codegen |
| `GET /docs/openapi.yaml` | The spec as written, the source of truth |

Swagger UI is bundled locally, so it works with no internet access.

To set the role in Swagger UI, click **Authorize** and enter `staff`, `manager` or `admin`. It persists across requests.

The spec is **hand-maintained, not generated**. A generated spec documents what the code does; this documents what the frontend is promised — why `results` changes shape when you group, what a null `percentChange` means, which query keys are reserved. To keep it honest, `npm run smoke` checks it in both directions: every documented path must be routed, and every routed path must be documented. Add an endpoint without documenting it and the suite fails.

Generate a typed client from it with whatever your frontend uses, e.g.:

```
npx openapi-typescript http://localhost:3000/docs/openapi.json -o src/api-types.ts
```

## Endpoints

All under `/api/v1`. Role comes from the `x-role` header (or `?role=`), defaulting to `DEFAULT_ROLE`.

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Data source, connectivity, cache stats, whether AI is configured |
| `POST /health/reprobe` | Re-run data source selection after a Fabric grant |
| `GET /capabilities` | Aggregations, buckets and filter operators this build supports |
| `GET /roles` | Valid roles and the active one |
| `GET /schema` | Every dataset the role can read, with column types, time axis and measures |
| `GET /schema/:table` | One dataset's columns |
| `GET /schema/:table/values?column=&limit=` | Distinct values — populates filter dropdowns |
| **`GET /dashboard`** | **Renderable tile/chart layout for this role, each with its endpoint** |
| **`GET /dashboard/pulse?days=`** | **Cross-dataset rollup: totals, what needs attention, financial exposure** |
| `GET /metrics/overview?days=` | Row counts across all accessible datasets, each with a trend |
| `GET /metrics/:table/count` | Row count, filterable |
| **`GET /metrics/:table/aggregate`** | **`?fn=sum&column=x&groupBy=y`, or `?metrics=sum:x,avg:y,max:z`** |
| **`GET /metrics/:table/compare`** | **Trailing window vs the one before it — the trend arrow on a KPI tile** |
| `GET /metrics/:table/breakdown?column=&limit=` | `GROUP BY` counts with each group's share — donuts and bars |
| `GET /metrics/:table/timeseries?column=&bucket=&days=` | Bucketed counts (`day`/`week`/`month`/`quarter`/`year`) |
| `GET /data/:table?page=&pageSize=&sort=&order=` | Paginated drill-down rows |
| `POST /ai/ask` `{ question, role }` | Natural-language answer plus a trace of which tools ran |
| `POST /cache/invalidate` `{ prefix }` | Drop cached results |

### Filtering

Every read endpoint accepts filters as `column=<expression>`. A bare value is equality, so `?status=Open` works as before; anything richer takes an operator prefix:

```
?status=Open                                  status = 'Open'
?status=in:Open,Escalated                     status IN (...)
?status=ne:Draft                              status <> 'Draft'
?amount_requested=gte:500000                  >= 500000     (also gt, lt, lte)
?created_at=between:2026-01-01,2026-03-31     inclusive range
?vendor_name=contains:Atlantic                LIKE '%Atlantic%'  (also startswith)
?resolved_at=isnull                           IS NULL       (also notnull)
```

`?from=` and `?to=` apply a date range to the dataset's time axis **without the caller needing to know its column name** — the API resolves it. Override with `?dateColumn=`.

Values are coerced to the column's type and rejected with a `400` if they don't fit; an operator that doesn't suit the column's type (`gte` on text) is a `400` too. Applied filters are echoed back on the response so the UI can render chips.

The metrics and data endpoints are **schema-driven**: they read the live schema and validate every table and column name against it, so they work against the lakehouse without column names being hardcoded here. That validation is also the injection boundary — SQL identifiers cannot be bound as parameters, so only names that came back from the source verbatim are ever interpolated into a query. Values are always bound.

### Example: what a KPI tile costs

```
GET /api/v1/metrics/credo_memos/aggregate?fn=sum&column=amount_requested
  -> { "results": { "sum_amount_requested": 950205414.63 } }

GET /api/v1/metrics/credo_memos/compare?fn=sum&column=amount_requested&days=30
  -> { "current": 148…, "previous": 96…, "percentChange": 54.2, "direction": "up" }
```

The `/dashboard` spec hands the frontend both of those URLs already assembled.

## Structure

- `src/config.js` — env loading, defaults, `FABRIC_MODE` resolution
- `src/datasource/index.js` — picks Fabric or the synthetic source; owns the fallback rule
- `src/datasource/fabric.js` — every SQL string in the project lives here
- `src/datasource/mock.js` — the same provider interface, in memory
- `src/datasource/mockData.js` — the seeded synthetic lakehouse
- `src/fabricClient.js` — Fabric SQL endpoint pool, Entra ID auth, token refresh before expiry
- `src/schema.js` — schema introspection, identifier validation, column classification
- `src/identifiers.js` — quoting and type classification, shared with the providers
- `src/filters.js` — the filter grammar and value coercion
- `src/permissions.js` — role → table access map (`staff` / `manager` / `admin`)
- `src/queries.js` — role check → resolve → parse → cache → provider, for every read
- `src/dashboard.js` — the dashboard spec and the cross-dataset pulse
- `src/cache.js` — TTL cache with single-flight dedupe and a bounded entry count
- `src/tools.js` — the callable functions exposed to the model, each role-gated
- `src/agent.js` — the function-calling loop: question + role in, answer + trace out
- `src/routes.js`, `src/server.js` — Express wiring, request ids, error shape
- `src/docs.js` — serves the spec and Swagger UI
- `docs/openapi.yaml` — the API contract
- `scripts/discover.js` — schema discovery CLI
- `scripts/smoke.js` — end-to-end check of every endpoint, RBAC rule and filter operator
- `test.js` — agent CLI: `node test.js "<question>" <role>`

## Datasets

- `credo_memos`, `credo_travel_details` — manager/admin only
- `credo_support_tickets`, `vendor_registry` — all roles
- `craig_audit_logs` — admin only (compliance/AML data)

Real column names are not documented here on purpose — run `npm run discover` and read them from the source of truth. The synthetic dataset mirrors the expected *shape* of each table (an id, a time axis, low-cardinality dimensions, numeric measures), not its exact columns; expect to re-run `discover` once real access lands.

## Testing

```
npm run smoke              # 53 checks: endpoints, RBAC both directions, filters, errors, spec drift
SMOKE_AI=1 npm run smoke   # also exercises the AI endpoint (costs tokens)
npm run ask "how many memos are pending approval?" manager
```

`smoke.js` asserts both directions of every RBAC rule — that `staff` is denied *and* that `manager` is allowed — because a permission check that denies everything also passes a one-sided test.

## Before this is more than a demo

1. **Rotate `AZURE_OPENAI_API_KEY`.** It has been sitting in plaintext in a folder that has changed hands.
2. **Add real auth.** Validate a token and read the role from a verified claim instead of trusting `x-role`.
3. **Lock down CORS** with `CORS_ORIGIN`, and put `POST /cache/invalidate` and `POST /health/reprobe` behind that auth — both are unauthenticated write endpoints today.
4. **Decide where RBAC lives.** Today one service identity queries Fabric and this API makes every access decision. If Fabric itself must enforce per-user access, that needs the on-behalf-of token flow and each dashboard user granted workspace access.
5. **Watch cache TTLs.** Defaults are 2 minutes for metrics, 10 for schema. Executive tiles tolerate that; anything alerting-grade will not.
6. **Set `FABRIC_MODE=fabric` in production**, so a Fabric outage is visible rather than papered over with synthetic data.
