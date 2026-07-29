const BASE_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

/**
 * Server-only fetch against the credo-fabric-ai backend. Role defaults to
 * "admin" - there is no per-user auth in this build yet, and the executive
 * Overview page is inherently an admin-tier surface.
 */
export async function backendGet<T>(path: string, role = "admin"): Promise<T> {
  const res = await fetch(`${BASE_URL}/api/v1${path}`, {
    headers: { "x-role": role },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Backend request failed: ${res.status} ${path}`);
  }

  return res.json();
}

export async function backendHealth() {
  const res = await fetch(`${BASE_URL}/api/v1/health`, { cache: "no-store" });
  return res.json();
}

export async function backendPost<T>(path: string, body: unknown, role = "admin"): Promise<T> {
  const res = await fetch(`${BASE_URL}/api/v1${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-role": role },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error ?? `Backend request failed: ${res.status} ${path}`);
  }

  return res.json();
}
