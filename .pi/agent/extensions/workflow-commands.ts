import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const PLANNOTATOR_REQUEST_CHANNEL = "plannotator:request";
const PLANNOTATOR_TIMEOUT_MS = 5_000;

type PlannotatorPhase = "idle" | "planning" | "executing";
type PlannotatorMode = "enter" | "status";
type PlannotatorResponse =
  | { status: "handled"; result: { phase: PlannotatorPhase } }
  | { status: "unavailable"; error?: string }
  | { status: "error"; error: string };

type WorkflowSpec = {
  description: string;
  inputLabel: string;
  template: string;
  validate?: (input: string) => boolean;
};

const workflows: Record<string, WorkflowSpec> = {
  ticket: {
    description: "Plan and implement or investigate a Jira ticket",
    inputLabel: "Jira issue ID or URL",
    template: "jira-ticket.md",
  },
  "mr-review": {
    description: "Review a GitLab merge request, approve comments, then post",
    inputLabel: "GitLab merge request URL",
    template: "gitlab-mr-review.md",
    validate: isGitLabMergeRequestUrl,
  },
  "mr-comments": {
    description: "Triage unresolved GitLab review comments, then fix or reply",
    inputLabel: "GitLab merge request URL",
    template: "gitlab-mr-comments.md",
    validate: isGitLabMergeRequestUrl,
  },
};

function isGitLabMergeRequestUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      /\/-\/merge_requests\/\d+(?:\/|$)/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function loadWorkflowMessage(spec: WorkflowSpec, input: string): string {
  const templateUrl = new URL(`../workflows/${spec.template}`, import.meta.url);
  const template = readFileSync(templateUrl, "utf8").trim();
  return `${template}\n\nWorkflow input:\n${input}`;
}

function requestPlanMode(pi: ExtensionAPI, mode: PlannotatorMode): Promise<PlannotatorResponse> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (response: PlannotatorResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(response);
    };
    const timeout = setTimeout(
      () => finish({ status: "unavailable", error: "Plannotator request timed out." }),
      PLANNOTATOR_TIMEOUT_MS,
    );

    try {
      pi.events.emit(PLANNOTATOR_REQUEST_CHANNEL, {
        requestId: randomUUID(),
        action: "plan-mode",
        payload: { mode },
        respond: finish,
      });
    } catch (error) {
      finish({
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

function responseError(response: PlannotatorResponse): string {
  if (response.status === "handled") return "";
  return response.error || "Plannotator is unavailable.";
}

export default function registerWorkflowCommands(pi: ExtensionAPI): void {
  for (const [name, spec] of Object.entries(workflows)) {
    pi.registerCommand(name, {
      description: spec.description,
      handler: async (rawInput, context) => {
        const input = rawInput.trim();
        if (!input || (spec.validate && !spec.validate(input))) {
          context.ui.notify(`Usage: /${name} <${spec.inputLabel}>`, "warning");
          return;
        }
        if (!context.isIdle()) {
          context.ui.notify("Agent busy; workflow not started.", "warning");
          return;
        }

        let message: string;
        try {
          message = loadWorkflowMessage(spec, input);
        } catch (error) {
          context.ui.notify(
            `Workflow template unavailable: ${error instanceof Error ? error.message : String(error)}`,
            "error",
          );
          return;
        }

        const current = await requestPlanMode(pi, "status");
        if (current.status !== "handled") {
          context.ui.notify(`Workflow not started: ${responseError(current)}`, "error");
          return;
        }
        if (current.result.phase !== "idle") {
          context.ui.notify("Finish or exit current Plannotator workflow first.", "warning");
          return;
        }

        const entered = await requestPlanMode(pi, "enter");
        if (entered.status !== "handled" || entered.result.phase !== "planning") {
          context.ui.notify(`Workflow not started: ${responseError(entered) || "Plannotator did not enter planning mode."}`, "error");
          return;
        }

        pi.sendUserMessage(message);
      },
    });
  }
}
