import { type Instrumentation } from "next";

/**
 * One structured line per server error — Server Component render, Route
 * Handler, Server Action or proxy — carrying the same `digest` the error
 * boundaries show the user as "Reference: …". Search Vercel Runtime Logs for
 * that digest to find the failing route.
 *
 * Deliberately vendor-free: this only writes to stderr. Forwarding these lines
 * anywhere (a log drain, an error-tracking service) adds a data processor,
 * which is an owner decision and needs the privacy page updated first.
 *
 * Left out on purpose:
 * - request headers: they carry the Supabase session cookies.
 * - the query string: it can hold OAuth codes, reset codes and invite tokens.
 * Error text comes from our own code, but a failed query can echo a value
 * back, so email addresses are masked and the length is capped.
 */
export const onRequestError: Instrumentation.onRequestError = (
  err,
  request,
  context,
) => {
  const digest =
    typeof err === "object" && err !== null && "digest" in err
      ? String(err.digest)
      : undefined;
  const message = err instanceof Error ? err.message : String(err);

  console.error(
    JSON.stringify({
      level: "error",
      event: "request_error",
      digest,
      name: err instanceof Error ? err.name : typeof err,
      message: message.replace(/[^\s@"'<>]+@[^\s@"'<>]+/g, "[email]").slice(0, 500),
      method: request.method,
      path: request.path.split("?")[0],
      routePath: context.routePath,
      routeType: context.routeType,
    }),
  );
};
