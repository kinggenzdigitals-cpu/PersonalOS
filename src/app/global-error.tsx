"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for errors thrown by the root layout itself. It replaces
 * the whole document, so globals.css, the fonts and the theme provider are all
 * gone: the few styles it needs are inline, on the app's dark palette.
 *
 * The server-side record of the same error is the `request_error` line written
 * by src/instrumentation.ts, keyed by the digest shown below.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" style={{ colorScheme: "dark" }}>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "0 16px",
          background: "#031124",
          color: "#f3f7ff",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          textAlign: "center",
        }}
      >
        <title>Something went wrong</title>
        <main style={{ maxWidth: 360 }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 600 }}>
            Something went wrong
          </h1>
          <p style={{ margin: "0 0 16px", fontSize: 14, color: "#9db4d2" }}>
            The app couldn&apos;t load. It might be a connection hiccup.
          </p>
          {error.digest && (
            <p style={{ margin: "0 0 16px", fontSize: 12, color: "#9db4d2" }}>
              Reference: <code>{error.digest}</code>
            </p>
          )}
          <button
            type="button"
            onClick={() => retry()}
            style={{
              padding: "10px 18px",
              border: 0,
              borderRadius: 8,
              background: "#087cff",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
