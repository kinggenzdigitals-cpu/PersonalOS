/**
 * Reads and normalizes the public Supabase env vars. Tolerates a URL entered
 * without an `https://` prefix or with trailing slashes/whitespace — a common
 * dashboard copy-paste mistake that otherwise makes auth requests resolve to
 * the app's own HTML (causing "Unexpected token '<' ... is not valid JSON").
 */
export function supabaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  if (!raw) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

export function supabaseAnonKey(): string {
  const raw = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  if (!raw) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set.");
  return raw;
}
