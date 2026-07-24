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

## Goal
Implement the requested behavior.

## In scope
- Requested behavior.

## Out of scope
- Unrelated changes.

## Evidence
- Repository evidence was inspected.

## Things to implement
- Requested implementation.

## Implementation plan
- [ ] Implement

## Requirement-to-test mapping
- Requested behavior: focused and full verification.

## Done when
- [ ] Requested behavior is implemented and verified.

## Verification contract
\`\`\`json
${JSON.stringify({ cwd, worker: workerVerification, reviewer: reviewerVerification }, null, 2)}
\`\`\`

## Skill recommendation
- coding-standards

## Open questions
- None.

## Risks
- Regression risk is covered by verification.
`;
}

function readOnlyPlan(
  marker: string,
  actions: Array<{ id: string; toolName: string; input: Record<string, unknown> }> = [{
    id: "approved-comment",
    toolName: "gitlab_create_merge_request_note",
    input: {
      project_id: "group/project",
      merge_request_iid: 42,
      body: "Approved comment",
    },
  }],
): string {
  const remoteActionContract = marker === "gitlab-mr-review" ||
      marker === "gitlab-mr-comments"
    ? `
## Remote action contract
\`\`\`json
${JSON.stringify({
      actions,
    }, null, 2)}
\`\`\`
`
    : "";
  return `Workflow: ${marker}

## Goal
Revalidate and report findings.

## In scope
- Read-only investigation.

## Out of scope
- Repository mutation.

## Evidence
- Repository evidence was inspected.

## Things to implement
- Produce the approved report.

## Implementation plan
- [ ] Revalidate and report

## Requirement-to-test mapping
- Findings: revalidate repository state.

## Done when
- [ ] Findings are revalidated and reported.

## Verification contract
Not applicable - read-only plan.
${remoteActionContract}

## Skill recommendation
- coding-standards

## Open questions
- None.

## Risks
- Evidence may become stale.
`;
}

function multiRepositoryCodePlan(
  repositories: Array<{
    cwd: string;
    sourceCwd?: string;
    baseHead?: string;
    branch: string;
    commitTitle: string;
  }>,
  marker = "local-work",
  actions: Array<{ id: string; toolName: string; input: Record<string, unknown> }> = [{
    id: "approved-comment",
    toolName: "gitlab_create_merge_request_note",
    input: {
      project_id: "group/project",
      merge_request_iid: 42,
      body: "Approved comment",
    },
  }],
): string {
  const remoteActionContract = marker === "gitlab-mr-review" ||
      marker === "gitlab-mr-comments"
    ? `
## Remote action contract
\`\`\`json
${JSON.stringify({
      actions,
    }, null, 2)}
\`\`\`
`
    : "";
  return `Workflow: ${marker}

## Goal
Implement cross-repository behavior.

## In scope
- Approved repository slices.

## Out of scope
- Unrelated repositories.

## Evidence
- Every repository was explored.

## Things to implement
- Cross-repository behavior.

## Implementation plan
- [ ] Implement each repository slice in parallel.

## Requirement-to-test mapping
- Cross-repository behavior: focused and complete verification.

## Done when
- [ ] Cross-repository behavior is implemented.
- [ ] Every repository passes focused and complete verification.

## Verification contract
\`\`\`json
${JSON.stringify({
    repositories: repositories.map((repository) => ({
      ...repository,
      sourceCwd: repository.sourceCwd ?? repository.cwd,
      baseHead: repository.baseHead ?? (() => {
        try {
          return execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
            cwd: repository.sourceCwd ?? repository.cwd,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
          }).trim();
        } catch {
          return "UNBORN";
        }
      })(),
      acceptanceCriteria: [
        "Cross-repository behavior is implemented.",
        "Every repository passes focused and complete verification.",
      ],
      worker: workerVerification,
      reviewer: reviewerVerification,
    })),
  }, null, 2)}
\`\`\`
${remoteActionContract}

## Skill recommendation
- coding-standards

## Open questions
- None.

## Risks
- Repository contracts may drift.
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
  criteriaCount = 1,
) {
  const criteria = criteriaCount === 2
    ? [
      "Cross-repository behavior is implemented.",
      "Every repository passes focused and complete verification.",
    ]
    : ["Requested behavior is implemented and verified."];
  const childReport = {
    criteriaSatisfied: criteria.map((criterion, index) => ({
      id: `criterion-${index + 1}`,
      criterion,
      status: "satisfied",
      evidence: `Verified criterion ${index + 1}.`,
    })),
    ...(role === "worker"
      ? {
        testsAddedOrUpdated: ["focused.test.ts"],
        commandsRun: [
          { command: "node --test focused.test.ts", result: "failed", summary: "RED failed as expected." },
          { command: "node --test focused.test.ts", result: "passed", summary: "GREEN passed." },
        ],
      }
      : { reviewFindings }),
  };
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
          childReport,
        },
      },
    ],
  };
}

function parallelVerifiedResult(
  role: "worker" | "reviewer",
  count: number,
  verify: typeof workerVerification | typeof reviewerVerification,
  criteriaCount = 2,
) {
  return {
    mode: "parallel",
    results: Array.from({ length: count }, () =>
      verifiedResult(role, verify, [], criteriaCount).results[0]),
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
  runtime?: {
    sessionKey?: string;
    worktreeBaseDir?: string;
    allowLegacyVerificationContracts?: boolean;
  },
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
  const submittedPlanToolCallIds = new Set<string>();

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
  registerWorkflowCommands(pi as never, {
    ...(derivedRuntime ?? {}),
    ...(runtime ?? {}),
    allowLegacyVerificationContracts: runtime?.allowLegacyVerificationContracts ?? true,
  });

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
    const result = await toolCallHandler({ toolCallId, toolName, input }, context);
    if (toolName === "plannotator_submit_plan" && result === undefined) {
      submittedPlanToolCallIds.add(toolCallId);
    }
    return result;
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

async function passReadOnlyExecutionGate(harness: ReturnType<typeof createHarness>) {
  const criteria = ["Findings are revalidated and reported."];
  const input = {
    agent: "scout",
    task: "Execute the approved read-only plan and return structured criterion evidence",
    context: "fresh",
    cwd: harness.context.cwd,
    acceptance: {
      level: "attested",
      criteria,
    },
  };
  assert.equal(await harness.routeToolCall("subagent", input), undefined);
  await harness.routeToolResult("subagent", input, {
    mode: "single",
    results: [{
      agent: "scout",
      exitCode: 0,
      acceptance: {
        status: "attested",
        childReport: {
          criteriaSatisfied: criteria.map((criterion, index) => ({
            id: `criterion-${index + 1}`,
            criterion,
            status: "satisfied",
            evidence: `Revalidated: ${criterion}`,
          })),
          manualNotes: "Revalidated evidence and reported the approved findings.",
        },
      },
    }],
  });
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
    "workflow-continue",
    "workflow-done",
    "workflow-retry",
    "workflow-status",
  ]);
});

test("ticket loads a project-local workflow template override", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-session-"));
  try {
    const templateDirectory = join(cwd, ".pi", "workflows");
    mkdirSync(templateDirectory, { recursive: true });
    writeFileSync(
      join(templateDirectory, "jira-ticket.md"),
      "Workflow: jira-ticket\n\nProject-local multi-repository workflow template.",
    );
    const { commands, context, sentMessages } = createHarness("idle", undefined, [], cwd);

    await commands.get("ticket")!.handler("ACTB-2758", context);

    assert.match(sentMessages[0]!, /Project-local multi-repository workflow template\./);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("work starts a local plan and implementation loop", async () => {
  const { commands, context, sentMessages } = createHarness();

  await commands.get("work")!.handler("Add deterministic retries", context);

  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0]!, /^Workflow: local-work/);
  assert.match(sentMessages[0]!, /Add deterministic retries/);
});

test("exits Plannotator planning before dispatching approved code execution", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-session-"));
  try {
    writePlan(cwd, "plan.md", codePlan(cwd));
    const harness = createHarness("idle", undefined, [], cwd);

    await harness.commands.get("work")!.handler("Implement the approved plan", harness.context);
    await approvePlan(harness);

    assert.equal(harness.sentMessages.length, 1);
    assert.equal(harness.requestedModes.at(-1), "exit");
    await harness.settleAgent();

    assert.equal(harness.sentMessages.length, 2);
    assert.match(
      harness.sentMessages.at(-1)!,
      /launch one compliant verified worker/i,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("approves a plan from a shared nested Git directory", async () => {
  const root = mkdtempSync(join(tmpdir(), "pi-root-"));
  const cwd = join(root, "shared");
  try {
    execFileSync("git", ["init", "--quiet", root]);
    mkdirSync(cwd);
    writePlan(cwd, "plan.md", readOnlyPlan("local-work"));
    const harness = createHarness("idle", undefined, [], cwd);

    await harness.commands.get("work")!.handler("Plan shared workspace work", harness.context);
    await approvePlan(harness);
    await harness.commands.get("workflow-status")!.handler("", harness.context);

    assert.match(harness.notices.at(-1)!.message, /approved \.plannotator\/plan\.md/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("permits a contract-bound canonical worktree outside the plan artifact repository", async () => {
  const base = mkdtempSync(join(tmpdir(), "pi-workflow-"));
  const planCwd = join(base, "plan-artifact");
  const targetCwd = join(base, "plan-artifact-canonical-worktree");
  try {
    mkdirSync(planCwd);
    mkdirSync(targetCwd);
    execFileSync("git", ["init", "--quiet"], { cwd: targetCwd });
    writePlan(planCwd, "plan.md", codePlan(targetCwd));
    const harness = createHarness(
      "idle",
      undefined,
      [],
      planCwd,
      { sessionKey: "cross-repo", worktreeBaseDir: base },
    );

    await harness.commands.get("work")!.handler("Implement in the canonical worktree", harness.context);
    await approvePlan(harness);

    const worker = await harness.routeToolCall("subagent", {
      agent: "worker",
      task: "Implement the approved change",
      context: "fresh",
      cwd: targetCwd,
      acceptance: verifiedAcceptance(workerVerification),
    });
    assert.equal(worker, undefined);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("ticket enters Plannotator before starting workflow", async () => {
  const { commands, context, requestedModes, sentMessages } = createHarness();

  await commands.get("ticket")!.handler("ABC-123", context);

  assert.deepEqual(requestedModes, ["status", "enter"]);
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0]!, /Workflow: jira-ticket/);
  assert.match(sentMessages[0]!, /ABC-123/);
  assert.match(sentMessages[0]!, /extra information.*optional/i);
});

test("ticket requires a Jira issue ID while allowing optional context", async () => {
  const invalid = createHarness();
  await invalid.commands.get("ticket")!.handler("Fix the cache", invalid.context);
  assert.equal(invalid.sentMessages.length, 0);
  assert.match(invalid.notices.at(-1)!.message, /Usage: \/ticket/i);

  const valid = createHarness();
  await valid.commands.get("ticket")!.handler(
    "https://jira.example.test/browse/ABC-123 cache context",
    valid.context,
  );
  assert.equal(valid.sentMessages.length, 1);
  assert.match(valid.sentMessages[0]!, /ABC-123 cache context/);
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

test("GitHub public pull request URLs start both review workflows", async () => {
  const pullRequestUrl = "https://github.com/octo-org/example/pull/42";

  for (const commandName of ["mr-review", "mr-comments"] as const) {
    const { commands, context, requestedModes, sentMessages } = createHarness();

    await commands.get(commandName)!.handler(pullRequestUrl, context);

    assert.deepEqual(requestedModes, ["status", "enter"]);
    assert.equal(sentMessages.length, 1);
    assert.match(sentMessages[0]!, /Remote platform: GitHub/);
  }
});

test("review workflows accept user context and generic HTTPS code-review URLs", async () => {
  const cases = [
    "https://github.com/octo-org/example/pull/42 focus on retry safety",
    "https://codeberg.example.test/team/project/pulls/42 compare the API contract",
  ];

  for (const input of cases) {
    const harness = createHarness();

    await harness.commands.get("mr-review")!.handler(input, harness.context);

    assert.equal(harness.sentMessages.length, 1);
    assert.match(harness.sentMessages[0]!, /focus on retry safety|compare the API contract/);
    assert.match(harness.sentMessages[0]!, /Remote platform:/);
  }
});

test("GitHub Enterprise pull request URLs do not require a matching local origin", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-ghe-"));
  try {
    execFileSync("git", ["init", "--quiet"], { cwd });
    execFileSync("git", ["remote", "add", "origin", "https://github.example.test/org/repo.git"], { cwd });
    const trusted = createHarness("idle", undefined, [], cwd);

    await trusted.commands.get("mr-review")!.handler(
      "https://github.example.test/org/repo/pull/42",
      trusted.context,
    );

    assert.match(trusted.sentMessages[0]!, /Remote platform: GitHub Enterprise/);

    const untrusted = createHarness("idle", undefined, [], cwd);
    await untrusted.commands.get("mr-review")!.handler(
      "https://untrusted.example.test/org/repo/pull/42",
      untrusted.context,
    );

    assert.equal(untrusted.sentMessages.length, 1);
    assert.match(untrusted.sentMessages[0]!, /Remote platform: GitHub Enterprise/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
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

    for (const command of [
      "git status --short",
      "rg -n 'workflow' agent",
      "ast-grep --pattern '$A' --lang ts agent",
    ]) {
      assert.equal(await harness.routeToolCall("bash", { command }), undefined);
    }

    for (const command of [
      "git commit -am mutation",
      "git diff --output=leak.patch",
      "git branch --edit-description",
      "sort -o sorted.txt input.txt",
      "uniq input.txt output.txt",
      "yq -i '.enabled = true' config.yml",
      "tree -o tree.txt",
      "sed -i mutation src/file.ts",
      "rm src/file.ts",
    ]) {
      const blocked = await harness.routeToolCall("bash", { command });
      assert.equal(blocked?.block, true);
      assert.match(blocked?.reason ?? "", /planning is read-only/i);
    }

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
      await harness.routeToolCall("atlassian_getJiraIssue", { issueIdOrKey: "EXAMPLE-1" }),
      undefined,
    );
    assert.equal(
      await harness.routeToolCall("agoda_skills_searchCatalog", { query: "workflow" }),
      undefined,
    );
    assert.equal(
      await harness.routeToolCall("mcp", { tool: "atlassian_getJiraIssue", args: "{}" }),
      undefined,
    );
    assert.equal(
      await harness.routeToolCall("mcp", { describe: "atlassian_getJiraIssue" }),
      undefined,
    );

    for (const [toolName, input] of [
      ["atlassian_readThenSend", {}],
      ["atlassian_retrieveJiraIssue", {}],
      ["mcp", { tool: "atlassian_getOrCreateJiraIssue", args: "{}" }],
      ["mcp", { action: "auth-start", server: "atlassian" }],
    ] as const) {
      const blocked = await harness.routeToolCall(toolName, input);
      assert.equal(blocked?.block, true);
    }

    assert.equal(
      await harness.routeToolCall("mcp__tracker__get_issue", { issue: "EXAMPLE-1" }),
      undefined,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("permits review-platform retrieval during planning without permitting mutations", async () => {
  const cases = [
    {
      commandName: "mr-review" as const,
      url: "https://gitlab.example.test/group/project/-/merge_requests/42",
      readTool: "gitlab_get_merge_request",
      readCli: "glab mr view 42 --output json",
      readCurl: "curl --request GET https://gitlab.example.test/api/v4/projects/group%2Fproject/merge_requests/42",
    },
    {
      commandName: "mr-comments" as const,
      url: "https://github.example.test/example/project/pull/42",
      readTool: "github_get_pull_request",
      readCli: "gh pr view 42 --hostname github.example.test --json number,title",
      readCurl: "curl --head https://github.example.test/api/v3/repos/example/project/pulls/42",
    },
  ];

  for (const { commandName, url, readTool, readCli, readCurl } of cases) {
    const harness = createHarness();
    await harness.commands.get(commandName)!.handler(url, harness.context);

    assert.equal(await harness.routeToolCall(readTool, {}), undefined);
    assert.equal(await harness.routeToolCall("mcp", { tool: readTool, args: "{}" }), undefined);
    assert.equal(await harness.routeToolCall("bash", { command: readCli }), undefined);
    assert.equal(await harness.routeToolCall("bash", { command: readCurl }), undefined);

    const mutationTool = commandName === "mr-review" ? "gitlab_create_merge_request" : "github_create_pull_request";
    assert.equal((await harness.routeToolCall(mutationTool, {}))?.block, true);
    assert.equal((await harness.routeToolCall("mcp", { tool: mutationTool, args: "{}" }))?.block, true);

    for (const command of [
      "glab mr note 42 --message mutation",
      "gh pr comment 42 --body mutation",
      "curl --request POST https://api.github.com/repos/example/project/issues/42/comments",
      "curl --data payload https://api.github.com/repos/example/project/issues/42/comments",
      "curl https://attacker.example.test/api",
      "curl https://api.github.com:8443/repos/example/project/pulls/42",
      "gh pr view 42 --repo attacker/example",
      "glab mr view 42 --output json && glab mr note 42 --message mutation",
    ]) {
      const blocked = await harness.routeToolCall("bash", { command });
      assert.equal(blocked?.block, true);
    }
  }
});

test("fails closed on plan path escapes", async () => {
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
    const repositoryChanged = createHarness("idle", undefined, [], cwd);
    await repositoryChanged.commands.get("work")!.handler("Investigate the task", repositoryChanged.context);
    await runPlanningScout(repositoryChanged);
    const repositoryChangedInput = { filePath: ".plannotator/plan.md" };
    assert.equal(
      await repositoryChanged.routeToolCall("plannotator_submit_plan", repositoryChangedInput),
      undefined,
    );
    writeFileSync(join(cwd, "unrelated-change.txt"), "changed during approval\n");
    await repositoryChanged.routeToolResult(
      "plannotator_submit_plan",
      repositoryChangedInput,
      { approved: true },
    );
    await repositoryChanged.commands.get("workflow-status")!.handler("", repositoryChanged.context);
    assert.match(repositoryChanged.notices.at(-1)!.message, /approved \.plannotator\/plan\.md/i);

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

test("approved read-only review asks for confirmation without reopening planning", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-session-"));
  try {
    const reviewTarget = {
      project_id: "group/project",
      merge_request_iid: 42,
    };
    writePlan(cwd, "review.md", readOnlyPlan("gitlab-mr-review"));
    const harness = createHarness("idle", undefined, [], cwd);
    await harness.commands.get("mr-review")!.handler(
      "https://gitlab.example.test/group/project/-/merge_requests/42",
      harness.context,
    );
    await approvePlan(harness, ".plannotator/review.md");
    await harness.settleAgent();
    const pendingScoutState = (
      harness.sessionEntries.at(-1)?.data as { active?: { awaitingRemoteConfirmation?: string } }
    )?.active;
    assert.equal(pendingScoutState?.awaitingRemoteConfirmation, undefined);
    await passReadOnlyExecutionGate(harness);
    const verifiedScoutState = (
      harness.sessionEntries.at(-1)?.data as { active?: { awaitingRemoteConfirmation?: string } }
    )?.active;
    assert.equal(verifiedScoutState?.awaitingRemoteConfirmation, "review-comments");

    assert.ok(harness.requestedModes.includes("exit"));
    assert.match(
      harness.sentMessages.at(-1)!,
      /ask the user whether to execute every exact Remote action contract entry/i,
    );
    const blockedBeforeConfirmation = await harness.routeToolCall(
      "gitlab_create_merge_request_note",
      { ...reviewTarget, body: "Approved comment" },
    );
    assert.equal(blockedBeforeConfirmation?.block, true);
    assert.match(blockedBeforeConfirmation?.reason ?? "", /explicit user confirmation/i);
    const blockedEdit = await harness.routeToolCall("write", {
      path: "review-output.txt",
      content: "mutation",
    });
    assert.equal(blockedEdit?.block, true);
    assert.match(blockedEdit?.reason ?? "", /read-only execution/i);
    const blockedCommit = await harness.routeToolCall("bash", {
      command: "git commit -am mutation",
    });
    assert.equal(blockedCommit?.block, true);
    assert.match(blockedCommit?.reason ?? "", /read-only shell/i);

    const requestedModes = [...harness.requestedModes];
    const decision = await harness.routeInput("Yes, post the approved comments.");
    assert.equal(decision.action, "transform");
    if (decision.action !== "transform") assert.fail("confirmation was not transformed");
    assert.match(decision.text, /user confirmed the approved remote action/i);
    assert.deepEqual(harness.requestedModes, requestedModes);
    const forbiddenMerge = await harness.routeToolCall(
      "github_merge_pull_request",
      { method: "merge" },
    );
    assert.equal(forbiddenMerge?.block, true);
    assert.match(forbiddenMerge?.reason ?? "", /never authorizes merge/i);
    const forbiddenApproval = await harness.routeToolCall(
      "github_create_pull_request_review",
      { event: "APPROVE", body: "Looks good" },
    );
    assert.equal(forbiddenApproval?.block, true);
    assert.match(forbiddenApproval?.reason ?? "", /never authorizes.*approval/i);
    const unapprovedComment = await harness.routeToolCall(
      "gitlab_create_merge_request_note",
      { ...reviewTarget, body: "A different unapproved comment" },
    );
    assert.equal(unapprovedComment?.block, true);
    assert.match(unapprovedComment?.reason ?? "", /exactly match.*approved remote action/i);
    const commentInput = { ...reviewTarget, body: "Approved comment" };
    assert.equal(
      await harness.routeToolCall("gitlab_create_merge_request_note", commentInput),
      undefined,
    );
    await harness.commands.get("workflow-done")!.handler("", harness.context);
    assert.match(harness.notices.at(-1)!.message, /correlated tool result/i);
    await harness.routeToolResult(
      "gitlab_create_merge_request_note",
      commentInput,
      { success: true },
    );

    const declined = createHarness("idle", undefined, [], cwd);
    await declined.commands.get("mr-review")!.handler(
      "https://gitlab.example.test/group/project/-/merge_requests/42",
      declined.context,
    );
    await approvePlan(declined, ".plannotator/review.md");
    await declined.settleAgent();
    await passReadOnlyExecutionGate(declined);
    const noDecision = await declined.routeInput("No, do not post anything.");
    assert.equal(noDecision.action, "transform");
    const blockedAfterNo = await declined.routeToolCall(
      "gitlab_create_merge_request_note",
      { ...reviewTarget, body: "Must stay local" },
    );
    assert.equal(blockedAfterNo?.block, true);
    assert.match(blockedAfterNo?.reason ?? "", /explicit user confirmation/i);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("hosted review actions are bound to the review platform and target", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-session-"));
  try {
    const githubAction = [{
      id: "wrong-platform",
      toolName: "github_create_pull_request_review_comment",
      input: {
        owner: "group",
        repo: "project",
        pull_number: 42,
        body: "Wrong platform",
      },
    }];
    writePlan(cwd, "wrong-platform.md", readOnlyPlan("gitlab-mr-review", githubAction));
    const wrongPlatform = createHarness("idle", undefined, [], cwd);
    await wrongPlatform.commands.get("mr-review")!.handler(
      "https://gitlab.example.test/group/project/-/merge_requests/42",
      wrongPlatform.context,
    );
    await runPlanningScout(wrongPlatform);
    const wrongPlatformResult = await wrongPlatform.routeToolCall("plannotator_submit_plan", {
      filePath: ".plannotator/wrong-platform.md",
    });
    assert.equal(wrongPlatformResult?.block, true);
    assert.match(wrongPlatformResult?.reason ?? "", /review platform/i);

    const wrongTargetAction = [{
      id: "wrong-target",
      toolName: "gitlab_create_merge_request_note",
      input: {
        project_id: "other/project",
        merge_request_iid: 99,
        body: "Wrong target",
      },
    }];
    writePlan(cwd, "wrong-target.md", readOnlyPlan("gitlab-mr-review", wrongTargetAction));
    const wrongTarget = createHarness("idle", undefined, [], cwd);
    await wrongTarget.commands.get("mr-review")!.handler(
      "https://gitlab.example.test/group/project/-/merge_requests/42",
      wrongTarget.context,
    );
    await runPlanningScout(wrongTarget);
    const wrongTargetResult = await wrongTarget.routeToolCall("plannotator_submit_plan", {
      filePath: ".plannotator/wrong-target.md",
    });
    assert.equal(wrongTargetResult?.block, true);
    assert.match(wrongTargetResult?.reason ?? "", /review URL target/i);

    const contradictoryTargetAction = [{
      id: "contradictory-target",
      toolName: "gitlab_create_merge_request_note",
      input: {
        review_url: "https://gitlab.example.test/group/project/-/merge_requests/42",
        project_id: "other/project",
        merge_request_iid: 99,
        body: "Contradictory target",
      },
    }];
    writePlan(
      cwd,
      "contradictory-target.md",
      readOnlyPlan("gitlab-mr-review", contradictoryTargetAction),
    );
    const contradictoryTarget = createHarness("idle", undefined, [], cwd);
    await contradictoryTarget.commands.get("mr-review")!.handler(
      "https://gitlab.example.test/group/project/-/merge_requests/42",
      contradictoryTarget.context,
    );
    await runPlanningScout(contradictoryTarget);
    const contradictoryTargetResult = await contradictoryTarget.routeToolCall(
      "plannotator_submit_plan",
      { filePath: ".plannotator/contradictory-target.md" },
    );
    assert.equal(contradictoryTargetResult?.block, true);
    assert.match(contradictoryTargetResult?.reason ?? "", /review URL target/i);

    for (const [name, command] of [
      [
        "wrong-cli-number",
        "glab mr note 99 --repo group/project --message 42",
      ],
      [
        "wrong-curl-project",
        "curl --request POST https://gitlab.example.test/api/v4/projects/other%2Fproject/merge_requests/42/notes",
      ],
      [
        "containing-curl-project",
        "curl --request POST https://gitlab.example.test/api/v4/projects/other%2Fgroup%2Fproject/merge_requests/42/notes",
      ],
    ] as const) {
      writePlan(
        cwd,
        `${name}.md`,
        readOnlyPlan("gitlab-mr-review", [{
          id: name,
          toolName: "bash",
          input: { command },
        }]),
      );
      const mismatched = createHarness("idle", undefined, [], cwd);
      await mismatched.commands.get("mr-review")!.handler(
        "https://gitlab.example.test/group/project/-/merge_requests/42",
        mismatched.context,
      );
      await runPlanningScout(mismatched);
      const result = await mismatched.routeToolCall("plannotator_submit_plan", {
        filePath: `.plannotator/${name}.md`,
      });
      assert.equal(result?.block, true);
      assert.match(result?.reason ?? "", /review URL target/i);
    }

    const mixedTargetAction = [{
      id: "mixed-targets",
      toolName: "gitlab_create_merge_request_note",
      input: {
        project_id: "group/project",
        merge_request_iid: 42,
        nested: {
          project_id: "other/project",
          merge_request_iid: 99,
        },
        body: "One correct target must not mask a wrong one.",
      },
    }];
    writePlan(cwd, "mixed-targets.md", readOnlyPlan("gitlab-mr-review", mixedTargetAction));
    const mixedTargets = createHarness("idle", undefined, [], cwd);
    await mixedTargets.commands.get("mr-review")!.handler(
      "https://gitlab.example.test/group/project/-/merge_requests/42",
      mixedTargets.context,
    );
    await runPlanningScout(mixedTargets);
    const mixedTargetResult = await mixedTargets.routeToolCall("plannotator_submit_plan", {
      filePath: ".plannotator/mixed-targets.md",
    });
    assert.equal(mixedTargetResult?.block, true);
    assert.match(mixedTargetResult?.reason ?? "", /review URL target/i);

    const gheAction = [{
      id: "ghe-without-host",
      toolName: "github_create_pull_request_review_comment",
      input: {
        owner: "group",
        repo: "project",
        pull_number: 42,
        body: "https://github.example.test/group/project/pull/42",
      },
    }];
    writePlan(cwd, "ghe-without-host.md", readOnlyPlan("gitlab-mr-review", gheAction));
    const ghe = createHarness("idle", undefined, [], cwd);
    await ghe.commands.get("mr-review")!.handler(
      "https://github.example.test/group/project/pull/42",
      ghe.context,
    );
    await runPlanningScout(ghe);
    const gheResult = await ghe.routeToolCall("plannotator_submit_plan", {
      filePath: ".plannotator/ghe-without-host.md",
    });
    assert.equal(gheResult?.block, true);
    assert.match(gheResult?.reason ?? "", /review URL target/i);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("clean hosted reviews complete without a remote-action confirmation", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-session-"));
  try {
    writePlan(cwd, "clean-review.md", readOnlyPlan("gitlab-mr-review", []));
    const harness = createHarness("idle", undefined, [], cwd);
    await harness.commands.get("mr-review")!.handler(
      "https://gitlab.example.test/group/project/-/merge_requests/42",
      harness.context,
    );
    await approvePlan(harness, ".plannotator/clean-review.md");
    await harness.settleAgent();
    await passReadOnlyExecutionGate(harness);
    const state = (
      harness.sessionEntries.at(-1)?.data as { active?: { awaitingRemoteConfirmation?: string } }
    )?.active;
    assert.equal(state?.awaitingRemoteConfirmation, undefined);

    await harness.commands.get("workflow-done")!.handler("", harness.context);
    assert.match(harness.notices.at(-1)!.message, /workflow loop finished/i);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("remote push contracts reject force refspecs", async () => {
  const base = mkdtempSync(join(tmpdir(), "pi-workflow-"));
  const planCwd = join(base, "plan-artifact");
  const repositoryCwd = join(base, "review-session");
  try {
    mkdirSync(planCwd);
    mkdirSync(repositoryCwd);
    execFileSync("git", ["init", "--quiet"], { cwd: repositoryCwd });
    execFileSync("git", ["switch", "--quiet", "-c", "review-session"], {
      cwd: repositoryCwd,
    });
    execFileSync(
      "git",
      ["remote", "add", "origin", "https://gitlab.example.test/group/project.git"],
      { cwd: repositoryCwd },
    );
    for (const [name, command] of [
      ["force-refspec", "git push origin +HEAD:review-session"],
      ["delete-short", "git push -d origin review-session"],
      ["force-cluster", "git push -fu origin HEAD:review-session"],
      ["force-includes", "git push --force-if-includes origin HEAD:review-session"],
    ] as const) {
      writePlan(
        planCwd,
        `${name}.md`,
        multiRepositoryCodePlan(
          [{
            cwd: repositoryCwd,
            branch: "review-session",
            commitTitle: "fix(review): address feedback",
          }],
          "gitlab-mr-comments",
          [{
            id: name,
            toolName: "bash",
            input: { cwd: repositoryCwd, command },
          }],
        ),
      );
      const harness = createHarness(
        "idle",
        undefined,
        [],
        planCwd,
        { sessionKey: "review-session", worktreeBaseDir: base },
      );
      await harness.commands.get("mr-comments")!.handler(
        "https://gitlab.example.test/group/project/-/merge_requests/42",
        harness.context,
      );
      await runPlanningScout(harness);
      const result = await harness.routeToolCall("plannotator_submit_plan", {
        filePath: `.plannotator/${name}.md`,
      });

      assert.equal(result?.block, true);
      assert.match(result?.reason ?? "", /force push|deletion/i);
    }
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("read-only completion proves the approved repository stayed unchanged", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-session-"));
  try {
    writePlan(cwd, "plan.md", readOnlyPlan("local-work"));
    const harness = createHarness("idle", undefined, [], cwd);
    await harness.commands.get("work")!.handler("Investigate the task", harness.context);
    await approvePlan(harness);
    await harness.settleAgent();
    await passReadOnlyExecutionGate(harness);
    writeFileSync(join(cwd, "unexpected.txt"), "mutation after approval\n");

    await harness.commands.get("workflow-done")!.handler("", harness.context);

    assert.match(harness.notices.at(-1)!.message, /repository changed after read-only plan approval/i);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("read-only completion requires the approved execution and report turn", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-session-"));
  try {
    writePlan(cwd, "plan.md", readOnlyPlan("local-work"));
    const harness = createHarness("idle", undefined, [], cwd);
    await harness.commands.get("work")!.handler("Investigate the task", harness.context);
    await approvePlan(harness);

    await harness.commands.get("workflow-done")!.handler("", harness.context);
    assert.match(harness.notices.at(-1)!.message, /read-only plan has not completed/i);

    await harness.settleAgent();
    await passReadOnlyExecutionGate(harness);
    await harness.commands.get("workflow-done")!.handler("", harness.context);
    assert.match(harness.notices.at(-1)!.message, /workflow loop finished/i);
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

test("resumes a pending approved continuation after extension reload", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-session-"));
  try {
    writePlan(cwd, "plan.md", codePlan(cwd));
    const first = createHarness("idle", undefined, [], cwd);
    await first.commands.get("work")!.handler("Implement the approved plan", first.context);
    await approvePlan(first);

    const restored = createHarness("planning", undefined, first.sessionEntries, cwd);
    await restored.startSession();

    assert.equal(restored.requestedModes.at(-1), "exit");
    assert.match(
      restored.sentMessages.at(-1)!,
      /launch one compliant verified worker/i,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("re-dispatches an approved code plan after a reload without a pending continuation", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-session-"));
  try {
    writePlan(cwd, "plan.md", codePlan(cwd));
    const first = createHarness("idle", undefined, [], cwd);
    await first.commands.get("work")!.handler("Implement the approved plan", first.context);
    await approvePlan(first);
    await first.settleAgent();

    const restored = createHarness("idle", undefined, first.sessionEntries, cwd);
    await restored.startSession();

    assert.match(
      restored.sentMessages.at(-1)!,
      /launch one compliant verified worker/i,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("reload releases interrupted worker and remote-action calls", async () => {
  const codeCwd = mkdtempSync(join(tmpdir(), "pi-session-"));
  const reviewCwd = mkdtempSync(join(tmpdir(), "pi-session-"));
  try {
    writePlan(codeCwd, "plan.md", codePlan(codeCwd));
    const firstCode = createHarness("idle", undefined, [], codeCwd);
    await firstCode.commands.get("work")!.handler("Implement safely", firstCode.context);
    await approvePlan(firstCode);
    firstCode.setPhase("executing");
    const workerInput = {
      agent: "worker",
      task: "Implement the approved change",
      context: "fresh",
      cwd: codeCwd,
      acceptance: verifiedAcceptance(workerVerification),
    };
    assert.equal(await firstCode.routeToolCall("subagent", workerInput), undefined);

    const restoredCode = createHarness(
      "executing",
      undefined,
      firstCode.sessionEntries,
      codeCwd,
    );
    await restoredCode.startSession();
    assert.equal(await restoredCode.routeToolCall("subagent", workerInput), undefined);

    writePlan(reviewCwd, "review.md", readOnlyPlan("gitlab-mr-review"));
    const firstReview = createHarness("idle", undefined, [], reviewCwd);
    await firstReview.commands.get("mr-review")!.handler(
      "https://gitlab.example.test/group/project/-/merge_requests/42",
      firstReview.context,
    );
    await approvePlan(firstReview, ".plannotator/review.md");
    await firstReview.settleAgent();
    await passReadOnlyExecutionGate(firstReview);
    await firstReview.routeInput("Yes, post the approved comment.");
    const commentInput = {
      project_id: "group/project",
      merge_request_iid: 42,
      body: "Approved comment",
    };
    assert.equal(
      await firstReview.routeToolCall("gitlab_create_merge_request_note", commentInput),
      undefined,
    );

    const restoredReview = createHarness(
      "idle",
      undefined,
      firstReview.sessionEntries,
      reviewCwd,
    );
    await restoredReview.startSession();
    const restoredRemoteState = (
      restoredReview.sessionEntries.at(-1)?.data as {
        active?: { approvedPlan?: unknown; awaitingRemoteConfirmation?: string };
      }
    )?.active;
    assert.ok(restoredRemoteState?.approvedPlan);
    assert.equal(restoredRemoteState?.awaitingRemoteConfirmation, "review-comments");
    const decline = await restoredReview.routeInput("No, do not retry the interrupted action.");
    assert.equal(decline.action, "transform");
    if (decline.action !== "transform") assert.fail("restored decision was not transformed");
    assert.match(decline.text, /not authorized/i);
    const declinedRemoteState = (
      restoredReview.sessionEntries.at(-1)?.data as { active?: { approvedPlan?: unknown } }
    )?.active;
    assert.ok(declinedRemoteState?.approvedPlan);
    await restoredReview.commands.get("workflow-done")!.handler("", restoredReview.context);
    assert.match(restoredReview.notices.at(-1)!.message, /workflow loop finished/i);
  } finally {
    rmSync(codeCwd, { recursive: true, force: true });
    rmSync(reviewCwd, { recursive: true, force: true });
  }
});

test("persists workflow abort as a tombstone without claiming completion", async () => {
  const first = createHarness();
  await first.commands.get("ticket")!.handler("ABC-123", first.context);
  await first.commands.get("workflow-abort")!.handler("", first.context);

  const restored = createHarness("idle", undefined, first.sessionEntries);
  await restored.startSession();

  assert.deepEqual(await restored.routeInput("Unrelated request."), { action: "continue" });
});

test("continues an aborted workflow through a new planning iteration", async () => {
  const first = createHarness();
  await first.commands.get("ticket")!.handler("ABC-123", first.context);
  await first.commands.get("workflow-abort")!.handler("", first.context);

  const restored = createHarness("idle", undefined, first.sessionEntries);
  await restored.startSession();
  await restored.commands.get("workflow-continue")!.handler("", restored.context);

  assert.match(restored.sentMessages.at(-1)!, /^Workflow: jira-ticket/);
  assert.match(restored.sentMessages.at(-1)!, /Workflow iteration 2:/);
  assert.match(restored.sentMessages.at(-1)!, /Continue from this workflow after \/workflow-abort\./);
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

test("allows supervisor replies during an active workflow", async () => {
  const harness = createHarness();
  await harness.commands.get("ticket")!.handler("ABC-123", harness.context);

  const result = await harness.routeToolCall("subagent_supervisor", {
    action: "reply",
    replyTo: "request-1",
    message: "Continue with the approved scope.",
  });

  assert.equal(result, undefined);
});

test("blocks subagent_wait during an active workflow so supervisor requests reach the user", async () => {
  const harness = createHarness();
  await harness.commands.get("ticket")!.handler("ABC-123", harness.context);

  const blocked = await harness.routeToolCall("subagent_wait", { id: "worker-run" });

  assert.equal(blocked?.block, true);
  assert.match(blocked?.reason ?? "", /must not block on subagent_wait/i);
  assert.match(blocked?.reason ?? "", /supervisor decision/i);
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
    await harness.settleAgent();
    await passReadOnlyExecutionGate(harness);
    await harness.commands.get("workflow-done")!.handler("", harness.context);

    assert.ok(harness.requestedModes.includes("exit"));
    assert.match(harness.notices.at(-1)!.message, /workflow loop finished/i);
    const requestedModes = [...harness.requestedModes];
    assert.deepEqual(await harness.routeInput("Unrelated request after completion."), {
      action: "continue",
    });
    assert.deepEqual(harness.requestedModes, requestedModes);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("requires a supported review URL", async () => {
  const { commands, context, notices, requestedModes, sentMessages } = createHarness();

  await commands.get("mr-review")!.handler("not-a-url", context);

  assert.deepEqual(requestedModes, []);
  assert.equal(sentMessages.length, 0);
  assert.match(notices[0]!.message, /hosted merge-request or pull-request URL/);
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

    writePlan(cwd, "legacy-contract.md", codePlan(cwd));
    const legacy = createHarness(
      "idle",
      undefined,
      [],
      cwd,
      { allowLegacyVerificationContracts: false },
    );
    await legacy.commands.get("work")!.handler("Implement the plan", legacy.context);
    await runPlanningScout(legacy);
    const legacyPlan = await legacy.routeToolCall("plannotator_submit_plan", {
      filePath: ".plannotator/legacy-contract.md",
    });
    assert.equal(legacyPlan?.block, true);
    assert.match(legacyPlan?.reason ?? "", /must use the repositories array/i);

    const wrappedLegacyContract = {
      repositories: [{
        cwd,
        worker: workerVerification,
        reviewer: reviewerVerification,
      }],
    };
    writePlan(
      cwd,
      "wrapped-legacy-contract.md",
      codePlan(cwd).replace(
        JSON.stringify(
          { cwd, worker: workerVerification, reviewer: reviewerVerification },
          null,
          2,
        ),
        JSON.stringify(wrappedLegacyContract, null, 2),
      ),
    );
    const wrappedLegacyPlan = await legacy.routeToolCall("plannotator_submit_plan", {
      filePath: ".plannotator/wrapped-legacy-contract.md",
    });
    assert.equal(wrappedLegacyPlan?.block, true);
    assert.match(
      wrappedLegacyPlan?.reason ?? "",
      /entries must include branch, commitTitle, and acceptanceCriteria/i,
    );

    writePlan(
      cwd,
      "missing-contract.md",
      "Workflow: local-work\n\n## Implementation plan\n- [ ] Implement\n\n## Done when\n- [ ] Implemented.\n",
    );
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
      readOnlyPlan("local-work").replace(
        "Not applicable - read-only plan.",
        "Not applicable - read-only plan.\nExtra verification text",
      ),
    );
    const mixedContract = createHarness("idle", undefined, [], cwd);
    await mixedContract.commands.get("work")!.handler("Implement the plan", mixedContract.context);
    await runPlanningScout(mixedContract);
    const mixedPlan = await mixedContract.routeToolCall("plannotator_submit_plan", {
      filePath: ".plannotator/mixed-contract.md",
    });
    assert.equal(mixedPlan?.block, true);
    assert.match(mixedPlan?.reason ?? "", /body must be exactly/i);

    writePlan(
      cwd,
      "missing-heading.md",
      readOnlyPlan("local-work").replace("## Risks\n", "## Missing risks\n"),
    );
    const missingHeading = createHarness("idle", undefined, [], cwd);
    await missingHeading.commands.get("work")!.handler("Investigate safely", missingHeading.context);
    await runPlanningScout(missingHeading);
    const missingHeadingPlan = await missingHeading.routeToolCall("plannotator_submit_plan", {
      filePath: ".plannotator/missing-heading.md",
    });
    assert.equal(missingHeadingPlan?.block, true);
    assert.match(missingHeadingPlan?.reason ?? "", /missing required.*Risks/i);

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

test("rejects plans without explicit done-when acceptance criteria", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-session-"));
  try {
    writePlan(
      cwd,
      "missing-done-when.md",
      "Workflow: local-work\n\n## Implementation plan\n- [ ] Implement\n\n## Verification contract\nNot applicable - read-only plan.\n",
    );
    const harness = createHarness("idle", undefined, [], cwd);
    await harness.commands.get("work")!.handler("Implement safely", harness.context);
    await runPlanningScout(harness);

    const result = await harness.routeToolCall("plannotator_submit_plan", {
      filePath: ".plannotator/missing-done-when.md",
    });

    assert.equal(result?.block, true);
    assert.match(result?.reason ?? "", /Done when/i);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("requires the execution contract to cover exactly the plan acceptance criteria", async () => {
  const base = mkdtempSync(join(tmpdir(), "pi-workflow-"));
  const planCwd = join(base, "plan-artifact");
  const targetCwd = join(base, "api-fix-cache");
  try {
    mkdirSync(planCwd);
    mkdirSync(targetCwd);
    execFileSync("git", ["init", "--quiet"], { cwd: targetCwd });
    const mismatchedPlan = multiRepositoryCodePlan([
      {
        cwd: targetCwd,
        branch: "fix-cache",
        commitTitle: "fix(api): prevent stale cache",
      },
    ]).replace(
      '"Every repository passes focused and complete verification."',
      '"An unapproved criterion replaces the planned criterion."',
    );
    writePlan(planCwd, "mismatched-criteria.md", mismatchedPlan);
    const harness = createHarness(
      "idle",
      undefined,
      [],
      planCwd,
      { worktreeBaseDir: base },
    );
    await harness.commands.get("work")!.handler("Fix cache behavior", harness.context);
    await runPlanningScout(harness);

    const result = await harness.routeToolCall("plannotator_submit_plan", {
      filePath: ".plannotator/mismatched-criteria.md",
    });

    assert.equal(result?.block, true);
    assert.match(result?.reason ?? "", /acceptance criteria.*Done when/i);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("requires each approved worktree to be on its exact contract branch", async () => {
  const base = mkdtempSync(join(tmpdir(), "pi-workflow-"));
  const planCwd = join(base, "plan-artifact");
  const targetCwd = join(base, "api-fix-cache");
  const repository = {
    cwd: targetCwd,
    branch: "fix-cache",
    commitTitle: "fix(api): prevent stale cache",
  };
  try {
    mkdirSync(planCwd);
    mkdirSync(targetCwd);
    execFileSync("git", ["init", "--quiet"], { cwd: targetCwd });
    writePlan(planCwd, "wrong-branch.md", multiRepositoryCodePlan([repository]));
    const harness = createHarness(
      "idle",
      undefined,
      [],
      planCwd,
      { worktreeBaseDir: base },
    );
    await harness.commands.get("work")!.handler("Fix cache behavior", harness.context);
    await approvePlan(harness, ".plannotator/wrong-branch.md");
    harness.setPhase("executing");

    const result = await harness.routeToolCall("subagent", {
      agent: "worker",
      task: "Implement the approved cache fix",
      context: "fresh",
      cwd: targetCwd,
      skill: [
        "test-driven-development",
        "verification-before-completion",
        "receiving-code-review",
      ],
      acceptance: {
        ...verifiedAcceptance(workerVerification),
        criteria: [
          "Cross-repository behavior is implemented.",
          "Every repository passes focused and complete verification.",
        ],
      },
    });

    assert.equal(result?.block, true);
    assert.match(result?.reason ?? "", /branch.*fix-cache/i);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("reused worktrees must belong to the approved source repository", async () => {
  const base = mkdtempSync(join(tmpdir(), "pi-workflow-"));
  const planCwd = join(base, "plan-artifact");
  const sourceCwd = join(base, "api");
  const targetCwd = join(base, "api-fix-cache");
  try {
    mkdirSync(planCwd);
    mkdirSync(sourceCwd);
    mkdirSync(targetCwd);
    execFileSync("git", ["init", "--quiet"], { cwd: sourceCwd });
    execFileSync("git", ["init", "--quiet"], { cwd: targetCwd });
    execFileSync("git", ["switch", "--quiet", "-c", "fix-cache"], { cwd: targetCwd });
    writePlan(
      planCwd,
      "wrong-source.md",
      multiRepositoryCodePlan([{
        cwd: targetCwd,
        sourceCwd,
        baseHead: "UNBORN",
        branch: "fix-cache",
        commitTitle: "fix(api): prevent stale cache",
      }]),
    );
    const harness = createHarness(
      "idle",
      undefined,
      [],
      planCwd,
      { worktreeBaseDir: base },
    );
    await harness.commands.get("work")!.handler("Fix cache behavior", harness.context);
    await approvePlan(harness, ".plannotator/wrong-source.md");
    harness.setPhase("executing");
    const result = await harness.routeToolCall("subagent", {
      agent: "worker",
      task: "Implement the approved cache fix",
      context: "fresh",
      cwd: targetCwd,
      skill: [
        "test-driven-development",
        "verification-before-completion",
        "receiving-code-review",
      ],
      acceptance: {
        ...verifiedAcceptance(workerVerification),
        criteria: [
          "Cross-repository behavior is implemented.",
          "Every repository passes focused and complete verification.",
        ],
      },
    });

    assert.equal(result?.block, true);
    assert.match(result?.reason ?? "", /approved source repository/i);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("binds MR fixes to the user's current checkout and Jira summaries to lowercase hyphen form", async () => {
  const base = mkdtempSync(join(tmpdir(), "pi-workflow-"));
  const planCwd = join(base, "plan-artifact");
  const jiraCwd = join(base, "api-ABC-123_Fix-Cache");
  try {
    mkdirSync(planCwd);
    mkdirSync(jiraCwd);
    execFileSync("git", ["init", "--quiet"], { cwd: planCwd });
    execFileSync("git", ["switch", "--quiet", "-c", "review-fix"], { cwd: planCwd });
    execFileSync("git", ["init", "--quiet"], { cwd: jiraCwd });

    writePlan(
      planCwd,
      "mr-session.md",
      multiRepositoryCodePlan(
        [{
          cwd: planCwd,
          branch: "review-fix",
          commitTitle: "fix(review): address feedback",
        }],
        "gitlab-mr-comments",
      ),
    );
    const mr = createHarness(
      "idle",
      undefined,
      [],
      planCwd,
      { worktreeBaseDir: base },
    );
    await mr.commands.get("mr-comments")!.handler(
      "https://gitlab.example.test/group/project/-/merge_requests/42",
      mr.context,
    );
    await runPlanningScout(mr);
    const mrResult = await mr.routeToolCall("plannotator_submit_plan", {
      filePath: ".plannotator/mr-session.md",
    });
    assert.equal(mrResult, undefined);

    writePlan(
      planCwd,
      "jira-summary.md",
      multiRepositoryCodePlan(
        [{
          cwd: jiraCwd,
          branch: "ABC-123_Fix-Cache",
          commitTitle: "fix(cache): prevent stale reads",
        }],
        "jira-ticket",
      ),
    );
    const jira = createHarness(
      "idle",
      undefined,
      [],
      planCwd,
      { worktreeBaseDir: base },
    );
    await jira.commands.get("ticket")!.handler("ABC-123", jira.context);
    await runPlanningScout(jira);
    const jiraResult = await jira.routeToolCall("plannotator_submit_plan", {
      filePath: ".plannotator/jira-summary.md",
    });
    assert.equal(jiraResult?.block, true);
    assert.match(jiraResult?.reason ?? "", /Jira repository directories/i);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("runs approved repository workers and reviewers in parallel and requires semantic commits", async () => {
  const base = mkdtempSync(join(tmpdir(), "pi-workflow-"));
  const planCwd = join(base, "plan-artifact");
  const repositories = [
    {
      cwd: join(base, "api-fix-cache"),
      branch: "fix-cache",
      commitTitle: "fix(api): prevent stale cache",
    },
    {
      cwd: join(base, "web-fix-cache"),
      branch: "fix-cache",
      commitTitle: "fix(web): refresh stale cache",
    },
  ];
  try {
    mkdirSync(planCwd);
    for (const repository of repositories) {
      mkdirSync(repository.cwd);
      execFileSync("git", ["init", "--quiet"], { cwd: repository.cwd });
      execFileSync("git", ["switch", "--quiet", "-c", repository.branch], {
        cwd: repository.cwd,
      });
    }
    writePlan(planCwd, "multi.md", multiRepositoryCodePlan(repositories));
    const harness = createHarness(
      "idle",
      undefined,
      [],
      planCwd,
      { worktreeBaseDir: base },
    );
    await harness.commands.get("work")!.handler(
      "Fix cache behavior across API and web repositories",
      harness.context,
    );
    await approvePlan(harness, ".plannotator/multi.md");
    harness.setPhase("executing");
    assert.equal(
      await harness.routeToolCall("bash", {
        command:
          `git -C ${repositories[0]!.cwd} worktree add -b ${repositories[0]!.branch} ${repositories[0]!.cwd} UNBORN`,
      }),
      undefined,
    );
    const wrongBaseSetup = await harness.routeToolCall("bash", {
      command:
        `git -C ${repositories[0]!.cwd} worktree add -b ${repositories[0]!.branch} ${repositories[0]!.cwd} HEAD`,
    });
    assert.equal(wrongBaseSetup?.block, true);
    assert.match(wrongBaseSetup?.reason ?? "", /exact approved worktree setup/i);
    const parentWrite = await harness.routeToolCall("write", {
      path: join(repositories[0]!.cwd, "parent-change.txt"),
      content: "parent mutation",
    });
    assert.equal(parentWrite?.block, true);
    assert.match(parentWrite?.reason ?? "", /contract-bound worker/i);
    const parentCommit = await harness.routeToolCall("bash", {
      command: "git commit --allow-empty -m 'fix: parent mutation'",
    });
    assert.equal(parentCommit?.block, true);
    assert.match(parentCommit?.reason ?? "", /contract-bound workers/i);
    const unknownMutation = await harness.routeToolCall("slack_send_message", {
      channel: "review",
      message: "unapproved external mutation",
    });
    assert.equal(unknownMutation?.block, true);
    assert.match(unknownMutation?.reason ?? "", /blocks unclassified tool/i);

    const criteria = [
      "Cross-repository behavior is implemented.",
      "Every repository passes focused and complete verification.",
    ];
    const workerInput = {
      context: "fresh",
      tasks: repositories.map((repository) => ({
        agent: "worker",
        task: `Implement approved plan and commit as ${repository.commitTitle}`,
        cwd: repository.cwd,
        skill: [
          "test-driven-development",
          "verification-before-completion",
          "receiving-code-review",
        ],
        acceptance: {
          ...verifiedAcceptance(workerVerification),
          criteria,
        },
      })),
    };
    assert.equal(await harness.routeToolCall("subagent", workerInput), undefined);
    const missingTddEvidence = parallelVerifiedResult(
      "worker",
      repositories.length,
      workerVerification,
    );
    delete missingTddEvidence.results[0]!.acceptance.childReport.commandsRun;
    await harness.routeToolResult("subagent", workerInput, missingTddEvidence);
    await harness.commands.get("workflow-status")!.handler("", harness.context);
    assert.match(harness.notices.at(-1)!.message, /worker=failed/i);
    assert.equal(await harness.routeToolCall("subagent", workerInput), undefined);
    const wrongCriterionEvidence = parallelVerifiedResult(
      "worker",
      repositories.length,
      workerVerification,
    );
    wrongCriterionEvidence.results[0]!.acceptance.childReport.criteriaSatisfied[0]!.criterion =
      "An unrelated criterion.";
    await harness.routeToolResult("subagent", workerInput, wrongCriterionEvidence);
    await harness.commands.get("workflow-status")!.handler("", harness.context);
    assert.match(harness.notices.at(-1)!.message, /worker=failed/i);
    const wrongCriterionState = (
      harness.sessionEntries.at(-1)?.data as {
        active?: { executionGates?: Array<{ workerReason?: string }> };
      }
    )?.active;
    assert.match(
      wrongCriterionState?.executionGates?.[0]?.workerReason ?? "",
      /criterion.*exact/i,
    );
    assert.equal(await harness.routeToolCall("subagent", workerInput), undefined);
    const unrelatedTddEvidence = parallelVerifiedResult(
      "worker",
      repositories.length,
      workerVerification,
    );
    unrelatedTddEvidence.results[0]!.acceptance.childReport.commandsRun = [
      {
        command: "node --test unrelated.test.ts",
        result: "failed",
        summary: "Unrelated RED.",
      },
      {
        command: "node --test focused.test.ts",
        result: "passed",
        summary: "GREEN.",
      },
    ];
    await harness.routeToolResult("subagent", workerInput, unrelatedTddEvidence);
    await harness.commands.get("workflow-status")!.handler("", harness.context);
    assert.match(harness.notices.at(-1)!.message, /worker=failed/i);
    const unrelatedTddState = (
      harness.sessionEntries.at(-1)?.data as {
        active?: { executionGates?: Array<{ workerReason?: string }> };
      }
    )?.active;
    assert.match(
      unrelatedTddState?.executionGates?.[0]?.workerReason ?? "",
      /same.*RED.*GREEN/i,
    );
    assert.equal(await harness.routeToolCall("subagent", workerInput), undefined);

    for (const repository of repositories) {
      writeFileSync(join(repository.cwd, "change.txt"), `${repository.commitTitle}\n`);
      execFileSync("git", ["add", "change.txt"], { cwd: repository.cwd });
      execFileSync(
        "git",
        [
          "-c",
          "user.name=Workflow Test",
          "-c",
          "user.email=workflow@example.test",
          "commit",
          "--quiet",
          "-m",
          repository.commitTitle,
        ],
        { cwd: repository.cwd },
      );
    }
    const dirtyPath = join(repositories[0]!.cwd, "leftover.txt");
    writeFileSync(dirtyPath, "uncommitted leftover\n");
    await harness.routeToolResult(
      "subagent",
      workerInput,
      parallelVerifiedResult("worker", repositories.length, workerVerification),
    );
    const dirtyState = (
      harness.sessionEntries.at(-1)?.data as {
        active?: { executionGates?: Array<{ cwd?: string; workerReason?: string }> };
      }
    )?.active;
    assert.match(
      dirtyState?.executionGates?.find((gate) => gate.cwd === repositories[0]!.cwd)
        ?.workerReason ?? "",
      /clean worktree/i,
    );
    rmSync(dirtyPath);
    const cleanWorkerInput = {
      context: "fresh",
      tasks: [workerInput.tasks[0]!],
    };
    assert.equal(await harness.routeToolCall("subagent", cleanWorkerInput), undefined);
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Workflow Test",
        "-c",
        "user.email=workflow@example.test",
        "commit",
        "--quiet",
        "--allow-empty",
        "-m",
        repositories[0]!.commitTitle,
      ],
      { cwd: repositories[0]!.cwd },
    );
    await harness.routeToolResult(
      "subagent",
      cleanWorkerInput,
      parallelVerifiedResult("worker", 1, workerVerification),
    );
    const cleanState = (
      harness.sessionEntries.at(-1)?.data as {
        active?: {
          executionGates?: Array<{ cwd?: string; worker?: string; workerReason?: string }>;
        };
      }
    )?.active;
    assert.deepEqual(
      cleanState?.executionGates?.map((gate) => ({
        cwd: gate.cwd,
        worker: gate.worker,
        workerReason: gate.workerReason,
      })),
      repositories.map((repository) => ({
        cwd: repository.cwd,
        worker: "verified",
        workerReason: undefined,
      })),
    );

    const reviewerInput = {
      context: "fresh",
      tasks: repositories.map((repository) => ({
        agent: "reviewer",
        task: "Review approved acceptance criteria and committed diff",
        cwd: repository.cwd,
        acceptance: {
          ...verifiedAcceptance(reviewerVerification),
          criteria,
        },
      })),
    };
    assert.equal(await harness.routeToolCall("subagent", reviewerInput), undefined);
    const initialReviewerResult = parallelVerifiedResult(
      "reviewer",
      repositories.length,
      reviewerVerification,
    );
    initialReviewerResult.results[0]!.acceptance.childReport.reviewFindings = [
      "API repository still needs one correction.",
    ];
    await harness.routeToolResult(
      "subagent",
      reviewerInput,
      initialReviewerResult,
    );
    await harness.commands.get("workflow-status")!.handler("", harness.context);
    assert.match(harness.notices.at(-1)!.message, /reviewer=required/i);

    const affectedRepository = repositories[0]!;
    const remediationWorkerInput = {
      context: "fresh",
      tasks: [workerInput.tasks[0]!],
    };
    assert.equal(
      await harness.routeToolCall("subagent", remediationWorkerInput),
      undefined,
    );
    writeFileSync(join(affectedRepository.cwd, "change.txt"), "remediated\n");
    execFileSync("git", ["add", "change.txt"], { cwd: affectedRepository.cwd });
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Workflow Test",
        "-c",
        "user.email=workflow@example.test",
        "commit",
        "--quiet",
        "-m",
        affectedRepository.commitTitle,
      ],
      { cwd: affectedRepository.cwd },
    );
    await harness.routeToolResult(
      "subagent",
      remediationWorkerInput,
      parallelVerifiedResult("worker", 1, workerVerification),
    );

    const remediationReviewerInput = {
      context: "fresh",
      tasks: [reviewerInput.tasks[0]!],
    };
    assert.equal(
      await harness.routeToolCall("subagent", remediationReviewerInput),
      undefined,
    );
    await harness.routeToolResult(
      "subagent",
      remediationReviewerInput,
      parallelVerifiedResult("reviewer", 1, reviewerVerification),
    );

    await harness.commands.get("workflow-status")!.handler("", harness.context);
    assert.match(harness.notices.at(-1)!.message, /repositories=2/i);
    assert.match(harness.notices.at(-1)!.message, /worker=verified/i);
    assert.match(harness.notices.at(-1)!.message, /reviewer=verified/i);

    await harness.commands.get("workflow-done")!.handler("", harness.context);
    assert.match(harness.notices.at(-1)!.message, /workflow loop finished/i);
  } finally {
    rmSync(base, { recursive: true, force: true });
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

test("Jira workflow defines one approved parallel multi-repository execution", () => {
  const template = readFileSync(new URL("../workflows/jira-ticket.md", import.meta.url), "utf8");

  assert.match(template, /extra information is optional/i);
  assert.match(template, /authoritative ticket through Atlassian MCP early/i);
  assert.match(template, /rg.*ast-grep.*MCP tools/i);
  assert.match(template, /Superpowers `brainstorming`/i);
  assert.match(template, /one approval covers the complete listed repository set/i);
  assert.match(template, /one foreground parallel subagent call/i);
  assert.match(template, /red.*green.*refactor/i);
  assert.match(template, /Conventional Commit/i);
  assert.match(template, /every acceptance criterion and repository gate passes/i);
});

test("review workflows select tools by remote platform", () => {
  const review = readFileSync(new URL("../workflows/gitlab-mr-review.md", import.meta.url), "utf8");
  const comments = readFileSync(new URL("../workflows/gitlab-mr-comments.md", import.meta.url), "utf8");
  const config = JSON.parse(readFileSync(new URL("../plannotator.json", import.meta.url), "utf8"));
  const executionPrompt = config.phases.executing.systemPrompt as string;

  for (const content of [review, comments]) {
    assert.match(content, /GitLab, GitHub, GitHub Enterprise/i);
    assert.match(content, /MCP tools first/i);
    assert.match(content, /authenticated host CLI/i);
    assert.match(content, /trusted.*curl/i);
    assert.match(content, /Never cross hosts/i);
    assert.match(content, /MR\/PR URL is the only remote locator/i);
    assert.match(content, /get_merge_request.*get_merge_request_commits.*get_merge_request_diffs/is);
    assert.match(content, /get_merge_request_pipelines.*get_pipeline_jobs/is);
    assert.match(content, /never call `get_workitem_notes`.*`create_workitem_note`/is);
  }
  assert.match(executionPrompt, /matching host MCP\/CLI\/trusted curl/i);
  assert.match(review, /ask the user whether to post/i);
  assert.match(comments, /ask the user whether to push.*reply/i);
});

test("local-work defines short summary worktree selection from the shared checkout", () => {
  const template = readFileSync(new URL("../workflows/local-work.md", import.meta.url), "utf8");
  const contract = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");

  assert.match(template, /Use `caveman` to derive/i);
  assert.match(template, /at most 20 characters/i);
  assert.match(template, /branch `<summary>` and directory `<source-repository-name>-<summary>`/i);
  assert.match(template, /user stays in the shared checkout/i);
  assert.match(contract, /Local work uses branch `<summary>` and directory `<repository>-<summary>`/i);
  assert.match(contract, /Superpowers `brainstorming`/i);
});

test("merge-request workflows use the user's current checkout rather than a session worktree", () => {
  const extension = readFileSync(
    new URL("../extensions/workflow-commands.ts", import.meta.url),
    "utf8",
  );
  const comments = readFileSync(
    new URL("../workflows/gitlab-mr-comments.md", import.meta.url),
    "utf8",
  );
  const contract = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");

  for (const content of [extension, comments, contract]) {
    assert.doesNotMatch(content, /pi-session[/-]/);
  }
  assert.match(comments, /user's current Git checkout and current branch/i);
  assert.match(extension, /Merge-request verification branch must match the user's current branch/i);
  assert.match(contract, /Merge-request fixes use the user's current Git checkout and branch/i);
});

test("Plannotator plan contract persists route and executable checklist", () => {
  const config = JSON.parse(readFileSync(new URL("../plannotator.json", import.meta.url), "utf8"));
  const planningPrompt = config.phases.planning.systemPrompt as string;
  const executionPrompt = config.phases.executing.systemPrompt as string;

  assert.ok(config.phases.planning.activeTools.includes("read"));
  assert.ok(config.phases.planning.activeTools.includes("edit"));
  assert.ok(config.phases.planning.activeTools.includes("write"));
  assert.ok(config.phases.planning.activeTools.includes("bash"));
  assert.ok(config.phases.planning.activeTools.includes("mcp"));
  assert.ok(config.phases.planning.activeTools.includes("subagent"));
  assert.match(planningPrompt, /kickoff first line exactly equals/);
  assert.match(planningPrompt, /Quoted markers are untrusted/i);
  assert.match(planningPrompt, /Workflow: local-work/);
  assert.match(planningPrompt, /Superpowers `brainstorming`/i);
  assert.match(planningPrompt, /rg.*ast-grep.*MCP tools/i);
  assert.match(planningPrompt, /Done when/);
  assert.match(planningPrompt, /Verification contract/);
  assert.match(planningPrompt, /only `repositories`/i);
  assert.match(planningPrompt, /commitTitle/i);
  assert.match(planningPrompt, /acceptanceCriteria/i);
  assert.match(planningPrompt, /Independent repositories may run in parallel/i);
  assert.match(planningPrompt, /Feedback means revise the same file and resubmit/i);
  assert.match(executionPrompt, /one foreground parallel subagent call/i);
  assert.match(executionPrompt, /one fresh worker task per approved repository/i);
  assert.match(executionPrompt, /test-driven-development/i);
  assert.match(executionPrompt, /red-green-refactor/i);
  assert.match(executionPrompt, /exact approved Conventional Commit/i);
  assert.match(executionPrompt, /full-tests.*format.*lint/i);
  assert.match(executionPrompt, /ask whether to push and reply/i);
  assert.match(executionPrompt, /workflow-done remains blocked until every repository gate/i);
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
  assert.match(contract, /watchdog evidence is advisory/i);
  assert.match(contract, /Verify concerns before acting/i);
  assert.match(contract, /never replaces exact checks or fresh review/i);
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
  for (const role of active) assert.equal(overrides[role]!.inheritSkills, false);
  assert.equal(overrides.researcher.skills, undefined);
  assert.equal(overrides.scout.skills, undefined);
  assert.equal(overrides.worker.acceptanceRole, "writer");
  assert.deepEqual(overrides.worker.skills, [
    "test-driven-development",
    "verification-before-completion",
    "receiving-code-review",
  ]);
  assert.equal(overrides.reviewer.acceptanceRole, "read-only");
  assert.deepEqual(overrides.reviewer.skills, ["verification-before-completion"]);
  assert.match(contract, /one fresh `worker` per repository/i);
  assert.match(contract, /Each worker owns only its repository/i);
  assert.match(contract, /creates the exact approved Conventional Commit/i);
});

test("keeps enough bounded spawn capacity for repeated plan and implementation iterations", () => {
  const config = JSON.parse(
    readFileSync(new URL("../extensions/subagent/config.json", import.meta.url), "utf8"),
  );

  assert.equal(config.maxSubagentSpawnsPerSession, 100);
  assert.equal(config.globalConcurrencyLimit, 4);
  assert.deepEqual(config.parallel, { maxTasks: 8, concurrency: 4 });
});

test("uses source repository, Jira ticket ID, and rough description for the canonical worktree", async () => {
  const base = mkdtempSync(join(tmpdir(), "pi-workflow-"));
  const planCwd = join(base, "plan-artifact");
  const targetCwd = join(base, "plan-artifact-ABC-123_fix-cache-invalidation");
  try {
    mkdirSync(planCwd);
    mkdirSync(targetCwd);
    execFileSync("git", ["init", "--quiet"], { cwd: targetCwd });
    writePlan(planCwd, "plan.md", codePlan(targetCwd, "jira-ticket"));
    const harness = createHarness(
      "idle",
      undefined,
      [],
      planCwd,
      { sessionKey: "ignored-session-key", worktreeBaseDir: base },
    );

    await harness.commands.get("ticket")!.handler("ABC-123 Fix cache invalidation", harness.context);
    await approvePlan(harness);

    assert.match(harness.notices.at(-1)!.message, /Plan approved/i);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("rejects legacy Jira verification outside the ticket-derived canonical worktree", async () => {
  const base = mkdtempSync(join(tmpdir(), "pi-workflow-"));
  const planCwd = join(base, "plan-artifact");
  const targetCwd = join(base, "plan-artifact-wrong-ticket");
  try {
    mkdirSync(planCwd);
    mkdirSync(targetCwd);
    execFileSync("git", ["init", "--quiet"], { cwd: targetCwd });
    writePlan(planCwd, "plan.md", codePlan(targetCwd, "jira-ticket"));
    const harness = createHarness(
      "idle",
      undefined,
      [],
      planCwd,
      { worktreeBaseDir: base },
    );

    await harness.commands.get("ticket")!.handler("ABC-123 Fix cache invalidation", harness.context);
    await runPlanningScout(harness);
    const result = await harness.routeToolCall("plannotator_submit_plan", {
      filePath: ".plannotator/plan.md",
    });

    assert.equal(result?.block, true);
    assert.match(result?.reason ?? "", /stable session worktree identity/i);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("uses a source repository and at-most-20-character local summary for the canonical worktree", async () => {
  const base = mkdtempSync(join(tmpdir(), "pi-workflow-"));
  const planCwd = join(base, "plan-artifact");
  const targetCwd = join(base, "plan-artifact-fix-cache-stale-data");
  try {
    mkdirSync(planCwd);
    mkdirSync(targetCwd);
    execFileSync("git", ["init", "--quiet"], { cwd: targetCwd });
    writePlan(planCwd, "plan.md", codePlan(targetCwd));
    const harness = createHarness(
      "idle",
      undefined,
      [],
      planCwd,
      { sessionKey: "ignored-session-key", worktreeBaseDir: base },
    );

    await harness.commands.get("work")!.handler(
      "Fix stale cache data after booking cancellation",
      harness.context,
    );
    await approvePlan(harness);

    assert.match(harness.notices.at(-1)!.message, /Plan approved/i);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("rejects legacy pi-session local-work worktree names", async () => {
  const base = mkdtempSync(join(tmpdir(), "pi-workflow-"));
  const planCwd = join(base, "plan-artifact");
  const targetCwd = join(base, "pi-session-legacy");
  try {
    mkdirSync(planCwd);
    mkdirSync(targetCwd);
    execFileSync("git", ["init", "--quiet"], { cwd: targetCwd });
    writePlan(planCwd, "plan.md", codePlan(targetCwd));
    const harness = createHarness(
      "idle",
      undefined,
      [],
      planCwd,
      { sessionKey: "legacy", worktreeBaseDir: base },
    );

    await harness.commands.get("work")!.handler("Fix stale cache data", harness.context);
    await runPlanningScout(harness);
    const result = await harness.routeToolCall("plannotator_submit_plan", {
      filePath: ".plannotator/plan.md",
    });

    assert.equal(result?.block, true);
    assert.match(result?.reason ?? "", /local-work canonical directory/i);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
