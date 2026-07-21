import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import registerWorkflowCommands from "../extensions/workflow-commands.ts";

type Command = {
  handler: (args: string, context: TestContext) => Promise<void>;
};

type TestContext = {
  isIdle: () => boolean;
  ui: {
    notify: (message: string, level?: string) => void;
  };
};

function createHarness(initialPhase: "idle" | "planning" | "executing" = "idle") {
  const commands = new Map<string, Command>();
  const notices: Array<{ message: string; level?: string }> = [];
  const sentMessages: string[] = [];
  const requestedModes: string[] = [];
  let phase = initialPhase;

  const pi = {
    events: {
      emit: (_channel: string, request: {
        payload: { mode: "enter" | "status" };
        respond: (response: unknown) => void;
      }) => {
        requestedModes.push(request.payload.mode);
        if (request.payload.mode === "enter" && phase === "idle") phase = "planning";
        request.respond({ status: "handled", result: { phase } });
      },
    },
    registerCommand: (name: string, command: Command) => {
      commands.set(name, command);
    },
    sendUserMessage: (message: string) => {
      sentMessages.push(message);
    },
  };

  registerWorkflowCommands(pi as never);

  const context: TestContext = {
    isIdle: () => true,
    ui: {
      notify: (message, level) => notices.push({ message, level }),
    },
  };

  return { commands, context, notices, requestedModes, sentMessages };
}

test("registers three exclusive workflow commands", () => {
  const { commands } = createHarness();

  assert.deepEqual([...commands.keys()].sort(), ["mr-comments", "mr-review", "ticket"]);
});

test("ticket enters Plannotator before starting workflow", async () => {
  const { commands, context, requestedModes, sentMessages } = createHarness();

  await commands.get("ticket")!.handler("ABC-123", context);

  assert.deepEqual(requestedModes, ["status", "enter"]);
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0]!, /Workflow: jira-ticket/);
  assert.match(sentMessages[0]!, /ABC-123/);
});

test("GitLab commands start their distinct workflows", async () => {
  const mergeRequestUrl = "https://gitlab.example.test/group/project/-/merge_requests/42";

  for (const [commandName, workflowName] of [
    ["mr-review", "gitlab-mr-review"],
    ["mr-comments", "gitlab-mr-comments"],
  ] as const) {
    const { commands, context, requestedModes, sentMessages } = createHarness();

    await commands.get(commandName)!.handler(mergeRequestUrl, context);

    assert.deepEqual(requestedModes, ["status", "enter"]);
    assert.equal(sentMessages.length, 1);
    assert.match(sentMessages[0]!, new RegExp(`Workflow: ${workflowName}`));
    assert.match(sentMessages[0]!, /gitlab\.example\.test/);
  }
});

test("refuses to mix workflows in an active Plannotator session", async () => {
  const { commands, context, notices, requestedModes, sentMessages } = createHarness("planning");

  await commands.get("ticket")!.handler("ABC-123", context);

  assert.deepEqual(requestedModes, ["status"]);
  assert.equal(sentMessages.length, 0);
  assert.match(notices[0]!.message, /current Plannotator workflow/i);
});

test("requires a GitLab merge request URL", async () => {
  const { commands, context, notices, requestedModes, sentMessages } = createHarness();

  await commands.get("mr-review")!.handler("not-a-url", context);

  assert.deepEqual(requestedModes, []);
  assert.equal(sentMessages.length, 0);
  assert.match(notices[0]!.message, /GitLab merge request URL/);
});

test("Plannotator plan contract persists route and executable checklist", () => {
  const config = JSON.parse(readFileSync(new URL("../plannotator.json", import.meta.url), "utf8"));
  const planningPrompt = config.phases.planning.systemPrompt as string;
  const executionPrompt = config.phases.executing.systemPrompt as string;

  assert.match(planningPrompt, /First plan line must be exactly one allowed marker/);
  assert.match(planningPrompt, /kickoff message's first line exactly equals/);
  assert.match(planningPrompt, /quoted or mentioned anywhere else.*does not select a route/);
  assert.match(planningPrompt, /Workflow: general/);
  assert.match(planningPrompt, /at least one standard unchecked markdown task item/);
  assert.match(planningPrompt, /read-only or no-action outcome still needs one item/);
  assert.match(executionPrompt, /Workflow: general follows the approved plan/);
});
