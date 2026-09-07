import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Plain CommonJS Node test scripts (`npm run test:csv` / `test:reconcile`)
    // and their compiled output — not application code, and intentionally
    // `require()`-based so they run on bare node with no bundler.
    "scripts/**",
    ".tmp-test/**",
  ]),
]);

export default eslintConfig;
