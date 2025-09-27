const BASE = import.meta.env.VITE_API_URL;

export async function api(path: string, init?: RequestInit) {
  if (!BASE) {
    // No backend configured — return a harmless placeholder to avoid crashes.
    console.warn("[api] VITE_API_URL not set; returning empty result for", path);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  }
  return fetch(`${BASE}${path}`, init);
}
