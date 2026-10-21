import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const packageDir = process.env.PI_PACKAGE_DIR;
assert.ok(packageDir, "Set PI_PACKAGE_DIR to the installed Pi coding-agent package");
const { loadExtensions } = await import(pathToFileURL(join(packageDir, "dist/core/extensions/loader.js")).href);
const { createEventBus } = await import(pathToFileURL(join(packageDir, "dist/core/event-bus.js")).href);
const extensionPath = fileURLToPath(new URL("../workflow-models.ts", import.meta.url));
const skillText = `# Example workflow
## Model selection
Use the cheapest suitable model.
Escalate only for demonstrated complexity or failed attempts.
## Stages
| Stage | Prompt | Model | Thinking | Outcomes |
| --- | --- | --- | --- | --- |
| intake | intake.md | cheap/fast | low | ready |
| implement | implement.md | mid-tier | medium | ready |
| plan | plan.md | near-flagship | high | ready |
`;
const usage = { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, totalTokens: 150,
  cost: { input: 0.01, output: 0.02, cacheRead: 0, cacheWrite: 0, total: 0.03 } };
function model(id, input, output, extra = {}) {
  return { provider: "fixture", id, name: id, api: "openai-responses", baseUrl: "https://example.invalid",
    reasoning: true, input: ["text"], contextWindow: 128000, maxTokens: 16000,
    cost: { input, output, cacheRead: 0, cacheWrite: 0 }, ...extra };
}
const defaultModels = [model("default", 10, 20), model("small", 1, 1), model("routine", 2, 3),
  model("strong", 5, 5), model("unknown", 0, 0)];
function decision(overrides = {}) {
  return { model: "fixture/small", thinking: "low", reason: "Sufficient for retrieval at a low cost.", ...overrides };
}
async function fixture(t, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), "pi-workflow-models-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const skill = join(dir, "SKILL.md");
  await writeFile(skill, options.skillText ?? skillText);
  const localExtensionPath = join(dir, "workflow-models.ts");
  await writeFile(localExtensionPath, await readFile(extensionPath, "utf8"));
  const eventBus = createEventBus();
  const loaded = await loadExtensions([localExtensionPath], dir, eventBus);
  assert.deepEqual(loaded.errors, []);
  const tools = loaded.extensions[0].tools;
  const runtime = loaded.runtime;
  const models = options.models ?? structuredClone(defaultModels);
  const virtual = model("workflow", 0, 0, { provider: "act-mkt", api: "pi-virtual" });
  const original = models.find(m => m.id === "routine") ?? models[0];
  let current = original;
  let thinking = "medium";
  let branch = [];
  const switches = [];
  const calls = [];
  const settings = { defaultProvider: "fixture", defaultModel: "default", defaultThinkingLevel: "medium",
    ...options.settings };
  runtime.getSettings = () => ({ ...settings });
  runtime.getThinkingLevel = () => thinking;
  runtime.setThinkingLevel = level => { thinking = level; };
  runtime.setModel = async m => { switches.push(m.id); if (options.rejectSwitch) return false; current = m; return true; };
  runtime.appendEntry = (customType, data) => { branch.push({ type: "custom", customType, data }); };
  const ctx = {
    cwd: dir,
    get model() { return current; },
    sessionManager: { getBranch: () => branch },
    modelRegistry: {
      find: (provider, id) => [...models, virtual].find(m => m.provider === provider && m.id === id),
      getAvailable: () => [...(options.availableModels ?? models), virtual],
      hasConfiguredAuth: m => !(options.noAuth ?? []).includes(m.id),
      getApiKeyAndHeaders: async m => ({ ok: !(options.noAuth ?? []).includes(m.id) }),
      streamSimple: (m, context, streamOptions) => {
        calls.push({ model: m, context, options: streamOptions });
        return { result: async () => {
          if (options.providerThrows) throw new Error("secret-provider-error");
          if (options.onResponse) await options.onResponse();
          return { role: "assistant", provider: m.provider, model: m.id, api: m.api, timestamp: Date.now(),
            stopReason: options.stopReason ?? "stop", errorMessage: "secret-provider-message",
            content: [{ type: "text", text: options.raw ?? JSON.stringify(options.decision ?? decision()) }], usage };
        } };
      },
    },
  };
  runtime.createContext = () => ctx;
  async function run(name, params, signal) {
    const tool = tools.get(name)?.definition;
    assert.ok(tool, `Missing tool: ${name}`);
    return tool.execute("test", params, signal, () => {}, ctx);
  }
  return { run, runtime, loaded, eventBus, ctx, skill, calls, switches, settings, models,
    extensionPath: localExtensionPath,
    select: (params = {}, signal) => run("workflow_select_model", { skill, stage: "intake", task: "Retrieve the issue", ...params }, signal),
    get branch() { return branch; }, set branch(value) { branch = value; },
    get current() { return current; }, set current(value) { current = value; },
    get thinking() { return thinking; } };
}
function failed(f, result, message) {
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, message);
  assert.deepEqual(f.switches, []);
  assert.deepEqual(f.branch, []);
  assert.equal(f.current.id, "routine");
}

test("default selector receives full skill and sanitized available catalog, then routes on the next request", async t => {
  const f = await fixture(t);
  const result = await f.select();
  assert.equal(result.isError, undefined);
  assert.equal(result.details.model, "fixture/small");
  assert.equal(result.details.selector, "fixture/default");
  assert.deepEqual(result.usage, usage);
  assert.equal(f.calls[0].model.id, "default");
  const prompt = f.calls[0].context.messages[0].content;
  assert.ok(prompt.includes(skillText));
  assert.ok(!prompt.includes("example.invalid"));
  assert.ok(!prompt.includes('"apiKey"'));
  assert.ok(!prompt.includes('"model":"act-mkt/workflow"'));
  assert.equal(f.current.provider, "act-mkt");
  const route = f.runtime.pendingVirtualModelRegistrations[0].definition;
  const routed = await route.route({ reason: "continuation" });
  assert.equal(routed.model.id, "small");
  assert.equal(routed.thinkingLevel, "low");
  assert.deepEqual(f.settings, { defaultProvider: "fixture", defaultModel: "default", defaultThinkingLevel: "medium" });
});

test("free-form model and thinking guidance is interpreted by the selector, not an enum", async t => {
  const customSkill = skillText.replace("cheap/fast | low", "Thorough cross-service reasoning; choose for accuracy, not price | Think deeply as needed");
  const f = await fixture(t, { skillText: customSkill, decision: decision({ model: "fixture/strong", thinking: "high" }) });
  const result = await f.select();
  assert.equal(result.isError, undefined);
  assert.equal(result.details.model, "fixture/strong");
  assert.equal(result.details.requestedThinking, "high");
  assert.ok(f.calls[0].context.messages[0].content.includes(customSkill));
});

test("code honors the chosen model instead of replacing it with a cheaper catalog model", async t => {
  const f = await fixture(t, { decision: decision({ model: "fixture/strong", thinking: "high",
    reason: "Accuracy is required; the cheaper model is not appropriate." }) });
  const result = await f.select();
  assert.equal(result.details.model, "fixture/strong");
  assert.equal(result.details.reason, "Accuracy is required; the cheaper model is not appropriate.");
  const route = f.runtime.pendingVirtualModelRegistrations[0].definition;
  assert.equal((await route.route({ reason: "continuation" })).model.id, "strong");
});

for (const [name, cost] of [
  ["zero-priced", { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }],
  ["unpriced", undefined],
  ["context-priced", { input: 1, output: 1, tiers: [{ inputTokensAbove: 1000, input: 2, output: 3 }] }],
]) {
  test(`selector can choose a ${name} candidate without a code-level price filter`, async t => {
    const models = structuredClone(defaultModels);
    models[4].cost = cost;
    const f = await fixture(t, { models, decision: decision({ model: "fixture/unknown" }) });
    assert.equal((await f.select()).details.model, "fixture/unknown");
  });
}

test("a newly configured catalog model needs no policy entry or tier classification", async t => {
  const models = [...structuredClone(defaultModels), model("newly-pushed", 3, 7)];
  const f = await fixture(t, { models, decision: decision({ model: "fixture/newly-pushed" }) });
  assert.equal((await f.select()).details.model, "fixture/newly-pushed");
});

test("uses default again on subsequent stage selection and restores the original model", async t => {
  const f = await fixture(t);
  await f.select();
  await f.select();
  assert.deepEqual(f.calls.map(c => c.model.id), ["default", "default"]);
  await f.run("workflow_finish", {});
  assert.equal(f.current.id, "routine");
  assert.equal(f.thinking, "medium");
  assert.equal(f.branch.at(-1).data.active, false);
});

test("clamps unsupported target effort without changing stage effort", async t => {
  const models = structuredClone(defaultModels);
  models[1].thinkingLevelMap = { low: null, medium: "medium" };
  const f = await fixture(t, { models });
  const result = await f.select();
  assert.equal(result.details.requestedThinking, "low");
  assert.equal(result.details.effectiveThinking, "medium");
});

test("selector interprets stage guidance without mandatory Model or Thinking columns", async t => {
  const f = await fixture(t, { skillText: "# Workflow\n| Stage | Guidance |\n| --- | --- |\n| intake | Choose a model for this task |\n" });
  assert.equal((await f.select()).details.model, "fixture/small");
});

for (const [name, change, pattern] of [
  ["invalid JSON", () => ({ raw: "secret-invalid-json" }), /JSON/],
  ["truncated answer", () => ({ stopReason: "length" }), /complete/],
  ["provider failure", () => ({ providerThrows: true }), /Selector request failed/],
  ["error answer", () => ({ stopReason: "error" }), /Selector request failed/],
  ["missing default", () => ({ settings: { defaultModel: undefined } }), /default/],
  ["virtual default", () => ({ settings: { defaultProvider: "act-mkt", defaultModel: "workflow" } }), /physical/],
  ["unknown default", () => ({ settings: { defaultModel: "absent" } }), /catalog/],
  ["unavailable default credentials", () => ({ noAuth: ["default"] }), /credentials/],
  ["unavailable target credentials", () => ({ noAuth: ["small"] }), /credentials|eligible/],
  ["unknown output identity", () => ({ decision: decision({ model: "fixture/invented" }) }), /catalog|available/],
  ["virtual output identity", () => ({ decision: decision({ model: "act-mkt/workflow" }) }), /catalog|available|physical/],
  ["unavailable output identity", () => ({ availableModels: defaultModels.slice(2) }), /catalog|available/],
  ["missing chosen model", () => ({ decision: decision({ model: undefined }) }), /model|selection/],
  ["invalid chosen thinking level", () => ({ decision: decision({ thinking: "think really hard" }) }), /thinking|effort/],
  ["empty rationale", () => ({ decision: decision({ reason: "" }) }), /rationale/],
]) {
  test(`rejects ${name} without changing selection or leaking raw errors`, async t => {
    const f = await fixture(t, change());
    const result = await f.select();
    failed(f, result, pattern);
    assert.ok(!JSON.stringify(result).includes("secret-"));
  });
}

test("selector may report no suitable model without code falling back to the default", async t => {
  const f = await fixture(t, { decision: decision({ model: null, reason: "No available model meets the requirements." }) });
  failed(f, await f.select(), /suitable/);
});

test("missing skill and absent stage fail before a selector request", async t => {
  const f = await fixture(t);
  failed(f, await f.select({ skill: join(tmpdir(), "absent-workflow-skill.md") }), /skill/i);
  failed(f, await f.select({ stage: "absent" }), /stage/i);
  assert.equal(f.calls.length, 0);
});

test("cancellation before and during selection leaves the session untouched", async t => {
  const controller = new AbortController();
  const f = await fixture(t, { onResponse: () => controller.abort() });
  failed(f, await f.select({}, controller.signal), /cancel/i);
  assert.equal(f.calls[0].options.signal, controller.signal);
  failed(f, await f.select({}, controller.signal), /cancel/i);
  assert.equal(f.calls.length, 1);
});

test("manual selection remains compatible and branch navigation does not reuse another branch target", async t => {
  const f = await fixture(t);
  await f.run("workflow_set_model", { model: "fixture/small", thinking: "low" });
  const saved = f.branch;
  f.branch = [];
  const route = f.runtime.pendingVirtualModelRegistrations[0].definition;
  await assert.rejects(route.route({ reason: "continuation" }), /Select|selection/);
  f.branch = saved;
  assert.equal((await route.route({ reason: "continuation" })).model.id, "small");
  f.current = f.models[0];
  await f.run("workflow_finish", {});
  assert.equal(f.current.id, "default");
});

test("empty available catalog fails closed", async t => {
  const empty = await fixture(t, { availableModels: [] });
  failed(empty, await empty.select(), /available/);
  assert.equal(empty.calls.length, 0);
});

test("a failed subsequent selection preserves the existing workflow state and accounts selector usage", async t => {
  const options = {};
  const f = await fixture(t, options);
  await f.select();
  const before = structuredClone(f.branch);
  options.raw = "not json";
  const result = await f.select();
  assert.equal(result.isError, true);
  assert.deepEqual(f.branch, before);
  assert.equal(f.current.id, "workflow");
  assert.deepEqual(result.usage, usage);
});

test("does not overwrite a user model change while the selector is running", async t => {
  const options = {};
  const f = await fixture(t, options);
  options.onResponse = () => { f.current = f.models[0]; };
  const result = await f.select();
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /changed/);
  assert.equal(f.current.id, "default");
  assert.deepEqual(f.branch, []);
  assert.deepEqual(f.switches, []);
});

test("does not apply a decision to a branch changed while the selector is running", async t => {
  const options = {};
  const f = await fixture(t, options);
  options.onResponse = () => { f.branch = [{ type: "custom", customType: "other-branch", data: {} }]; };
  const result = await f.select();
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /changed/);
  assert.equal(f.current.id, "routine");
  assert.equal(f.branch.length, 1);
});

test("failed virtual selection does not record a new target", async t => {
  const f = await fixture(t, { rejectSwitch: true });
  const result = await f.select();
  assert.equal(result.isError, true);
  assert.equal(f.current.id, "routine");
  assert.deepEqual(f.branch, []);
});

test("actual loader registers once even when extension is included twice", async t => {
  const f = await fixture(t);
  assert.ok(f.loaded.extensions[0].tools.has("workflow_select_model"));
  const again = await loadExtensions([f.extensionPath], f.ctx.cwd, f.eventBus, f.runtime);
  assert.deepEqual(again.errors, []);
  assert.equal(again.extensions[0].tools.size, 0);
  assert.equal(f.runtime.pendingVirtualModelRegistrations.length, 1);
});

test("switching stages routes the next requests without changing global defaults or terminating the workflow", async t => {
  const options = {};
  const f = await fixture(t, options);
  const first = await f.select();
  assert.notEqual(first.terminate, true);
  options.decision = decision({ model: "fixture/strong", thinking: "high", reason: "This stage needs careful review." });
  const second = await f.select({ stage: "plan" });
  assert.notEqual(second.terminate, true);
  const route = f.runtime.pendingVirtualModelRegistrations[0].definition;
  const routed = await route.route({ reason: "continuation" });
  assert.equal(routed.model.id, "strong");
  assert.equal(routed.thinkingLevel, "high");
  await f.run("workflow_finish", {});
  assert.equal(f.current.id, "routine");
  assert.equal(f.thinking, "medium");
  assert.deepEqual(f.settings, { defaultProvider: "fixture", defaultModel: "default", defaultThinkingLevel: "medium" });
});
