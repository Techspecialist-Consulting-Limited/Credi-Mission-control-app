import sql from 'mssql';
import { DefaultAzureCredential } from '@azure/identity';
import { config } from './config.js';

/**
 * Connection to the Fabric SQL analytics endpoint.
 *
 * Auth is Entra ID, never an API key. DefaultAzureCredential resolves in order:
 *   1. AZURE_CLIENT_ID / AZURE_CLIENT_SECRET / AZURE_TENANT_ID  (service principal - use in deployment)
 *   2. Managed identity, if running on Azure
 *   3. Azure CLI session from `az login`                        (local development)
 *
 * So the same code works on a laptop and in production; production just sets
 * the three service-principal vars. Whichever identity is used, it must be a
 * member of the Fabric workspace that owns the lakehouse, or every query fails
 * with a permissions error even though the connection succeeds.
 */
const credential = new DefaultAzureCredential();

let pool = null;
let poolTokenExpiresAt = 0;

// Access tokens live ~1h. Rebuild the pool before expiry rather than letting
// in-flight queries fail on a stale token.
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

async function buildPool() {
  const token = await credential.getToken(config.fabric.scope);
  if (!token?.token) {
    throw new Error(
      'Could not acquire an Entra ID token for Fabric. Set AZURE_CLIENT_ID/AZURE_CLIENT_SECRET/AZURE_TENANT_ID, or run `az login`.'
    );
  }

  const created = new sql.ConnectionPool({
    server: config.fabric.endpoint,
    database: config.fabric.database,
    port: config.fabric.port,
    authentication: {
      type: 'azure-active-directory-access-token',
      options: { token: token.token },
    },
    options: {
      encrypt: true,
      trustServerCertificate: false,
      // Fabric returns large analytic result sets; keep row streaming sane.
      requestTimeout: config.fabric.requestTimeoutMs,
      // Bounded so `FABRIC_MODE=auto` can decide quickly rather than leaving
      // the dashboard's first request hanging on an unreachable endpoint.
      connectTimeout: config.fabric.connectTimeoutMs,
    },
    pool: { min: 0, max: 10, idleTimeoutMillis: 30_000 },
  });

  try {
    await created.connect();
  } catch (error) {
    // Fabric does not return a login-failure token for an unauthorized service
    // principal - it accepts the TLS handshake, reads LOGIN7 and then drops the
    // socket. The driver surfaces that as a bare "socket hang up", which reads
    // like a network problem and is not one. Say what it actually means.
    if (/socket hang up|ECONNRESET|Connection lost/i.test(error.message)) {
      const identity = process.env.AZURE_CLIENT_ID
        ? `service principal ${process.env.AZURE_CLIENT_ID}`
        : 'your az login identity';
      throw new Error(
        `Fabric accepted the connection then closed it during login. The token is valid, so this is authorization, not connectivity: ` +
        `${identity} is almost certainly not a member of the Fabric workspace that owns '${config.fabric.database}' ` +
        `(needs Viewer at minimum), or the tenant setting "Service principals can use Fabric APIs" is off. ` +
        `Original driver error: ${error.message}`
      );
    }
    throw error;
  }

  poolTokenExpiresAt = token.expiresOnTimestamp ?? Date.now() + 45 * 60 * 1000;
  return created;
}

async function getPool() {
  const expiringSoon = Date.now() > poolTokenExpiresAt - TOKEN_REFRESH_MARGIN_MS;

  if (pool && !expiringSoon) return pool;

  if (pool && expiringSoon) {
    const stale = pool;
    pool = null;
    // Don't await - let existing queries drain while we open the new pool.
    stale.close().catch(() => {});
  }

  pool = await buildPool();
  return pool;
}

/**
 * Run a parameterized query. `params` is an object of name -> value; reference
 * them in SQL as @name. Identifiers (table/column names) can never be
 * parameterized by the driver, so anything interpolated into SQL text must
 * first be validated against the live schema - see identifiers.js.
 */
export async function query(text, params = {}) {
  const activePool = await getPool();
  const request = activePool.request();

  for (const [name, value] of Object.entries(params)) {
    request.input(name, value);
  }

  const result = await request.query(text);
  return result.recordset ?? [];
}

export async function healthCheck() {
  const rows = await query('SELECT 1 AS ok');
  return rows[0]?.ok === 1;
}

export async function closePool() {
  if (pool) {
    const stale = pool;
    pool = null;
    await stale.close();
  }
}
