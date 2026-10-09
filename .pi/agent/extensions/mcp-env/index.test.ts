import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ExtensionAPI, McpServerConfig } from "@earendil-works/pi-coding-agent";
import registerMcpEnv from "./index.ts";

async function fixture(t: test.TestContext, content?: string) {
  const dir = await mkdtemp(join(tmpdir(), "pi-mcp-env-test-"));
  const previous = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = dir;
  if (content !== undefined) await writeFile(join(dir, "mcp-env.json"), content);
  t.after(async () => {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
    await rm(dir, { recursive: true, force: true });
  });
  return dir;
}

function api(rejectName?: string) {
  const servers = new Map<string, McpServerConfig>();
  const handlers: ((event: unknown, ctx: unknown) => Promise<void>)[] = [];
  const errors: string[] = [];
  const pi = {
    registerMcpServer(name: string, config: McpServerConfig) {
      if (name === rejectName) throw new Error("secret-native-error-with-token-and-endpoint");
      servers.set(name, structuredClone(config));
    },
    on(event: string, handler: (event: unknown, ctx: unknown) => Promise<void>) {
      assert.equal(event, "session_start");
      handlers.push(handler);
    },
  } as unknown as ExtensionAPI;
  return { pi, servers, handlers, errors, async start() {
    for (const handler of handlers) await handler({}, { hasUI: true, ui: {
      notify(message: string) { errors.push(message); },
    } });
  } };
}

test("registers normalized servers during load without writing source or running commands", async (t) => {
  const content = JSON.stringify({ mcpServers: {
    company: { url: "${MCP_ENV_TEST_ENDPOINT}", auth: "oauth", directTools: ["get_issue"] },
    disabled: { command: "not-a-real-command", enabled: false },
    bearer: { url: "https://public.example.invalid/mcp", auth: "bearer", bearerToken: "!exit 99" },
  } });
  const dir = await fixture(t, content);
  const previous = process.env.MCP_ENV_TEST_ENDPOINT;
  process.env.MCP_ENV_TEST_ENDPOINT = "https://internal.example.invalid/mcp";
  t.after(() => {
    if (previous === undefined) delete process.env.MCP_ENV_TEST_ENDPOINT;
    else process.env.MCP_ENV_TEST_ENDPOINT = previous;
  });
  const runtime = api();
  await registerMcpEnv(runtime.pi);
  assert.deepEqual([...runtime.servers.keys()], ["company", "disabled", "bearer"]);
  assert.equal((runtime.servers.get("company") as { url: string }).url, "https://internal.example.invalid/mcp");
  assert.deepEqual(runtime.servers.get("company")?.toolExposure, { get_issue: "direct" });
  assert.equal(runtime.servers.get("disabled")?.enabled, false);
  await runtime.start();
  assert.deepEqual(runtime.errors, []);
  assert.equal(await readFile(join(dir, "mcp-env.json"), "utf8"), content);
  assert.deepEqual(await readdir(dir), ["mcp-env.json"]);
  await registerMcpEnv(runtime.pi);
  assert.equal(runtime.servers.size, 3);
});

test("isolates normalization and native registration failures with sanitized diagnostics", async (t) => {
  await fixture(t, JSON.stringify({ mcpServers: {
    malformed: { url: "secret-endpoint" },
    rejected: { command: "valid" },
    good: { command: "valid", args: ["--flag"] },
  } }));
  const runtime = api("rejected");
  await registerMcpEnv(runtime.pi);
  assert.deepEqual([...runtime.servers.keys()], ["good"]);
  assert.deepEqual(runtime.errors, []);
  await runtime.start();
  assert.equal(runtime.errors.length, 2);
  assert.match(runtime.errors.join(), /malformed/);
  assert.match(runtime.errors.join(), /rejected/);
  assert.ok(!runtime.errors.join().includes("secret"));
});

test("malformed JSON emits one generic diagnostic without source text", async (t) => {
  await fixture(t, "secret-malformed-json-and-token");
  const runtime = api();
  await registerMcpEnv(runtime.pi);
  await runtime.start();
  assert.equal(runtime.servers.size, 0);
  assert.equal(runtime.errors.length, 1);
  assert.ok(!runtime.errors[0].includes("secret"));
});

test("missing source is a silent no-op", async (t) => {
  await fixture(t);
  const runtime = api();
  await registerMcpEnv(runtime.pi);
  await runtime.start();
  assert.equal(runtime.servers.size, 0);
  assert.deepEqual(runtime.errors, []);
});
