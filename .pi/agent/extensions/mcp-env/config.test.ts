import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { normalizeConfig } from "./config.ts";

const source = (entry: unknown) => ({ mcpServers: { company: entry } });
const url = "https://internal.example.invalid/mcp";
const one = (entry: unknown, env: Record<string, string> = {}) => {
  const result = normalizeConfig(source(entry), env);
  assert.deepEqual(result.errors, []);
  assert.equal(result.servers.length, 1);
  return result.servers[0].config;
};

test("resolves multiple URL variables without mutating source", () => {
  const input = source({ url: "${ORIGIN}/${PATH}", headers: { Authorization: "Bearer ${TOKEN}" } });
  const before = JSON.stringify(input);
  const result = normalizeConfig(input, { ORIGIN: "https://internal.example.invalid", PATH: "mcp" });
  assert.equal(result.servers[0].config.url, url);
  assert.deepEqual(result.servers[0].config.headers, { Authorization: "Bearer ${TOKEN}" });
  assert.equal(JSON.stringify(input), before);
});

test("fails closed on missing, empty, and whitespace URL variables", () => {
  for (const env of [{}, { ENDPOINT: "" }, { ENDPOINT: "   " }]) {
    const result = normalizeConfig(source({ url: "${ENDPOINT}" }), env);
    assert.equal(result.servers.length, 0);
    assert.match(result.errors[0], /ENDPOINT/);
  }
});

test("rejects invalid URLs without leaking endpoint values", () => {
  for (const value of ["ftp://secret-endpoint.invalid", "https://", "!secret-command", "${BAD-NAME}"]) {
    const result = normalizeConfig(source({ url: value }), {});
    assert.equal(result.servers.length, 0);
    assert.equal(result.errors.length, 1);
    assert.ok(!result.errors[0].includes(value));
  }
});

test("preserves native auth, OAuth settings, headers, exposure, and timeout", () => {
  const entry = { url, auth: { provider: "provider" }, oauth: { clientSecret: "${SECRET}" },
    headers: { Org: "${ORG}" }, exposure: "deferred", timeout: 120, enabled: false };
  assert.deepEqual(one(entry), entry);
});

test("resolves OAuth clientId references while keeping secret references deferred", () => {
  const config = one({ url, oauth: { clientId: "${CLIENT_ID}", clientSecret: "${CLIENT_SECRET}" } }, { CLIENT_ID: "registered-client" });
  assert.deepEqual(config.oauth, { clientId: "registered-client", clientSecret: "${CLIENT_SECRET}" });
  const result = normalizeConfig(source({ url, oauth: { clientId: "${MISSING_CLIENT}" } }), {});
  assert.equal(result.servers.length, 0);
  assert.match(result.errors.join(), /MISSING_CLIENT/);
});

test("legacy OAuth and false auth defer to native automatic authentication", () => {
  for (const auth of ["oauth", false]) {
    const config = one({ url, auth });
    assert.ok(!("auth" in config));
  }
});

test("bearer variable and literal values become native header templates", () => {
  for (const token of ["${TOKEN}", "literal-token"]) {
    const config = one({ url, auth: "bearer", bearerToken: token, headers: { Org: "1" } });
    assert.deepEqual(config.headers, { Org: "1", Authorization: `Bearer ${token}` });
    assert.ok(!("auth" in config));
    assert.ok(!("bearerToken" in config));
  }
});

test("bearer command is deferred, safely quoted, and preserves failure and empty output", () => {
  for (const [command, status, output] of [
    ["printf '%s' 'test-token'", 0, "Bearer test-token"],
    ["printf 'unusable'; exit 7", 7, ""],
    ["printf ''", 1, ""],
    ["printf '   '", 1, ""],
  ] as const) {
    const config = one({ url, auth: "bearer", bearerToken: `!${command}` });
    const header = (config.headers as Record<string, string>).Authorization;
    assert.ok(header.startsWith("!"));
    const result = spawnSync("/bin/sh", ["-c", header.slice(1)], { encoding: "utf8" });
    assert.equal(result.status, status);
    assert.equal(result.stdout, output);
  }
});

test("bearer auth accepts an existing case-insensitive Authorization header", () => {
  const config = one({ url, auth: "bearer", headers: { authorization: "Bearer ${TOKEN}" } });
  assert.deepEqual(config.headers, { authorization: "Bearer ${TOKEN}" });
});

test("rejects bearer conflicts, missing tokens, bad scalar auth, and bad headers safely", () => {
  for (const entry of [
    { url, auth: "bearer" },
    { url, bearerToken: "" },
    { url, bearerToken: "!   " },
    { url, bearerToken: "secret-token", headers: { AUTHORIZATION: "secret-header" } },
    { url, auth: "secret-unsupported-mode" },
    { url, headers: { Authorization: 123 } },
  ]) {
    const result = normalizeConfig(source(entry), {});
    assert.equal(result.servers.length, 0);
    assert.ok(result.errors.every((e) => !e.includes("secret")));
  }
});

test("maps directTools while preserving explicit tool overrides", () => {
  const config = one({ url, directTools: ["get_issue", "delete_issue"],
    toolExposure: { delete_issue: "hidden", search: "deferred" } });
  assert.deepEqual(config.toolExposure, { get_issue: "direct", delete_issue: "hidden", search: "deferred" });
  assert.ok(!("directTools" in config));
  assert.ok(!("directTools" in one({ url, directTools: false })));
});

test("explicit wildcard tool overrides also take precedence over legacy lists", () => {
  const config = one({ url, directTools: ["search_code", "get_issue"], toolExposure: { "search_*": "hidden" } });
  assert.deepEqual(config.toolExposure, { get_issue: "direct", "search_*": "hidden" });
});

test("rejects malformed direct tool lists and unsupported protocol versions", () => {
  for (const fields of [{ directTools: true }, { directTools: [123] }, { protocolVersion: "secret-version" }]) {
    const result = normalizeConfig(source({ url, ...fields }), {});
    assert.equal(result.servers.length, 0);
    assert.ok(!result.errors.join().includes("secret-version"));
  }
  assert.ok(!("protocolVersion" in one({ url, protocolVersion: "auto" })));
});

test("preserves stdio commands, args, environment and disabled state", () => {
  const entry = { command: "npx", args: ["-y", "mcp-remote", "${UNCHANGED}"], env: { TOKEN: "${TOKEN}" }, enabled: false };
  assert.deepEqual(one(entry), entry);
});

test("rejects malformed roots and isolates malformed entries", () => {
  for (const input of [null, [], "secret-json", { mcpServers: [] }]) {
    const result = normalizeConfig(input, {});
    assert.equal(result.servers.length, 0);
    assert.equal(result.errors.length, 1);
  }
  const result = normalizeConfig({ mcpServers: { bad: null, good: { url }, absent: { url: "${MISSING}" } } }, {});
  assert.deepEqual(result.servers.map((s) => s.name), ["good"]);
  assert.equal(result.errors.length, 2);
  assert.deepEqual(normalizeConfig({}, {}), { servers: [], errors: [] });
});

test("rejects invalid names without including untrusted text in diagnostics", () => {
  const result = normalizeConfig({ mcpServers: { "secret://endpoint": { url } } }, {});
  assert.equal(result.servers.length, 0);
  assert.ok(!result.errors.join().includes("secret://endpoint"));
});
