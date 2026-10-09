// Personal Pi runtime extension.
// Workflow stages and model choices belong to skills, not to this extension.
import { clampThinkingLevel, Type, type ModelThinkingLevel } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const PROVIDER = "act-mkt";
const MODEL = "workflow";
const STATE = "act-mkt.workflow-model";
const CLAIM = "act-mkt.workflow-model-registration";
const LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const;

type Selection = { provider: string; id: string; thinking: ModelThinkingLevel };
type WorkflowState = { version: 1; active: true; target: Selection; original: Selection };

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
  if (!model) throw new Error(`Model is not in the catalog: ${provider}/${id}`);
  if (model.api === "pi-virtual") throw new Error("Workflow routing requires a physical model, not a virtual model.");
  if (!ctx.modelRegistry.hasConfiguredAuth(model) || !(await ctx.modelRegistry.getApiKeyAndHeaders(model)).ok) {
    throw new Error(`Model credentials are unavailable: ${provider}/${id}`);
  }
  return model;
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
    name: "workflow_set_model",
    label: "Select workflow model",
    description: "Select the exact provider/model-id and thinking level specified by the skill for its next stage, in this same session. Call this alone, then wait for the next model request before stage work. It does not authorize actions or change global defaults.",
    parameters: Type.Object({
      model: Type.String({ description: "Exact provider/model-id from the skill's stage table." }),
      thinking: Type.Union(LEVELS.map(level => Type.Literal(level))),
    }),
    async execute(_id, params, signal, _update, ctx) {
      const match = /^([^/\s]+)\/(\S+)$/.exec(params.model);
      if (!match) throw new Error("Expected an exact provider/model-id without whitespace.");
      if (!LEVELS.includes(params.thinking)) throw new Error("Invalid Pi thinking level.");
      const target = await physicalModel(ctx, match[1], match[2]);
      if (signal?.aborted) throw new Error("Workflow selection was cancelled.");
      if (!ctx.model) throw new Error("No current model selection to restore.");
      const previous = activeState(ctx);
      if (isWorkflow(ctx.model) && !previous) throw new Error("The current workflow model has no saved original selection.");
      const original = isWorkflow(ctx.model) && previous ? previous.original : {
        provider: ctx.model.provider, id: ctx.model.id, thinking: pi.getThinkingLevel(),
      };
      const state: WorkflowState = {
        version: 1, active: true, original,
        target: { provider: target.provider, id: target.id, thinking: params.thinking },
      };
      if (!isWorkflow(ctx.model)) {
        const virtual = ctx.modelRegistry.find(PROVIDER, MODEL);
        if (!virtual || !(await pi.setModel(virtual))) throw new Error("Unable to select the workflow virtual model.");
      }
      // Custom entries also preserve state for tools invoked through codemode, whose nested
      // results are not separate transcript messages. The result carries the same snapshot.
      pi.appendEntry(STATE, state);
      const effectiveThinking = clampThinkingLevel(target, params.thinking);
      return {
        content: [{ type: "text", text: `Next model request: ${params.model}\nRequested thinking: ${params.thinking}\nEffective thinking: ${effectiveThinking}\nSelection applies to the next request; do not perform stage work in this tool batch.` }],
        details: { workflowModel: state, model: params.model, requestedThinking: params.thinking, effectiveThinking },
      };
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
