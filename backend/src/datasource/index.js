/**
 * Data source selection.
 *
 *   FABRIC_MODE=fabric  always Fabric; a connection failure is an error
 *   FABRIC_MODE=mock    always the in-memory dataset
 *   FABRIC_MODE=auto    probe Fabric once at first use, fall back to mock
 *
 * The fallback is a startup decision, never a per-query one. A query that fails
 * mid-flight against Fabric surfaces as an error rather than quietly returning
 * synthetic numbers - on an executive dashboard, wrong-but-plausible is worse
 * than visibly broken. Whenever the mock is live, every response carries
 * `synthetic: true` and /health says so loudly.
 */
import { config } from '../config.js';
import { fabricProvider } from './fabric.js';
import { mockProvider } from './mock.js';

let resolution = null;

async function resolve() {
  const mode = config.fabric.mode;

  if (mode === 'mock') {
    console.warn('[datasource] FABRIC_MODE=mock - serving synthetic data, nothing will touch Fabric.');
    return { provider: mockProvider, reason: 'FABRIC_MODE=mock' };
  }

  if (mode === 'fabric') {
    return { provider: fabricProvider, reason: 'FABRIC_MODE=fabric' };
  }

  // auto
  try {
    await fabricProvider.healthCheck();
    console.log('[datasource] Fabric reachable - serving live lakehouse data.');
    return { provider: fabricProvider, reason: 'Fabric probe succeeded' };
  } catch (error) {
    console.warn(
      `[datasource] Fabric unavailable (${error.message}) - falling back to the synthetic dataset.\n` +
      '            Every response will be marked synthetic:true. Set FABRIC_MODE=fabric to fail loudly instead.'
    );
    return { provider: mockProvider, reason: `Fabric probe failed: ${error.message}` };
  }
}

/** The active provider, chosen once and reused. */
export function datasource() {
  resolution ??= resolve();
  return resolution.then((r) => r.provider);
}

/** Re-run selection - used after a Fabric grant lands, so no restart is needed. */
export async function reprobe() {
  resolution = null;
  return describe();
}

export async function describe() {
  const { provider, reason } = await (resolution ??= resolve());
  return {
    mode: config.fabric.mode,
    provider: provider.name,
    synthetic: provider.name === 'mock',
    reason,
  };
}

export const isSynthetic = async () => (await datasource()).name === 'mock';

export async function close() {
  if (!resolution) return;
  const { provider } = await resolution;
  await provider.close();
}
