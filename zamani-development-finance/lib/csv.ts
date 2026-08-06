const REPO_RAW_BASE =
  "https://raw.githubusercontent.com/Techspecialist-Consulting-Limited/mock-data-crdi-proto/main";

/** Server-only: revalidated hourly since this is a static demo dataset, not
 * live data - no point re-fetching multi-megabyte CSVs on every request.
 *
 * This is a hand-rolled cache, not Next.js's built-in fetch data cache,
 * because that cache silently refuses to store anything over 2MB - and
 * three of these files (lending_repayments is ~28MB) are well past that,
 * which would otherwise mean re-downloading and re-parsing tens of MB of
 * CSV on every single request. */
const REVALIDATE_MS = 3600_000;
const rawTextCache = new Map<string, { text: string; expiresAt: number }>();
// Single-flight: concurrent requests for the same URL before the cache is
// warm (e.g. several KPI fetches racing on first page load) share one
// in-flight promise instead of each independently re-downloading and
// re-parsing a multi-megabyte file.
const inFlight = new Map<string, Promise<string>>();

async function fetchRawText(url: string): Promise<string> {
  const cached = rawTextCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.text;

  const pending = inFlight.get(url);
  if (pending) return pending;

  const promise = (async () => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    }
    const text = await res.text();
    rawTextCache.set(url, { text, expiresAt: Date.now() + REVALIDATE_MS });
    return text;
  })();

  inFlight.set(url, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(url);
  }
}

/** Quote-aware CSV parser (RFC4180-ish) - several columns here (vendor_name,
 * partner_name, payee) contain embedded commas inside quoted fields, so a
 * naive split(",") silently corrupts rows. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (c === "\r") {
      // skip - source data is LF-only, but tolerate CRLF anyway
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""));
}

// Every page (the executive overview, and every persona's own overview on
// top of it) calls the same fetchXxx wrappers independently, and several of
// these files are tens of MB (lending_repayments is ~28MB) - parsing +
// row-mapping is real CPU work, not just a network fetch. Caching only the
// raw text (above) still meant redoing that work on every call, so a single
// page load could parse the same multi-MB file two or more times, and every
// navigation redid it from scratch even on a cache-warm raw text. This cache
// stores the fully mapped rows per URL instead, so parse+map happens once
// per hour (matching REVALIDATE_MS) no matter how many places ask for it.
const parsedCache = new Map<string, { rows: unknown[]; expiresAt: number }>();
const parseInFlight = new Map<string, Promise<unknown[]>>();

/** Fetches one CSV from the mock-data-crdi-proto repo and maps every row
 * through `mapRow`. `folder` matches the repo's exact folder name (note
 * "PFI Partner Portal" has spaces - encodeURIComponent handles that). */
export async function fetchCsv<T>(
  folder: string,
  file: string,
  mapRow: (cols: Record<string, string>) => T
): Promise<T[]> {
  const url = `${REPO_RAW_BASE}/${encodeURIComponent(folder)}/${file}.csv`;

  const cached = parsedCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.rows as T[];

  const pending = parseInFlight.get(url);
  if (pending) return pending as Promise<T[]>;

  const promise = (async () => {
    const text = await fetchRawText(url);
    const rows = parseCsv(text);
    const header = rows[0];
    const dataRows = rows.slice(1);

    const mapped = dataRows.map((r) => {
      const obj: Record<string, string> = {};
      header.forEach((h, idx) => (obj[h.trim()] = r[idx] ?? ""));
      return mapRow(obj);
    });
    parsedCache.set(url, { rows: mapped, expiresAt: Date.now() + REVALIDATE_MS });
    return mapped;
  })();

  parseInFlight.set(url, promise);
  try {
    return await promise;
  } finally {
    parseInFlight.delete(url);
  }
}

/** Common field coercions - CSV values arrive as strings, everything else is invented. */
export const num = (v: string): number => (v === "" ? 0 : Number(v));
export const numOrNull = (v: string): number | null => (v === "" ? null : Number(v));
export const strOrNull = (v: string): string | null => (v === "" ? null : v);
export const bool = (v: string): boolean => v.trim().toLowerCase() === "true";
