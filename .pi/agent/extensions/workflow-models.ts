// Personal Pi runtime extension.
// Skills define stage requirements; the configured default assesses catalog candidates.
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, resolve } from "node:path";
import { clampThinkingLevel, getSupportedThinkingLevels, Type, type Api, type Model, type ModelThinkingLevel, type Usage } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const PROVIDER = "act-mkt";
const MODEL = "workflow";
const STATE = "act-mkt.workflow-model";
const CLAIM = "act-mkt.workflow-model-registration";
const LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const;

type Selection = { provider: string; id: string; thinking: ModelThinkingLevel };
type WorkflowState = { version: 1; active: true; target: Selection; original: Selection; selection?: Record<string, unknown> };
class SelectionError extends Error {}
function fail(message: string): never { throw new SelectionError(message); }
function cancelled(signal?: AbortSignal) {
  if (signal?.aborted) fail("Workflow selection was cancelled.");
}

// Validate the stage identity only. Model and thinking guidance remain free-form input to the selector.
function validateStage(skill: string, stage: string) {
  const rows = skill.split(/\r?\n/).filter(line => line.trim().startsWith("|"))
    .map(line => line.trim().slice(1, -1).split("|").map(cell => cell.trim()));
  const header = rows.find(row => row.includes("Stage"));
  if (!header) fail("The skill has no supported stage table.");
  const matches = rows.filter(row => row[header.indexOf("Stage")] === stage);
  if (matches.length !== 1) fail("The requested stage must exist exactly once in the skill table.");
}

const SELECTOR_PROMPT = `You select a model for a workflow, not execute its work. You have no tools.
All supplied catalog models are authorized by the user; do not impose a flagship exclusion.
Interpret the complete skill, requested stage, and task. Model and thinking guidance is natural language, not a fixed tier taxonomy.
Use your judgment to choose the best suitable available model and thinking level, following the skill's capability, cost, and escalation requirements.
Consider the entire catalog. Prices are evidence, not capability labels; missing or zero prices do not necessarily mean free inference.
You make the final model choice. Code only validates and routes it; it will not re-rank candidates, substitute a cheaper model, or enforce tier labels.
Choose an exact model identity from the supplied catalog, never an invented ID or a virtual router. Do not inherit the default just because it is the default.
Use a valid Pi thinking level (${LEVELS.join(", ")}), preferably one the selected model supports. Interpret free-form thinking guidance yourself.
If no available model can meet the requirements, return model null instead of guessing a fallback.
Return ONLY JSON (no Markdown) with this shape:
{"model":"exact provider/id or null","thinking":"supported Pi thinking level","reason":"brief decision rationale"}
Use JSON null, not the string "null", when no model is suitable.`;

function validateChoice(text: string, models: Model<Api>[]) {
  let answer;
  try { answer = JSON.parse(text); } catch { fail("Selector returned invalid JSON; no selection changed."); }
  if (!answer || typeof answer !== "object" || Array.isArray(answer)
      || typeof answer.reason !== "string" || !answer.reason.trim() || answer.reason.length > 4000) {
    fail("Selector must return a model selection with a bounded decision rationale.");
  }
  if (answer.model === null) fail("Selector found no suitable model; no selection changed.");
  if (typeof answer.model !== "string") fail("Selector must return a model identity from the available catalog.");
  if (!LEVELS.includes(answer.thinking)) fail("Selector returned an invalid thinking level.");
  const model = models.find(candidate => `${candidate.provider}/${candidate.id}` === answer.model);
  if (!model || model.api === "pi-virtual" || !model.input.includes("text")) {
    fail("Selector chose a model outside the available physical text catalog.");
  }
  return { model, thinking: answer.thinking as ModelThinkingLevel, reason: answer.reason };
}

function activeState(ctx: ExtensionContext): WorkflowState | undefined {
  const branch = ctx.sessionManager.getBranch();
  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = branch[i];
    if (entry.type !== "custom" || entry.customType !== STATE) continue;
    const state = entry.data as WorkflowState | { version: 1; active: false };
    return state?.version === 1 && state.active ? state : undefined;
  }
  return undefined;
}

function isWorkflow(model: ExtensionContext["model"]): boolean {
  return model?.provider === PROVIDER && model.id === MODEL;
}

async function physicalModel(ctx: ExtensionContext, provider: string, id: string) {
  const model = ctx.modelRegistry.find(provider, id);
  if (!model) fail(`Model is not in the catalog: ${provider}/${id}`);
  if (model.api === "pi-virtual") fail("Workflow routing requires a physical model, not a virtual model.");
  if (!ctx.modelRegistry.hasConfiguredAuth(model) || !(await ctx.modelRegistry.getApiKeyAndHeaders(model)).ok) {
    fail(`Model credentials are unavailable: ${provider}/${id}`);
  }
  return model;
}

async function activate(pi: ExtensionAPI, ctx: ExtensionContext, target: Model<Api>, thinking: ModelThinkingLevel,
    signal?: AbortSignal, selection?: Record<string, unknown>) {
  cancelled(signal);
  if (!ctx.model) fail("No current model selection to restore.");
  const previous = activeState(ctx);
  if (isWorkflow(ctx.model) && !previous) fail("The current workflow model has no saved original selection.");
  const original = isWorkflow(ctx.model) && previous ? previous.original : {
    provider: ctx.model.provider, id: ctx.model.id, thinking: pi.getThinkingLevel(),
  };
  const state: WorkflowState = { version: 1, active: true, original,
    target: { provider: target.provider, id: target.id, thinking }, ...(selection ? { selection } : {}) };
  if (!isWorkflow(ctx.model)) {
    const virtual = ctx.modelRegistry.find(PROVIDER, MODEL);
    if (!virtual || !(await pi.setModel(virtual))) fail("Unable to select the workflow virtual model.");
  }
  // Branch entries survive compaction and codemode's nested tool calls.
  pi.appendEntry(STATE, state);
  const model = `${target.provider}/${target.id}`;
  const effectiveThinking = clampThinkingLevel(target, thinking);
  return {
    content: [{ type: "text" as const, text: `Next model request: ${model}\nRequested thinking: ${thinking}\nEffective thinking: ${effectiveThinking}\nContinue stage work automatically in the next model request, not in this tool batch. Do not ask the user to resume. Pause only for required human annotation/approval or a genuine blocker.` }],
    details: { workflowModel: state, model, requestedThinking: thinking, effectiveThinking },
  };
}

export default function (pi: ExtensionAPI) {
  // Pi's shared event bus is scoped to the extension runtime, including reload cleanup.
  // Loading this extension more than once must not register competing tools or routes.
  const claim = { registered: false };
  pi.events.emit(CLAIM, claim);
  if (claim.registered) return;
  pi.events.on(CLAIM, (data) => { (data as typeof claim).registered = true; });

  pi.registerVirtualModel({
    provider: PROVIDER,
    id: MODEL,
    name: "Workflow (skill-selected)",
    thinkingLevels: LEVELS,
    async route(_request, ctx) {
      // Read the active branch, not process-global state or a possibly compacted transcript.
      const state = activeState(ctx);
      if (!state) throw new Error("Select a physical model with workflow_set_model before using act-mkt/workflow.");
      const model = await physicalModel(ctx, state.target.provider, state.target.id);
      return { model, thinkingLevel: state.target.thinking };
    },
  });

  pi.registerTool({
    name: "workflow_select_model",
    label: "Select model for skill stage",
    description: "Use before each skill stage to ask the configured default model to select a suitable available model from the skill's actual requirements. Supply the SKILL.md path, stage and task/complexity evidence, not a model ID. Interpret the skill's free-form requirements and let the configured default choose the model and thinking level. Call this alone; continue stage work automatically in the next model request without ending the workflow or asking the user to continue. Pause only for required human annotation/approval or a genuine blocker. Selection does not approve plans or authorize publication; global defaults are unchanged.",
    parameters: Type.Object({
      skill: Type.String({ minLength: 1, maxLength: 4096, description: "Path to the actual SKILL.md file (absolute, cwd-relative or ~/)." }),
      stage: Type.String({ minLength: 1, maxLength: 128, description: "Exact stage name in the skill's stage table." }),
      task: Type.String({ minLength: 1, maxLength: 8000, description: "Bounded task description, including demonstrated complexity or failed attempts if requesting escalation." }),
    }),
    async execute(_id, params, signal, _update, ctx) {
      let usage: Usage | undefined;
      let selector: string | undefined;
      try {
        cancelled(signal);
        const initialModel = ctx.model && `${ctx.model.provider}/${ctx.model.id}`;
        const initialBranchTip = ctx.sessionManager.getBranch().at(-1);
        const initialThinking = pi.getThinkingLevel();
        if (typeof params.skill !== "string" || !params.skill || params.skill.length > 4096
            || typeof params.stage !== "string" || !params.stage.trim() || params.stage.length > 128
            || typeof params.task !== "string" || !params.task.trim() || params.task.length > 8000) {
          fail("Supply a bounded skill path, stage and task.");
        }
        const path = resolve(ctx.cwd, params.skill.startsWith("~/") ? resolve(homedir(), params.skill.slice(2)) : params.skill);
        if (basename(path) !== "SKILL.md") fail("The skill path must name SKILL.md.");
        let skill;
        try { skill = await readFile(path, "utf8"); } catch { fail("Unable to read the requested skill file."); }
        if (skill.length > 128_000) fail("Skill file exceeds the selector input limit; it was not truncated.");
        validateStage(skill, params.stage);
        const settings = pi.getSettings();
        if (!settings.defaultProvider || !settings.defaultModel) fail("Configure an explicit default provider and model for the selector.");
        const defaultModel = await physicalModel(ctx, settings.defaultProvider, settings.defaultModel);
        selector = `${defaultModel.provider}/${defaultModel.id}`;
        const models = ctx.modelRegistry.getAvailable().filter(model => model.api !== "pi-virtual" && model.input.includes("text"));
        if (!models.length) fail("No available physical text models in the catalog.");
        const catalog = models.map(model => ({ model: `${model.provider}/${model.id}`, name: model.name,
          reasoning: model.reasoning, input: model.input, contextWindow: model.contextWindow, maxTokens: model.maxTokens,
          thinking: getSupportedThinkingLevels(model), cost: model.cost }));
        cancelled(signal);
        const effort = clampThinkingLevel(defaultModel, settings.defaultThinkingLevel ?? "medium");
        let response;
        try {
          response = await ctx.modelRegistry.streamSimple(defaultModel, {
            systemPrompt: SELECTOR_PROMPT,
            messages: [{ role: "user", timestamp: Date.now(), content: `Skill requirements (complete):\n${skill}\n\nStage: ${params.stage}\nTask: ${params.task}\nCatalog:\n${JSON.stringify(catalog)}` }],
          }, { signal, reasoning: effort === "off" ? undefined : effort,
            maxTokens: Math.min(defaultModel.maxTokens, 4096) }).result();
        } catch { fail("Selector request failed; no workflow selection changed."); }
        usage = response.usage;
        cancelled(signal);
        if (response.stopReason === "error" || response.stopReason === "aborted") fail("Selector request failed; no workflow selection changed.");
        if (response.stopReason !== "stop") fail("Selector must return a complete JSON answer; no selection changed.");
        const text = response.content.filter(block => block.type === "text").map(block => block.text).join("");
        const choice = validateChoice(text, models);
        const target = await physicalModel(ctx, choice.model.provider, choice.model.id);
        // A nested request may take time; never overwrite a newer user selection or branch.
        if ((ctx.model && `${ctx.model.provider}/${ctx.model.id}`) !== initialModel
            || ctx.sessionManager.getBranch().at(-1) !== initialBranchTip || pi.getThinkingLevel() !== initialThinking) {
          fail("Session model, thinking or branch changed during selection; request a fresh decision.");
        }
        const { model: _model, thinking, ...audit } = choice;
        const selection = { skill: path, stage: params.stage, selector, ...audit };
        const result = await activate(pi, ctx, target, thinking, signal, selection);
        return { ...result, usage,
          content: [...result.content, { type: "text" as const, text: `Selector: ${selector}\nReason: ${choice.reason}` }],
          details: { ...result.details, ...selection } };
      } catch (error) {
        return { isError: true, usage, content: [{ type: "text" as const,
          text: error instanceof SelectionError ? error.message : "Workflow model selection failed; no new target was recorded." }],
          details: { selector } };
      }
    },
  });

  pi.registerTool({
    name: "workflow_set_model",
    label: "Select workflow model",
    description: "Manually select an exact provider/model-id and thinking level. Prefer workflow_select_model for skill stages: this manual override does not enforce skill tier, price or non-flagship policy. Call this alone, then wait for the next model request before stage work. It does not authorize actions or change global defaults.",
    parameters: Type.Object({
      model: Type.String({ description: "Exact provider/model-id for an explicit manual override." }),
      thinking: Type.Union(LEVELS.map(level => Type.Literal(level))),
    }),
    async execute(_id, params, signal, _update, ctx) {
      const match = /^([^/\s]+)\/(\S+)$/.exec(params.model);
      if (!match) throw new Error("Expected an exact provider/model-id without whitespace.");
      if (!LEVELS.includes(params.thinking)) throw new Error("Invalid Pi thinking level.");
      const target = await physicalModel(ctx, match[1], match[2]);
      return activate(pi, ctx, target, params.thinking, signal);
    },
  });

  pi.registerTool({
    name: "workflow_finish",
    label: "Finish workflow routing",
    description: "Restore the model and thinking selection saved before workflow routing, without ending the session or changing global defaults. Call after the workflow is done, not at an approval pause.",
    parameters: Type.Object({}),
    async execute(_id, _params, signal, _update, ctx) {
      const state = activeState(ctx);
      if (!state) return { content: [{ type: "text", text: "No active workflow routing to restore." }], details: {} };
      // Do not overwrite an explicit model change made by the user outside the workflow.
      if (isWorkflow(ctx.model)) {
        const original = ctx.modelRegistry.find(state.original.provider, state.original.id);
        if (!original || !ctx.modelRegistry.hasConfiguredAuth(original)) throw new Error("The original model selection is unavailable; workflow routing is retained.");
        if (signal?.aborted) throw new Error("Workflow restoration was cancelled.");
        if (!(await pi.setModel(original))) throw new Error("Unable to restore the original model selection.");
        pi.setThinkingLevel(state.original.thinking);
      }
      pi.appendEntry(STATE, { version: 1, active: false });
      return {
        content: [{ type: "text", text: "Workflow routing finished. The session remains open; global defaults are unchanged." }],
        details: { workflowModel: { version: 1, active: false } },
      };
    },
  });
}
