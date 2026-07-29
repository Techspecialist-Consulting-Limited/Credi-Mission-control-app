/**
 * CLI for the natural-language agent.
 *
 *   node test.js "how many memos are pending approval?" staff
 *   node test.js "how many memos are pending approval?" admin
 *
 * Staff should be denied on manager/admin datasets; admin should get a real
 * number back from Fabric.
 */
import { ask } from './src/agent.js';
import { normalizeRole } from './src/permissions.js';
import { close } from './src/datasource/index.js';

const [question, rawRole = 'admin'] = process.argv.slice(2);

if (!question) {
  console.error('Usage: node test.js "<question>" <staff|manager|admin>');
  process.exit(1);
}

const role = normalizeRole(rawRole);
if (!role) {
  console.error(`Unknown role '${rawRole}' - expected staff, manager or admin`);
  process.exit(1);
}

try {
  const result = await ask(question, role);
  console.log(`\n[${role}] ${question}\n`);
  console.log(result.answer);
  if (result.trace.length > 0) {
    console.log('\ntools used:');
    for (const step of result.trace) {
      const status = step.denied ? 'DENIED' : step.ok ? 'ok' : 'error';
      console.log(`  ${step.tool}(${JSON.stringify(step.args)}) -> ${status}`);
    }
  }
} catch (error) {
  console.error(`\nFailed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await close().catch(() => {});
}
