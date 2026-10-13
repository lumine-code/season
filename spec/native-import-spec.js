const { spawnSync } = require("node:child_process");
const path = require("node:path");

const source = path.resolve(__dirname, "../src/cson.js");
const fixture = path.resolve(__dirname, "fixtures/sample.cson");
const parserPath = path.resolve(__dirname, "../src/cson-parser.js");

function runColdCase(body) {
  const program = `
    const assert = require("node:assert/strict");
    const fs = require("node:fs");
    const path = require("node:path");
    const os = require("node:os");
    const crypto = require("node:crypto");
    const { pathToFileURL } = require("node:url");
    const { registerHooks } = require("node:module");
    const source = ${JSON.stringify(source)};
    const fixture = ${JSON.stringify(fixture)};
    const parserPath = ${JSON.stringify(parserPath)};
    const read = (api, file = fixture) => new Promise((resolve, reject) => {
      assert.equal(api.readFile(file, (error, value) => error ? reject(error) : resolve(value)), undefined);
    });
    const removeTemp = (directory) => {
      const relative = path.relative(fs.realpathSync(os.tmpdir()), fs.realpathSync(directory));
      assert(!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(".." + path.sep));
      fs.rmSync(directory, { recursive: true, force: true });
    };
    (async () => { ${body} })().then(() => console.log("native case passed"), (error) => {
      console.error(error);
      process.exitCode = 1;
    });
  `;
  const result = spawnSync(process.execPath, ["-e", program], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 10000,
  });
  expect(result.error).withContext(result.error?.message).toBeUndefined();
  expect(result.status).withContext(result.stderr).toBe(0);
  expect(result.stdout).toContain("native case passed");
}

describe("native CSON imports for asynchronous reads", () => {
  it("shares the native parser with concurrent reads and synchronous require", () => {
    runColdCase(`
      let imports = 0;
      registerHooks({ resolve(specifier, context, next) {
        if (specifier === "./cson-parser.js") imports++;
        return next(specifier, context);
      }});
      const api = require(source);
      assert.equal(require.cache[require.resolve(parserPath)], undefined);
      const values = await Promise.all([read(api), read(api)]);
      assert.deepEqual(values, [{ a: 1, b: { c: true } }, { a: 1, b: { c: true } }]);
      assert.equal(imports, 1);
      const required = require(parserPath);
      const imported = await import(pathToFileURL(parserPath).href);
      assert.equal(imported.default, required);
      let parsed = 0;
      const parse = required.parse;
      required.parse = (...args) => { parsed++; return parse(...args); };
      assert.deepEqual(await read(api), values[0]);
      assert.deepEqual(api.readFileSync(fixture), values[0]);
      assert.equal(parsed, 2);
    `);
  });

  it("keeps JSON, blank files and validated CSON cache hits independent of the compiler", () => {
    runColdCase(`
      let imports = 0;
      registerHooks({ resolve(specifier, context, next) {
        if (specifier === "./cson-parser.js") { imports++; throw Error("Unexpected compiler import"); }
        return next(specifier, context);
      }});
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), "season-import-cache-"));
      try {
        const api = require(source);
        api.setCacheDir(directory);
        const digest = crypto.createHash("sha1").update(fs.readFileSync(fixture, "utf8"), "utf8").digest("hex");
        fs.writeFileSync(path.join(directory, digest + ".json"), JSON.stringify({ cached: true }));
        assert.deepEqual(await read(api), { cached: true });
        assert.equal(api.getCacheHits(), 1);
        assert.deepEqual(await read(api, path.join(path.dirname(fixture), "sample.json")), { foo: "bar" });
        assert.equal(await read(api, path.join(path.dirname(fixture), "empty.cson")), null);
        assert.equal(imports, 0);
        assert.equal(require.cache[require.resolve(parserPath)], undefined);
      } finally {
        removeTemp(directory);
      }
    `);
  });

  it("retries a transient import failure and calls each callback only once", () => {
    runColdCase(`
      let imports = 0;
      registerHooks({ resolve(specifier, context, next) {
        if (specifier === "./cson-parser.js" && ++imports === 1) throw Error("Held compiler import failed");
        return next(specifier, context);
      }});
      const api = require(source);
      let calls = 0;
      const failure = await new Promise((resolve) => api.readFile(fixture, (error) => { calls++; resolve(error); }));
      assert(failure instanceof Error);
      assert.equal(failure.path, fixture);
      assert.equal(failure.filename, fixture);
      assert.equal(failure.message, fixture + ": Held compiler import failed");
      assert(failure.stack.includes("Held compiler import failed"));
      assert.deepEqual(await read(api), { a: 1, b: { c: true } });
      await new Promise(setImmediate);
      assert.equal(calls, 1);
      assert.equal(imports, 2);
    `);
  });

  it("annotates shared import failures separately for different input files", () => {
    runColdCase(`
      const shared = Error("Shared compiler import failed");
      registerHooks({ resolve(specifier, context, next) {
        if (specifier === "./cson-parser.js") throw shared;
        return next(specifier, context);
      }});
      const api = require(source);
      const second = path.join(path.dirname(fixture), "multi-comment.cson");
      const failures = await Promise.all([fixture, second].map(file => new Promise(resolve => api.readFile(file, error => resolve(error)))));
      assert.notEqual(failures[0], failures[1]);
      assert.equal(failures[0].path, fixture);
      assert.equal(failures[1].path, second);
      assert.equal(failures[0].message, fixture + ": Shared compiler import failed");
      assert.equal(failures[1].message, second + ": Shared compiler import failed");
      assert.equal(shared.message, "Shared compiler import failed");
    `);
  });

  it("preserves synchronous APIs when a native read is pending", () => {
    runColdCase(`
      const api = require(source);
      const pending = read(api);
      assert.deepEqual(api.parse("a: 1"), { a: 1 });
      assert.equal(api.stringify({ a: 1 }), "a: 1");
      assert.deepEqual(api.readFileSync(fixture), { a: 1, b: { c: true } });
      assert.deepEqual(await pending, { a: 1, b: { c: true } });
    `);
  });

  it("delivers syntax errors with the source path and one callback", () => {
    runColdCase(`
      const api = require(source);
      const invalid = path.join(path.dirname(fixture), "syntax-error.cson");
      let calls = 0;
      const error = await new Promise(resolve => api.readFile(invalid, error => { calls++; resolve(error); }));
      assert(error instanceof Error);
      assert.equal(error.path, invalid);
      assert.equal(error.filename, invalid);
      assert(error.message.startsWith(invalid + ": "));
      await new Promise(setImmediate);
      assert.equal(calls, 1);
    `);
  });

  it("keeps user callback exceptions out of the loader's rejection handler", () => {
    runColdCase(`
      const api = require(source);
      let calls = 0;
      const expected = Error("Callback exception");
      const caught = new Promise(resolve => process.once("uncaughtException", resolve));
      api.readFile(fixture, () => { calls++; throw expected; });
      assert.equal(await caught, expected);
      await new Promise(setImmediate);
      assert.equal(calls, 1);
    `);
  });

  it("preserves the corrupted-cache fallback's callback exception handling", () => {
    runColdCase(`
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), "season-import-invalid-cache-"));
      try {
        const api = require(source);
        api.setCacheDir(directory);
        const digest = crypto.createHash("sha1").update(fs.readFileSync(fixture, "utf8"), "utf8").digest("hex");
        fs.writeFileSync(path.join(directory, digest + ".json"), "invalid cached JSON");
        let calls = 0, uncaught = 0;
        process.on("uncaughtException", () => uncaught++);
        await new Promise(resolve => api.readFile(fixture, (error, value) => {
          assert.equal(error, null);
          assert.deepEqual(value, { a: 1, b: { c: true } });
          calls++;
          resolve();
          throw Error("Fallback callback exception");
        }));
        await new Promise(setImmediate);
        assert.equal(calls, 1);
        assert.equal(uncaught, 0);
        await new Promise(resolve => setTimeout(resolve, 10));
      } finally {
        removeTemp(directory);
      }
    `);
  });
});
