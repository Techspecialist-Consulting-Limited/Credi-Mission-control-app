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

/** Fetches one CSV from the mock-data-crdi-proto repo and maps every row
 * through `mapRow`. `folder` matches the repo's exact folder name (note
 * "PFI Partner Portal" has spaces - encodeURIComponent handles that). */
export async function fetchCsv<T>(
  folder: string,
  file: string,
  mapRow: (cols: Record<string, string>) => T
): Promise<T[]> {
  const url = `${REPO_RAW_BASE}/${encodeURIComponent(folder)}/${file}.csv`;
  const text = await fetchRawText(url);
  const rows = parseCsv(text);
  const header = rows[0];
  const dataRows = rows.slice(1);

  return dataRows.map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => (obj[h.trim()] = r[idx] ?? ""));
    return mapRow(obj);
  });
}

/** Common field coercions - CSV values arrive as strings, everything else is invented. */
export const num = (v: string): number => (v === "" ? 0 : Number(v));
export const numOrNull = (v: string): number | null => (v === "" ? null : Number(v));
export const strOrNull = (v: string): string | null => (v === "" ? null : v);
export const bool = (v: string): boolean => v.trim().toLowerCase() === "true";
