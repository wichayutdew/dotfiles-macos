import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

// Set PI_PACKAGE_DIR to the installed @earendil-works/pi-coding-agent directory.
// Only extension registration is exercised; no session or transport is started.
test("Pi's actual loader accepts the extension and validates native registrations", {
  skip: !process.env.PI_PACKAGE_DIR,
}, async (t) => {
  const loader = await import(pathToFileURL(join(process.env.PI_PACKAGE_DIR!, "dist/core/extensions/loader.js")).href);
  const dir = await mkdtemp(join(tmpdir(), "pi-mcp-env-loader-"));
  const oldDir = process.env.PI_CODING_AGENT_DIR;
  const oldEndpoint = process.env.MCP_ENV_TEST_ENDPOINT;
  process.env.PI_CODING_AGENT_DIR = dir;
  process.env.MCP_ENV_TEST_ENDPOINT = "https://internal.example.invalid/mcp";
  t.after(async () => {
    if (oldDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = oldDir;
    if (oldEndpoint === undefined) delete process.env.MCP_ENV_TEST_ENDPOINT;
    else process.env.MCP_ENV_TEST_ENDPOINT = oldEndpoint;
    await rm(dir, { recursive: true, force: true });
  });
  const text = JSON.stringify({ mcpServers: {
    company: { url: "${MCP_ENV_TEST_ENDPOINT}", auth: "oauth", directTools: ["get_issue"] },
    cli: { command: "not-a-real-command", args: ["--version"], enabled: false },
    invalid: { url: "https://public.example.invalid/mcp", timeout: -1 },
  } });
  await writeFile(join(dir, "mcp-env.json"), text);
  const extension = join(dirname(fileURLToPath(import.meta.url)), "index.ts");
  const first = await loader.loadExtensions([extension], dir);
  assert.deepEqual(first.errors, []);
  assert.equal(first.extensions.length, 1);
  assert.deepEqual(first.runtime.mcpServers.list().map((s: { name: string }) => s.name), ["company", "cli"]);
  const company = first.runtime.mcpServers.get("company");
  assert.equal(company.config.url, "https://internal.example.invalid/mcp");
  assert.deepEqual(company.config.toolExposure, { get_issue: "direct" });
  assert.ok(!("auth" in company.config));
  const notifications: string[] = [];
  for (const handler of first.extensions[0].handlers.get("session_start") ?? []) {
    await handler({}, { hasUI: true, ui: { notify: (message: string) => notifications.push(message) } });
  }
  assert.equal(notifications.length, 1);
  assert.match(notifications[0], /invalid: native MCP registration failed/);
  const second = await loader.loadExtensions([extension], dir, undefined, first.runtime);
  assert.deepEqual(second.errors, []);
  assert.equal(second.runtime.mcpServers.list().length, 2);
  assert.equal(await readFile(join(dir, "mcp-env.json"), "utf8"), text);
  assert.deepEqual(await readdir(dir), ["mcp-env.json"]);
});
