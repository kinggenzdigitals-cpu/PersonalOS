/**
 * The pure half of the social-provider lookup.
 *
 * It lives in its own module with **no imports at all** so the repo's test
 * harness can reach it: `npm test` compiles a single file with bare `tsc` and
 * requires the output from plain node, which cannot resolve the `@/` path
 * alias and has no `node_modules/server-only` on disk. Its only other caller,
 * auth-providers.ts, needs both — so keeping the parser here is what makes it
 * testable at all. See scripts/auth-provider-state.test.cjs.
 */

/**
 * Three states, not a boolean. "we asked and it's off" and "we couldn't ask"
 * must stay distinguishable — see parseProviderState for why collapsing them
 * produces a button that hides itself permanently for the wrong reason.
 */
export type ProviderState = "enabled" | "disabled" | "unknown";

/**
 * Reads one provider out of a /auth/v1/settings body.
 *
 * The trap this exists to avoid: an unauthorised or rejected request still
 * returns valid JSON, just without an `external` key. The natural-looking
 * `body.external?.[provider]` then yields undefined, which is falsy, which
 * reads as "disabled" — so a rotated key would hide the button forever and
 * enabling the provider would never bring it back. A missing or malformed
 * `external` object is therefore "unknown", never "disabled". Only a real
 * boolean from Supabase is treated as an answer.
 */
export function parseProviderState(body: unknown, provider: string): ProviderState {
  if (!body || typeof body !== "object") return "unknown";
  const external = (body as { external?: unknown }).external;
  if (!external || typeof external !== "object") return "unknown";
  // Own property only, so nothing inherited from a prototype can pass itself
  // off as Supabase having answered.
  if (!Object.prototype.hasOwnProperty.call(external, provider)) return "unknown";
  const value = (external as Record<string, unknown>)[provider];
  if (typeof value !== "boolean") return "unknown";
  return value ? "enabled" : "disabled";
}
