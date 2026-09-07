// Test-only loader: transpile the actual source with the project's TypeScript.
// No extra app bundler, test server, or production credentials are needed.
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
exports.loadSource = function loadSource(relative, mocks = {}, cache = new Map()) {
  const file = path.resolve(__dirname, "..", relative);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} };
  cache.set(file, mod);
  const source = fs.readFileSync(file, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const resolve = (name) => {
    if (name in mocks) return mocks[name];
    if (name.startsWith("@/") || name.startsWith(".")) {
      const base = name.startsWith("@/") ? path.resolve(__dirname, "../src", name.slice(2)) : path.resolve(path.dirname(file), name);
      const target = [base, base + ".ts", base + ".tsx"].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
      return loadSource(path.relative(path.resolve(__dirname, ".."), target), mocks, cache);
    }
    return require(name);
  };
  new Function("require", "module", "exports", compiled)(resolve, mod, mod.exports);
  return mod.exports;
};
