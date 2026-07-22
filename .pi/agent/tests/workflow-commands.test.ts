import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import test from "node:test";

import registerWorkflowCommands from "../extensions/workflow-commands.ts";

type Command = {
  handler: (args: string, context: TestContext) => Promise<void>;
};

type TestContext = {
  cwd: string;
  isIdle: () => boolean;
  sessionManager: {
    getBranch: () => SessionEntry[];
  };
  ui: {
    notify: (message: string, level?: string) => void;
  };
};

type SessionEntry = {
  type: "custom";
  customType: string;
  data?: unknown;
};

type PlannotatorPhase = "idle" | "planning" | "executing";
type PlannotatorMode = "enter" | "exit" | "status";
type InputSource = "interactive" | "rpc" | "extension";
type InputResult =
  | { action: "continue" }
  | { action: "handled" }
  | { action: "transform"; text: string; images?: unknown[] };
type InputHandler = (
  event: {
    text: string;
    images?: unknown[];
    source: InputSource;
    streamingBehavior?: "steer" | "followUp";
  },
  context: TestContext,
) => Promise<InputResult> | InputResult;
type SessionHandler = (event: { reason: string }, context: TestContext) => Promise<void> | void;
type AgentSettledHandler = (event: Record<string, never>, context: TestContext) => Promise<void> | void;
type ToolCallHandler = (
  event: { toolCallId: string; toolName: string; input: Record<string, unknown> },
  context: TestContext,
) => Promise<{ block: true; reason: string } | void> | { block: true; reason: string } | void;
type ToolResultHandler = (
  event: {
    toolCallId: string;
    toolName: string;
    input: Record<string, unknown>;
    details?: Record<string, unknown>;
  },
  context: TestContext,
) => Promise<void> | void;

const workerVerification = [
  { id: "focused-tests", command: "node --test focused.test.ts", timeoutMs: 120_000 },
];
const reviewerVerification = [
  { id: "full-tests", command: "node --test", timeoutMs: 600_000 },
  { id: "format", command: "prettier --check .", timeoutMs: 120_000 },
  { id: "lint", command: "eslint .", timeoutMs: 120_000 },
];

function codePlan(cwd = process.cwd(), marker = "local-work"): string {
  return `Workflow: ${marker}

## Implementation plan
- [ ] Implement

## Verification contract
\`\`\`json
${JSON.stringify({ cwd, worker: workerVerification, reviewer: reviewerVerification }, null, 2)}
\`\`\`
`;
}

function readOnlyPlan(marker: string): string {
  return `Workflow: ${marker}

## Implementation plan
- [ ] Revalidate and report

## Verification contract
Not applicable - read-only plan.
`;
}

function writePlan(cwd: string, name: string, content: string): string {
  const directory = join(cwd, ".plannotator");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, name), content);
  return `.plannotator/${name}`;
}

function verifiedAcceptance(verify: typeof workerVerification | typeof reviewerVerification) {
  return {
    level: "verified",
    verify: verify.map((command) => ({ ...command })),
  };
}

function verifiedResult(
  role: "worker" | "reviewer",
  verify: typeof workerVerification | typeof reviewerVerification,
  reviewFindings: string[] = [],
) {
  return {
    mode: "single",
    results: [
      {
        agent: role,
        exitCode: 0,
        acceptance: {
          status: "verified",
          verifyRuns: verify.map((command) => ({
            id: command.id,
            command: command.command,
            status: "passed",
            exitCode: 0,
            durationMs: 1,
          })),
          childReport: role === "reviewer" ? { reviewFindings } : {},
        },
      },
    ],
  };
}

function scoutResult() {
  return {
    mode: "single",
    results: [
      {
        agent: "scout",
        exitCode: 0,
        acceptance: {
          status: "attested",
        },
      },
    ],
  };
}

function createHarness(
  initialPhase: PlannotatorPhase = "idle",
  initialFailingMode?: PlannotatorMode,
  initialEntries: SessionEntry[] = [],
  cwd = process.cwd(),
  runtime?: { sessionKey?: string; worktreeBaseDir?: string },
) {
  try {
    execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      stdio: ["ignore", "ignore", "ignore"],
    });
  } catch {
    execFileSync("git", ["init", "--quiet"], { cwd });
  }

  const commands = new Map<string, Command>();
  const notices: Array<{ message: string; level?: string }> = [];
  const sentMessages: string[] = [];
  const sentUserContents: unknown[] = [];
  const requestedModes: string[] = [];
  const sessionEntries = [...initialEntries];
  let inputHandler: InputHandler | undefined;
  let agentSettledHandler: AgentSettledHandler | undefined;
  let sessionStartHandler: SessionHandler | undefined;
  let sessionTreeHandler: SessionHandler | undefined;
  let toolCallHandler: ToolCallHandler | undefined;
  let toolResultHandler: ToolResultHandler | undefined;
  let failingMode = initialFailingMode;
  let phase = initialPhase;
  let nextToolCall = 0;
  const toolCallIds = new WeakMap<Record<string, unknown>, string>();

  const pi = {
    events: {
      emit: (_channel: string, request: {
        payload: { mode: PlannotatorMode };
        respond: (response: unknown) => void;
      }) => {
        requestedModes.push(request.payload.mode);
        if (request.payload.mode === failingMode) {
          request.respond({ status: "error", error: `${failingMode} failed` });
          return;
        }
        if (request.payload.mode === "enter" && phase === "idle") phase = "planning";
        if (request.payload.mode === "exit" && phase !== "idle") phase = "idle";
        request.respond({ status: "handled", result: { phase } });
      },
    },
    on: (event: string, handler: unknown) => {
      if (event === "input") inputHandler = handler as InputHandler;
      if (event === "agent_settled") agentSettledHandler = handler as AgentSettledHandler;
      if (event === "session_start") sessionStartHandler = handler as SessionHandler;
      if (event === "session_tree") sessionTreeHandler = handler as SessionHandler;
      if (event === "tool_call") toolCallHandler = handler as ToolCallHandler;
      if (event === "tool_result") toolResultHandler = handler as ToolResultHandler;
    },
    appendEntry: (customType: string, data?: unknown) => {
      sessionEntries.push({ type: "custom", customType, data });
    },
    registerCommand: (name: string, command: Command) => {
      commands.set(name, command);
    },
    sendUserMessage: (content: string | Array<{ type: string; text?: string }>) => {
      sentUserContents.push(content);
      sentMessages.push(
        typeof content === "string"
          ? content
          : (content.find((item) => item.type === "text")?.text ?? ""),
      );
    },
  };

  const cwdName = basename(cwd);
  const derivedRuntime = cwdName.startsWith("pi-session-")
    ? { sessionKey: cwdName.slice("pi-session-".length), worktreeBaseDir: dirname(cwd) }
    : undefined;
  registerWorkflowCommands(pi as never, runtime ?? derivedRuntime);

  const context: TestContext = {
    cwd,
    isIdle: () => true,
    sessionManager: {
      getBranch: () => sessionEntries,
    },
    ui: {
      notify: (message, level) => notices.push({ message, level }),
    },
  };

  const routeInput = async (
    text: string,
    source: InputSource = "interactive",
    streamingBehavior?: "steer" | "followUp",
    images?: unknown[],
  ) => {
    assert.ok(inputHandler, "input handler registered");
    return inputHandler({ text, source, streamingBehavior, images }, context);
  };
  const routeToolCall = async (
    toolName: string,
    input: Record<string, unknown>,
    toolCallId = `call-${++nextToolCall}`,
  ) => {
    assert.ok(toolCallHandler, "tool_call handler registered");
    toolCallIds.set(input, toolCallId);
    return toolCallHandler({ toolCallId, toolName, input }, context);
  };
  const routeToolResult = async (
    toolName: string,
    input: Record<string, unknown>,
    details?: Record<string, unknown>,
    toolCallId = toolCallIds.get(input) ?? `orphan-${++nextToolCall}`,
  ) => {
    assert.ok(toolResultHandler, "tool_result handler registered");
    return toolResultHandler({ toolCallId, toolName, input, details }, context);
  };
  const startSession = async (reason = "reload") => {
    assert.ok(sessionStartHandler, "session_start handler registered");
    await sessionStartHandler({ reason }, context);
  };
  const changeTree = async () => {
    assert.ok(sessionTreeHandler, "session_tree handler registered");
    await sessionTreeHandler({ reason: "tree" }, context);
  };
  const settleAgent = async () => {
    assert.ok(agentSettledHandler, "agent_settled handler registered");
    await agentSettledHandler({}, context);
  };

  return {
    changeTree,
    commands,
    context,
    notices,
    requestedModes,
    routeInput,
    routeToolCall,
    routeToolResult,
    sessionEntries,
    sentUserContents,
    sentMessages,
    setFailingMode: (nextMode?: PlannotatorMode) => {
      failingMode = nextMode;
    },
    setPhase: (nextPhase: PlannotatorPhase) => {
      phase = nextPhase;
    },
    settleAgent,
    startSession,
  };
}

async function runPlanningScout(harness: ReturnType<typeof createHarness>) {
  const input = {
    agent: "scout",
    task: "Refresh the bounded repository evidence for this plan iteration",
    context: "fresh",
    cwd: harness.context.cwd,
  };
  assert.equal(await harness.routeToolCall("subagent", input), undefined);
  await harness.routeToolResult("subagent", input, scoutResult());
}

async function approvePlan(
  harness: ReturnType<typeof createHarness>,
  filePath = ".plannotator/plan.md",
) {
  await runPlanningScout(harness);
  const input = { filePath };
  assert.equal(
    await harness.routeToolCall("plannotator_submit_plan", input),
    undefined,
  );
  await harness.routeToolResult(
    "plannotator_submit_plan",
    input,
    { approved: true },
  );
}

async function passCodeGates(harness: ReturnType<typeof createHarness>) {
  const workerInput = {
    agent: "worker",
    task: "Implement the approved change",
    context: "fresh",
    cwd: harness.context.cwd,
    acceptance: verifiedAcceptance(workerVerification),
  };
  assert.equal(await harness.routeToolCall("subagent", workerInput), undefined);
  await harness.routeToolResult(
    "subagent",
    workerInput,
    verifiedResult("worker", workerVerification),
  );
  const reviewerInput = {
    agent: "reviewer",
    task: "Review the complete repository",
    context: "fresh",
    cwd: harness.context.cwd,
    acceptance: verifiedAcceptance(reviewerVerification),
  };
  assert.equal(await harness.routeToolCall("subagent", reviewerInput), undefined);
  await harness.routeToolResult(
    "subagent",
    reviewerInput,
    verifiedResult("reviewer", reviewerVerification),
  );
}

test("registers workflow commands and explicit loop completion", () => {
  const { commands } = createHarness();

  assert.deepEqual([...commands.keys()].sort(), [
    "mr-comments",
    "mr-review",
    "ticket",
    "work",
    "workflow-abort",
    "workflow-done",
    "workflow-retry",
    "workflow-status",
  ]);
});

test("work starts a local plan and implementation loop", async () => {
  const { commands, context, sentMessages } = createHarness();

  await commands.get("work")!.handler("Add deterministic retries", context);

  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0]!, /^Workflow: local-work/);
  assert.match(sentMessages[0]!, /Add deterministic retries/);
});

test("ticket enters Plannotator before starting workflow", async () => {
  const { commands, context, requestedModes, sentMessages } = createHarness();

  await commands.get("ticket")!.handler("ABC-123", context);

  assert.deepEqual(requestedModes, ["status", "enter"]);
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0]!, /Workflow: jira-ticket/);
  assert.match(sentMessages[0]!, /ABC-123/);
  assert.match(sentMessages[0]!, /\/workflow-done/);
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

test("requires workflow-done before replacing an active loop", async () => {
  const { commands, context, notices, requestedModes, sentMessages, setPhase } = createHarness();

  await commands.get("ticket")!.handler("ABC-123", context);
  setPhase("idle");
  await commands
    .get("mr-review")!
    .handler("https://gitlab.example.test/group/project/-/merge_requests/42", context);

  assert.deepEqual(requestedModes, ["status", "enter"]);
  assert.equal(sentMessages.length, 1);
  assert.match(notices.at(-1)!.message, /\/workflow-done/);
});

test("routes every user follow-up through a new planning iteration", async () => {
  const { commands, context, requestedModes, routeInput, setPhase } = createHarness();

  await commands.get("ticket")!.handler("ABC-123", context);
  setPhase("executing");

  const first = await routeInput("A requirement was missed and the full tests fail.");

  assert.equal(first.action, "transform");
  if (first.action !== "transform") assert.fail("follow-up was not transformed");
  assert.match(first.text, /^Workflow: jira-ticket/);
  assert.match(first.text, /Reuse the existing plan file/);
  assert.match(first.text, /new bounded foreground fresh read-only scout/);
  assert.match(first.text, /A requirement was missed and the full tests fail\./);
  assert.deepEqual(requestedModes, ["status", "enter", "status", "exit", "enter"]);

  setPhase("idle");
  const second = await routeInput("The formatter still reports changes.", "rpc");

  assert.equal(second.action, "transform");
  if (second.action !== "transform") assert.fail("second follow-up was not transformed");
  assert.match(second.text, /^Workflow: jira-ticket/);
  assert.match(second.text, /The formatter still reports changes\./);
  assert.deepEqual(requestedModes, [
    "status",
    "enter",
    "status",
    "exit",
    "enter",
    "status",
    "enter",
  ]);
});

test("blocks planning mutations except the plan file", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-planning-"));
  try {
    const harness = createHarness("idle", undefined, [], cwd);
    await harness.commands.get("work")!.handler("Plan a safe change", harness.context);

    const sourceWrite = await harness.routeToolCall("write", {
      path: "src/file.ts",
      content: "mutation",
    });
    assert.equal(sourceWrite?.block, true);
    assert.match(sourceWrite?.reason ?? "", /planning is read-only/i);

    assert.equal(
      await harness.routeToolCall("write", {
        path: ".plannotator/work-plan.md",
        content: "# Plan",
      }),
      undefined,
    );

    writeFileSync(join(cwd, "outside.md"), "outside\n");
    mkdirSync(join(cwd, ".plannotator"), { recursive: true });
    symlinkSync(join(cwd, "outside.md"), join(cwd, ".plannotator", "escape.md"));
    const symlinkWrite = await harness.routeToolCall("write", {
      path: ".plannotator/escape.md",
      content: "escaped mutation",
    });
    assert.equal(symlinkWrite?.block, true);
    assert.match(symlinkWrite?.reason ?? "", /planning is read-only/i);

    const bash = await harness.routeToolCall("bash", { command: "git status --short" });
    assert.equal(bash?.block, true);
    assert.match(bash?.reason ?? "", /use the fresh scout/i);

    for (const toolName of [
      "mcp__tracker__create_issue",
      "mcp__tracker__archive_issue",
      "mcp__wiki__rename_page",
      "mcp__tracker__get_or_create_issue",
      "mcp__tracker__fetch_and_update",
    ]) {
      const remoteWrite = await harness.routeToolCall(toolName, {
        title: "No mutation during planning",
      });
      assert.equal(remoteWrite?.block, true);
      assert.match(remoteWrite?.reason ?? "", /blocked until the current plan is approved/i);
    }

    assert.equal(
      await harness.routeToolCall("mcp__tracker__get_issue", { issue: "EXAMPLE-1" }),
      undefined,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("fails closed on plan path escapes and missing workflow session identity", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-session-"));
  try {
    writeFileSync(join(cwd, "outside-plan.md"), readOnlyPlan("local-work"));

    const outside = createHarness("idle", undefined, [], cwd);
    await outside.commands.get("work")!.handler("Investigate safely", outside.context);
    await runPlanningScout(outside);
    const outsidePlan = await outside.routeToolCall("plannotator_submit_plan", {
      filePath: "outside-plan.md",
    });
    assert.equal(outsidePlan?.block, true);
    assert.match(outsidePlan?.reason ?? "", /markdown beneath \.plannotator/i);

    mkdirSync(join(cwd, ".plannotator"), { recursive: true });
    symlinkSync(join(cwd, "outside-plan.md"), join(cwd, ".plannotator", "linked-plan.md"));
    const linked = createHarness("idle", undefined, [], cwd);
    await linked.commands.get("work")!.handler("Investigate safely", linked.context);
    await runPlanningScout(linked);
    const linkedPlan = await linked.routeToolCall("plannotator_submit_plan", {
      filePath: ".plannotator/linked-plan.md",
    });
    assert.equal(linkedPlan?.block, true);
    assert.match(linkedPlan?.reason ?? "", /symbolic links/i);

    linkSync(join(cwd, "outside-plan.md"), join(cwd, ".plannotator", "hard-plan.md"));
    const hardLinked = createHarness("idle", undefined, [], cwd);
    await hardLinked.commands.get("work")!.handler("Investigate safely", hardLinked.context);
    await runPlanningScout(hardLinked);
    const hardLinkedPlan = await hardLinked.routeToolCall("plannotator_submit_plan", {
      filePath: ".plannotator/hard-plan.md",
    });
    assert.equal(hardLinkedPlan?.block, true);
    assert.match(hardLinkedPlan?.reason ?? "", /hard links/i);

    writePlan(cwd, "code-plan.md", codePlan(cwd));
    const missingIdentity = createHarness(
      "idle",
      undefined,
      [],
      cwd,
      { worktreeBaseDir: dirname(cwd) },
    );
    await missingIdentity.commands.get("work")!.handler("Implement safely", missingIdentity.context);
    await runPlanningScout(missingIdentity);
    const missingIdentityPlan = await missingIdentity.routeToolCall("plannotator_submit_plan", {
      filePath: ".plannotator/code-plan.md",
    });
    assert.equal(missingIdentityPlan?.block, true);
    assert.match(missingIdentityPlan?.reason ?? "", /PI_SUBAGENT_PARENT_SESSION key is unavailable/i);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("preserves each workflow route across follow-up iterations", async () => {
  for (const [commandName, input, marker] of [
    ["ticket", "ABC-123", "jira-ticket"],
    ["mr-review", "https://gitlab.example.test/group/project/-/merge_requests/42", "gitlab-mr-review"],
    ["mr-comments", "https://gitlab.example.test/group/project/-/merge_requests/42", "gitlab-mr-comments"],
  ] as const) {
    const { commands, context, routeInput, setPhase } = createHarness();
    await commands.get(commandName)!.handler(input, context);
    setPhase("executing");

    const result = await routeInput("New requirement.");

    assert.equal(result.action, "transform");
    if (result.action !== "transform") assert.fail(`${commandName} follow-up was not transformed`);
    assert.match(result.text, new RegExp(`^Workflow: ${marker}`));
  }
});

test("requires a new foreground fresh scout before submitting each follow-up plan", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-session-"));
  try {
    writePlan(cwd, "plan.md", readOnlyPlan("local-work"));
    const harness = createHarness("idle", undefined, [], cwd);
    await harness.commands.get("work")!.handler("Investigate the task", harness.context);
    harness.setPhase("executing");
    const followUp = await harness.routeInput("The requirement changed.");
    assert.equal(followUp.action, "transform");

    const beforeScout = await harness.routeToolCall("plannotator_submit_plan", {
      filePath: ".plannotator/plan.md",
    });
    assert.equal(beforeScout?.block, true);
    assert.match(beforeScout?.reason ?? "", /requires one new foreground fresh scout/i);
    await harness.routeToolResult(
      "plannotator_submit_plan",
      { filePath: ".plannotator/plan.md" },
      { approved: true },
      "unsubmitted-plan",
    );
    assert.match(harness.notices.at(-1)!.message, /did not match the submitted plan call/i);

    const invalidScout = await harness.routeToolCall("subagent", {
      agent: "scout",
      task: "Refresh the changed requirement evidence",
      context: "fork",
      cwd,
    });
    assert.equal(invalidScout?.block, true);
    assert.match(invalidScout?.reason ?? "", /requires context: "fresh"/i);

    const scoutInput = {
      agent: "scout",
      task: "Refresh the changed requirement evidence",
      context: "fresh",
      cwd,
    };
    assert.equal(await harness.routeToolCall("subagent", scoutInput, "scout-1"), undefined);
    const siblingScout = {
      ...scoutInput,
      task: "A second sibling scout that must not race",
    };
    const sibling = await harness.routeToolCall("subagent", siblingScout, "scout-2");
    assert.equal(sibling?.block, true);
    assert.match(sibling?.reason ?? "", /already running/i);
    await harness.routeToolResult("subagent", siblingScout, scoutResult(), "scout-2");
    const stillPending = await harness.routeToolCall("plannotator_submit_plan", {
      filePath: ".plannotator/plan.md",
    });
    assert.equal(stillPending?.block, true);
    await harness.routeToolResult("subagent", scoutInput, scoutResult(), "scout-1");
    const planInput = { filePath: ".plannotator/plan.md" };
    assert.equal(await harness.routeToolCall("plannotator_submit_plan", planInput), undefined);
    await harness.routeToolResult(
      "plannotator_submit_plan",
      planInput,
      { approved: true },
    );
    await harness.commands.get("workflow-status")!.handler("", harness.context);
    assert.match(harness.notices.at(-1)!.message, /iteration-scout=verified/i);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("binds approval to the submitted plan snapshot and rejects approval feedback", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-session-"));
  try {
    writePlan(cwd, "plan.md", readOnlyPlan("local-work"));
    const changed = createHarness("idle", undefined, [], cwd);
    await changed.commands.get("work")!.handler("Investigate the task", changed.context);
    await runPlanningScout(changed);
    const changedInput = { filePath: ".plannotator/plan.md" };
    assert.equal(
      await changed.routeToolCall("plannotator_submit_plan", changedInput, "plan-changed"),
      undefined,
    );
    writePlan(cwd, "plan.md", `${readOnlyPlan("local-work")}\n## Revised scope\n`);
    await changed.routeToolResult(
      "plannotator_submit_plan",
      changedInput,
      { approved: true },
      "plan-changed",
    );
    assert.match(changed.notices.at(-1)!.message, /changed while approval was pending/i);

    writePlan(cwd, "plan.md", readOnlyPlan("local-work"));
    const feedback = createHarness("idle", undefined, [], cwd);
    await feedback.commands.get("work")!.handler("Investigate the task", feedback.context);
    await runPlanningScout(feedback);
    const feedbackInput = { filePath: ".plannotator/plan.md" };
    assert.equal(
      await feedback.routeToolCall("plannotator_submit_plan", feedbackInput, "plan-feedback"),
      undefined,
    );
    await feedback.routeToolResult(
      "plannotator_submit_plan",
      feedbackInput,
      { approved: true, feedback: "Add the missing requirement." },
      "plan-feedback",
    );
    assert.match(feedback.notices.at(-1)!.message, /included feedback; revise the plan/i);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("read-only completion proves the approved repository stayed unchanged", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-session-"));
  try {
    writePlan(cwd, "plan.md", readOnlyPlan("local-work"));
    const harness = createHarness("idle", undefined, [], cwd);
    await harness.commands.get("work")!.handler("Investigate the task", harness.context);
    await approvePlan(harness);
    harness.setPhase("executing");
    writeFileSync(join(cwd, "unexpected.txt"), "mutation after approval\n");

    await harness.commands.get("workflow-done")!.handler("", harness.context);

    assert.match(harness.notices.at(-1)!.message, /repository changed after read-only plan approval/i);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("blocks follow-up execution when replanning transition fails", async () => {
  const { commands, context, notices, requestedModes, routeInput, setPhase } = createHarness("idle", "exit");

  await commands.get("ticket")!.handler("ABC-123", context);
  setPhase("executing");

  const result = await routeInput("New requirement.");

  assert.deepEqual(result, { action: "handled" });
  assert.deepEqual(requestedModes, ["status", "enter", "status", "exit"]);
  assert.match(notices.at(-1)!.message, /exit failed/);
  assert.match(notices.at(-1)!.message, /workflow-retry/);
});

test("persists an active workflow across extension reload", async () => {
  const first = createHarness();
  await first.commands.get("ticket")!.handler("ABC-123", first.context);

  const restored = createHarness("executing", undefined, first.sessionEntries);
  await restored.startSession();

  const result = await restored.routeInput("The regression still fails.");

  assert.equal(result.action, "transform");
  if (result.action !== "transform") assert.fail("restored follow-up was not transformed");
  assert.match(result.text, /^Workflow: jira-ticket/);
  assert.match(result.text, /The regression still fails\./);
});

test("persists workflow abort as a tombstone without claiming completion", async () => {
  const first = createHarness();
  await first.commands.get("ticket")!.handler("ABC-123", first.context);
  await first.commands.get("workflow-abort")!.handler("", first.context);

  const restored = createHarness("idle", undefined, first.sessionEntries);
  await restored.startSession();

  assert.deepEqual(await restored.routeInput("Unrelated request."), { action: "continue" });
});

test("retries a preserved follow-up after a failed phase transition", async () => {
  const harness = createHarness();
  await harness.commands.get("ticket")!.handler("ABC-123", harness.context);
  harness.setPhase("executing");
  harness.setFailingMode("enter");

  assert.deepEqual(await harness.routeInput("New requirement."), { action: "handled" });
  harness.setFailingMode();
  await harness.commands.get("workflow-retry")!.handler("", harness.context);

  assert.match(harness.sentMessages.at(-1)!, /^Workflow: jira-ticket/);
  assert.match(harness.sentMessages.at(-1)!, /New requirement\./);
});

test("queues a streaming follow-up until the current agent settles", async () => {
  const harness = createHarness();
  await harness.commands.get("ticket")!.handler("ABC-123", harness.context);
  harness.setPhase("executing");
  const image = { type: "image", source: { type: "base64", mediaType: "image/png", data: "AA==" } };

  const result = await harness.routeInput("Stop and cover this case.", "interactive", "steer", [image]);

  assert.equal(result.action, "transform");
  if (result.action !== "transform") assert.fail("steer was not transformed into a stop instruction");
  assert.match(result.text, /Stop the current approved-plan execution/);
  assert.equal(harness.sentMessages.length, 1);
  const pendingTool = await harness.routeToolCall("read", { path: "src/file.ts" });
  assert.equal(pendingTool?.block, true);
  assert.match(pendingTool?.reason ?? "", /follow-up is pending; no tool may start/i);
  assert.deepEqual(
    await harness.routeInput("Continue with the approved plan.", "extension"),
    { action: "handled" },
  );

  await harness.settleAgent();

  assert.equal(harness.sentMessages.length, 2);
  assert.match(harness.sentMessages.at(-1)!, /Stop and cover this case\./);
  assert.deepEqual(harness.sentUserContents.at(-1), [
    { type: "text", text: harness.sentMessages.at(-1) },
    image,
  ]);
  assert.deepEqual(
    await harness.routeInput("Continue with the approved plan.", "extension"),
    { action: "handled" },
  );
});

test("queues a streaming follow-up without interrupting the current agent", async () => {
  const harness = createHarness();
  await harness.commands.get("work")!.handler("Implement the current plan", harness.context);
  harness.setPhase("executing");

  assert.deepEqual(
    await harness.routeInput("Add another requirement.", "interactive", "followUp"),
    { action: "handled" },
  );

  await harness.settleAgent();

  assert.match(harness.sentMessages.at(-1)!, /Add another requirement\./);
});

test("preserves an image-only workflow follow-up", async () => {
  const harness = createHarness();
  await harness.commands.get("work")!.handler("Implement the current plan", harness.context);
  harness.setPhase("executing");
  const image = { type: "image", source: { type: "base64", mediaType: "image/png", data: "AA==" } };

  const result = await harness.routeInput("", "interactive", "followUp", [image]);
  assert.deepEqual(result, { action: "handled" });

  await harness.settleAgent();

  assert.match(harness.sentMessages.at(-1)!, /\[Image-only user follow-up\]/);
  assert.deepEqual(harness.sentUserContents.at(-1)?.at(-1), image);
});

test("blocks extension-generated execution continuation before approval", async () => {
  const { commands, context, requestedModes, routeInput } = createHarness();

  await commands.get("ticket")!.handler("ABC-123", context);
  const before = [...requestedModes];

  const result = await routeInput("Continue with the approved plan.", "extension");

  assert.deepEqual(result, { action: "handled" });
  assert.deepEqual(requestedModes, before);
});

test("workflow-done exits Plannotator and disables follow-up routing", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-session-"));
  try {
    writePlan(cwd, "plan.md", readOnlyPlan("jira-ticket"));
    const harness = createHarness("idle", undefined, [], cwd);
    await harness.commands.get("ticket")!.handler("ABC-123", harness.context);
    await approvePlan(harness);
    harness.setPhase("executing");
    await harness.commands.get("workflow-done")!.handler("", harness.context);

    assert.deepEqual(harness.requestedModes, [
      "status",
      "enter",
      "status",
      "status",
      "status",
      "exit",
    ]);
    assert.match(harness.notices.at(-1)!.message, /workflow loop finished/i);
    assert.deepEqual(await harness.routeInput("Unrelated request after completion."), {
      action: "continue",
    });
    assert.deepEqual(harness.requestedModes, [
      "status",
      "enter",
      "status",
      "status",
      "status",
      "exit",
    ]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("requires a GitLab merge request URL", async () => {
  const { commands, context, notices, requestedModes, sentMessages } = createHarness();

  await commands.get("mr-review")!.handler("not-a-url", context);

  assert.deepEqual(requestedModes, []);
  assert.equal(sentMessages.length, 0);
  assert.match(notices[0]!.message, /GitLab merge request URL/);
});

test("blocks ad-hoc reviewers without an approved workflow contract", async () => {
  const harness = createHarness();

  const missing = await harness.routeToolCall("subagent", {
    agent: "reviewer",
    task: "Review the current diff",
    context: "fresh",
    cwd: process.cwd(),
  });
  assert.equal(missing?.block, true);
  assert.match(missing?.reason ?? "", /active approved workflow/i);

  const accepted = await harness.routeToolCall("subagent", {
    agent: "reviewer",
    task: "Review the current diff",
    context: "fresh",
    cwd: process.cwd(),
    acceptance: verifiedAcceptance(reviewerVerification),
  });
  assert.equal(accepted?.block, true);
  assert.match(accepted?.reason ?? "", /active approved workflow/i);
});

test("blocks workflow execution when the approved plan changes", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-session-"));
  try {
    writePlan(cwd, "plan.md", codePlan(cwd));
    const harness = createHarness("idle", undefined, [], cwd);
    await harness.commands.get("work")!.handler("Implement the plan", harness.context);
    await approvePlan(harness);
    harness.setPhase("executing");

    const unverified = await harness.routeToolCall("subagent", {
      agent: "worker",
      task: "Implement the approved change",
      context: "fresh",
      cwd,
    });
    assert.equal(unverified?.block, true);
    assert.match(unverified?.reason ?? "", /verified acceptance/i);

    const current = await harness.routeToolCall("subagent", {
      agent: "worker",
      task: "Implement the approved change",
      context: "fresh",
      cwd,
      acceptance: verifiedAcceptance(workerVerification),
    });
    assert.equal(current, undefined);

    writePlan(cwd, "plan.md", `${codePlan(cwd)}\n## Different scope\n`);
    const stale = await harness.routeToolCall("subagent", {
      agent: "worker",
      task: "Implement the approved change",
      context: "fresh",
      cwd,
      acceptance: verifiedAcceptance(workerVerification),
    });
    assert.equal(stale?.block, true);
    assert.match(stale?.reason ?? "", /approved plan changed/i);
    assert.deepEqual(
      await harness.routeInput("Continue with the approved plan.", "extension"),
      { action: "handled" },
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("binds worker verification to the exact approved command contract", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-session-"));
  try {
    writePlan(cwd, "plan.md", codePlan(cwd));
    const harness = createHarness("idle", undefined, [], cwd);
    await harness.commands.get("work")!.handler("Implement the plan", harness.context);
    await approvePlan(harness);
    harness.setPhase("executing");

    const droppedBaselineSkills = await harness.routeToolCall("subagent", {
      agent: "worker",
      task: "Implement with one additional project skill",
      context: "fresh",
      cwd,
      skill: ["coding-standards"],
      acceptance: verifiedAcceptance(workerVerification),
    });
    assert.equal(droppedBaselineSkills?.block, true);
    assert.match(droppedBaselineSkills?.reason ?? "", /skill overrides replace configured defaults/i);
    assert.match(droppedBaselineSkills?.reason ?? "", /test-driven-development/);
    assert.match(droppedBaselineSkills?.reason ?? "", /verification-before-completion/);
    assert.match(droppedBaselineSkills?.reason ?? "", /receiving-code-review/);

    const weak = await harness.routeToolCall("subagent", {
      agent: "worker",
      task: "Implement the approved change",
      context: "fresh",
      cwd,
      acceptance: verifiedAcceptance([
        { id: "focused-tests", command: "node --test wrong.test.ts", timeoutMs: 120_000 },
      ]),
    });

    assert.equal(weak?.block, true);
    assert.match(weak?.reason ?? "", /does not exactly match the approved plan contract/i);

    const wrongCwd = await harness.routeToolCall("subagent", {
      agent: "worker",
      task: "Run against the wrong checkout",
      context: "fresh",
      cwd: join(cwd, "other-checkout"),
      acceptance: verifiedAcceptance(workerVerification),
    });
    assert.equal(wrongCwd?.block, true);
    assert.match(wrongCwd?.reason ?? "", /does not match the exact repository cwd/i);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("requires the approved workflow marker and a code verification contract", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-session-"));
  try {
    writePlan(cwd, "wrong.md", readOnlyPlan("jira-ticket"));
    const wrong = createHarness("idle", undefined, [], cwd);
    await wrong.commands.get("work")!.handler("Implement the plan", wrong.context);
    await runPlanningScout(wrong);
    const wrongPlan = await wrong.routeToolCall("plannotator_submit_plan", {
      filePath: ".plannotator/wrong.md",
    });
    assert.equal(wrongPlan?.block, true);
    assert.match(wrongPlan?.reason ?? "", /first line must be exactly Workflow: local-work/i);

    writePlan(
      cwd,
      "placeholder.md",
      codePlan(cwd).replace("node --test focused.test.ts", "true"),
    );
    const placeholder = createHarness("idle", undefined, [], cwd);
    await placeholder.commands.get("work")!.handler("Implement the plan", placeholder.context);
    await runPlanningScout(placeholder);
    const placeholderPlan = await placeholder.routeToolCall("plannotator_submit_plan", {
      filePath: ".plannotator/placeholder.md",
    });
    assert.equal(placeholderPlan?.block, true);
    assert.match(placeholderPlan?.reason ?? "", /placeholder success command/i);

    writePlan(cwd, "missing-contract.md", "Workflow: local-work\n\n- [ ] Implement\n");
    const missingContract = createHarness("idle", undefined, [], cwd);
    await missingContract.commands.get("work")!.handler("Implement the plan", missingContract.context);
    await runPlanningScout(missingContract);
    const missingPlan = await missingContract.routeToolCall("plannotator_submit_plan", {
      filePath: ".plannotator/missing-contract.md",
    });
    assert.equal(missingPlan?.block, true);
    assert.match(missingPlan?.reason ?? "", /exactly one ## Verification contract heading/i);

    writePlan(
      cwd,
      "mixed-contract.md",
      `${readOnlyPlan("local-work").trim()}\nExtra verification text\n`,
    );
    const mixedContract = createHarness("idle", undefined, [], cwd);
    await mixedContract.commands.get("work")!.handler("Implement the plan", mixedContract.context);
    await runPlanningScout(mixedContract);
    const mixedPlan = await mixedContract.routeToolCall("plannotator_submit_plan", {
      filePath: ".plannotator/mixed-contract.md",
    });
    assert.equal(mixedPlan?.block, true);
    assert.match(mixedPlan?.reason ?? "", /body must be exactly/i);

    writePlan(cwd, "readonly.md", readOnlyPlan("local-work"));
    const noContract = createHarness("idle", undefined, [], cwd);
    await noContract.commands.get("work")!.handler("Implement the plan", noContract.context);
    await approvePlan(noContract, ".plannotator/readonly.md");
    noContract.setPhase("executing");
    const blocked = await noContract.routeToolCall("subagent", {
      agent: "worker",
      task: "Implement the approved change",
      context: "fresh",
      cwd,
      acceptance: verifiedAcceptance(workerVerification),
    });
    assert.equal(blocked?.block, true);
    assert.match(blocked?.reason ?? "", /requires an exact ## Verification contract/i);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("workflow-done requires latest verified worker and fresh zero-finding reviewer ledgers", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-session-"));
  try {
    writePlan(cwd, "plan.md", codePlan(cwd));
    const harness = createHarness("idle", undefined, [], cwd);
    await harness.commands.get("work")!.handler("Implement the plan", harness.context);
    await approvePlan(harness);
    harness.setPhase("executing");

    await harness.commands.get("workflow-done")!.handler("", harness.context);
    assert.match(harness.notices.at(-1)!.message, /approved code plan has not produced/i);

    const workerInput = {
      agent: "worker",
      task: "Implement the approved change",
      context: "fresh",
      cwd,
      skill: [
        "test-driven-development",
        "verification-before-completion",
        "receiving-code-review",
        "coding-standards",
      ],
      acceptance: verifiedAcceptance(workerVerification),
    };
    assert.equal(await harness.routeToolCall("subagent", workerInput), undefined);
    await harness.commands.get("workflow-done")!.handler("", harness.context);
    assert.match(harness.notices.at(-1)!.message, /worker runtime acceptance ledger is not verified/i);

    await harness.routeToolResult(
      "subagent",
      workerInput,
      verifiedResult("worker", workerVerification),
    );
    const reviewerInput = {
      agent: "reviewer",
      task: "Review the current diff",
      context: "fresh",
      cwd,
      skill: ["verification-before-completion", "coding-standards"],
      acceptance: verifiedAcceptance(reviewerVerification),
    };
    const droppedReviewerBaseline = await harness.routeToolCall("subagent", {
      ...reviewerInput,
      skill: ["coding-standards"],
    });
    assert.equal(droppedReviewerBaseline?.block, true);
    assert.match(droppedReviewerBaseline?.reason ?? "", /skill overrides replace configured defaults/i);
    assert.match(droppedReviewerBaseline?.reason ?? "", /verification-before-completion/);
    const extraReviewerCommand = await harness.routeToolCall("subagent", {
      ...reviewerInput,
      acceptance: {
        ...verifiedAcceptance(reviewerVerification),
        verify: [
          ...reviewerVerification,
          { id: "typecheck", command: "tsc --noEmit", timeoutMs: 120_000 },
        ],
      },
    });
    assert.equal(extraReviewerCommand?.block, true);
    assert.match(extraReviewerCommand?.reason ?? "", /exactly.*full-tests, format, lint/i);
    assert.equal(await harness.routeToolCall("subagent", reviewerInput), undefined);
    await harness.routeToolResult(
      "subagent",
      reviewerInput,
      verifiedResult("reviewer", reviewerVerification),
    );

    await harness.commands.get("workflow-status")!.handler("", harness.context);
    assert.match(harness.notices.at(-1)!.message, /contract worker\[focused-tests\]/i);
    assert.match(harness.notices.at(-1)!.message, /gates worker=verified, reviewer=verified/i);

    await harness.commands.get("workflow-done")!.handler("", harness.context);
    assert.match(harness.notices.at(-1)!.message, /workflow loop finished/i);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("serializes worker and reviewer calls by toolCallId", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-session-"));
  try {
    writePlan(cwd, "plan.md", codePlan(cwd));
    const harness = createHarness("idle", undefined, [], cwd);
    await harness.commands.get("work")!.handler("Implement the plan", harness.context);
    await approvePlan(harness);
    harness.setPhase("executing");

    const workerOne = {
      agent: "worker",
      task: "First writer",
      context: "fresh",
      cwd,
      acceptance: verifiedAcceptance(workerVerification),
    };
    const workerTwo = { ...workerOne, task: "Sibling writer" };
    assert.equal(await harness.routeToolCall("subagent", workerOne, "worker-1"), undefined);
    const siblingWorker = await harness.routeToolCall("subagent", workerTwo, "worker-2");
    assert.equal(siblingWorker?.block, true);
    assert.match(siblingWorker?.reason ?? "", /already running/i);
    await harness.routeToolResult(
      "subagent",
      workerTwo,
      verifiedResult("worker", workerVerification),
      "worker-2",
    );
    await harness.commands.get("workflow-done")!.handler("", harness.context);
    assert.match(harness.notices.at(-1)!.message, /worker runtime acceptance ledger is not verified/i);
    await harness.routeToolResult(
      "subagent",
      workerOne,
      verifiedResult("worker", workerVerification),
      "worker-1",
    );

    const reviewerOne = {
      agent: "reviewer",
      task: "First reviewer",
      context: "fresh",
      cwd,
      acceptance: verifiedAcceptance(reviewerVerification),
    };
    const reviewerTwo = { ...reviewerOne, task: "Sibling reviewer" };
    assert.equal(await harness.routeToolCall("subagent", reviewerOne, "reviewer-1"), undefined);
    const siblingReviewer = await harness.routeToolCall("subagent", reviewerTwo, "reviewer-2");
    assert.equal(siblingReviewer?.block, true);
    assert.match(siblingReviewer?.reason ?? "", /already running/i);
    await harness.routeToolResult(
      "subagent",
      reviewerTwo,
      verifiedResult("reviewer", reviewerVerification),
      "reviewer-2",
    );
    await harness.commands.get("workflow-done")!.handler("", harness.context);
    assert.match(harness.notices.at(-1)!.message, /fresh reviewer/i);
    await harness.routeToolResult(
      "subagent",
      reviewerOne,
      verifiedResult("reviewer", reviewerVerification),
      "reviewer-1",
    );

    await harness.commands.get("workflow-done")!.handler("", harness.context);
    assert.match(harness.notices.at(-1)!.message, /workflow loop finished/i);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("invalidates completion when the repository changes after review", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-session-"));
  try {
    writePlan(cwd, "plan.md", codePlan(cwd));
    const harness = createHarness("idle", undefined, [], cwd);
    await harness.commands.get("work")!.handler("Implement the plan", harness.context);
    await approvePlan(harness);
    harness.setPhase("executing");
    await passCodeGates(harness);
    writeFileSync(join(cwd, "late-change.txt"), "changed after review\n");

    await harness.commands.get("workflow-done")!.handler("", harness.context);

    assert.match(harness.notices.at(-1)!.message, /changed after the fresh reviewer passed/i);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("reviewer findings fail completion and a later worker invalidates review", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-session-"));
  try {
    writePlan(cwd, "plan.md", codePlan(cwd));
    const harness = createHarness("idle", undefined, [], cwd);
    await harness.commands.get("work")!.handler("Implement the plan", harness.context);
    await approvePlan(harness);
    harness.setPhase("executing");
    const workerInput = {
      agent: "worker",
      task: "Implement the approved change",
      context: "fresh",
      cwd,
      acceptance: verifiedAcceptance(workerVerification),
    };
    await harness.routeToolCall("subagent", workerInput);
    await harness.routeToolResult(
      "subagent",
      workerInput,
      verifiedResult("worker", workerVerification),
    );
    const reviewerInput = {
      agent: "reviewer",
      task: "Review the current diff",
      context: "fresh",
      cwd,
      acceptance: verifiedAcceptance(reviewerVerification),
    };
    await harness.routeToolCall("subagent", reviewerInput);
    await harness.routeToolResult(
      "subagent",
      reviewerInput,
      verifiedResult("reviewer", reviewerVerification, ["src/file.ts:1 blocker"]),
    );
    await harness.commands.get("workflow-done")!.handler("", harness.context);
    assert.match(harness.notices.at(-1)!.message, /reviewer reported 1 actionable finding/i);

    assert.equal(await harness.routeToolCall("subagent", workerInput), undefined);
    await harness.commands.get("workflow-status")!.handler("", harness.context);
    assert.match(harness.notices.at(-1)!.message, /worker=pending, reviewer=required/i);

    await harness.commands.get("workflow-abort")!.handler("", harness.context);
    assert.match(harness.notices.at(-1)!.message, /aborted without a completion claim/i);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("does not restore old approval after a queued follow-up", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-session-"));
  try {
    writePlan(cwd, "plan.md", "Workflow: local-work\n\n- [ ] Implement\n");
    const harness = createHarness("idle", undefined, [], cwd);
    await harness.commands.get("work")!.handler("Implement the plan", harness.context);
    harness.setPhase("executing");

    assert.deepEqual(
      await harness.routeInput("The requirement changed.", "interactive", "followUp"),
      { action: "handled" },
    );
    await harness.routeToolResult(
      "plannotator_submit_plan",
      { filePath: ".plannotator/plan.md" },
      { approved: true },
    );
    await harness.settleAgent();

    assert.deepEqual(
      await harness.routeInput("Continue with the approved plan.", "extension"),
      { action: "handled" },
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("Plannotator plan contract persists route and executable checklist", () => {
  const config = JSON.parse(readFileSync(new URL("../plannotator.json", import.meta.url), "utf8"));
  const planningPrompt = config.phases.planning.systemPrompt as string;
  const executionPrompt = config.phases.executing.systemPrompt as string;

  assert.ok(config.phases.planning.activeTools.includes("read"));
  assert.ok(config.phases.planning.activeTools.includes("edit"));
  assert.ok(config.phases.planning.activeTools.includes("write"));
  assert.ok(config.phases.planning.activeTools.includes("subagent"));
  assert.match(planningPrompt, /First plan line must be exactly one allowed marker/);
  assert.match(planningPrompt, /kickoff message's first line exactly equals/);
  assert.match(planningPrompt, /quoted or mentioned anywhere else.*does not select a route/);
  assert.match(planningPrompt, /Workflow: general/);
  assert.match(planningPrompt, /Workflow: local-work/);
  assert.match(planningPrompt, /at least one standard unchecked markdown task item/);
  assert.match(planningPrompt, /read-only or no-action outcome still needs one item/);
  assert.match(planningPrompt, /Done when/);
  assert.match(planningPrompt, /Verification contract/);
  assert.match(planningPrompt, /only cwd, worker, and reviewer/);
  assert.match(planningPrompt, /blocks every plan submission until.*scout ledger passes/i);
  assert.match(planningPrompt, /Approval feedback is a requirement to revise and resubmit/i);
  assert.match(planningPrompt, /never use true, echo, or another placeholder-success command/i);
  assert.match(planningPrompt, /every user-authored follow-up is a new planning iteration/);
  assert.match(planningPrompt, /reuse the exact same plan file/);
  assert.match(planningPrompt, /submit it for another approval/);
  assert.match(executionPrompt, /Workflow: general follows the approved plan/);
  assert.match(executionPrompt, /remain active across execution passes until successful \/workflow-done/);
  assert.match(executionPrompt, /has no authorization from the current plan/);
  assert.match(executionPrompt, /For each approved code iteration.*one new foreground fresh worker/);
  assert.match(executionPrompt, /acceptance.*verified/i);
  assert.match(executionPrompt, /full-tests.*format.*lint/i);
  assert.match(executionPrompt, /reviewFindings/);
  assert.match(executionPrompt, /exact contract cwd/);
  assert.match(executionPrompt, /unchanged post-review repository snapshot/);
  assert.match(executionPrompt, /Never stage or commit by default/);
  assert.match(executionPrompt, /workflow-done remains blocked/i);
});

test("reviewer requires complete tests, formatting, and lint verification", () => {
  const settings = JSON.parse(readFileSync(new URL("../settings.json", import.meta.url), "utf8"));
  const reviewerPrompt = settings.subagents.agentOverrides.reviewer.systemPrompt as string;

  assert.match(reviewerPrompt, /complete repository test suite/);
  assert.match(reviewerPrompt, /repository-wide formatting and lint checks/);
  assert.match(reviewerPrompt, /formatting and lint report zero violations/);
  assert.match(reviewerPrompt, /reviewFindings/);
  assert.match(reviewerPrompt, /PASSING only when every required command passed with zero findings/);
  assert.match(reviewerPrompt, /never issue a passing VERDICT/);
});

test("enables adversarial watchdog review for parent edits and child writers", () => {
  const settings = JSON.parse(readFileSync(new URL("../settings.json", import.meta.url), "utf8"));
  const watchdog = settings.subagents.watchdog;
  const contract = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");

  assert.equal(watchdog.enabled, true);
  assert.deepEqual(watchdog.autoFollow, { blockers: false });
  assert.deepEqual(watchdog.main, {
    enabled: true,
    model: "openai-gateway/gpt-5.6-sol",
    thinking: "high",
  });
  assert.deepEqual(watchdog.children, {
    enabled: true,
    model: "openai-gateway/gpt-5.6-sol",
    thinking: "high",
    autoFollow: { blockers: false },
  });
  assert.match(contract, /watchdog.*advisory.*never auto-follow, mutate, interrupt, or steer/i);
  assert.match(contract, /inspect current status and evidence at a safe boundary first/i);
  assert.match(contract, /supplements but never replaces.*fresh final reviewer/i);
});

test("keeps only four active subagent roles with explicit contracts", () => {
  const settings = JSON.parse(readFileSync(new URL("../settings.json", import.meta.url), "utf8"));
  const contract = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");
  const overrides = settings.subagents.agentOverrides as Record<string, Record<string, unknown>>;
  const active = Object.entries(overrides)
    .filter(([, config]) => config.disabled !== true)
    .map(([name]) => name)
    .sort();

  assert.deepEqual(active, ["researcher", "reviewer", "scout", "worker"]);
  for (const role of active) assert.equal(overrides[role]!.inheritSkills, true);
  assert.equal(overrides.worker.acceptanceRole, "writer");
  assert.deepEqual(overrides.worker.skills, [
    "test-driven-development",
    "verification-before-completion",
    "receiving-code-review",
  ]);
  assert.equal(overrides.reviewer.acceptanceRole, "read-only");
  assert.deepEqual(overrides.reviewer.skills, ["verification-before-completion"]);
  assert.match(contract, /All four active roles inherit Pi's discovered skills catalog/);
  assert.match(contract, /loads only catalog skills whose descriptions match its bounded task/i);
  assert.match(contract, /A skill never grants tools, mutation authority, broader scope/i);
  assert.match(contract, /Parent-only orchestration skills stay unavailable to children/i);
});

test("keeps enough bounded spawn capacity for repeated plan and implementation iterations", () => {
  const config = JSON.parse(
    readFileSync(new URL("../extensions/subagent/config.json", import.meta.url), "utf8"),
  );

  assert.equal(config.maxSubagentSpawnsPerSession, 100);
  assert.equal(config.globalConcurrencyLimit, 3);
});
