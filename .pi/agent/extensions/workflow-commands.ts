import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readlinkSync, realpathSync } from "node:fs";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";

const PLANNOTATOR_REQUEST_CHANNEL = "plannotator:request";
const PLANNOTATOR_TIMEOUT_MS = 5_000;
const WORKFLOW_STATE_ENTRY = "workflow-loop-state";
const WORKFLOW_RESUME_ENTRY = "workflow-resume-state";
const WORKFLOW_STATE_VERSION = 2;
const REQUIRED_REVIEWER_COMMAND_IDS = ["full-tests", "format", "lint"] as const;
const GIT_OUTPUT_LIMIT_BYTES = 64 * 1024 * 1024;

type PlannotatorPhase = "idle" | "planning" | "executing";
type PlannotatorMode = "enter" | "exit" | "status";
type PlannotatorResponse =
  | { status: "handled"; result: { phase: PlannotatorPhase } }
  | { status: "unavailable"; error?: string }
  | { status: "error"; error: string };

type WorkflowName = "work" | "ticket" | "mr-review" | "mr-comments";
type RemoteActionKind = "review-comments" | "review-replies";

type WorkflowRuntime = {
  sessionKey?: string;
  worktreeBaseDir?: string;
  allowLegacyVerificationContracts?: boolean;
};

type WorkflowSpec = {
  description: string;
  inputLabel: string;
  marker: string;
  template: string;
  validate?: (input: string, cwd: string) => boolean;
};

type ReviewPlatform = "gitlab" | "github" | "github-enterprise" | "generic";

type VerificationCommand = {
  id: string;
  command: string;
  timeoutMs: number;
};

type RepositoryVerificationContract = {
  cwd: string;
  sourceCwd?: string;
  baseHead?: string;
  branch?: string;
  commitTitle?: string;
  acceptanceCriteria?: string[];
  worker: VerificationCommand[];
  reviewer: VerificationCommand[];
};

type VerificationContract = {
  repositories: RepositoryVerificationContract[];
};
type VerificationRole = "worker" | "reviewer";

type ApprovedRemoteAction = {
  id: string;
  toolName: string;
  input: Record<string, unknown>;
};

const REQUIRED_ROLE_SKILLS: Record<VerificationRole, readonly string[]> = {
  worker: [
    "test-driven-development",
    "verification-before-completion",
    "receiving-code-review",
  ],
  reviewer: ["verification-before-completion"],
};

type PlanKind = "code" | "read-only";

type ApprovedPlan = {
  cwd: string;
  path: string;
  sha256: string;
  kind: PlanKind;
  repositorySha256: string;
  acceptanceCriteria: string[];
  verification?: VerificationContract;
  remoteActions?: ApprovedRemoteAction[];
};

type GateStatus = "pending" | "verified" | "failed";

type ExecutionGate = {
  cwd: string;
  planSha256: string;
  commitTitle?: string;
  baseHead?: string;
  worker: GateStatus;
  reviewer: GateStatus | "required";
  workerToolCallId?: string;
  reviewerToolCallId?: string;
  workerRepositorySha256?: string;
  reviewerRepositorySha256?: string;
  workerReason?: string;
  reviewerReason?: string;
};

type PlanningScoutGate = {
  iteration: number;
  status: GateStatus;
  toolCallId?: string;
  reason?: string;
};

type PlanSubmission = {
  toolCallId: string;
  requestedPath: string;
  plan: ApprovedPlan;
};

type ActiveWorkflow = {
  name: WorkflowName;
  input: string;
  iteration: number;
  // Preserve the original canonical worktree across /workflow-abort → /workflow-continue.
  canonicalCwds?: string[];
  pendingFollowUp?: string;
  pendingImages?: ImageContent[];
  pendingExecutionContinuation?: boolean;
  approvedPlan?: ApprovedPlan;
  executionGates?: ExecutionGate[];
  planningScoutGate?: PlanningScoutGate;
  planSubmission?: PlanSubmission;
  awaitingRemoteConfirmation?: RemoteActionKind;
  remoteActionAuthorization?: RemoteActionKind;
  remoteActionPending?: Array<{ id: string; toolCallId: string }>;
  remoteActionCompletedIds?: string[];
  readOnlyExecutionStatus?: "pending" | "completed" | "failed";
  readOnlyToolCallId?: string;
};

const workflows: Record<WorkflowName, WorkflowSpec> = {
  work: {
    description: "Plan and implement a local task in an iterative workflow",
    inputLabel: "task or requirement",
    marker: "local-work",
    template: "local-work.md",
  },
  ticket: {
    description: "Plan and implement or investigate a Jira ticket",
    inputLabel: "Jira issue ID or URL plus optional context",
    marker: "jira-ticket",
    template: "jira-ticket.md",
    validate: isJiraTicketInput,
  },
  "mr-review": {
    description: "Review a hosted merge request or pull request",
    inputLabel: "hosted merge-request or pull-request URL plus optional context",
    marker: "gitlab-mr-review",
    template: "gitlab-mr-review.md",
    validate: isSupportedReviewUrl,
  },
  "mr-comments": {
    description: "Triage unresolved hosted review comments",
    inputLabel: "hosted merge-request or pull-request URL plus optional context",
    marker: "gitlab-mr-comments",
    template: "gitlab-mr-comments.md",
    validate: isSupportedReviewUrl,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isWorkflowName(value: unknown): value is WorkflowName {
  return typeof value === "string" && Object.hasOwn(workflows, value);
}

function reviewUrl(input: string): URL | undefined {
  const candidate = input.trim().split(/\s+/, 1)[0];
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" && !url.username && !url.password ? url : undefined;
  } catch {
    return undefined;
  }
}

function reviewPlatform(input: string, _cwd: string): ReviewPlatform | undefined {
  const url = reviewUrl(input);
  if (!url) return undefined;
  if (/\/-\/merge_requests\/\d+(?:\/|$)/.test(url.pathname)) return "gitlab";
  if (/^\/[^/]+\/[^/]+\/pull\/\d+\/?$/.test(url.pathname)) {
    return url.hostname.toLowerCase() === "github.com" ? "github" : "github-enterprise";
  }
  return "generic";
}

function isSupportedReviewUrl(input: string, cwd: string): boolean {
  return reviewPlatform(input, cwd) !== undefined;
}

function isJiraTicketInput(input: string): boolean {
  return /\b[A-Za-z][A-Za-z0-9_]*-\d+\b/.test(input);
}

function reviewPlatformLabel(platform: ReviewPlatform): string {
  if (platform === "github-enterprise") return "GitHub Enterprise";
  if (platform === "github") return "GitHub";
  if (platform === "gitlab") return "GitLab";
  return "Generic HTTPS code host";
}

function loadWorkflowMessage(workflow: ActiveWorkflow, cwd?: string): string {
  const spec = workflows[workflow.name];
  const projectTemplatePath = cwd ? resolve(cwd, ".pi", "workflows", spec.template) : undefined;
  let template: string | undefined;
  if (projectTemplatePath) {
    try {
      template = readFileSync(projectTemplatePath, "utf8");
    } catch {
      // Project-local workflow templates are optional overrides.
    }
  }
  if (template === undefined) {
    const templateUrl = new URL(`../workflows/${spec.template}`, import.meta.url);
    template = readFileSync(templateUrl, "utf8");
  }
  const platform = cwd && (workflow.name === "mr-review" || workflow.name === "mr-comments")
    ? reviewPlatform(workflow.input, cwd)
    : undefined;
  const platformContext = platform ? `\n\nRemote platform: ${reviewPlatformLabel(platform)}` : "";
  return `${template.trim()}${platformContext}\n\nWorkflow input:\n${workflow.input}`;
}

function loadWorkflowIterationMessage(workflow: ActiveWorkflow, followUp: string, cwd?: string): string {
  return `${loadWorkflowMessage(workflow, cwd)}

Workflow iteration ${workflow.iteration}:
This user follow-up belongs to the active workflow. Re-enter planning before any new implementation or remote action. Reuse the existing plan file. Refresh authoritative data, repository state, diff, and verification; use a new bounded foreground fresh read-only scout; revise the plan and submit it for approval. Preserve the canonical worktree and previously approved work. Do not execute this follow-up under an earlier approval.

Before revising, add an iteration delta under Evidence: the new or corrected requirement, why the prior plan or implementation missed it, invalidated assumptions or evidence, the exact regression check, and unfinished work carried forward. Map every delta to one implementation item and one verification item.

User follow-up:
${followUp}`;
}

function requestPlanMode(pi: ExtensionAPI, mode: PlannotatorMode): Promise<PlannotatorResponse> {
  return new Promise((resolveResponse) => {
    let settled = false;
    const finish = (response: PlannotatorResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolveResponse(response);
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

function hashPlan(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function gitOutput(cwd: string, args: string[]): Buffer {
  return execFileSync("git", ["-c", "core.fsmonitor=false", ...args], {
    cwd,
    maxBuffer: GIT_OUTPUT_LIMIT_BYTES,
    stdio: ["ignore", "pipe", "pipe"],
  }) as Buffer;
}

function optionalGitOutput(cwd: string, args: string[], fallback: string): Buffer {
  try {
    return gitOutput(cwd, args);
  } catch {
    return Buffer.from(fallback);
  }
}

function canonicalPath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

function repositoryRoot(cwd: string): string {
  const root = gitOutput(cwd, ["rev-parse", "--show-toplevel"]).toString("utf8").trim();
  if (!root) throw new Error("workflow checkout is not a Git repository");
  return canonicalPath(root);
}

function repositoryCommonDirectory(cwd: string): string {
  const common = gitOutput(cwd, ["rev-parse", "--git-common-dir"]).toString("utf8").trim();
  if (!common) throw new Error("workflow checkout Git common directory is unavailable");
  return canonicalPath(resolve(cwd, common));
}

function hashPart(hash: ReturnType<typeof createHash>, label: string, value: Buffer | string): void {
  const bytes = typeof value === "string" ? Buffer.from(value) : value;
  hash.update(`${label}\0${bytes.length}\0`);
  hash.update(bytes);
}

type RepositoryInputs = {
  head: Buffer;
  index: Buffer;
  status: Buffer;
  dirtyPaths: Buffer;
};

function repositoryInputs(root: string): RepositoryInputs {
  return {
    head: optionalGitOutput(root, ["rev-parse", "--verify", "HEAD"], "UNBORN"),
    index: gitOutput(root, ["ls-files", "--stage", "-z"]),
    status: gitOutput(root, ["status", "--porcelain=v2", "-z", "--untracked-files=all"]),
    dirtyPaths: gitOutput(root, [
      "ls-files",
      "--modified",
      "--deleted",
      "--others",
      "--exclude-standard",
      "-z",
    ]),
  };
}

function sameRepositoryInputs(left: RepositoryInputs, right: RepositoryInputs): boolean {
  return (
    left.head.equals(right.head) &&
    left.index.equals(right.index) &&
    left.status.equals(right.status) &&
    left.dirtyPaths.equals(right.dirtyPaths)
  );
}

function hashRepositoryPath(
  hash: ReturnType<typeof createHash>,
  root: string,
  repositoryPath: string,
): void {
  const fullPath = resolve(root, repositoryPath);
  const relativePath = relative(root, fullPath);
  if (
    !relativePath ||
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    throw new Error("repository snapshot contained a path outside its root");
  }

  hashPart(hash, "path", relativePath);
  try {
    const stat = lstatSync(fullPath);
    hashPart(hash, "mode", String(stat.mode));
    if (stat.isSymbolicLink()) {
      hashPart(hash, "symlink", readlinkSync(fullPath));
    } else if (stat.isFile()) {
      hashPart(hash, "file", readFileSync(fullPath));
    } else if (stat.isDirectory()) {
      hashPart(hash, "directory", "gitlink-or-directory");
    } else {
      hashPart(hash, "special", "unsupported-file-type");
    }
  } catch (error) {
    const code = isRecord(error) && typeof error.code === "string" ? error.code : "UNKNOWN";
    if (code !== "ENOENT") throw error;
    hashPart(hash, "missing", code);
  }
}

function captureRepositorySnapshot(cwd: string): string {
  try {
    const root = repositoryRoot(cwd);
    const before = repositoryInputs(root);
    const hash = createHash("sha256");
    hashPart(hash, "head", before.head);
    hashPart(hash, "index", before.index);
    hashPart(hash, "status", before.status);

    const paths = [...new Set(before.dirtyPaths.toString("utf8").split("\0").filter(Boolean))].sort();
    for (const repositoryPath of paths) hashRepositoryPath(hash, root, repositoryPath);

    const after = repositoryInputs(root);
    if (!sameRepositoryInputs(before, after)) {
      throw new Error("repository changed while its verification snapshot was captured");
    }
    return hash.digest("hex");
  } catch (error) {
    throw new Error(
      `repository snapshot unavailable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function isPlaceholderSuccessCommand(command: string): boolean {
  return /^(?:(?:\/usr\/bin\/|\/bin\/)?true|:|exit\s+0|echo(?:\s+.*)?|printf(?:\s+.*)?)\s*;?\s*$/.test(
    command,
  );
}

function parseVerificationCommands(value: unknown, role: VerificationRole): VerificationCommand[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Verification contract ${role} must contain at least one command.`);
  }

  const commands: VerificationCommand[] = [];
  const ids = new Set<string>();
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) {
      throw new Error(`Verification contract ${role}[${index}] must be an object.`);
    }
    const unknownKeys = Object.keys(item).filter(
      (key) => key !== "id" && key !== "command" && key !== "timeoutMs",
    );
    if (unknownKeys.length) {
      throw new Error(
        `Verification contract ${role}[${index}] has unsupported fields: ${unknownKeys.join(", ")}.`,
      );
    }

    const id = typeof item.id === "string" ? item.id.trim() : "";
    const command = typeof item.command === "string" ? item.command.trim() : "";
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(id)) {
      throw new Error(
        `Verification contract ${role}[${index}].id must use lowercase letters, digits, dot, underscore, or hyphen.`,
      );
    }
    if (ids.has(id)) throw new Error(`Verification contract ${role} duplicates command id ${id}.`);
    if (!command || /[\r\n]/.test(command)) {
      throw new Error(`Verification contract ${role}[${index}].command must be one non-empty line.`);
    }
    if (isPlaceholderSuccessCommand(command)) {
      throw new Error(`Verification contract ${role}[${index}].command cannot be a placeholder success command.`);
    }
    if (
      typeof item.timeoutMs !== "number" ||
      !Number.isInteger(item.timeoutMs) ||
      item.timeoutMs < 1
    ) {
      throw new Error(`Verification contract ${role}[${index}].timeoutMs must be a positive integer.`);
    }

    ids.add(id);
    commands.push({ id, command, timeoutMs: item.timeoutMs });
  }
  return commands;
}

function normalizeRepositoryVerification(
  value: unknown,
  extended: boolean,
  index: number,
): RepositoryVerificationContract {
  if (!isRecord(value)) {
    throw new Error(`Verification contract repositories[${index}] must be an object.`);
  }
  const allowedKeys = [
    "cwd",
    "sourceCwd",
    "baseHead",
    "branch",
    "commitTitle",
    "acceptanceCriteria",
    "worker",
    "reviewer",
  ];
  const unknownKeys = Object.keys(value).filter((key) => !allowedKeys.includes(key));
  if (unknownKeys.length) {
    throw new Error(
      `Verification contract repositories[${index}] has unsupported fields: ${unknownKeys.join(", ")}.`,
    );
  }

  const cwd = typeof value.cwd === "string" ? value.cwd.trim() : "";
  if (!cwd || !isAbsolute(cwd) || /[\r\n]/.test(cwd)) {
    throw new Error(`Verification contract repositories[${index}].cwd must be absolute.`);
  }

  const branch = typeof value.branch === "string" ? value.branch.trim() : undefined;
  const sourceCwd = typeof value.sourceCwd === "string" ? value.sourceCwd.trim() : undefined;
  const baseHead = typeof value.baseHead === "string" ? value.baseHead.trim() : undefined;
  const commitTitle = typeof value.commitTitle === "string" ? value.commitTitle.trim() : undefined;
  const acceptanceCriteria = Array.isArray(value.acceptanceCriteria)
    ? value.acceptanceCriteria.map((criterion) =>
      typeof criterion === "string" ? criterion.trim() : "")
    : undefined;
  if (extended) {
    if (!sourceCwd || !isAbsolute(sourceCwd) || /[\r\n]/.test(sourceCwd)) {
      throw new Error(
        `Verification contract repositories[${index}].sourceCwd must be an absolute Git root.`,
      );
    }
    if (!baseHead || (baseHead !== "UNBORN" && !/^[a-f0-9]{40,64}$/.test(baseHead))) {
      throw new Error(
        `Verification contract repositories[${index}].baseHead must be an exact Git object ID or UNBORN.`,
      );
    }
    if (!branch || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch)) {
      throw new Error(
        `Verification contract repositories[${index}].branch must be a concrete Git branch name.`,
      );
    }
    if (
      !commitTitle ||
      !/^(?:feat|fix|refactor|perf|test|docs|build|ci|chore)(?:\([^)]+\))?!?: .{1,72}$/.test(
        commitTitle,
      )
    ) {
      throw new Error(
        `Verification contract repositories[${index}].commitTitle must be a Conventional Commit title.`,
      );
    }
    if (
      !acceptanceCriteria?.length ||
      acceptanceCriteria.some((criterion) => !criterion || /[\r\n]/.test(criterion))
    ) {
      throw new Error(
        `Verification contract repositories[${index}].acceptanceCriteria must contain non-empty one-line criteria.`,
      );
    }
  }

  const worker = parseVerificationCommands(value.worker, "worker");
  const reviewer = parseVerificationCommands(value.reviewer, "reviewer");
  const reviewerIds = reviewer.map((command) => command.id);
  if (
    reviewerIds.length !== REQUIRED_REVIEWER_COMMAND_IDS.length ||
    REQUIRED_REVIEWER_COMMAND_IDS.some((id, index) => reviewerIds[index] !== id)
  ) {
    throw new Error(
      `Verification contract reviewer command ids must be exactly: ${REQUIRED_REVIEWER_COMMAND_IDS.join(", ")}.`,
    );
  }
  return {
    cwd: resolve(cwd),
    sourceCwd: sourceCwd ? resolve(sourceCwd) : undefined,
    baseHead,
    branch,
    commitTitle,
    acceptanceCriteria,
    worker,
    reviewer,
  };
}

function normalizeVerificationContract(
  value: unknown,
  allowLegacy = false,
): VerificationContract {
  if (!isRecord(value)) throw new Error("Verification contract JSON must be an object.");
  if (Array.isArray(value.repositories)) {
    const unknownKeys = Object.keys(value).filter((key) => key !== "repositories");
    if (unknownKeys.length) {
      throw new Error(`Verification contract has unsupported fields: ${unknownKeys.join(", ")}.`);
    }
    if (value.repositories.length === 0) {
      throw new Error("Verification contract repositories must not be empty.");
    }
    const extended = value.repositories.length > 1 || value.repositories.some((repository) =>
      isRecord(repository) &&
      ["branch", "commitTitle", "acceptanceCriteria"].some((key) => repository[key] !== undefined));
    if (!extended && !allowLegacy) {
      throw new Error(
        "Verification contract repository entries must include branch, commitTitle, and acceptanceCriteria.",
      );
    }
    const repositories = value.repositories.map((repository, index) =>
      normalizeRepositoryVerification(repository, extended, index));
    const uniqueCwds = new Set(repositories.map((repository) => repository.cwd));
    if (uniqueCwds.size !== repositories.length) {
      throw new Error("Verification contract repositories must use unique cwd values.");
    }
    return { repositories };
  }

  if (!allowLegacy) {
    throw new Error(
      "Verification contract code plans must use the repositories array with branch, commitTitle, and acceptanceCriteria.",
    );
  }
  return { repositories: [normalizeRepositoryVerification(value, false, 0)] };
}

function planSection(content: string, heading: string): string | undefined {
  const matches = [...content.matchAll(new RegExp(`^## ${heading}[ \\t]*$`, "gm"))];
  if (matches.length !== 1) return undefined;
  const match = matches[0]!;
  const start = (match.index ?? 0) + match[0].length;
  const remainder = content.slice(start).replace(/^\r?\n/, "");
  const nextHeading = remainder.search(/^## [^\r\n]+[ \t]*$/m);
  return (nextHeading === -1 ? remainder : remainder.slice(0, nextHeading)).trim();
}

function uncheckedChecklistItems(section: string): string[] {
  return [...section.matchAll(/^- \[ \] (.+)$/gm)].map((match) => match[1]!.trim());
}

function validatePlanStructure(content: string): string[] {
  const implementation = planSection(content, "Implementation plan");
  if (!implementation || uncheckedChecklistItems(implementation).length === 0) {
    throw new Error("Approved plan must contain executable items under ## Implementation plan.");
  }
  const doneWhen = planSection(content, "Done when");
  const acceptanceCriteria = doneWhen ? uncheckedChecklistItems(doneWhen) : [];
  if (acceptanceCriteria.length === 0) {
    throw new Error("Approved plan must contain explicit acceptance criteria under ## Done when.");
  }
  if (new Set(acceptanceCriteria).size !== acceptanceCriteria.length) {
    throw new Error("Approved plan must not duplicate acceptance criteria under ## Done when.");
  }
  return acceptanceCriteria;
}

const REQUIRED_PLAN_HEADINGS = [
  "Goal",
  "In scope",
  "Out of scope",
  "Evidence",
  "Things to implement",
  "Implementation plan",
  "Requirement-to-test mapping",
  "Done when",
  "Verification contract",
  "Skill recommendation",
  "Open questions",
  "Risks",
] as const;

function validateRequiredPlanHeadings(content: string): void {
  const missing = REQUIRED_PLAN_HEADINGS.filter((heading) => !planSection(content, heading));
  if (missing.length) {
    throw new Error(`Approved plan is missing required non-empty headings: ${missing.join(", ")}.`);
  }
}

function parseVerificationContract(
  content: string,
  allowLegacy = false,
): VerificationContract | undefined {
  const headings = [...content.matchAll(/^## Verification contract[ \t]*$/gm)];
  if (headings.length === 0) {
    throw new Error("Approved plan must contain exactly one ## Verification contract heading.");
  }
  if (headings.length !== 1) {
    throw new Error("Approved plan must contain exactly one ## Verification contract heading.");
  }

  const heading = headings[0]!;
  const bodyStart = (heading.index ?? 0) + heading[0].length;
  const remainder = content.slice(bodyStart).replace(/^\r?\n/, "");
  const nextHeading = remainder.search(/^## [^\r\n]+[ \t]*$/m);
  const body = (nextHeading === -1 ? remainder : remainder.slice(0, nextHeading)).trim();
  if (body === "Not applicable - read-only plan.") return undefined;

  const match = body.match(/^```json[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*$/);
  if (!match) {
    throw new Error(
      "Verification contract body must be exactly the read-only sentinel or one JSON code block.",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1]!);
  } catch (error) {
    throw new Error(
      `Verification contract JSON is invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return normalizeVerificationContract(parsed, allowLegacy);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalizeRemoteActions(value: unknown): ApprovedRemoteAction[] | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value) || Object.keys(value).some((key) => key !== "actions")) {
    throw new Error("Remote action contract must be an object containing only actions.");
  }
  if (!Array.isArray(value.actions)) {
    throw new Error("Remote action contract actions must be an array.");
  }
  const ids = new Set<string>();
  const calls = new Set<string>();
  return value.actions.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`Remote action contract actions[${index}] must be an object.`);
    }
    const unknownKeys = Object.keys(item).filter(
      (key) => !["id", "toolName", "input"].includes(key),
    );
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const toolName = typeof item.toolName === "string" ? item.toolName.trim() : "";
    if (unknownKeys.length || !/^[a-z0-9][a-z0-9._-]*$/.test(id) || ids.has(id)) {
      throw new Error(`Remote action contract actions[${index}] has invalid or duplicate id.`);
    }
    if (!toolName || /[\r\n]/.test(toolName) || !isRecord(item.input)) {
      throw new Error(
        `Remote action contract actions[${index}] requires one toolName and object input.`,
      );
    }
    const call = `${toolName}\0${canonicalJson(item.input)}`;
    if (calls.has(call)) {
      throw new Error("Remote action contract cannot duplicate an exact tool call.");
    }
    ids.add(id);
    calls.add(call);
    return { id, toolName, input: item.input };
  });
}

function parseRemoteActionContract(
  content: string,
  workflow: ActiveWorkflow,
  cwd: string,
  verification?: VerificationContract,
): ApprovedRemoteAction[] | undefined {
  const section = planSection(content, "Remote action contract");
  const isReview = workflow.name === "mr-review" || workflow.name === "mr-comments";
  if (!isReview) {
    if (section) throw new Error("Only hosted-review workflows may define remote actions.");
    return undefined;
  }
  if (!section) {
    throw new Error("Hosted-review plans require one non-empty ## Remote action contract.");
  }
  const match = section.match(/^```json[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*$/);
  if (!match) {
    throw new Error("Remote action contract body must be exactly one JSON code block.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1]!);
  } catch (error) {
    throw new Error(
      `Remote action contract JSON is invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const actions = normalizeRemoteActions(parsed)!;
  for (const action of actions) {
    const kind = reviewRemoteMutationKind(action.toolName, action.input, workflow, cwd);
    if (kind === "forbidden") {
      throw new Error(
        `Remote action ${action.id} is forbidden; approval, merge, resolution, closure, deletion, and force push are never allowed.`,
      );
    }
    if (!kind || kind === "other") {
      throw new Error(`Remote action ${action.id} is not an allowed comment, reply, or push.`);
    }
    if (workflow.name === "mr-review" && kind !== "comment") {
      throw new Error("Merge-request review plans may authorize comments only.");
    }
    const targetError = remoteActionTargetError(action, workflow, cwd, verification);
    if (targetError) throw new Error(`Remote action ${action.id} ${targetError}`);
  }
  return actions;
}

function resolvePlanPath(
  cwd: string,
  planPath: string,
  mustExist = true,
): { fullPath: string; relativePath: string } {
  if (!planPath.trim()) throw new Error("approved plan path is empty");
  const canonicalCwd = canonicalPath(cwd);
  const planRoot = resolve(canonicalCwd, ".plannotator");
  const fullPath = resolve(canonicalCwd, planPath);
  const planRelativePath = relative(planRoot, fullPath);
  if (
    !planRelativePath ||
    planRelativePath === ".." ||
    planRelativePath.startsWith(`..${sep}`) ||
    isAbsolute(planRelativePath) ||
    !planRelativePath.toLowerCase().endsWith(".md")
  ) {
    throw new Error("approved plan path must be markdown beneath .plannotator");
  }

  const components = [planRoot, ...planRelativePath.split(sep).map((part, index, parts) =>
    resolve(planRoot, ...parts.slice(0, index + 1)),
  )];
  for (const [index, component] of components.entries()) {
    try {
      const stat = lstatSync(component);
      if (stat.isSymbolicLink()) {
        throw new Error("approved plan path cannot contain symbolic links");
      }
      if (index < components.length - 1 && !stat.isDirectory()) {
        throw new Error("approved plan parent must be a directory");
      }
      if (index === components.length - 1 && !stat.isFile()) {
        throw new Error("approved plan must be a regular markdown file");
      }
      if (index === components.length - 1 && stat.nlink !== 1) {
        throw new Error("approved plan file cannot have hard links");
      }
      const resolvedComponent = realpathSync(component);
      const resolvedRelative = relative(planRoot, resolvedComponent);
      if (
        resolvedRelative === ".." ||
        resolvedRelative.startsWith(`..${sep}`) ||
        isAbsolute(resolvedRelative)
      ) {
        throw new Error("approved plan path resolves outside .plannotator");
      }
    } catch (error) {
      const code = isRecord(error) && typeof error.code === "string" ? error.code : undefined;
      if (code !== "ENOENT") throw error;
      if (mustExist) throw new Error("approved plan file does not exist");
      break;
    }
  }

  return { fullPath, relativePath: relative(canonicalCwd, fullPath) };
}

function jiraWorktreeIdentity(input: string): string {
  const match = input.match(/\b[A-Za-z][A-Za-z0-9_]*-\d+\b/);
  if (!match || match.index === undefined) {
    throw new Error("Jira workflow input has no stable ticket ID");
  }

  const roughDescription = input.slice(match.index + match[0].length)
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!roughDescription) {
    throw new Error("Jira workflow input requires a rough description after the ticket ID or URL");
  }

  return `${match[0].toUpperCase()}_${roughDescription}`;
}

function sourceRepositoryName(cwd: string): string {
  const normalized = basename(repositoryRoot(cwd))
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!normalized) throw new Error("source repository name is unavailable");
  return normalized;
}

const MAX_LOCAL_WORK_SUMMARY_LENGTH = 20;

function isLocalWorktreeSummary(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_LOCAL_WORK_SUMMARY_LENGTH &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  );
}

function localWorktreeCwd(
  worktreeBaseDir: string,
  sourceCwd: string,
  candidateCwd: string,
): string {
  const candidate = resolve(candidateCwd);
  const candidateName = relative(worktreeBaseDir, candidate);
  const sourceName = sourceRepositoryName(sourceCwd);
  const prefix = `${sourceName}-`;
  if (
    !candidateName ||
    candidateName === ".." ||
    candidateName.startsWith(`..${sep}`) ||
    isAbsolute(candidateName) ||
    candidateName.includes(sep) ||
    !candidateName.startsWith(prefix) ||
    !isLocalWorktreeSummary(candidateName.slice(prefix.length))
  ) {
    throw new Error(
      `local-work canonical directory must be ${sourceName}-<lowercase-hyphen-summary> with a summary of at most ${MAX_LOCAL_WORK_SUMMARY_LENGTH} characters`,
    );
  }
  return candidate;
}

function isCanonicalWorktreeName(workflow: ActiveWorkflow, name: string): boolean {
  if (workflow.name === "work") {
    return /^[A-Za-z0-9._-]+-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name);
  }
  if (workflow.name !== "ticket") return /^[A-Za-z0-9._-]+$/.test(name);
  return /^[A-Za-z0-9._-]+-[A-Za-z][A-Za-z0-9]+-\d+_[a-z0-9-]+$/.test(name);
}

function configuredWorktreeBaseDir(runtime?: WorkflowRuntime): string {
  let configuredBaseDir = runtime?.worktreeBaseDir;
  if (configuredBaseDir === undefined) {
    const config = JSON.parse(
      readFileSync(new URL("./subagent/config.json", import.meta.url), "utf8"),
    ) as unknown;
    if (!isRecord(config) || typeof config.worktreeBaseDir !== "string") {
      throw new Error("subagent worktreeBaseDir configuration is unavailable");
    }
    configuredBaseDir = config.worktreeBaseDir;
  }
  const worktreeBaseDir = configuredBaseDir.trim();
  if (!isAbsolute(worktreeBaseDir)) {
    throw new Error("subagent worktreeBaseDir must be absolute");
  }
  return resolve(worktreeBaseDir);
}

function expectedCanonicalCwd(
  workflow: ActiveWorkflow,
  runtime?: WorkflowRuntime,
  recoveryCwd?: string,
  sourceCwd?: string,
): string {
  if (workflow.name === "mr-review" || workflow.name === "mr-comments") {
    if (!sourceCwd) throw new Error("source repository checkout is unavailable");
    return repositoryRoot(sourceCwd);
  }
  const worktreeBaseDir = configuredWorktreeBaseDir(runtime);

  const persistedOrRecoveredCwd = workflow.canonicalCwds?.[0] ?? (
    workflow.name === "work" || workflow.iteration > 1 ? recoveryCwd : undefined
  );
  if (persistedOrRecoveredCwd) {
    const persistedCwd = resolve(persistedOrRecoveredCwd);
    const persistedRelativePath = relative(worktreeBaseDir, persistedCwd);
    const allowLegacyCurrentCheckout =
      runtime?.allowLegacyVerificationContracts === true &&
      workflow.name === "work" &&
      Boolean(sourceCwd) &&
      canonicalPath(repositoryRoot(sourceCwd!)) === canonicalPath(persistedCwd);
    if (
      !persistedRelativePath ||
      persistedRelativePath === ".." ||
      persistedRelativePath.startsWith(`..${sep}`) ||
      isAbsolute(persistedRelativePath) ||
      persistedRelativePath.includes(sep) ||
      (!isCanonicalWorktreeName(workflow, persistedRelativePath) && !allowLegacyCurrentCheckout)
    ) {
      throw new Error("persisted canonical worktree is outside configured worktreeBaseDir");
    }
    if (workflow.name === "work") {
      if (!sourceCwd) throw new Error("source repository checkout is unavailable");
      if (
        allowLegacyCurrentCheckout
      ) {
        captureRepositorySnapshot(persistedCwd);
        return persistedCwd;
      }
      const canonicalCwd = localWorktreeCwd(worktreeBaseDir, sourceCwd, persistedCwd);
      if (workflow.canonicalCwds?.length || workflow.iteration > 1) {
        captureRepositorySnapshot(canonicalCwd);
      }
      return canonicalCwd;
    }
    captureRepositorySnapshot(persistedCwd);
    return persistedCwd;
  }

  if (workflow.name === "ticket") {
    if (!sourceCwd) throw new Error("source repository checkout is unavailable");
    return resolve(worktreeBaseDir, `${sourceRepositoryName(sourceCwd)}-${jiraWorktreeIdentity(workflow.input)}`);
  }
  throw new Error("workflow does not support a canonical worktree");
}

function validateExtendedRepositoryContracts(
  workflow: ActiveWorkflow,
  verification: VerificationContract,
  runtime?: WorkflowRuntime,
): void {
  const isMergeRequestWorkflow = workflow.name === "mr-review" || workflow.name === "mr-comments";
  if (
    isMergeRequestWorkflow &&
    verification.repositories.length !== 1
  ) {
    throw new Error("Merge-request workflows support exactly one current-checkout repository.");
  }

  const ticketId = workflow.input.match(/\b[A-Za-z][A-Za-z0-9_]*-\d+\b/)?.[0]?.toUpperCase();
  for (const repository of verification.repositories) {
    if (isMergeRequestWorkflow) {
      if (!repository.branch || !repository.sourceCwd || !repository.baseHead) {
        continue;
      }
      const currentCheckout = repositoryRoot(repository.sourceCwd);
      if (
        canonicalPath(repository.cwd) !== currentCheckout ||
        canonicalPath(repository.sourceCwd) !== currentCheckout
      ) {
        throw new Error(
          "Merge-request verification must use the user's current Git checkout as both cwd and sourceCwd.",
        );
      }
      const currentBranch = optionalGitOutput(
        currentCheckout,
        ["symbolic-ref", "--quiet", "--short", "HEAD"],
        "",
      ).toString("utf8").trim();
      if (!currentBranch || repository.branch !== currentBranch) {
        throw new Error("Merge-request verification branch must match the user's current branch.");
      }
      const currentBaseHead = optionalGitOutput(
        currentCheckout,
        ["rev-parse", "--verify", "HEAD"],
        "UNBORN",
      ).toString("utf8").trim();
      if (currentBaseHead !== repository.baseHead) {
        throw new Error("Verification contract baseHead does not match the current checkout HEAD.");
      }
      continue;
    }

    const worktreeBaseDir = configuredWorktreeBaseDir(runtime);
    const relativePath = relative(worktreeBaseDir, repository.cwd);
    if (
      !relativePath ||
      relativePath === ".." ||
      relativePath.startsWith(`..${sep}`) ||
      isAbsolute(relativePath) ||
      relativePath.includes(sep)
    ) {
      throw new Error("Verification contract repository cwd must be directly beneath worktreeBaseDir.");
    }
    if (!repository.branch || !repository.commitTitle || !repository.acceptanceCriteria) {
      continue;
    }
    if (!repository.sourceCwd || !repository.baseHead) {
      throw new Error("Extended repository contracts require sourceCwd and baseHead.");
    }
    if (repositoryRoot(repository.sourceCwd) !== canonicalPath(repository.sourceCwd)) {
      throw new Error("Verification contract sourceCwd must be a Git repository root.");
    }
    const currentBaseHead = optionalGitOutput(
      repository.sourceCwd,
      ["rev-parse", "--verify", "HEAD"],
      "UNBORN",
    ).toString("utf8").trim();
    if (currentBaseHead !== repository.baseHead) {
      throw new Error("Verification contract baseHead does not match the source repository HEAD.");
    }

    if (workflow.name === "work") {
      if (
        !isLocalWorktreeSummary(repository.branch) ||
        !relativePath.endsWith(`-${repository.branch}`)
      ) {
        throw new Error(
          "Local-work repository directories must use <source-repository-name>-<summary> and branch <summary>.",
        );
      }
      continue;
    }
    if (workflow.name === "ticket") {
      const summary = ticketId && repository.branch.startsWith(`${ticketId}_`)
        ? repository.branch.slice(`${ticketId}_`.length)
        : "";
      if (
        !ticketId ||
        !isLocalWorktreeSummary(summary) ||
        !relativePath.endsWith(`-${repository.branch}`)
      ) {
        throw new Error(
          "Jira repository directories must use <source-repository-name>-<ticket>_<summary> and branch <ticket>_<summary>.",
        );
      }
      continue;
    }
  }
}

function captureApprovedPlan(
  workflow: ActiveWorkflow,
  cwd: string,
  planPath: string,
  runtime?: WorkflowRuntime,
): ApprovedPlan {
  const { fullPath, relativePath } = resolvePlanPath(cwd, planPath);
  const content = readFileSync(fullPath, "utf8");
  const expectedMarker = `Workflow: ${workflows[workflow.name].marker}`;
  if (content.split(/\r?\n/, 1)[0] !== expectedMarker) {
    throw new Error(`approved plan first line must be exactly ${expectedMarker}`);
  }
  const plannedAcceptanceCriteria = validatePlanStructure(content);
  const verification = parseVerificationContract(
    content,
    runtime?.allowLegacyVerificationContracts === true,
  );
  validateRequiredPlanHeadings(content);
  const remoteActions = parseRemoteActionContract(content, workflow, cwd, verification);
  if (workflow.name === "mr-review" && verification) {
    throw new Error("gitlab-mr-review is read-only and cannot approve a code verification contract");
  }
  if (verification) {
    const extended = verification.repositories.some((repository) => repository.branch !== undefined);
    if (extended) {
      validateExtendedRepositoryContracts(workflow, verification, runtime);
      const contractedAcceptanceCriteria = new Set(
        verification.repositories.flatMap((repository) => repository.acceptanceCriteria ?? []),
      );
      if (
        contractedAcceptanceCriteria.size !== plannedAcceptanceCriteria.length ||
        plannedAcceptanceCriteria.some((criterion) => !contractedAcceptanceCriteria.has(criterion))
      ) {
        throw new Error(
          "Verification contract acceptance criteria must exactly cover ## Done when.",
        );
      }
    } else {
      const repository = verification.repositories[0]!;
      // Preserve legacy single-repository plans during migration.
      const expectedCwd = expectedCanonicalCwd(workflow, runtime, repository.cwd, cwd);
      const usesCurrentMergeRequestCheckout =
        workflow.name === "mr-review" || workflow.name === "mr-comments";
      if (
        usesCurrentMergeRequestCheckout
          ? canonicalPath(repository.cwd) !== expectedCwd
          : repository.cwd !== expectedCwd
      ) {
        throw new Error("Verification contract cwd does not match the stable session worktree identity");
      }
      if (verification.repositories.length !== 1) {
        throw new Error("Verification contract cwd does not match the stable session worktree identity");
      }
    }
  }
  return {
    cwd,
    path: relativePath,
    sha256: hashPlan(content),
    kind: verification ? "code" : "read-only",
    repositorySha256: captureRepositorySnapshot(cwd),
    acceptanceCriteria: plannedAcceptanceCriteria,
    verification,
    remoteActions,
  };
}

function approvedPlanError(workflow: ActiveWorkflow, cwd: string): string | undefined {
  const approved = workflow.approvedPlan;
  if (!approved) return "No approved plan revision is recorded; return to planning and obtain approval.";
  if (approved.cwd !== cwd) return "Approved plan checkout changed; return to planning and obtain approval.";

  try {
    const { fullPath } = resolvePlanPath(cwd, approved.path);
    if (hashPlan(readFileSync(fullPath, "utf8")) !== approved.sha256) {
      return "Approved plan changed after approval; return to planning and approve the new revision.";
    }
  } catch (error) {
    return `Approved plan cannot be verified: ${error instanceof Error ? error.message : String(error)}`;
  }
  return undefined;
}

function parseApprovedPlan(value: unknown): ApprovedPlan | undefined {
  if (!isRecord(value)) return undefined;
  if (
    typeof value.cwd !== "string" ||
    typeof value.path !== "string" ||
    typeof value.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.sha256) ||
    (value.kind !== "code" && value.kind !== "read-only") ||
    typeof value.repositorySha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.repositorySha256)
  ) {
    return undefined;
  }
  let verification: VerificationContract | undefined;
  if (value.verification !== undefined) {
    try {
      verification = normalizeVerificationContract(value.verification, true);
    } catch {
      return undefined;
    }
  }
  const derivedAcceptanceCriteria = verification?.repositories.flatMap(
    (repository) => repository.acceptanceCriteria ?? [],
  ) ?? [];
  const acceptanceCriteria =
    Array.isArray(value.acceptanceCriteria) &&
      value.acceptanceCriteria.length > 0 &&
      value.acceptanceCriteria.every(
        (criterion) => typeof criterion === "string" && Boolean(criterion.trim()),
      )
      ? value.acceptanceCriteria.map((criterion) => (criterion as string).trim())
      : derivedAcceptanceCriteria.length
        ? derivedAcceptanceCriteria
        : ["Legacy approved plan."];
  let remoteActions: ApprovedRemoteAction[] | undefined;
  try {
    remoteActions = Array.isArray(value.remoteActions)
      ? normalizeRemoteActions({ actions: value.remoteActions })
      : normalizeRemoteActions(value.remoteActions);
  } catch {
    return undefined;
  }
  if ((value.kind === "code") !== Boolean(verification)) return undefined;
  return {
    cwd: value.cwd,
    path: value.path,
    sha256: value.sha256,
    kind: value.kind,
    repositorySha256: value.repositorySha256,
    acceptanceCriteria,
    verification,
    remoteActions,
  };
}

function isGateStatus(value: unknown): value is GateStatus {
  return value === "pending" || value === "verified" || value === "failed";
}

function parseExecutionGate(value: unknown): ExecutionGate | undefined {
  if (
    !isRecord(value) ||
    typeof value.cwd !== "string" ||
    typeof value.planSha256 !== "string" ||
    !isGateStatus(value.worker) ||
    (value.reviewer !== "required" && !isGateStatus(value.reviewer))
  ) {
    return undefined;
  }
  const workerToolCallId =
    typeof value.workerToolCallId === "string" ? value.workerToolCallId : undefined;
  const reviewerToolCallId =
    typeof value.reviewerToolCallId === "string" ? value.reviewerToolCallId : undefined;
  const workerRepositorySha256 =
    typeof value.workerRepositorySha256 === "string" &&
    /^[a-f0-9]{64}$/.test(value.workerRepositorySha256)
      ? value.workerRepositorySha256
      : undefined;
  const reviewerRepositorySha256 =
    typeof value.reviewerRepositorySha256 === "string" &&
    /^[a-f0-9]{64}$/.test(value.reviewerRepositorySha256)
      ? value.reviewerRepositorySha256
      : undefined;
  if (
    (value.worker === "pending" && !workerToolCallId) ||
    (value.worker === "verified" && !workerRepositorySha256) ||
    (value.reviewer === "pending" && !reviewerToolCallId) ||
    (value.reviewer === "verified" && !reviewerRepositorySha256)
  ) {
    return undefined;
  }
  return {
    cwd: value.cwd,
    planSha256: value.planSha256,
    commitTitle: typeof value.commitTitle === "string" ? value.commitTitle : undefined,
    baseHead: typeof value.baseHead === "string" ? value.baseHead : undefined,
    worker: value.worker,
    reviewer: value.reviewer,
    workerToolCallId,
    reviewerToolCallId,
    workerRepositorySha256,
    reviewerRepositorySha256,
    workerReason: typeof value.workerReason === "string" ? value.workerReason : undefined,
    reviewerReason: typeof value.reviewerReason === "string" ? value.reviewerReason : undefined,
  };
}

function parsePlanningScoutGate(value: unknown): PlanningScoutGate | undefined {
  if (
    !isRecord(value) ||
    typeof value.iteration !== "number" ||
    !Number.isInteger(value.iteration) ||
    value.iteration < 1 ||
    !isGateStatus(value.status)
  ) {
    return undefined;
  }
  if (value.status === "pending" && typeof value.toolCallId !== "string") return undefined;
  return {
    iteration: value.iteration,
    status: value.status,
    toolCallId: typeof value.toolCallId === "string" ? value.toolCallId : undefined,
    reason: typeof value.reason === "string" ? value.reason : undefined,
  };
}

function parsePlanSubmission(value: unknown): PlanSubmission | undefined {
  if (
    !isRecord(value) ||
    typeof value.toolCallId !== "string" ||
    typeof value.requestedPath !== "string"
  ) {
    return undefined;
  }
  const plan = parseApprovedPlan(value.plan);
  return plan
    ? { toolCallId: value.toolCallId, requestedPath: value.requestedPath, plan }
    : undefined;
}

function parseActiveWorkflow(value: unknown): ActiveWorkflow | null {
  if (!isRecord(value)) return null;
  if (
    !isWorkflowName(value.name) ||
    typeof value.input !== "string" ||
    !value.input.trim() ||
    typeof value.iteration !== "number" ||
    !Number.isInteger(value.iteration) ||
    value.iteration < 1
  ) {
    return null;
  }

  const pendingImages = Array.isArray(value.pendingImages)
    ? (value.pendingImages.filter((item) => isRecord(item) && item.type === "image") as ImageContent[])
    : undefined;
  return {
    name: value.name,
    input: value.input,
    iteration: value.iteration,
    canonicalCwds: Array.isArray(value.canonicalCwds) &&
        value.canonicalCwds.every((cwd) => typeof cwd === "string")
      ? value.canonicalCwds as string[]
      : undefined,
    pendingFollowUp: typeof value.pendingFollowUp === "string" ? value.pendingFollowUp : undefined,
    pendingImages: pendingImages?.length ? pendingImages : undefined,
    pendingExecutionContinuation: value.pendingExecutionContinuation === true,
    approvedPlan: parseApprovedPlan(value.approvedPlan),
    executionGates: Array.isArray(value.executionGates)
      ? value.executionGates.map(parseExecutionGate).filter(
        (gate): gate is ExecutionGate => gate !== undefined,
      )
      : undefined,
    planningScoutGate: parsePlanningScoutGate(value.planningScoutGate),
    planSubmission: parsePlanSubmission(value.planSubmission),
    awaitingRemoteConfirmation:
      value.awaitingRemoteConfirmation === "review-comments" ||
        value.awaitingRemoteConfirmation === "review-replies"
        ? value.awaitingRemoteConfirmation
        : undefined,
    remoteActionAuthorization:
      value.remoteActionAuthorization === "review-comments" ||
        value.remoteActionAuthorization === "review-replies"
        ? value.remoteActionAuthorization
        : undefined,
    remoteActionPending:
      Array.isArray(value.remoteActionPending) &&
        value.remoteActionPending.every(
          (item) =>
            isRecord(item) &&
            typeof item.id === "string" &&
            typeof item.toolCallId === "string",
        )
        ? value.remoteActionPending as Array<{ id: string; toolCallId: string }>
        : undefined,
    remoteActionCompletedIds:
      Array.isArray(value.remoteActionCompletedIds) &&
        value.remoteActionCompletedIds.every((id) => typeof id === "string")
        ? value.remoteActionCompletedIds as string[]
        : undefined,
    readOnlyExecutionStatus:
      value.readOnlyExecutionStatus === "pending" ||
        value.readOnlyExecutionStatus === "completed" ||
        value.readOnlyExecutionStatus === "failed"
        ? value.readOnlyExecutionStatus
        : undefined,
    readOnlyToolCallId:
      typeof value.readOnlyToolCallId === "string"
        ? value.readOnlyToolCallId
        : undefined,
  };
}

function restoreWorkflow(entries: readonly unknown[]): ActiveWorkflow | null {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (!isRecord(entry) || entry.type !== "custom" || entry.customType !== WORKFLOW_STATE_ENTRY) continue;
    if (!isRecord(entry.data) || entry.data.version !== WORKFLOW_STATE_VERSION) return null;
    if (entry.data.active === null) return null;
    return parseActiveWorkflow(entry.data.active);
  }
  return null;
}

function reconcileInterruptedToolCalls(
  workflow: ActiveWorkflow | null,
): { workflow: ActiveWorkflow | null; interrupted: boolean } {
  if (!workflow) return { workflow, interrupted: false };
  let interrupted = false;
  let planningScoutGate = workflow.planningScoutGate;
  if (planningScoutGate?.status === "pending") {
    interrupted = true;
    planningScoutGate = {
      iteration: planningScoutGate.iteration,
      status: "failed",
      reason: "Planning scout was interrupted by session restoration; run a fresh scout.",
    };
  }
  let readOnlyExecutionStatus = workflow.readOnlyExecutionStatus;
  let readOnlyToolCallId = workflow.readOnlyToolCallId;
  if (readOnlyToolCallId) {
    interrupted = true;
    readOnlyExecutionStatus = "failed";
    readOnlyToolCallId = undefined;
  }
  const executionGates = workflow.executionGates?.map((gate) => {
    if (gate.worker === "pending") {
      interrupted = true;
      return {
        ...gate,
        worker: "failed" as const,
        reviewer: "required" as const,
        workerToolCallId: undefined,
        reviewerToolCallId: undefined,
        workerReason: "Worker was interrupted by session restoration; run a fresh worker.",
        reviewerReason: undefined,
      };
    }
    if (gate.reviewer === "pending") {
      interrupted = true;
      return {
        ...gate,
        reviewer: "required" as const,
        reviewerToolCallId: undefined,
        reviewerReason: "Reviewer was interrupted by session restoration; run a fresh reviewer.",
      };
    }
    return gate;
  });
  const interruptedRemoteAction = Boolean(workflow.remoteActionPending?.length);
  if (interruptedRemoteAction) interrupted = true;
  const interruptedSubmission = Boolean(workflow.planSubmission);
  if (interruptedSubmission) interrupted = true;
  const awaitingRemoteConfirmation = interruptedRemoteAction
    ? workflow.name === "mr-review"
      ? "review-comments"
      : workflow.name === "mr-comments"
        ? "review-replies"
        : undefined
    : workflow.awaitingRemoteConfirmation;
  return {
    interrupted,
    workflow: {
      ...workflow,
      planningScoutGate,
      planSubmission: interruptedSubmission ? undefined : workflow.planSubmission,
      executionGates,
      awaitingRemoteConfirmation,
      remoteActionAuthorization: interruptedRemoteAction
        ? undefined
        : workflow.remoteActionAuthorization,
      remoteActionPending: interruptedRemoteAction ? undefined : workflow.remoteActionPending,
      readOnlyExecutionStatus,
      readOnlyToolCallId,
    },
  };
}

function persistWorkflow(pi: ExtensionAPI, workflow: ActiveWorkflow | null): void {
  pi.appendEntry(WORKFLOW_STATE_ENTRY, {
    version: WORKFLOW_STATE_VERSION,
    active: workflow,
  });
}

function restoreResumableWorkflow(entries: readonly unknown[]): ActiveWorkflow | null {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (!isRecord(entry) || entry.type !== "custom" || entry.customType !== WORKFLOW_RESUME_ENTRY) continue;
    if (!isRecord(entry.data) || entry.data.version !== WORKFLOW_STATE_VERSION) return null;
    if (entry.data.workflow === null) return null;
    return parseActiveWorkflow(entry.data.workflow);
  }
  return null;
}

function persistResumableWorkflow(pi: ExtensionAPI, workflow: ActiveWorkflow | null): void {
  pi.appendEntry(WORKFLOW_RESUME_ENTRY, {
    version: WORKFLOW_STATE_VERSION,
    workflow,
  });
}

function withQueuedFollowUp(
  workflow: ActiveWorkflow,
  followUp: string,
  images?: ImageContent[],
): ActiveWorkflow {
  const hasPending = Boolean(workflow.pendingFollowUp);
  return {
    ...workflow,
    iteration: hasPending ? workflow.iteration : workflow.iteration + 1,
    pendingFollowUp: hasPending
      ? `${workflow.pendingFollowUp}\n\n${followUp}`
      : followUp,
    pendingImages: [...(workflow.pendingImages ?? []), ...(images ?? [])],
    pendingExecutionContinuation: undefined,
    approvedPlan: undefined,
    executionGates: undefined,
    planningScoutGate: undefined,
    planSubmission: undefined,
    awaitingRemoteConfirmation: undefined,
    remoteActionAuthorization: undefined,
    remoteActionPending: undefined,
    remoteActionCompletedIds: undefined,
    readOnlyExecutionStatus: undefined,
    readOnlyToolCallId: undefined,
  };
}

function sendWorkflowMessage(pi: ExtensionAPI, message: string, images?: ImageContent[]): void {
  if (images?.length) {
    pi.sendUserMessage([{ type: "text", text: message }, ...images]);
    return;
  }
  pi.sendUserMessage(message);
}

function containsAgent(value: unknown, agentName: string): boolean {
  if (Array.isArray(value)) return value.some((item) => containsAgent(item, agentName));
  if (!isRecord(value)) return false;
  if (value.agent === agentName) return true;
  return [value.tasks, value.chain, value.parallel].some((item) => containsAgent(item, agentName));
}

function hasApprovalFeedback(value: unknown): boolean {
  if (value === undefined || value === null || value === false) return false;
  if (typeof value === "string") return Boolean(value.trim());
  if (Array.isArray(value)) return value.length > 0;
  if (isRecord(value)) return Object.keys(value).length > 0;
  return true;
}

function sameApprovedPlan(left: ApprovedPlan, right: ApprovedPlan): boolean {
  return (
    left.cwd === right.cwd &&
    left.path === right.path &&
    left.sha256 === right.sha256 &&
    left.kind === right.kind
  );
}

function repositoryContract(
  approvedPlan: ApprovedPlan,
  requestedCwd: unknown,
): RepositoryVerificationContract | undefined {
  if (typeof requestedCwd !== "string") return undefined;
  const cwd = resolve(requestedCwd);
  return approvedPlan.verification?.repositories.find((repository) => repository.cwd === cwd);
}

function codeTargetError(approvedPlan: ApprovedPlan, requestedCwd: unknown): string | undefined {
  const repository = repositoryContract(approvedPlan, requestedCwd);
  if (!repository) {
    return "Subagent cwd does not match the exact repository cwd in the approved Verification contract.";
  }
  const target = repository.cwd;

  try {
    if (repositoryRoot(target) !== canonicalPath(target)) {
      return "Approved Verification contract cwd is not a Git repository root.";
    }
    if (
      repository.sourceCwd &&
      repositoryCommonDirectory(target) !== repositoryCommonDirectory(repository.sourceCwd)
    ) {
      return "Approved repository worktree does not belong to the approved source repository.";
    }
    if (repository.branch) {
      const branch = gitOutput(target, ["branch", "--show-current"]).toString("utf8").trim();
      if (branch !== repository.branch) {
        return `Approved repository must be on branch ${repository.branch}; found ${branch || "detached HEAD"}.`;
      }
    }
  } catch (error) {
    return `Approved repository cwd cannot be verified: ${error instanceof Error ? error.message : String(error)}`;
  }
  return undefined;
}

function cleanWorktreeError(cwd: string): string | undefined {
  const status = gitOutput(cwd, ["status", "--porcelain=v1", "--untracked-files=all"])
    .toString("utf8")
    .trim();
  return status
    ? "Approved repository must have a clean worktree with no staged, unstaged, or untracked leftovers."
    : undefined;
}

function isPlanMarkdownPath(input: Record<string, unknown>, cwd: string): boolean {
  const candidate = typeof input.path === "string" ? input.path : input.filePath;
  if (typeof candidate !== "string" || !candidate.trim()) return false;
  try {
    resolvePlanPath(cwd, candidate, false);
    return true;
  } catch {
    return false;
  }
}

function isReadOnlyMcpOperation(toolName: string): boolean {
  const operation = toolName.split("__").at(-1) ?? toolName;
  const normalized = operation.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  if (
    /(?:^|_)(?:add|apply|approve|assign|close|commit|create|delete|deploy|edit|execute|install|merge|patch|post|publish|push|remove|reopen|reply|resolve|run|send|set|submit|transition|update|upload|write)(?:_|$)/.test(
      normalized,
    )
  ) {
    return false;
  }
  return /(?:^|_)(?:get|list|search|read|fetch|query|find|inspect|show|lookup|describe|view)(?:_|$)/.test(
    normalized,
  );
}

function isReadOnlyMcpProxyCall(input: Record<string, unknown>): boolean {
  if (typeof input.tool === "string") return isReadOnlyMcpOperation(input.tool);
  if (typeof input.action === "string") return input.action === "ui-messages";
  return ["connect", "describe", "search", "server"].some((key) => typeof input[key] === "string");
}

function reviewPlatformForWorkflow(workflow: ActiveWorkflow, cwd: string): ReviewPlatform | undefined {
  if (workflow.name !== "mr-review" && workflow.name !== "mr-comments") return undefined;
  return reviewPlatform(workflow.input, cwd);
}

function isReviewReadOnlyMcpOperation(toolName: string, workflow: ActiveWorkflow, cwd: string): boolean {
  const platform = reviewPlatformForWorkflow(workflow, cwd);
  if (!platform) return false;

  const normalized = toolName.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  const prefix = platform === "gitlab" ? "gitlab" : "github";
  if (!new RegExp(`^${prefix}(?:_|__)`).test(normalized)) return false;
  if (!/(?:^|_)(?:get|list|search|read|fetch|query|find|inspect|show|lookup|describe|view)(?:_|$)/.test(normalized)) {
    return false;
  }
  return !/(?:^|_)(?:add|apply|approve|assign|close|commit|create|delete|deploy|edit|execute|install|patch|post|publish|push|remove|reopen|reply|resolve|run|send|set|submit|transition|update|upload|write)(?:_|$)/.test(
    normalized,
  );
}

function explicitlyAuthorizesRemoteAction(input: string): boolean {
  return /^(?:yes\b|y\b|go ahead\b|proceed\b|do it\b|please (?:post|push|reply)\b)/i.test(
    input.trim(),
  );
}

type ReviewRemoteMutationKind = "push" | "comment" | "forbidden" | "other";

function remoteUrlHost(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.hostname.toLowerCase()
      : undefined;
  } catch {
    const scpHost = value.match(/^[^@\s]+@([^:\s]+):/);
    return scpHost?.[1]?.toLowerCase();
  }
}

function actionInputFields(
  value: unknown,
  fields: Array<{ key: string; value: string | number }> = [],
): Array<{ key: string; value: string | number }> {
  if (Array.isArray(value)) {
    for (const item of value) actionInputFields(item, fields);
    return fields;
  }
  if (!isRecord(value)) return fields;
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" || typeof item === "number") {
      fields.push({ key: key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase(), value: item });
    } else {
      actionInputFields(item, fields);
    }
  }
  return fields;
}

function normalizedRepositoryReference(value: string): string {
  try {
    return decodeURIComponent(value)
      .replace(/^https:\/\/[^/]+\//i, "")
      .replace(/^\/+|\/+$/g, "")
      .replace(/\.git$/i, "")
      .toLowerCase();
  } catch {
    return value.replace(/^\/+|\/+$/g, "").replace(/\.git$/i, "").toLowerCase();
  }
}

function parsedGitPushCommand(
  command: string,
): { args: string[]; pushIndex: number } | undefined {
  const args = splitSimpleCommand(command);
  if (!args || basename(args[0]!) !== "git") return undefined;
  const pushIndex = args.indexOf("push");
  return pushIndex > 0 ? { args, pushIndex } : undefined;
}

function isForbiddenGitPush(command: string): boolean {
  const parsed = parsedGitPushCommand(command);
  if (!parsed) return false;
  return parsed.args.slice(parsed.pushIndex + 1).some(
    (arg) =>
      /^-[^-]*[df]/.test(arg) ||
      arg === "--force" ||
      arg.startsWith("--force=") ||
      arg === "--force-with-lease" ||
      arg.startsWith("--force-with-lease=") ||
      arg === "--force-if-includes" ||
      arg.startsWith("--force-if-includes=") ||
      arg === "--mirror" ||
      arg === "--delete" ||
      arg.startsWith("--delete=") ||
      arg === "--prune" ||
      arg.startsWith("+") ||
      /^:[^:]+$/.test(arg),
  );
}

function gitPushTarget(
  action: ApprovedRemoteAction,
  verification: VerificationContract | undefined,
): RepositoryVerificationContract | undefined {
  if (action.toolName !== "bash" || typeof action.input.command !== "string" || !verification) {
    return undefined;
  }
  const parsed = parsedGitPushCommand(action.input.command);
  if (!parsed) return undefined;
  const { args, pushIndex } = parsed;
  let cwd: string | undefined;
  const cwdIndex = args.indexOf("-C");
  if (cwdIndex > 0 && cwdIndex < pushIndex && args[cwdIndex + 1]) {
    cwd = resolve(args[cwdIndex + 1]!);
  } else if (typeof action.input.cwd === "string") {
    cwd = resolve(action.input.cwd);
  }
  return cwd
    ? verification.repositories.find((repository) => repository.cwd === cwd)
    : undefined;
}

function remoteActionTargetError(
  action: ApprovedRemoteAction,
  workflow: ActiveWorkflow,
  cwd: string,
  verification?: VerificationContract,
): string | undefined {
  const url = reviewUrl(workflow.input);
  const platform = reviewPlatformForWorkflow(workflow, cwd);
  if (!url || !platform) return "does not match the review URL target.";
  const trustedHost = url.hostname.toLowerCase();
  const effectiveTool = action.toolName === "mcp" && typeof action.input.tool === "string"
    ? action.input.tool
    : action.toolName;
  const normalizedTool = effectiveTool
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();

  if (action.toolName === "bash") {
    const command = typeof action.input.command === "string" ? action.input.command : "";
    const args = splitSimpleCommand(command);
    if (!args?.length) return "does not contain a safe exact review-target command.";
    const executable = basename(args[0]!);
    if (executable === "gh" || executable === "glab") {
      if (
        (executable === "gh" && platform !== "github" && platform !== "github-enterprise") ||
        (executable === "glab" && platform !== "gitlab")
      ) {
        return "does not match the review platform.";
      }
      const repoIndex = args.indexOf("--repo");
      const hostnameIndex = args.indexOf("--hostname");
      const pathParts = url.pathname.split("/").filter(Boolean);
      const expectedRepository = platform === "gitlab"
        ? pathParts.slice(0, pathParts.indexOf("-")).join("/")
        : pathParts.slice(0, 2).join("/");
      const reviewNumber = platform === "gitlab"
        ? pathParts[pathParts.indexOf("merge_requests") + 1]
        : pathParts[pathParts.indexOf("pull") + 1];
      if (
        repoIndex < 0 ||
        normalizedRepositoryReference(args[repoIndex + 1] ?? "") !==
          normalizedRepositoryReference(expectedRepository) ||
        args[3] !== reviewNumber ||
        (
          platform === "github-enterprise" &&
          (hostnameIndex < 0 || args[hostnameIndex + 1]?.toLowerCase() !== trustedHost)
        )
      ) {
        return "does not match the review URL target.";
      }
      return undefined;
    }
    if (executable === "curl") {
      const candidateUrls = args.flatMap((arg) => {
        try {
          const candidate = new URL(arg);
          return candidate.protocol === "https:" ? [candidate] : [];
        } catch {
          return [];
        }
      });
      const pathParts = url.pathname.split("/").filter(Boolean);
      const expectedRepository = platform === "gitlab"
        ? pathParts.slice(0, pathParts.indexOf("-")).join("/")
        : pathParts.slice(0, 2).join("/");
      const reviewNumber = platform === "gitlab"
        ? pathParts[pathParts.indexOf("merge_requests") + 1]
        : pathParts[pathParts.indexOf("pull") + 1];
      const candidatePath = candidateUrls[0]?.pathname ?? "";
      const gitlabTarget = candidatePath.match(
        /\/projects\/([^/]+)\/merge_requests\/(\d+)(?:\/|$)/,
      );
      const githubTarget = candidatePath.match(
        /\/repos\/([^/]+)\/([^/]+)\/pulls?\/(\d+)(?:\/|$)/,
      );
      const exactTarget = platform === "gitlab"
        ? Boolean(
          gitlabTarget &&
          normalizedRepositoryReference(decodeURIComponent(gitlabTarget[1]!)) ===
            normalizedRepositoryReference(expectedRepository) &&
          gitlabTarget[2] === reviewNumber,
        )
        : platform === "github" || platform === "github-enterprise"
          ? Boolean(
            githubTarget &&
            normalizedRepositoryReference(`${githubTarget[1]}/${githubTarget[2]}`) ===
              normalizedRepositoryReference(expectedRepository) &&
            githubTarget[3] === reviewNumber,
          )
          : candidatePath.replace(/\/+$/, "").startsWith(
            `${url.pathname.replace(/\/+$/, "")}/`,
          );
      if (
        candidateUrls.length !== 1 ||
        candidateUrls[0]!.hostname.toLowerCase() !== trustedHost ||
        !exactTarget
      ) {
        return "does not match the review URL target.";
      }
      return undefined;
    }
    const pushRepository = gitPushTarget(action, verification);
    if (pushRepository) {
      const args = splitSimpleCommand(command)!;
      const pushIndex = args.indexOf("push");
      const remote = args.slice(pushIndex + 1).find((arg) => !arg.startsWith("-")) ?? "origin";
      try {
        const remoteUrl = gitOutput(
          pushRepository.sourceCwd ?? pushRepository.cwd,
          ["remote", "get-url", remote],
        ).toString("utf8").trim();
        if (remoteUrlHost(remoteUrl) !== trustedHost) {
          return "does not match the review URL target.";
        }
      } catch {
        return "does not match the review URL target.";
      }
      return undefined;
    }
    return "does not match the review URL target.";
  }

  if (
    (platform === "gitlab" && !/(?:^|__)gitlab(?:_|__)/.test(normalizedTool)) ||
    (
      (platform === "github" || platform === "github-enterprise") &&
      !/(?:^|__)github(?:_|__)/.test(normalizedTool)
    )
  ) {
    return "does not match the review platform.";
  }

  const fields = actionInputFields(action.input);
  let exactReviewUrl = false;
  let explicitHostBinding = false;
  for (const field of fields) {
    if (typeof field.value !== "string") continue;
    const isTargetUrlField =
      /^(?:url|review_url|web_url|html_url|api_url|endpoint|merge_request_url|pull_request_url)$/.test(
        field.key,
      );
    const host = isTargetUrlField ? remoteUrlHost(field.value) : undefined;
    if (host) {
      if (host !== trustedHost) return "does not match the review URL target.";
      try {
        const candidate = new URL(field.value);
        if (
          candidate.pathname.replace(/\/+$/, "") === url.pathname.replace(/\/+$/, "")
        ) {
          exactReviewUrl = true;
        }
      } catch {
        // A validated scp-style Git URL cannot be the exact review URL.
      }
    }
    if (
      /^(?:host|hostname|server_host)$/.test(field.key)
    ) {
      if (field.value.toLowerCase() !== trustedHost) {
        return "does not match the review URL target.";
      }
      explicitHostBinding = true;
    }
  }
  const pathParts = url.pathname.split("/").filter(Boolean);
  if (platform === "generic") {
    return exactReviewUrl ? undefined : "does not match the review URL target.";
  }
  const expectedRepository = platform === "gitlab"
    ? pathParts.slice(0, pathParts.indexOf("-")).join("/")
    : pathParts.slice(0, 2).join("/");
  const reviewNumber = platform === "gitlab"
    ? pathParts[pathParts.indexOf("merge_requests") + 1]
    : pathParts[pathParts.indexOf("pull") + 1];
  const repositoryFields = fields.filter((field) =>
    /^(?:project|project_id|project_path|repo|repository|repository_id|full_name)$/.test(
      field.key,
    )
  );
  const ownerFields = fields.filter((field) => field.key === "owner");
  const repositoryMatched = platform === "gitlab"
    ? repositoryFields.length > 0 &&
      repositoryFields.every(
        (field) =>
          typeof field.value === "string" &&
          normalizedRepositoryReference(field.value) ===
            normalizedRepositoryReference(expectedRepository),
      )
    : ownerFields.length > 0 &&
      ownerFields.every(
        (field) => String(field.value).toLowerCase() === pathParts[0]?.toLowerCase(),
      ) &&
      repositoryFields.length > 0 &&
      repositoryFields.every(
        (field) =>
          typeof field.value === "string" &&
          (
            normalizedRepositoryReference(field.value) ===
              normalizedRepositoryReference(expectedRepository) ||
            (
              /^(?:repo|repository)$/.test(field.key) &&
              normalizedRepositoryReference(field.value) ===
                normalizedRepositoryReference(pathParts[1] ?? "")
            )
          ),
      );
  const numberFields = fields.filter((field) =>
    /^(?:iid|merge_request_iid|merge_request_id|mr_iid|number|pull_number|pull_request_number)$/.test(
      field.key,
    )
  );
  const numberMatched =
    numberFields.length > 0 &&
    numberFields.every((field) => String(field.value) === reviewNumber);
  const contradictoryRepository =
    (repositoryFields.length > 0 || ownerFields.length > 0) && !repositoryMatched;
  const contradictoryNumber = numberFields.length > 0 && !numberMatched;
  if (contradictoryRepository || contradictoryNumber) {
    return "does not match the review URL target.";
  }
  if (platform === "github-enterprise" && !exactReviewUrl && !explicitHostBinding) {
    return "does not match the review URL target.";
  }
  return exactReviewUrl || (repositoryMatched && numberMatched)
    ? undefined
    : "does not match the review URL target.";
}

function hasForbiddenRemoteActionInput(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenRemoteActionInput);
  if (!isRecord(value)) return false;
  for (const [key, item] of Object.entries(value)) {
    if (
      /^(?:action|event|method|operation|state|status)$/i.test(key) &&
      typeof item === "string" &&
      /^(?:approve|approved|merge|merged|resolve|resolved|close|closed|delete|deleted)$/i.test(
        item.trim(),
      )
    ) {
      return true;
    }
    if (hasForbiddenRemoteActionInput(item)) return true;
  }
  return false;
}

function reviewRemoteMutationKind(
  toolName: string,
  input: Record<string, unknown>,
  workflow: ActiveWorkflow,
  cwd: string,
): ReviewRemoteMutationKind | undefined {
  if (workflow.name !== "mr-review" && workflow.name !== "mr-comments") return undefined;
  if (hasForbiddenRemoteActionInput(input)) return "forbidden";
  if (toolName === "bash") {
    if (typeof input.command !== "string") return undefined;
    if (isReadOnlyReviewCliCommand(input.command, workflow, cwd)) return undefined;
    const command = input.command.trim();
    if (
      /\b(?:merge|approve|resolve|close|delete)\b/i.test(command) ||
      isForbiddenGitPush(command)
    ) {
      return "forbidden";
    }
    if (parsedGitPushCommand(command)) return "push";
    if (
      /\b(?:gh\s+pr\s+(?:comment|review)|glab\s+mr\s+(?:comment|note)|curl\b[^\n]*(?:comments?|notes?|discussions?|replies?|reviews?))\b/i.test(
        command,
      )
    ) {
      return "comment";
    }
    return /\b(?:gh|glab|curl)\b/i.test(command) ? "other" : undefined;
  }
  if (toolName === "mcp") {
    if (typeof input.tool === "string") {
      return reviewRemoteMutationKind(input.tool, input, workflow, cwd);
    }
    return typeof input.action === "string" && input.action !== "ui-messages"
      ? "other"
      : undefined;
  }
  if (
    !/^(?:mcp__|github(?:_|__)|gitlab(?:_|__)|bitbucket(?:_|__)|gitea(?:_|__)|forgejo(?:_|__)|azure_devops(?:_|__))/i.test(
      toolName,
    )
  ) {
    return undefined;
  }
  if (isReadOnlyMcpOperation(toolName)) return undefined;
  const normalized = toolName.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  if (
    /(?:^|_)(?:merge(?!_request)|approve|resolve|close|delete|force_push)(?:_|$)/.test(
      normalized,
    )
  ) {
    return "forbidden";
  }
  if (/(?:^|_)(?:comment|note|reply|discussion|review)(?:_|$)/.test(normalized)) {
    return "comment";
  }
  if (/(?:^|_)(?:push|publish)(?:_|$)/.test(normalized)) return "push";
  return "other";
}

function remoteMutationAuthorizationError(
  workflow: ActiveWorkflow,
  kind: ReviewRemoteMutationKind,
): string | undefined {
  if (kind === "forbidden") {
    return "Workflow confirmation never authorizes merge, approval, resolution, closure, deletion, or force push.";
  }
  const authorization = workflow.remoteActionAuthorization;
  if (!authorization) {
    return "Review comments, replies, and pushes require explicit user confirmation after plan approval and verification.";
  }
  if (authorization === "review-comments" && kind !== "comment") {
    return "Review-comment authorization permits only approved review comments.";
  }
  if (authorization === "review-replies" && kind !== "comment" && kind !== "push") {
    return "Review-reply authorization permits only approved replies and a non-force push.";
  }
  return undefined;
}

function matchingApprovedRemoteAction(
  workflow: ActiveWorkflow,
  toolName: string,
  input: Record<string, unknown>,
): ApprovedRemoteAction | undefined {
  const unavailable = new Set([
    ...(workflow.remoteActionCompletedIds ?? []),
    ...(workflow.remoteActionPending ?? []).map((item) => item.id),
  ]);
  const inputJson = canonicalJson(input);
  return workflow.approvedPlan?.remoteActions?.find(
    (action) =>
      !unavailable.has(action.id) &&
      action.toolName === toolName &&
      canonicalJson(action.input) === inputJson,
  );
}

function splitSimpleCommand(command: string): string[] | undefined {
  if (!command.trim() || /[\n\r]/.test(command)) return undefined;
  const args: string[] = [];
  let current = "";
  let quote: "'" | '"' | undefined;
  let escaped = false;

  for (const character of command.trim()) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (quote === "'") {
      if (character === "'") quote = undefined;
      else current += character;
      continue;
    }
    if (quote === '"') {
      if (character === '"') {
        quote = undefined;
      } else if (character === "$" || character === "`") {
        return undefined;
      } else if (character === "\\") {
        escaped = true;
      } else {
        current += character;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (";&|<>()`$".includes(character)) return undefined;
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (/\s/.test(character)) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }
    current += character;
  }
  if (quote || escaped) return undefined;
  if (current) args.push(current);
  return args.length ? args : undefined;
}

function hasOnlyReadOnlyCliArguments(args: string[], trustedHost: string): boolean {
  for (let index = 3; index < args.length; index += 1) {
    const arg = args[index]!;
    if (["--output", "--json", "--limit"].includes(arg)) {
      const value = args[++index];
      if (!value || !/^[a-z0-9,._-]+$/i.test(value)) return false;
      continue;
    }
    if (arg === "--hostname") {
      if (args[++index]?.toLowerCase() !== trustedHost) return false;
      continue;
    }
    if (!/^\d+$/.test(arg)) return false;
  }
  return true;
}

function isReadOnlyReviewCliCommand(command: string, workflow: ActiveWorkflow, cwd: string): boolean {
  const platform = reviewPlatformForWorkflow(workflow, cwd);
  const args = splitSimpleCommand(command);
  if (!platform || !args?.length) return false;
  const trustedHost = reviewUrl(workflow.input)?.hostname.toLowerCase();
  if (!trustedHost) return false;

  if (platform === "gitlab" && args[0] === "glab") {
    return ["mr", "ci", "pipeline"].includes(args[1] ?? "") &&
      ["view", "list", "diff", "status"].includes(args[2] ?? "") &&
      hasOnlyReadOnlyCliArguments(args, trustedHost);
  }
  if ((platform === "github" || platform === "github-enterprise") && args[0] === "gh") {
    return ["pr", "run", "workflow"].includes(args[1] ?? "") &&
      ["view", "list", "diff", "status"].includes(args[2] ?? "") &&
      hasOnlyReadOnlyCliArguments(args, trustedHost);
  }
  if (args[0] !== "curl") return false;

  let method = "GET";
  let url: URL | undefined;
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index]!;
    if (["--head", "-I"].includes(arg)) {
      method = "HEAD";
      continue;
    }
    if (["--request", "-X"].includes(arg)) {
      const requestedMethod = args[++index];
      if (!requestedMethod || !["GET", "HEAD"].includes(requestedMethod.toUpperCase())) return false;
      method = requestedMethod.toUpperCase();
      continue;
    }
    if (["--silent", "-s", "--show-error", "-S", "--fail", "-f", "--compressed", "--netrc"].includes(arg)) {
      continue;
    }
    if (arg.startsWith("-")) return false;
    if (url) return false;
    try {
      url = new URL(arg);
    } catch {
      return false;
    }
  }

  if (
    !url ||
    !["GET", "HEAD"].includes(method) ||
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  ) {
    return false;
  }
  const allowedHost = platform === "github" ? "api.github.com" : trustedHost;
  return url.hostname.toLowerCase() === allowedHost;
}

function isReadOnlyExplorationCommand(command: string): boolean {
  const args = splitSimpleCommand(command);
  if (!args?.length) return false;
  const executable = basename(args[0]!);
  const passiveCommands = new Set([
    "rg",
    "grep",
    "head",
    "tail",
    "wc",
    "cut",
    "jq",
    "ls",
    "stat",
    "file",
    "pwd",
    "realpath",
    "dirname",
    "basename",
  ]);
  if (passiveCommands.has(executable)) {
    if (executable === "rg" && args.some((arg) => arg === "--pre" || arg.startsWith("--pre="))) {
      return false;
    }
    return true;
  }
  if (executable === "ast-grep" || executable === "sg") {
    return !args.some((arg) =>
      ["--rewrite", "--update-all", "--interactive"].includes(arg));
  }
  if (executable !== "git") return false;
  const subcommand = args[1];
  if (!subcommand) return false;
  if (args.slice(2).some((arg) => arg === "--output" || arg.startsWith("--output="))) {
    return false;
  }
  if (subcommand === "branch") {
    const branchArgs = args.slice(2);
    if (branchArgs.length === 0) return true;
    if (branchArgs.length === 1 && branchArgs[0] === "--show-current") return true;
    const listMode = branchArgs.includes("--list");
    return branchArgs.every((arg) =>
      ["--list", "-a", "--all", "-r", "--remotes", "-v", "-vv"].includes(arg) ||
      (listMode && !arg.startsWith("-")));
  }
  if (subcommand === "remote") return args[2] === "get-url" || args.length === 2;
  if (subcommand === "worktree") return args[2] === "list";
  return new Set([
    "status",
    "diff",
    "show",
    "log",
    "rev-parse",
    "ls-files",
    "grep",
    "blame",
    "describe",
    "name-rev",
    "shortlog",
  ]).has(subcommand);
}

function isApprovedWorktreeSetupCommand(
  command: string,
  approvedPlan: ApprovedPlan,
): boolean {
  const args = splitSimpleCommand(command);
  if (!args || basename(args[0]!) !== "git") return false;
  let index = 1;
  if (args[index] !== "-C" || !args[index + 1]) return false;
  const sourceCwd = resolve(approvedPlan.cwd, args[index + 1]!);
  index += 2;
  if (args[index] !== "worktree" || args[index + 1] !== "add") return false;
  const worktreeArgs = args.slice(index + 2);
  if (
    (worktreeArgs[0] !== "-b" && worktreeArgs[0] !== "--branch") ||
    worktreeArgs.length !== 4
  ) {
    return false;
  }
  const branch = worktreeArgs[1];
  const target = worktreeArgs[2];
  const baseHead = worktreeArgs[3];
  if (!branch || !target || !baseHead) return false;
  const resolvedTarget = resolve(approvedPlan.cwd, target);
  return approvedPlan.verification?.repositories.some(
    (repository) =>
      repository.cwd === resolvedTarget &&
      repository.sourceCwd === sourceCwd &&
      repository.branch === branch &&
      repository.baseHead === baseHead,
  ) ?? false;
}

function isMcpLikeTool(toolName: string): boolean {
  return /^(?:mcp(?:__|$)|atlassian(?:_|__)|github(?:_|__)|gitlab(?:_|__)|bitbucket(?:_|__)|gitea(?:_|__)|forgejo(?:_|__)|azure_devops(?:_|__))/i.test(
    toolName,
  );
}

function approvedExecutionMutationError(
  toolName: string,
  input: Record<string, unknown>,
  workflow: ActiveWorkflow,
  cwd: string,
  remoteMutation: ReviewRemoteMutationKind | undefined,
): string | undefined {
  const approvedPlan = workflow.approvedPlan;
  if (!approvedPlan) return undefined;
  if (toolName === "edit" || toolName === "write") {
    return approvedPlan.kind === "code"
      ? "Approved code changes must be made only by contract-bound worker subagents."
      : "Approved read-only execution cannot edit or write local files.";
  }
  if (toolName === "bash" && typeof input.command === "string") {
    if (
      isReadOnlyExplorationCommand(input.command) ||
      isReadOnlyReviewCliCommand(input.command, workflow, cwd) ||
      remoteMutation
    ) {
      return undefined;
    }
    if (
      approvedPlan.kind === "code" &&
      isApprovedWorktreeSetupCommand(input.command, approvedPlan)
    ) {
      return undefined;
    }
    return approvedPlan.kind === "code"
      ? "Parent execution permits only read-only checks, exact approved worktree setup, and contract-bound workers."
      : "Approved read-only execution permits only read-only shell commands.";
  }
  if (isMcpLikeTool(toolName)) {
    const readOnly = toolName === "mcp"
      ? isReadOnlyMcpProxyCall(input)
      : isReadOnlyMcpOperation(toolName);
    if (!readOnly && !remoteMutation) {
      return "Approved execution does not authorize unlisted external mutations.";
    }
    return undefined;
  }
  if (
    ["read", "grep", "ls", "subagent"].includes(toolName) ||
    isReadOnlyMcpOperation(toolName) ||
    remoteMutation
  ) {
    return undefined;
  }
  return `Approved execution blocks unclassified tool ${toolName}.`;
}

function planningMutationError(
  toolName: string,
  input: Record<string, unknown>,
  cwd: string,
  workflow: ActiveWorkflow,
): string | undefined {
  if (["read", "grep", "ls", "subagent", "plannotator_submit_plan"].includes(toolName)) {
    return undefined;
  }
  if ((toolName === "edit" || toolName === "write") && isPlanMarkdownPath(input, cwd)) {
    return undefined;
  }
  if (toolName === "bash") {
    return typeof input.command === "string" &&
        (
          isReadOnlyExplorationCommand(input.command) ||
          isReadOnlyReviewCliCommand(input.command, workflow, cwd)
        )
      ? undefined
      : "Planning is read-only except approved exploration commands and markdown plans beneath .plannotator.";
  }
  if (["edit", "write", "find"].includes(toolName)) {
    return "Planning is read-only except approved exploration commands and markdown plans beneath .plannotator.";
  }
  if (toolName === "mcp") {
    return isReadOnlyMcpProxyCall(input) ||
        (typeof input.tool === "string" && isReviewReadOnlyMcpOperation(input.tool, workflow, cwd))
      ? undefined
      : "MCP operation is not explicitly classified as read-only and is blocked until the current plan is approved.";
  }
  if (isReadOnlyMcpOperation(toolName) || isReviewReadOnlyMcpOperation(toolName, workflow, cwd)) return undefined;
  return `Tool ${toolName} is not explicitly classified as read-only and is blocked until the current plan is approved.`;
}

function planningScoutError(input: Record<string, unknown>, cwd: string): string | undefined {
  if (input.agent !== "scout" || Array.isArray(input.tasks) || Array.isArray(input.chain)) {
    return "Planning scout must run as one single subagent, not in a chain or parallel batch.";
  }
  if (input.context !== "fresh") return "Planning scout requires context: \"fresh\".";
  if (input.cwd !== cwd) return "Planning scout must use the invoking workflow checkout cwd.";
  if (input.async === true) return "Planning scout must run in the foreground so its result is available.";
  if (input.worktree === true) return "Planning scout must not create a worktree.";
  if (typeof input.task !== "string" || !input.task.trim()) {
    return "Planning scout requires one bounded evidence question.";
  }
  return undefined;
}

function planningResearcherError(input: Record<string, unknown>, cwd: string): string | undefined {
  if (input.agent !== "researcher" || Array.isArray(input.tasks) || Array.isArray(input.chain)) {
    return "Planning researcher must run as one single subagent, not in a chain or parallel batch.";
  }
  if (input.context !== "fresh") return "Planning researcher requires context: \"fresh\".";
  if (input.cwd !== cwd) return "Planning researcher must use the invoking workflow checkout cwd.";
  if (input.async === true) return "Planning researcher must run in the foreground.";
  if (input.worktree === true) return "Planning researcher must not create a worktree.";
  if (typeof input.task !== "string" || !input.task.trim()) {
    return "Planning researcher requires one bounded current-doc question.";
  }
  return undefined;
}

function planningScoutResultError(details: unknown): string | undefined {
  if (!isRecord(details) || !Array.isArray(details.results) || details.results.length !== 1) {
    return "Planning scout did not return one final runtime result.";
  }
  const result = details.results[0];
  if (!isRecord(result) || result.agent !== "scout" || result.exitCode !== 0) {
    return "Planning scout process did not complete successfully.";
  }
  const acceptance = result.acceptance;
  if (
    !isRecord(acceptance) ||
    !["attested", "checked", "verified", "reviewed", "accepted"].includes(
      acceptance.status as string,
    )
  ) {
    return "Planning scout runtime acceptance ledger did not pass.";
  }
  return undefined;
}

function verifiedAcceptanceError(
  input: Record<string, unknown>,
  role: "worker" | "reviewer",
): string | undefined {
  if (input.agent !== role || Array.isArray(input.chain)) {
    return `${role} task must name the expected role without a chain.`;
  }
  if (input.context !== "fresh") return `${role} requires context: "fresh".`;
  if (typeof input.cwd !== "string" || !input.cwd.trim()) return `${role} requires the explicit target checkout cwd.`;
  if (input.async === true) return `${role} must run in the foreground so its final acceptance ledger is available.`;
  if (input.worktree === true) return `${role} must reuse the explicit canonical cwd, not create another worktree.`;

  const explicitSkills = normalizeExplicitSkillOverride(input.skill);
  if (explicitSkills !== undefined) {
    const missingSkills = REQUIRED_ROLE_SKILLS[role].filter(
      (required) => !explicitSkills.includes(required),
    );
    if (missingSkills.length > 0) {
      return `Explicit ${role} skill overrides replace configured defaults and must retain: ${REQUIRED_ROLE_SKILLS[role].join(", ")}. Missing: ${missingSkills.join(", ")}. Omit skill when no additional task skill is needed.`;
    }
  }

  const acceptance = input.acceptance;
  if (!isRecord(acceptance) || acceptance.level !== "verified") {
    return `${role} requires runtime verified acceptance.`;
  }
  if (!Array.isArray(acceptance.verify) || acceptance.verify.length === 0) {
    return `${role} verified acceptance requires runtime verification commands.`;
  }

  const ids = new Set<string>();
  for (const command of acceptance.verify) {
    if (!isRecord(command) || typeof command.id !== "string" || typeof command.command !== "string") {
      return `${role} verification commands require non-empty id and command fields.`;
    }
    if (!command.id.trim() || !command.command.trim()) {
      return `${role} verification commands require non-empty id and command fields.`;
    }
    const id = command.id.trim();
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(id)) {
      return `${role} verification command ids must use lowercase letters, digits, dot, underscore, or hyphen.`;
    }
    if (ids.has(id)) return `${role} verification command ids must be unique.`;
    if (/\r|\n/.test(command.command)) return `${role} verification commands must each be one line.`;
    if (isPlaceholderSuccessCommand(command.command.trim())) {
      return `${role} verification commands cannot be placeholder success commands.`;
    }
    if (
      typeof command.timeoutMs !== "number" ||
      !Number.isInteger(command.timeoutMs) ||
      command.timeoutMs < 1
    ) {
      return `${role} verification commands require a positive integer timeoutMs.`;
    }
    if (command.cwd !== undefined || command.env !== undefined) {
      return `${role} verification commands must use the explicit target cwd and inherited environment.`;
    }
    if (command.allowFailure === true) return `${role} verification commands cannot allow failure.`;
    ids.add(id);
  }

  if (role === "reviewer") {
    const missing = REQUIRED_REVIEWER_COMMAND_IDS.filter((id) => !ids.has(id));
    if (missing.length || ids.size !== REQUIRED_REVIEWER_COMMAND_IDS.length) {
      return `reviewer verified acceptance command ids must be exactly: ${REQUIRED_REVIEWER_COMMAND_IDS.join(", ")}.`;
    }
  }
  return undefined;
}

function requestedRoleTasks(
  input: Record<string, unknown>,
  role: VerificationRole,
): Record<string, unknown>[] | undefined {
  if (input.agent === role && !Array.isArray(input.tasks) && !Array.isArray(input.chain)) {
    return [input];
  }
  if (
    input.agent !== undefined ||
    !Array.isArray(input.tasks) ||
    input.tasks.length === 0 ||
    Array.isArray(input.chain)
  ) {
    return undefined;
  }
  const tasks: Record<string, unknown>[] = [];
  for (const value of input.tasks) {
    if (!isRecord(value) || value.agent !== role) return undefined;
    tasks.push({
      ...value,
      context: value.context ?? input.context,
      async: value.async ?? input.async,
      worktree: value.worktree ?? input.worktree,
    });
  }
  return tasks;
}

function normalizeExplicitSkillOverride(value: unknown): string[] | undefined {
  if (value === undefined || value === true) return undefined;
  if (value === false) return [];
  if (Array.isArray(value)) {
    if (!value.every((skill) => typeof skill === "string")) return [];
    return [...new Set(value.map((skill) => skill.trim()).filter(Boolean))];
  }
  if (typeof value !== "string") return [];

  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return normalizeExplicitSkillOverride(parsed) ?? [];
    } catch {
      // Match pi-subagents: malformed JSON-like strings fall back to comma splitting.
    }
  }
  return [...new Set(value.split(",").map((skill) => skill.trim()).filter(Boolean))];
}

function acceptanceVerificationCommands(input: Record<string, unknown>): VerificationCommand[] {
  const acceptance = input.acceptance as Record<string, unknown>;
  return (acceptance.verify as Array<Record<string, unknown>>).map((command) => ({
    id: (command.id as string).trim(),
    command: (command.command as string).trim(),
    timeoutMs: command.timeoutMs as number,
  }));
}

function verificationContractError(
  input: Record<string, unknown>,
  role: VerificationRole,
  approvedPlan: ApprovedPlan,
): string | undefined {
  const repository = repositoryContract(approvedPlan, input.cwd);
  if (!repository) {
    return codeTargetError(approvedPlan, input.cwd);
  }
  const expected = repository[role];
  if (!expected) {
    return `Approved plan requires an exact ## Verification contract before ${role} may run.`;
  }
  const targetError = codeTargetError(approvedPlan, input.cwd);
  if (targetError) return targetError;
  const actual = acceptanceVerificationCommands(input);
  if (actual.length !== expected.length) {
    return `${role} verification commands do not match the approved plan contract.`;
  }
  for (let index = 0; index < expected.length; index += 1) {
    const approved = expected[index]!;
    const requested = actual[index]!;
    if (
      requested.id !== approved.id ||
      requested.command !== approved.command ||
      requested.timeoutMs !== approved.timeoutMs
    ) {
      return `${role} verification command ${requested.id || index + 1} does not exactly match the approved plan contract.`;
    }
  }
  if (repository.acceptanceCriteria) {
    const acceptance = input.acceptance as Record<string, unknown>;
    const criteria = Array.isArray(acceptance.criteria)
      ? acceptance.criteria.map((criterion) => typeof criterion === "string" ? criterion.trim() : "")
      : [];
    if (
      criteria.length !== repository.acceptanceCriteria.length ||
      criteria.some((criterion, index) => criterion !== repository.acceptanceCriteria![index])
    ) {
      return `${role} acceptance criteria do not exactly match the approved plan contract.`;
    }
  }
  return undefined;
}

function acceptanceLedgerError(
  details: unknown,
  role: VerificationRole,
  expected: VerificationCommand[],
  acceptanceCriteria?: string[],
): string | undefined {
  if (!isRecord(details) || !Array.isArray(details.results) || details.results.length !== 1) {
    return `${role} did not return one final runtime result.`;
  }
  const result = details.results[0];
  if (!isRecord(result) || result.agent !== role || result.exitCode !== 0) {
    return `${role} process did not complete successfully.`;
  }
  const acceptance = result.acceptance;
  if (!isRecord(acceptance) || acceptance.status !== "verified") {
    return `${role} runtime acceptance ledger is not verified.`;
  }
  if (!Array.isArray(acceptance.verifyRuns) || acceptance.verifyRuns.length !== expected.length) {
    return `${role} runtime acceptance ledger does not contain the approved commands.`;
  }
  if (acceptanceCriteria?.length) {
    const childReport = acceptance.childReport;
    if (!isRecord(childReport) || !Array.isArray(childReport.criteriaSatisfied)) {
      return `${role} acceptance report did not provide per-criterion outcomes.`;
    }
    if (
      childReport.criteriaSatisfied.length !== acceptanceCriteria.length ||
      childReport.criteriaSatisfied.some(
        (criterion, index) =>
          !isRecord(criterion) ||
          criterion.criterion !== acceptanceCriteria[index] ||
          criterion.status !== "satisfied" ||
          typeof criterion.evidence !== "string" ||
          !criterion.evidence.trim(),
      )
    ) {
      return `${role} did not bind every criterion exactly to its approved acceptance criterion with evidence.`;
    }
    if (role === "worker") {
      const tests = childReport.testsAddedOrUpdated;
      const commands = childReport.commandsRun;
      const redGreenPair = Array.isArray(commands) && commands.some((red, redIndex) => {
        if (
          !isRecord(red) ||
          red.result !== "failed" ||
          typeof red.command !== "string" ||
          !expected.some((verification) => verification.command === red.command)
        ) {
          return false;
        }
        return commands.slice(redIndex + 1).some(
          (green) =>
            isRecord(green) &&
            green.result === "passed" &&
            green.command === red.command,
        );
      });
      if (
        !Array.isArray(tests) ||
        tests.length === 0 ||
        tests.some((test) => typeof test !== "string" || !test.trim()) ||
        !redGreenPair
      ) {
        return "worker acceptance report must prove the same approved test command failed RED before it passed GREEN, plus named tests added or updated.";
      }
    }
  }
  for (let index = 0; index < expected.length; index += 1) {
    const approved = expected[index]!;
    const run = acceptance.verifyRuns[index];
    if (
      !isRecord(run) ||
      run.id !== approved.id ||
      run.command !== approved.command ||
      run.status !== "passed" ||
      run.exitCode !== 0
    ) {
      return `${role} runtime verification ${approved.id} did not pass exactly as approved.`;
    }
  }
  if (role === "reviewer") {
    const childReport = acceptance.childReport;
    if (!isRecord(childReport) || !Array.isArray(childReport.reviewFindings)) {
      return "reviewer acceptance report did not provide a complete reviewFindings array.";
    }
    if (childReport.reviewFindings.length > 0) {
      return `reviewer reported ${childReport.reviewFindings.length} actionable finding(s).`;
    }
  }
  return undefined;
}

function readOnlyScoutInputError(
  input: Record<string, unknown>,
  approvedPlan: ApprovedPlan,
): string | undefined {
  if (
    input.agent !== "scout" ||
    input.context !== "fresh" ||
    input.async === true ||
    input.worktree === true ||
    input.cwd !== approvedPlan.cwd
  ) {
    return "Read-only execution requires one foreground fresh scout in the approved plan cwd.";
  }
  const acceptance = input.acceptance;
  if (!isRecord(acceptance) || acceptance.level !== "attested") {
    return "Read-only execution scout requires attested acceptance.";
  }
  const criteria = Array.isArray(acceptance.criteria)
    ? acceptance.criteria.map((criterion) => typeof criterion === "string" ? criterion.trim() : "")
    : [];
  if (
    criteria.length !== approvedPlan.acceptanceCriteria.length ||
    criteria.some((criterion, index) => criterion !== approvedPlan.acceptanceCriteria[index])
  ) {
    return "Read-only execution criteria must exactly match the approved Done when contract.";
  }
  return undefined;
}

function readOnlyScoutResultError(
  details: unknown,
  approvedPlan: ApprovedPlan,
): string | undefined {
  if (!isRecord(details) || !Array.isArray(details.results) || details.results.length !== 1) {
    return "Read-only execution scout did not return one final result.";
  }
  const result = details.results[0];
  if (!isRecord(result) || result.agent !== "scout" || result.exitCode !== 0) {
    return "Read-only execution scout did not complete successfully.";
  }
  const acceptance = result.acceptance;
  if (
    !isRecord(acceptance) ||
    !["attested", "checked", "verified", "reviewed", "accepted"].includes(
      String(acceptance.status),
    )
  ) {
    return "Read-only execution scout did not return an attested acceptance ledger.";
  }
  const childReport = acceptance.childReport;
  if (!isRecord(childReport) || !Array.isArray(childReport.criteriaSatisfied)) {
    return "Read-only execution scout omitted per-criterion evidence.";
  }
  if (
    childReport.criteriaSatisfied.length !== approvedPlan.acceptanceCriteria.length ||
    childReport.criteriaSatisfied.some(
      (criterion, index) =>
        !isRecord(criterion) ||
        criterion.criterion !== approvedPlan.acceptanceCriteria[index] ||
        criterion.status !== "satisfied" ||
        typeof criterion.evidence !== "string" ||
        !criterion.evidence.trim(),
    ) ||
    (
      typeof childReport.manualNotes !== "string" &&
      typeof childReport.notes !== "string"
    )
  ) {
    return "Read-only execution scout did not satisfy every criterion with a structured report.";
  }
  return undefined;
}

function completionGateError(workflow: ActiveWorkflow, cwd: string): string | undefined {
  if (workflow.pendingFollowUp) {
    return "A user follow-up is waiting for a newly approved plan iteration.";
  }
  if (workflow.awaitingRemoteConfirmation) {
    return "The workflow is waiting for the user's remote comment or reply decision.";
  }
  const planError = approvedPlanError(workflow, cwd);
  if (planError) return planError;
  const approvedPlan = workflow.approvedPlan!;
  if (workflow.remoteActionAuthorization) {
    const requiredIds = approvedPlan.remoteActions?.map((action) => action.id) ?? [];
    const completedIds = new Set(workflow.remoteActionCompletedIds ?? []);
    if (
      workflow.remoteActionPending?.length ||
      requiredIds.length === 0 ||
      requiredIds.some((id) => !completedIds.has(id))
    ) {
      return "Every exact authorized remote action must produce a successful correlated tool result.";
    }
  }
  if (approvedPlan.kind === "read-only") {
    try {
      if (captureRepositorySnapshot(approvedPlan.cwd) !== approvedPlan.repositorySha256) {
        return "The repository changed after read-only plan approval; return to planning and reapprove.";
      }
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    if (workflow.readOnlyExecutionStatus !== "completed") {
      return "The approved read-only plan has not completed its execution and report turn.";
    }
    return undefined;
  }

  const gates = workflow.executionGates;
  const repositories = approvedPlan.verification?.repositories ?? [];
  const gateCwds = new Set(gates?.map((gate) => gate.cwd) ?? []);
  if (
    !gates ||
    gates.length !== repositories.length ||
    gateCwds.size !== repositories.length ||
    repositories.some((repository) => !gateCwds.has(repository.cwd))
  ) {
    return "The approved code plan has not produced a verified worker and reviewer gate.";
  }
  for (const gate of gates) {
    if (gate.planSha256 !== approvedPlan.sha256) {
      return "Execution gates belong to an older plan revision.";
    }
    const targetError = codeTargetError(approvedPlan, gate.cwd);
    if (targetError) return targetError;
    if (gate.worker !== "verified") {
      return gate.workerReason || "The latest worker runtime acceptance ledger is not verified.";
    }
    if (gate.reviewer !== "verified") {
      return gate.reviewerReason ||
        "A fresh reviewer with all approved checks and no findings is still required.";
    }
    if (!gate.reviewerRepositorySha256) {
      return "The fresh reviewer repository snapshot is unavailable.";
    }
    try {
      if (captureRepositorySnapshot(gate.cwd) !== gate.reviewerRepositorySha256) {
        return "The canonical repository changed after the fresh reviewer passed; rerun worker and reviewer gates.";
      }
      const cleanError = cleanWorktreeError(gate.cwd);
      if (cleanError) return cleanError;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }
  return undefined;
}

export default function registerWorkflowCommands(
  pi: ExtensionAPI,
  runtime?: WorkflowRuntime,
): void {
  let activeWorkflow: ActiveWorkflow | null = null;
  let resumableWorkflow: ActiveWorkflow | null = null;
  let transitionInProgress = false;
  let restoredInterruptedCalls = false;

  const setActiveWorkflow = (workflow: ActiveWorkflow | null) => {
    activeWorkflow = workflow;
    persistWorkflow(pi, workflow);
  };
  const setResumableWorkflow = (workflow: ActiveWorkflow | null) => {
    resumableWorkflow = workflow;
    persistResumableWorkflow(pi, workflow);
  };

  const transitionToPlanning = async (): Promise<string | undefined> => {
    const current = await requestPlanMode(pi, "status");
    if (current.status !== "handled") return responseError(current);

    let phase = current.result.phase;
    if (phase === "executing") {
      const exited = await requestPlanMode(pi, "exit");
      if (exited.status !== "handled" || exited.result.phase !== "idle") {
        return responseError(exited) || "Plannotator did not exit execution mode.";
      }
      phase = exited.result.phase;
    }

    if (phase === "idle") {
      const entered = await requestPlanMode(pi, "enter");
      if (entered.status !== "handled" || entered.result.phase !== "planning") {
        return responseError(entered) || "Plannotator did not enter planning mode.";
      }
    }
    return undefined;
  };

  const transitionToIdle = async (): Promise<string | undefined> => {
    const current = await requestPlanMode(pi, "status");
    if (current.status !== "handled") return responseError(current);
    if (current.result.phase === "idle") return undefined;

    const exited = await requestPlanMode(pi, "exit");
    if (exited.status !== "handled" || exited.result.phase !== "idle") {
      return responseError(exited) || "Plannotator did not exit the active phase.";
    }
    return undefined;
  };

  const dispatchPendingIteration = async (
    context: ExtensionContext,
    sendImmediately: boolean,
  ): Promise<{ text: string; images?: ImageContent[] } | undefined> => {
    if (!activeWorkflow?.pendingFollowUp || transitionInProgress) return undefined;
    transitionInProgress = true;
    try {
      const transitionError = await transitionToPlanning();
      if (transitionError) {
        context.ui.notify(
          `Workflow iteration not started: ${transitionError}. The follow-up is preserved; run /workflow-retry.`,
          "error",
        );
        return undefined;
      }

      const queued = activeWorkflow;
      let text: string;
      try {
        text = loadWorkflowIterationMessage(queued, queued.pendingFollowUp, context.cwd);
      } catch (error) {
        context.ui.notify(
          `Workflow iteration not started: ${error instanceof Error ? error.message : String(error)}. The follow-up is preserved; run /workflow-retry.`,
          "error",
        );
        return undefined;
      }

      const images = queued.pendingImages;
      setActiveWorkflow({
        ...queued,
        pendingFollowUp: undefined,
        pendingImages: undefined,
        pendingExecutionContinuation: undefined,
        approvedPlan: undefined,
      });
      if (sendImmediately) {
        try {
          sendWorkflowMessage(pi, text, images);
        } catch (error) {
          setActiveWorkflow(queued);
          context.ui.notify(
            `Workflow iteration not sent: ${error instanceof Error ? error.message : String(error)}. Run /workflow-retry.`,
            "error",
          );
          return undefined;
        }
      }
      return { text, images };
    } finally {
      transitionInProgress = false;
    }
  };

  const dispatchApprovedExecution = async (context: ExtensionContext): Promise<void> => {
    if (!activeWorkflow?.pendingExecutionContinuation || activeWorkflow.pendingFollowUp) return;

    const transitionError = await transitionToIdle();
    if (transitionError) {
      context.ui.notify(
        `Approved plan is waiting for Plannotator to exit planning: ${transitionError}`,
        "error",
      );
      return;
    }

    const workflow = activeWorkflow;
    const repositoryCount = workflow.approvedPlan?.verification?.repositories.length ?? 0;
    let message: string;
    let awaitingRemoteConfirmation = workflow.awaitingRemoteConfirmation;
    let readOnlyExecutionStatus = workflow.readOnlyExecutionStatus;
    if (workflow.approvedPlan?.kind === "code") {
      message = workflow.name === "mr-comments"
        ? "Continue with the approved plan in the user's current checkout and current branch. Do not create or switch worktrees or branches. Launch one compliant verified worker there. Require TDD, every approved acceptance criterion, exact verification, and the approved Conventional Commit. Do not re-enter planning or revise the approved plan."
        : repositoryCount > 1
        ? `Continue with the approved plan. Create or reuse every approved canonical worktree, then launch one foreground parallel subagent call containing exactly ${repositoryCount} worker tasks, one per repository. Each worker must use TDD, satisfy every approved acceptance criterion, run its exact verification contract, and create its approved Conventional Commit. Do not re-enter planning or revise the approved plan.`
        : "Continue with the approved plan. Create or reuse the approved canonical worktree, then launch one compliant verified worker. Require TDD, every approved acceptance criterion, exact verification, and the approved Conventional Commit. Do not re-enter planning or revise the approved plan.";
    } else if (workflow.name === "mr-review") {
      awaitingRemoteConfirmation = undefined;
      readOnlyExecutionStatus = "pending";
      message =
        "Approved review plan is ready. Launch one foreground fresh scout in the approved plan cwd with attested acceptance and the exact Done when criteria. Remote-action confirmation remains unavailable until its structured criterion report passes.";
    } else if (workflow.name === "mr-comments") {
      awaitingRemoteConfirmation = undefined;
      readOnlyExecutionStatus = "pending";
      message =
        "Approved review-comment plan needs no code fix. Launch one foreground fresh scout in the approved plan cwd with attested acceptance and the exact Done when criteria. Remote-action confirmation remains unavailable until its structured criterion report passes.";
    } else {
      readOnlyExecutionStatus = "pending";
      message =
        "Execute the approved read-only plan with one foreground fresh scout in the approved plan cwd. Require attested acceptance, the exact Done when criteria, per-criterion evidence, and a structured report before completion.";
    }
    setActiveWorkflow({
      ...workflow,
      pendingExecutionContinuation: undefined,
      awaitingRemoteConfirmation,
      remoteActionAuthorization: awaitingRemoteConfirmation
        ? undefined
        : workflow.remoteActionAuthorization,
      remoteActionPending: undefined,
      remoteActionCompletedIds: undefined,
      readOnlyExecutionStatus,
      readOnlyToolCallId: undefined,
    });
    sendWorkflowMessage(
      pi,
      message,
    );
  };

  const restoreCurrentBranch = (context: ExtensionContext) => {
    const entries = context.sessionManager.getBranch();
    const reconciled = reconcileInterruptedToolCalls(restoreWorkflow(entries));
    activeWorkflow = reconciled.workflow;
    restoredInterruptedCalls = reconciled.interrupted;
    resumableWorkflow = restoreResumableWorkflow(entries);
    transitionInProgress = false;
  };

  pi.on("session_start", async (_event, context) => {
    restoreCurrentBranch(context);
    if (restoredInterruptedCalls && activeWorkflow) {
      setActiveWorkflow(activeWorkflow);
      context.ui.notify(
        "Interrupted workflow tool calls were released; rerun the required fresh gate or reconfirm the remote action.",
        "warning",
      );
      restoredInterruptedCalls = false;
    }
    if (activeWorkflow?.pendingFollowUp) {
      context.ui.notify("Workflow follow-up preserved; run /workflow-retry when ready.", "warning");
      return;
    }
    if (
      activeWorkflow?.approvedPlan &&
      !activeWorkflow.executionGates &&
      !activeWorkflow.awaitingRemoteConfirmation &&
      activeWorkflow.readOnlyExecutionStatus !== "completed" &&
      !activeWorkflow.pendingExecutionContinuation
    ) {
      setActiveWorkflow({ ...activeWorkflow, pendingExecutionContinuation: true });
    }
    await dispatchApprovedExecution(context);
  });

  pi.on("session_tree", async (_event, context) => {
    restoreCurrentBranch(context);
  });

  pi.on("input", async (event, context) => {
    if (!activeWorkflow) {
      return { action: "continue" };
    }
    if (event.source === "extension") {
      if (
        event.text.trim() === "Continue with the approved plan." &&
        (activeWorkflow.pendingFollowUp || approvedPlanError(activeWorkflow, context.cwd))
      ) {
        return { action: "handled" };
      }
      return { action: "continue" };
    }

    if (activeWorkflow.awaitingRemoteConfirmation) {
      const decisionKind = activeWorkflow.awaitingRemoteConfirmation;
      const authorized = explicitlyAuthorizesRemoteAction(event.text);
      setActiveWorkflow({
        ...activeWorkflow,
        awaitingRemoteConfirmation: undefined,
        remoteActionAuthorization: authorized ? decisionKind : undefined,
        remoteActionPending: undefined,
        remoteActionCompletedIds: authorized
          ? activeWorkflow.remoteActionCompletedIds ?? []
          : undefined,
      });
      return {
        action: "transform",
        text: `The user confirmed the approved remote action decision for ${decisionKind}:\n${event.text}\n\nRemote mutation is ${authorized ? "authorized" : "not authorized"}. ${authorized ? "Re-fetch current review state and perform only the already approved comments, replies, or non-force push." : "Perform no remote mutation."} If this changes scope, return to Plannotator planning.`,
        images: event.images,
      };
    }

    const followUp = event.text.trim() || (event.images?.length ? "[Image-only user follow-up]" : event.text);
    setActiveWorkflow(withQueuedFollowUp(activeWorkflow, followUp, event.images));
    if (event.streamingBehavior) {
      context.ui.notify("Workflow follow-up queued; replanning starts when the current agent settles.", "info");
      if (event.streamingBehavior === "steer") {
        return {
          action: "transform",
          text: "Stop the current approved-plan execution after the current tool call. Do not make further changes, commit, or perform remote actions. The user follow-up is preserved and will re-enter planning after this turn settles.",
        };
      }
      return { action: "handled" };
    }

    const iteration = await dispatchPendingIteration(context, false);
    if (!iteration) return { action: "handled" };
    return { action: "transform", text: iteration.text, images: iteration.images };
  });

  pi.on("agent_settled", async (_event, context) => {
    if (activeWorkflow?.pendingFollowUp) {
      await dispatchPendingIteration(context, true);
      return;
    }
    await dispatchApprovedExecution(context);
  });

  pi.on("tool_result", async (event, context) => {
    if (!activeWorkflow || activeWorkflow.pendingFollowUp || !isRecord(event.input)) return;

    const pendingRemoteAction = activeWorkflow.remoteActionPending?.find(
      (item) => item.toolCallId === event.toolCallId,
    );
    if (pendingRemoteAction) {
      const details = isRecord(event.details) ? event.details : {};
      const eventRecord = event as unknown as Record<string, unknown>;
      const failed =
        eventRecord.isError === true ||
        details.success === false ||
        details.status === "error" ||
        typeof details.error === "string";
      setActiveWorkflow({
        ...activeWorkflow,
        remoteActionPending: activeWorkflow.remoteActionPending?.filter(
          (item) => item.toolCallId !== event.toolCallId,
        ),
        remoteActionCompletedIds: failed
          ? activeWorkflow.remoteActionCompletedIds
          : [...(activeWorkflow.remoteActionCompletedIds ?? []), pendingRemoteAction.id],
      });
      if (failed) {
        context.ui.notify(
          "Authorized remote action failed; retry the approved action before completion.",
          "error",
        );
      }
    }

    if (event.toolName === "plannotator_submit_plan") {
      const submission = activeWorkflow.planSubmission;
      if (
        !submission ||
        submission.toolCallId !== event.toolCallId ||
        event.input.filePath !== submission.requestedPath
      ) {
        if (isRecord(event.details) && event.details.approved === true) {
          context.ui.notify("Approved plan result did not match the submitted plan call.", "error");
        }
        return;
      }
      if (!isRecord(event.details) || event.details.approved !== true) {
        setActiveWorkflow({ ...activeWorkflow, planSubmission: undefined });
        return;
      }
      if (hasApprovalFeedback(event.details.feedback)) {
        setActiveWorkflow({
          ...activeWorkflow,
          approvedPlan: undefined,
          executionGates: undefined,
          planSubmission: undefined,
        });
        context.ui.notify(
          "Plan approval included feedback; revise the plan, rerun the iteration scout if evidence changes, and submit again.",
          "error",
        );
        return;
      }
      try {
        const current = captureApprovedPlan(
          activeWorkflow,
          context.cwd,
          submission.plan.path,
          runtime,
        );
        if (!sameApprovedPlan(submission.plan, current)) {
          throw new Error("plan or repository changed while approval was pending; submit the current revision again");
        }
        setActiveWorkflow({
          ...activeWorkflow,
          canonicalCwds: current.verification?.repositories.map((repository) => repository.cwd) ??
            activeWorkflow.canonicalCwds,
          approvedPlan: submission.plan,
          executionGates: undefined,
          planSubmission: undefined,
          pendingExecutionContinuation: true,
          awaitingRemoteConfirmation: undefined,
          remoteActionAuthorization: undefined,
          remoteActionPending: undefined,
          remoteActionCompletedIds: undefined,
          readOnlyExecutionStatus: undefined,
          readOnlyToolCallId: undefined,
        });
        const transitionError = await transitionToIdle();
        if (transitionError) {
          context.ui.notify(
            `Plan approved, but Plannotator could not exit planning: ${transitionError}. The approved continuation is preserved and will retry when the agent settles.`,
            "error",
          );
          return;
        }
        context.ui.notify(
          "Plan approved. Plannotator exited planning; approved continuation starts when the agent settles.",
          "info",
        );
      } catch (error) {
        setActiveWorkflow({
          ...activeWorkflow,
          approvedPlan: undefined,
          executionGates: undefined,
          planSubmission: undefined,
        });
        context.ui.notify(
          `Approved plan could not be bound to this workflow: ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
      }
      return;
    }

    if (event.toolName !== "subagent") return;
    if (event.input.agent === "scout") {
      if (
        activeWorkflow.approvedPlan?.kind === "read-only" &&
        activeWorkflow.readOnlyToolCallId === event.toolCallId
      ) {
        const error = readOnlyScoutResultError(event.details, activeWorkflow.approvedPlan);
        const hasRemoteActions = (activeWorkflow.approvedPlan.remoteActions?.length ?? 0) > 0;
        const confirmationKind = !error && hasRemoteActions
          ? activeWorkflow.name === "mr-review"
            ? "review-comments"
            : activeWorkflow.name === "mr-comments"
              ? "review-replies"
              : undefined
          : undefined;
        setActiveWorkflow({
          ...activeWorkflow,
          readOnlyExecutionStatus: error ? "failed" : "completed",
          readOnlyToolCallId: undefined,
          awaitingRemoteConfirmation: confirmationKind,
          remoteActionAuthorization: undefined,
          remoteActionPending: undefined,
          remoteActionCompletedIds: undefined,
        });
        if (error) {
          context.ui.notify(error, "error");
        } else if (confirmationKind) {
          sendWorkflowMessage(
            pi,
            confirmationKind === "review-comments"
              ? "The approved read-only review passed every criterion. Ask the user whether to execute every exact Remote action contract entry. Do not post, approve, merge, or resolve anything until the user answers."
              : "The approved read-only review-comment report passed every criterion. Ask the user whether to push and reply by executing every exact Remote action contract entry. Do not push, reply, or resolve anything until the user answers.",
          );
        }
        return;
      }
      const scoutGate = activeWorkflow.planningScoutGate;
      if (
        !scoutGate ||
        scoutGate.iteration !== activeWorkflow.iteration ||
        scoutGate.status !== "pending" ||
        scoutGate.toolCallId !== event.toolCallId
      ) {
        return;
      }
      const error = planningScoutResultError(event.details);
      setActiveWorkflow({
        ...activeWorkflow,
        planningScoutGate: {
          iteration: activeWorkflow.iteration,
          status: error ? "failed" : "verified",
          reason: error,
        },
      });
      return;
    }
    const workerTasks = requestedRoleTasks(event.input, "worker");
    const reviewerTasks = requestedRoleTasks(event.input, "reviewer");
    const role: VerificationRole | undefined = workerTasks
      ? "worker"
      : reviewerTasks
        ? "reviewer"
        : undefined;
    const tasks = role === "worker" ? workerTasks : reviewerTasks;
    if (!role || !tasks) return;
    const gates = activeWorkflow.executionGates;
    const approvedPlan = activeWorkflow.approvedPlan;
    if (
      !gates ||
      !approvedPlan?.verification ||
      !isRecord(event.details) ||
      !Array.isArray(event.details.results) ||
      event.details.results.length !== tasks.length
    ) {
      return;
    }

    const nextGates = gates.map((gate) => ({ ...gate }));
    for (const [index, task] of tasks.entries()) {
      const cwd = typeof task.cwd === "string" ? resolve(task.cwd) : "";
      const gate = nextGates.find((candidate) => candidate.cwd === cwd);
      const repository = repositoryContract(approvedPlan, cwd);
      if (
        !gate ||
        !repository ||
        gate.planSha256 !== approvedPlan.sha256 ||
        (role === "worker" &&
          (gate.worker !== "pending" || gate.workerToolCallId !== event.toolCallId)) ||
        (role === "reviewer" &&
          (gate.reviewer !== "pending" || gate.reviewerToolCallId !== event.toolCallId))
      ) {
        return;
      }

      let error = acceptanceLedgerError(
        { results: [event.details.results[index]] },
        role,
        repository[role],
        repository.acceptanceCriteria,
      );
      if (role === "worker") {
        let repositorySha256: string | undefined;
        if (!error) {
          try {
            if (gate.commitTitle) {
              const head = optionalGitOutput(gate.cwd, ["rev-parse", "--verify", "HEAD"], "UNBORN")
                .toString("utf8")
                .trim();
              const subject = optionalGitOutput(gate.cwd, ["log", "-1", "--format=%s"], "")
                .toString("utf8")
                .trim();
              if (!head || head === gate.baseHead) {
                error = "Worker did not create the approved Conventional Commit.";
              } else if (subject !== gate.commitTitle) {
                error = `Worker commit title does not match approved title: ${gate.commitTitle}`;
              }
            }
            if (!error) error = cleanWorktreeError(gate.cwd);
            if (!error) repositorySha256 = captureRepositorySnapshot(gate.cwd);
          } catch (snapshotError) {
            error = snapshotError instanceof Error ? snapshotError.message : String(snapshotError);
          }
        }
        Object.assign(gate, {
          worker: error ? "failed" : "verified",
          reviewer: "required",
          workerRepositorySha256: repositorySha256,
          reviewerRepositorySha256: undefined,
          reviewerToolCallId: undefined,
          workerReason: error,
          reviewerReason: undefined,
        });
        continue;
      }

      let repositorySha256: string | undefined;
      let repositoryChanged = false;
      if (!error) {
        try {
          error = cleanWorktreeError(gate.cwd);
          if (error) throw new Error(error);
          repositorySha256 = captureRepositorySnapshot(gate.cwd);
          if (repositorySha256 !== gate.workerRepositorySha256) {
            repositoryChanged = true;
            error = "Canonical repository changed after the worker gate; run a new worker before review.";
          }
        } catch (snapshotError) {
          error = snapshotError instanceof Error ? snapshotError.message : String(snapshotError);
        }
      }
      Object.assign(gate, {
        worker: repositoryChanged ? "failed" : gate.worker,
        reviewer: error ? "failed" : "verified",
        reviewerRepositorySha256: error ? undefined : repositorySha256,
        workerReason: repositoryChanged
          ? "Canonical repository changed after the worker gate."
          : gate.workerReason,
        reviewerReason: error,
      });
    }

    const shouldAskForReply = role === "reviewer" &&
      activeWorkflow.name === "mr-comments" &&
      (approvedPlan.remoteActions?.length ?? 0) > 0 &&
      nextGates.every((gate) => gate.worker === "verified" && gate.reviewer === "verified");
    setActiveWorkflow({
      ...activeWorkflow,
      executionGates: nextGates,
      awaitingRemoteConfirmation: shouldAskForReply ? "review-replies" : undefined,
      remoteActionAuthorization: shouldAskForReply
        ? undefined
        : activeWorkflow.remoteActionAuthorization,
      remoteActionPending: shouldAskForReply
        ? undefined
        : activeWorkflow.remoteActionPending,
      remoteActionCompletedIds: shouldAskForReply
        ? undefined
        : activeWorkflow.remoteActionCompletedIds,
    });
    if (shouldAskForReply) {
      sendWorkflowMessage(
        pi,
        "All approved review-comment fixes and verification gates passed. Ask the user whether to push the committed fix and reply to the existing review threads. Do not push, reply, or resolve threads until the user answers.",
      );
    }
  });

  pi.on("tool_call", async (event, context) => {
    const input = isRecord(event.input) ? event.input : {};
    if (event.toolName === "subagent_supervisor" || event.toolName === "intercom") return;
    if (activeWorkflow && event.toolName === "subagent_wait") {
      return {
        block: true,
        reason:
          "Workflow execution must not block on subagent_wait. Return control so a supervisor decision can be shown to the user; inspect the run with subagent status, then reply through subagent_supervisor before resuming or retrying the worker.",
      };
    }
    const reviewerRequested = event.toolName === "subagent" && containsAgent(input, "reviewer");
    const workerRequested = event.toolName === "subagent" && containsAgent(input, "worker");
    const scoutRequested = event.toolName === "subagent" && containsAgent(input, "scout");

    if (!activeWorkflow) {
      if (reviewerRequested) {
        return {
          block: true,
          reason: "Reviewer requires an active approved workflow with an exact verification contract.",
        };
      }
      return;
    }
    if (activeWorkflow.pendingFollowUp) {
      return {
        block: true,
        reason: "A user follow-up is pending; no tool may start until the workflow re-enters planning.",
      };
    }
    const remoteMutation = activeWorkflow.approvedPlan
      ? reviewRemoteMutationKind(event.toolName, input, activeWorkflow, context.cwd)
      : undefined;
    let remoteAction: ApprovedRemoteAction | undefined;
    if (remoteMutation) {
      if (
        activeWorkflow.approvedPlan?.kind === "read-only" &&
        activeWorkflow.readOnlyExecutionStatus !== "completed"
      ) {
        return {
          block: true,
          reason:
            "Remote mutation remains blocked until the approved read-only scout completes every criterion.",
        };
      }
      const authorizationError = remoteMutationAuthorizationError(activeWorkflow, remoteMutation);
      if (authorizationError) return { block: true, reason: authorizationError };
      remoteAction = matchingApprovedRemoteAction(activeWorkflow, event.toolName, input);
      if (!remoteAction) {
        return {
          block: true,
          reason: "Remote mutation must exactly match one unfinished approved remote action.",
        };
      }
    }

    const phaseResponse = await requestPlanMode(pi, "status");
    if (phaseResponse.status !== "handled") {
      return { block: true, reason: `Workflow phase unavailable: ${responseError(phaseResponse)}` };
    }

    if (phaseResponse.result.phase === "planning") {
      if (event.toolName === "subagent") {
        if (scoutRequested) {
          const error = planningScoutError(input, context.cwd);
          if (error) return { block: true, reason: error };
          if (activeWorkflow.planningScoutGate?.status === "pending") {
            return { block: true, reason: "The current iteration scout is already running." };
          }
          setActiveWorkflow({
            ...activeWorkflow,
            planningScoutGate: {
              iteration: activeWorkflow.iteration,
              status: "pending",
              toolCallId: event.toolCallId,
            },
          });
          return;
        }
        if (input.agent === "researcher") {
          const error = planningResearcherError(input, context.cwd);
          return error ? { block: true, reason: error } : undefined;
        }
        return {
          block: true,
          reason: "Planning permits only one foreground fresh scout or researcher subagent.",
        };
      }
      if (event.toolName === "plannotator_submit_plan") {
        const gate = activeWorkflow.planningScoutGate;
        if (gate?.iteration !== activeWorkflow.iteration || gate.status !== "verified") {
          return {
            block: true,
            reason:
              gate?.reason ||
              "This plan iteration requires one new foreground fresh scout result before submission.",
          };
        }
        if (activeWorkflow.planSubmission) {
          return { block: true, reason: "A plan submission is already awaiting its correlated result." };
        }
        if (typeof input.filePath !== "string") {
          return { block: true, reason: "Plan submission requires one filePath." };
        }
        try {
          const plan = captureApprovedPlan(activeWorkflow, context.cwd, input.filePath, runtime);
          setActiveWorkflow({
            ...activeWorkflow,
            planSubmission: {
              toolCallId: event.toolCallId,
              requestedPath: input.filePath,
              plan,
            },
          });
        } catch (error) {
          return {
            block: true,
            reason: `Plan cannot be submitted: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
        return;
      }
      const mutationError = planningMutationError(event.toolName, input, context.cwd, activeWorkflow);
      return mutationError ? { block: true, reason: mutationError } : undefined;
    }

    if (phaseResponse.result.phase !== "idle" && phaseResponse.result.phase !== "executing") {
      if (workerRequested || reviewerRequested) {
        return {
          block: true,
          reason: "worker and reviewer may run only after approval exits Plannotator planning.",
        };
      }
      return;
    }

    const planError = approvedPlanError(activeWorkflow, context.cwd);
    if (planError) return { block: true, reason: planError };
    const approvedPlan = activeWorkflow.approvedPlan!;
    const mutationError = approvedExecutionMutationError(
      event.toolName,
      input,
      activeWorkflow,
      context.cwd,
      remoteMutation,
    );
    if (mutationError) return { block: true, reason: mutationError };
    if (remoteAction) {
      setActiveWorkflow({
        ...activeWorkflow,
        remoteActionPending: [
          ...(activeWorkflow.remoteActionPending ?? []),
          { id: remoteAction.id, toolCallId: event.toolCallId },
        ],
      });
    }

    if (approvedPlan.kind === "read-only" && event.toolName === "subagent") {
      if (workerRequested || reviewerRequested) {
        return {
          block: true,
          reason: "Approved plan requires an exact ## Verification contract before worker or reviewer may run.",
        };
      }
      if (!scoutRequested) {
        return {
          block: true,
          reason: "Approved read-only execution permits only its contract-bound scout.",
        };
      }
      if (activeWorkflow.readOnlyToolCallId) {
        return { block: true, reason: "The approved read-only execution scout is already running." };
      }
      const error = readOnlyScoutInputError(input, approvedPlan);
      if (error) return { block: true, reason: error };
      setActiveWorkflow({
        ...activeWorkflow,
        readOnlyExecutionStatus: "pending",
        readOnlyToolCallId: event.toolCallId,
      });
      return;
    }

    if (workerRequested) {
      if (!approvedPlan.verification) {
        return {
          block: true,
          reason: "Approved plan requires an exact ## Verification contract before worker may run.",
        };
      }
      const tasks = requestedRoleTasks(input, "worker");
      const repositories = approvedPlan.verification.repositories;
      const existingGates = activeWorkflow.executionGates;
      const initialRun = !existingGates?.length;
      if (
        !tasks ||
        tasks.length === 0 ||
        (initialRun && tasks.length !== repositories.length)
      ) {
        return {
          block: true,
          reason:
            "Initial worker execution must include exactly one task per approved repository; remediation may include only affected repositories.",
        };
      }
      if (
        activeWorkflow.executionGates?.some(
          (gate) => gate.worker === "pending" || gate.reviewer === "pending",
        )
      ) {
        return { block: true, reason: "Another worker or reviewer gate is already running." };
      }
      const cwds = new Set<string>();
      for (const task of tasks) {
        const error = verifiedAcceptanceError(task, "worker");
        if (error) return { block: true, reason: error };
        const contractError = verificationContractError(task, "worker", approvedPlan);
        if (contractError) return { block: true, reason: contractError };
        cwds.add(resolve(task.cwd as string));
      }
      if (
        cwds.size !== tasks.length ||
        [...cwds].some((cwd) => !repositories.some((repository) => repository.cwd === cwd)) ||
        (initialRun && repositories.some((repository) => !cwds.has(repository.cwd)))
      ) {
        return {
          block: true,
          reason: "Worker tasks must cover each selected approved repository exactly once.",
        };
      }
      const priorGates = initialRun
        ? repositories.map((repository) => ({
          cwd: repository.cwd,
          planSha256: approvedPlan.sha256,
          commitTitle: repository.commitTitle,
          worker: "failed" as GateStatus,
          reviewer: "required" as const,
        }))
        : existingGates!;
      setActiveWorkflow({
        ...activeWorkflow,
        executionGates: priorGates.map((gate) =>
          !cwds.has(gate.cwd)
            ? gate
            : {
              ...gate,
              baseHead: optionalGitOutput(
                gate.cwd,
                ["rev-parse", "--verify", "HEAD"],
                "UNBORN",
              ).toString("utf8").trim(),
              worker: "pending",
              reviewer: "required",
              workerToolCallId: event.toolCallId,
              reviewerToolCallId: undefined,
              workerRepositorySha256: undefined,
              reviewerRepositorySha256: undefined,
              workerReason: undefined,
              reviewerReason: undefined,
            }),
      });
      return;
    }

    if (reviewerRequested) {
      if (!approvedPlan.verification) {
        return {
          block: true,
          reason: "Approved plan requires an exact ## Verification contract before reviewer may run.",
        };
      }
      const tasks = requestedRoleTasks(input, "reviewer");
      const repositories = approvedPlan.verification.repositories;
      const gates = activeWorkflow.executionGates;
      const requiredReviewerCwds = gates
        ?.filter((gate) => gate.worker === "verified" && gate.reviewer !== "verified")
        .map((gate) => gate.cwd) ?? [];
      if (
        !tasks ||
        tasks.length === 0 ||
        tasks.length !== requiredReviewerCwds.length ||
        !gates ||
        gates.length !== repositories.length ||
        gates.some((gate) => gate.planSha256 !== approvedPlan.sha256 || gate.worker !== "verified")
      ) {
        return {
          block: true,
          reason:
            "Reviewer execution requires every current approved repository's verified worker ledger first.",
        };
      }
      if (gates.some((gate) => gate.reviewer === "pending")) {
        return { block: true, reason: "The current reviewer gate is already running." };
      }
      const cwds = new Set<string>();
      for (const task of tasks) {
        const error = verifiedAcceptanceError(task, "reviewer");
        if (error) return { block: true, reason: error };
        const contractError = verificationContractError(task, "reviewer", approvedPlan);
        if (contractError) return { block: true, reason: contractError };
        cwds.add(resolve(task.cwd as string));
      }
      if (
        cwds.size !== tasks.length ||
        requiredReviewerCwds.some((cwd) => !cwds.has(cwd))
      ) {
        return {
          block: true,
          reason: "Reviewer tasks must cover exactly the repositories requiring fresh review.",
        };
      }
      for (const gate of gates.filter((candidate) => cwds.has(candidate.cwd))) {
        try {
          if (
            !gate.workerRepositorySha256 ||
            captureRepositorySnapshot(gate.cwd) !== gate.workerRepositorySha256
          ) {
            setActiveWorkflow({
              ...activeWorkflow,
              executionGates: gates.map((candidate) =>
                candidate.cwd === gate.cwd
                  ? {
                    ...candidate,
                    worker: "failed",
                    reviewer: "required",
                    workerReason: "Canonical repository changed after the worker gate.",
                  }
                  : candidate),
            });
            return {
              block: true,
              reason: "Canonical repository changed after the worker gate; run a new worker first.",
            };
          }
        } catch (snapshotError) {
          return {
            block: true,
            reason: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
          };
        }
      }
      setActiveWorkflow({
        ...activeWorkflow,
        executionGates: gates.map((gate) =>
          !cwds.has(gate.cwd)
            ? gate
            : {
              ...gate,
              reviewer: "pending",
              reviewerToolCallId: event.toolCallId,
              reviewerRepositorySha256: undefined,
              reviewerReason: undefined,
            }),
      });
      return;
    }

    if (event.toolName === "subagent") {
      return {
        block: true,
        reason: "Approved code execution permits only the contract-bound worker and reviewer roles.",
      };
    }
  });

  for (const [name, spec] of Object.entries(workflows) as Array<[WorkflowName, WorkflowSpec]>) {
    pi.registerCommand(name, {
      description: spec.description,
      handler: async (rawInput, context) => {
        const input = rawInput.trim();
        if (!input || (spec.validate && !spec.validate(input, context.cwd))) {
          context.ui.notify(`Usage: /${name} <${spec.inputLabel}>`, "warning");
          return;
        }
        if (activeWorkflow) {
          context.ui.notify(
            "Finish the active workflow with /workflow-done, or abandon it with /workflow-abort, before starting another.",
            "warning",
          );
          return;
        }
        if (!context.isIdle()) {
          context.ui.notify("Agent busy; workflow not started.", "warning");
          return;
        }

        setResumableWorkflow(null);
        const workflow: ActiveWorkflow = { name, input, iteration: 1 };
        let message: string;
        try {
          message = loadWorkflowMessage(workflow, context.cwd);
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
          context.ui.notify(
            `Workflow not started: ${responseError(entered) || "Plannotator did not enter planning mode."}`,
            "error",
          );
          return;
        }

        setActiveWorkflow(workflow);
        try {
          pi.sendUserMessage(message);
        } catch (error) {
          setActiveWorkflow(null);
          context.ui.notify(
            `Workflow not sent: ${error instanceof Error ? error.message : String(error)}`,
            "error",
          );
        }
      },
    });
  }

  pi.registerCommand("workflow-status", {
    description: "Show the active workflow loop without starting a new iteration",
    handler: async (_rawInput, context) => {
      if (!activeWorkflow) {
        context.ui.notify("No active workflow loop.", "info");
        return;
      }
      const phaseResponse = await requestPlanMode(pi, "status");
      const phase = phaseResponse.status === "handled"
        ? `; Plannotator=${phaseResponse.result.phase}`
        : `; Plannotator=${responseError(phaseResponse)}`;
      const pending = activeWorkflow.pendingFollowUp ? "; follow-up pending" : "";
      const approved = activeWorkflow.approvedPlan
        ? `; approved ${activeWorkflow.approvedPlan.path} @${activeWorkflow.approvedPlan.sha256.slice(0, 8)}`
        : "";
      const repositories = activeWorkflow.approvedPlan?.verification?.repositories;
      const firstRepository = repositories?.[0];
      const contract = firstRepository
        ? `; repositories=${repositories!.length}; contract worker[${firstRepository.worker.map((item) => item.id).join(",")}], reviewer[${firstRepository.reviewer.map((item) => item.id).join(",")}]`
        : "";
      const executionGates = activeWorkflow.executionGates;
      const gates = executionGates?.length
        ? `; gates worker=${executionGates.every((gate) => gate.worker === "verified") ? "verified" : executionGates.some((gate) => gate.worker === "pending") ? "pending" : "failed"}, reviewer=${executionGates.every((gate) => gate.reviewer === "verified") ? "verified" : executionGates.some((gate) => gate.reviewer === "pending") ? "pending" : "required"}`
        : "";
      const scout = activeWorkflow.planningScoutGate
        ? `; iteration-scout=${activeWorkflow.planningScoutGate.status}`
        : "";
      context.ui.notify(
        `Workflow ${activeWorkflow.name}; iteration ${activeWorkflow.iteration}${phase}${pending}${approved}${contract}${gates}${scout}.`,
        "info",
      );
    },
  });

  pi.registerCommand("workflow-continue", {
    description: "Resume an aborted workflow through a new planning iteration",
    handler: async (_rawInput, context) => {
      if (activeWorkflow) {
        context.ui.notify("An active workflow already exists; use its current planning or execution path.", "warning");
        return;
      }
      if (!resumableWorkflow) {
        context.ui.notify("No aborted workflow is available to continue.", "warning");
        return;
      }
      if (!context.isIdle()) {
        context.ui.notify("Agent busy; aborted workflow continuation is deferred.", "warning");
        return;
      }

      const workflow = withQueuedFollowUp(
        resumableWorkflow,
        "Continue from this workflow after /workflow-abort.",
      );
      setResumableWorkflow(null);
      setActiveWorkflow(workflow);
      await dispatchPendingIteration(context, true);
    },
  });

  pi.registerCommand("workflow-retry", {
    description: "Retry a preserved workflow follow-up",
    handler: async (_rawInput, context) => {
      if (!activeWorkflow?.pendingFollowUp) {
        context.ui.notify("No preserved workflow follow-up.", "warning");
        return;
      }
      if (!context.isIdle()) {
        context.ui.notify("Agent busy; workflow retry deferred until it settles.", "warning");
        return;
      }
      await dispatchPendingIteration(context, true);
    },
  });

  pi.registerCommand("workflow-done", {
    description: "Finish a successfully verified workflow loop",
    handler: async (_rawInput, context) => {
      if (!activeWorkflow) {
        context.ui.notify("No active workflow loop.", "warning");
        return;
      }
      if (!context.isIdle()) {
        context.ui.notify("Agent busy; workflow loop not finished.", "warning");
        return;
      }

      const gateError = completionGateError(activeWorkflow, context.cwd);
      if (gateError) {
        context.ui.notify(
          `Workflow loop not finished: ${gateError} Fix and re-run the gates, or use /workflow-abort to abandon without a completion claim.`,
          "error",
        );
        return;
      }

      const transitionError = await transitionToIdle();
      if (transitionError) {
        context.ui.notify(`Workflow loop not finished: ${transitionError}`, "error");
        return;
      }

      setActiveWorkflow(null);
      setResumableWorkflow(null);
      context.ui.notify("Workflow loop finished.", "info");
    },
  });

  pi.registerCommand("workflow-abort", {
    description: "Abandon the active workflow without claiming completion",
    handler: async (_rawInput, context) => {
      if (!activeWorkflow) {
        context.ui.notify("No active workflow loop.", "warning");
        return;
      }
      if (!context.isIdle()) {
        context.ui.notify("Agent busy; workflow loop not aborted.", "warning");
        return;
      }

      const transitionError = await transitionToIdle();
      if (transitionError) {
        context.ui.notify(`Workflow loop not aborted: ${transitionError}`, "error");
        return;
      }
      const workflow = activeWorkflow;
      setActiveWorkflow(null);
      setResumableWorkflow(workflow);
      context.ui.notify("Workflow loop aborted without a completion claim. Run /workflow-continue to re-enter planning.", "warning");
    },
  });
}
