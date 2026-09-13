import test from "node:test";
import assert from "node:assert/strict";
import { OsvScanner } from "../src/scanners/dependency/osv-engine.js";

test("OsvScanner: supports project with package.json", () => {
  const scanner = new OsvScanner();
  assert.ok(scanner.supports({ projectPath: process.cwd(), files: ["package.json"] }));
});

test("OsvScanner: handles missing package.json gracefully without crashing", async () => {
  const scanner = new OsvScanner();
  const result = await scanner.scan({
    projectPath: "/non-existent-directory",
    files: [],
  });

  assert.equal(result.scanner, "osv");
  assert.equal(result.status, "success");
  assert.equal(result.findings.length, 0);
});

test("OsvScanner: returns normalized findings structure", async () => {
  const scanner = new OsvScanner();
  const result = await scanner.scan({
    projectPath: process.cwd(),
    files: ["package.json"],
    dependencies: {},
  });

  assert.equal(result.scanner, "osv");
  assert.ok(Array.isArray(result.findings));
});
