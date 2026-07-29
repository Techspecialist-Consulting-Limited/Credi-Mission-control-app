/**
 * TTL cache with single-flight dedupe.
 *
 * The dedupe matters more than the caching here: an executive dashboard mounts
 * a dozen tiles at once, and without it a cold cache fires a dozen identical
 * Fabric queries in the same tick.
 */
import { config } from './config.js';

const entries = new Map(); // key -> { value, expiresAt }
const inflight = new Map(); // key -> Promise

/**
 * Filters make the key space unbounded, so drop expired entries first and then
 * the oldest insertions until we are back under the cap. Map preserves
 * insertion order, which is close enough to LRU for a metrics cache.
 */
function evictIfNeeded() {
  if (entries.size <= config.cache.maxEntries) return;

  const now = Date.now();
  for (const [key, entry] of entries) {
    if (entry.expiresAt <= now) entries.delete(key);
  }

  for (const key of entries.keys()) {
    if (entries.size <= config.cache.maxEntries) break;
    entries.delete(key);
  }
}

export async function cached(key, ttlMs, producer) {
  const hit = entries.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const value = await producer();
      entries.set(key, { value, expiresAt: Date.now() + ttlMs });
      evictIfNeeded();
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

export function invalidate(prefix) {
  if (!prefix) {
    entries.clear();
    return;
  }
  for (const key of entries.keys()) {
    if (key.startsWith(prefix)) entries.delete(key);
  }
}

export function stats() {
  const now = Date.now();
  let fresh = 0;
  for (const entry of entries.values()) if (entry.expiresAt > now) fresh += 1;
  return { total: entries.size, fresh, inflight: inflight.size };
}
