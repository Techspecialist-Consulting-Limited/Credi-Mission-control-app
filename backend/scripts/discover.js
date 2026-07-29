/**
 * Schema discovery. Run this first, before wiring dashboard tiles:
 *
 *   npm run discover
 *
 * It prints every table and column the active data source exposes, flags which
 * column each dataset defaults to for time series, which numeric columns are
 * treated as measures, and the top values of low-cardinality text columns -
 * i.e. the columns the dashboard turns into status donuts and category bars.
 *
 * Runs against whatever FABRIC_MODE resolves to, so it is also the quickest way
 * to see what the synthetic dataset looks like.
 */
import { loadSchema, defaultTemporalColumn, measureColumns } from '../src/schema.js';
import { datasource, describe, close } from '../src/datasource/index.js';

const CARDINALITY_PROBE_LIMIT = 25;

async function main() {
  const source = await describe();
  const provider = await datasource();

  console.log(`Data source: ${source.provider}${source.synthetic ? '  (SYNTHETIC - not real lakehouse data)' : ''}`);
  console.log(`Reason: ${source.reason}\n`);

  const schema = await loadSchema();
  console.log(`Found ${schema.size} table(s)\n`);

  for (const table of schema.values()) {
    const total = await provider.count(table, []);
    const temporal = defaultTemporalColumn(table);
    const measures = new Set(measureColumns(table).map((column) => column.name));

    console.log(`=== ${table.schema}.${table.name}  (${total.toLocaleString()} rows)`);
    for (const column of table.columns) {
      const notes = [
        column.name === temporal?.name ? 'default time axis' : null,
        measures.has(column.name) ? 'measure' : null,
      ].filter(Boolean);
      const suffix = notes.length ? `  <- ${notes.join(', ')}` : '';
      console.log(`    ${column.name.padEnd(32)} ${column.dataType.padEnd(14)} ${column.kind}${suffix}`);
    }

    // Text columns with few distinct values are the dashboard's dimensions.
    for (const column of table.columns.filter((c) => c.kind === 'text')) {
      const values = await provider.groupBy(table, column, { limit: CARDINALITY_PROBE_LIMIT });
      if (values.length > 0 && values.length < CARDINALITY_PROBE_LIMIT) {
        const preview = values
          .slice(0, 8)
          .map((row) => `${row.label ?? '(null)'}=${row.value}`)
          .join(', ');
        console.log(`    * dimension candidate '${column.name}': ${preview}`);
      }
    }
    console.log('');
  }
}

main()
  .catch((error) => {
    console.error(`\nDiscovery failed: ${error.message}\n`);
    if (/token|credential|AADSTS|DefaultAzureCredential/i.test(error.message)) {
      console.error('This looks like an auth failure. Either set');
      console.error('  AZURE_CLIENT_ID / AZURE_CLIENT_SECRET / AZURE_TENANT_ID');
      console.error('for a service principal, or install the Azure CLI and run `az login`.');
    } else {
      console.error('If the connection succeeded but queries fail, the identity is probably');
      console.error('not a member of the Fabric workspace that owns the lakehouse.');
      console.error('Run with FABRIC_MODE=mock to work against the synthetic dataset instead.');
    }
    process.exitCode = 1;
  })
  .finally(() => close().catch(() => {}));
