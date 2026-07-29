import 'dotenv/config';

function required(name, { unless = false } = {}) {
  const value = process.env[name];
  if (!value && !unless) throw new Error(`Missing required env var: ${name}`);
  return value ?? null;
}

const MODES = ['auto', 'fabric', 'mock'];

function resolveMode() {
  const mode = String(process.env.FABRIC_MODE ?? 'auto').trim().toLowerCase();
  if (!MODES.includes(mode)) {
    throw new Error(`FABRIC_MODE must be one of ${MODES.join(', ')} - got '${mode}'`);
  }
  return mode;
}

const mode = resolveMode();

export const config = {
  port: Number(process.env.PORT ?? 3000),

  fabric: {
    // auto: probe Fabric, fall back to the in-memory dataset if it is
    // unreachable. See src/datasource/index.js.
    mode,
    // Connection details are only required if Fabric might actually be used.
    endpoint: required('FABRIC_SQL_ENDPOINT', { unless: mode === 'mock' }),
    database: required('FABRIC_DATABASE', { unless: mode === 'mock' }),
    // Fabric's SQL analytics endpoint is TDS on the standard SQL Server port.
    port: 1433,
    // Token audience for the SQL endpoint - not the Fabric REST audience.
    scope: 'https://database.windows.net/.default',
    requestTimeoutMs: Number(process.env.FABRIC_REQUEST_TIMEOUT_MS ?? 60_000),
    // A short connect timeout so `auto` mode falls back quickly instead of
    // leaving the dashboard's first request hanging.
    connectTimeoutMs: Number(process.env.FABRIC_CONNECT_TIMEOUT_MS ?? 20_000),
  },

  openai: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2024-10-21',
  },

  cache: {
    // Executive KPI tiles re-request constantly; a short TTL keeps the
    // dashboard fast without hammering the SQL analytics endpoint.
    metricsTtlMs: Number(process.env.CACHE_METRICS_TTL_MS ?? 120_000),
    schemaTtlMs: Number(process.env.CACHE_SCHEMA_TTL_MS ?? 600_000),
    maxEntries: Number(process.env.CACHE_MAX_ENTRIES ?? 2000),
  },

  // Prototype only: there is no auth layer, so the caller's role arrives as a
  // plain header. Anyone who can reach the API can claim any role.
  defaultRole: process.env.DEFAULT_ROLE ?? 'admin',

  // Comma-separated origins, or '*' for the open prototype default.
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
};

export function assertOpenAIConfigured() {
  const { endpoint, apiKey, deployment } = config.openai;
  if (!endpoint || !apiKey || !deployment) {
    const error = new Error(
      'Azure OpenAI is not configured (need AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT)'
    );
    error.status = 503;
    throw error;
  }
}
