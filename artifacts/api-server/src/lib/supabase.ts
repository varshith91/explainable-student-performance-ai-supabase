import { ReplitConnectors } from "@replit/connectors-sdk";

function readSupabaseKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    ""
  );
}

function readSupabaseUrl() {
  const raw =
    process.env.SUPABASE_URL ??
    (process.env.SUPABASE_PROJECT_REF
      ? `https://${process.env.SUPABASE_PROJECT_REF}.supabase.co`
      : "");
  return raw.replace(/\/+$/, "");
}

export function isSupabaseConfigured() {
  return Boolean(readSupabaseUrl() && readSupabaseKey());
}

function mergeHeaders(init?: RequestInit) {
  const key = readSupabaseKey();
  const headers = new Headers(init?.headers);
  if (!headers.has("apikey")) headers.set("apikey", key);
  if (!headers.has("authorization")) headers.set("authorization", `Bearer ${key}`);
  return headers;
}

export async function supabaseRequest(path: string, init?: RequestInit) {
  const baseUrl = readSupabaseUrl();
  const key = readSupabaseKey();

  if (baseUrl && key) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = `${baseUrl}${normalizedPath}`;
    return fetch(url, { ...init, headers: mergeHeaders(init) });
  }

  const connectors = new ReplitConnectors();
  const options = init
    ? {
        method: init.method,
        headers: init.headers as Record<string, string> | undefined,
        body: init.body,
      }
    : undefined;
  return connectors.proxy("supabase", path, options);
}

export async function supabaseJson(path: string, init?: RequestInit) {
  const response = await supabaseRequest(path, init);
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { response, data };
}
