import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readlinkSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";

const PLANNOTATOR_REQUEST_CHANNEL = "plannotator:request";
const PLANNOTATOR_TIMEOUT_MS = 5_000;
const WORKFLOW_STATE_ENTRY = "workflow-loop-state";
const WORKFLOW_STATE_VERSION = 1;
const REQUIRED_REVIEWER_COMMAND_IDS = ["full-tests", "format", "lint"] as const;
const GIT_OUTPUT_LIMIT_BYTES = 64 * 1024 * 1024;

type PlannotatorPhase = "idle" | "planning" | "executing";
type PlannotatorMode = "enter" | "exit" | "status";
type PlannotatorResponse =
  | { status: "handled"; result: { phase: PlannotatorPhase } }
  | { status: "unavailable"; error?: string }
  | { status: "error"; error: string };

type WorkflowName = "work" | "ticket" | "mr-review" | "mr-comments";

type WorkflowRuntime = {
  sessionKey?: string;
  worktreeBaseDir?: string;
};

type WorkflowSpec = {
  description: string;
  inputLabel: string;
  marker: string;
  template: string;
  validate?: (input: string) => boolean;
};

type VerificationCommand = {
  id: string;
  command: string;
  timeoutMs: number;
};

type VerificationContract = {
  cwd: string;
  worker: VerificationCommand[];
  reviewer: VerificationCommand[];
};
type VerificationRole = "worker" | "reviewer";

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
  verification?: VerificationContract;
};

type GateStatus = "pending" | "verified" | "failed";

type ExecutionGate = {
  cwd: string;
  planSha256: string;
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
  pendingFollowUp?: string;
  pendingImages?: ImageContent[];
  approvedPlan?: ApprovedPlan;
  executionGate?: ExecutionGate;
  planningScoutGate?: PlanningScoutGate;
  planSubmission?: PlanSubmission;
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
    inputLabel: "Jira issue ID or URL",
    marker: "jira-ticket",
    template: "jira-ticket.md",
  },
  "mr-review": {
    description: "Review a GitLab merge request, approve comments, then post",
    inputLabel: "GitLab merge request URL",
    marker: "gitlab-mr-review",
    template: "gitlab-mr-review.md",
    validate: isGitLabMergeRequestUrl,
  },
  "mr-comments": {
    description: "Triage unresolved GitLab review comments, then fix or reply",
    inputLabel: "GitLab merge request URL",
    marker: "gitlab-mr-comments",
    template: "gitlab-mr-comments.md",
    validate: isGitLabMergeRequestUrl,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isWorkflowName(value: unknown): value is WorkflowName {
  return typeof value === "string" && Object.hasOwn(workflows, value);
}

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

function loadWorkflowMessage(workflow: ActiveWorkflow): string {
  const spec = workflows[workflow.name];
  const templateUrl = new URL(`../workflows/${spec.template}`, import.meta.url);
  const template = readFileSync(templateUrl, "utf8").trim();
  return `${template}\n\nWorkflow input:\n${workflow.input}`;
}

function loadWorkflowIterationMessage(workflow: ActiveWorkflow, followUp: string): string {
  return `${loadWorkflowMessage(workflow)}

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
    if (root !== canonicalPath(cwd)) {
      throw new Error("workflow cwd must be the Git repository root for repository-wide verification");
    }

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

function normalizeVerificationContract(value: unknown): VerificationContract {
  if (!isRecord(value)) throw new Error("Verification contract JSON must be an object.");
  const unknownKeys = Object.keys(value).filter(
    (key) => key !== "cwd" && key !== "worker" && key !== "reviewer",
  );
  if (unknownKeys.length) {
    throw new Error(`Verification contract has unsupported fields: ${unknownKeys.join(", ")}.`);
  }

  const cwd = typeof value.cwd === "string" ? value.cwd.trim() : "";
  if (!cwd || !isAbsolute(cwd) || /[\r\n]/.test(cwd)) {
    throw new Error("Verification contract cwd must be one absolute repository-root path.");
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
  return { cwd: resolve(cwd), worker, reviewer };
}

function parseVerificationContract(content: string): VerificationContract | undefined {
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
  return normalizeVerificationContract(parsed);
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

function expectedCanonicalCwd(workflow: ActiveWorkflow, runtime?: WorkflowRuntime): string {
  const sessionKey = runtime ? runtime.sessionKey : process.env.PI_SUBAGENT_PARENT_SESSION;
  if (sessionKey === undefined) {
    throw new Error("stable PI_SUBAGENT_PARENT_SESSION key is unavailable");
  }
  if (!/^[A-Za-z0-9._-]+$/.test(sessionKey)) {
    throw new Error("stable Pi subagent session key is invalid");
  }

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

  let identity = sessionKey;
  if (workflow.name === "ticket") {
    const ticketId = workflow.input.match(/\b[A-Za-z][A-Za-z0-9]+-\d+\b/)?.[0];
    if (!ticketId) throw new Error("Jira workflow input has no stable ticket ID");
    identity = `${ticketId}-${sessionKey}`;
  }
  return resolve(worktreeBaseDir, `pi-session-${identity}`);
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
  const verification = parseVerificationContract(content);
  if (workflow.name === "mr-review" && verification) {
    throw new Error("gitlab-mr-review is read-only and cannot approve a code verification contract");
  }
  if (verification) {
    const expectedCwd = expectedCanonicalCwd(workflow, runtime);
    if (verification.cwd !== expectedCwd) {
      throw new Error("Verification contract cwd does not match the stable session worktree identity");
    }
  }
  return {
    cwd,
    path: relativePath,
    sha256: hashPlan(content),
    kind: verification ? "code" : "read-only",
    repositorySha256: captureRepositorySnapshot(cwd),
    verification,
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
      verification = normalizeVerificationContract(value.verification);
    } catch {
      return undefined;
    }
  }
  if ((value.kind === "code") !== Boolean(verification)) return undefined;
  return {
    cwd: value.cwd,
    path: value.path,
    sha256: value.sha256,
    kind: value.kind,
    repositorySha256: value.repositorySha256,
    verification,
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
    pendingFollowUp: typeof value.pendingFollowUp === "string" ? value.pendingFollowUp : undefined,
    pendingImages: pendingImages?.length ? pendingImages : undefined,
    approvedPlan: parseApprovedPlan(value.approvedPlan),
    executionGate: parseExecutionGate(value.executionGate),
    planningScoutGate: parsePlanningScoutGate(value.planningScoutGate),
    planSubmission: parsePlanSubmission(value.planSubmission),
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

function persistWorkflow(pi: ExtensionAPI, workflow: ActiveWorkflow | null): void {
  pi.appendEntry(WORKFLOW_STATE_ENTRY, {
    version: WORKFLOW_STATE_VERSION,
    active: workflow,
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
    approvedPlan: undefined,
    executionGate: undefined,
    planningScoutGate: undefined,
    planSubmission: undefined,
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
    left.kind === right.kind &&
    left.repositorySha256 === right.repositorySha256
  );
}

function codeTargetError(approvedPlan: ApprovedPlan, requestedCwd: unknown): string | undefined {
  const target = approvedPlan.verification?.cwd;
  if (!target) return "Approved code plan has no bound repository cwd.";
  if (typeof requestedCwd !== "string" || resolve(requestedCwd) !== target) {
    return "Subagent cwd does not match the exact repository cwd in the approved Verification contract.";
  }

  try {
    if (repositoryRoot(target) !== canonicalPath(target)) {
      return "Approved Verification contract cwd is not a Git repository root.";
    }
    if (repositoryCommonDirectory(target) !== repositoryCommonDirectory(approvedPlan.cwd)) {
      return "Approved Verification contract cwd belongs to a different Git repository.";
    }
  } catch (error) {
    return `Approved repository cwd cannot be verified: ${error instanceof Error ? error.message : String(error)}`;
  }
  return undefined;
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

function planningMutationError(
  toolName: string,
  input: Record<string, unknown>,
  cwd: string,
): string | undefined {
  if (["read", "grep", "ls", "subagent", "plannotator_submit_plan"].includes(toolName)) {
    return undefined;
  }
  if ((toolName === "edit" || toolName === "write") && isPlanMarkdownPath(input, cwd)) {
    return undefined;
  }
  if (["bash", "edit", "write", "find"].includes(toolName)) {
    return "Planning is read-only except the markdown plan beneath .plannotator; use the fresh scout for repository commands.";
  }

  const operation = toolName.split("__").at(-1) ?? toolName;
  const normalized = operation.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  if (
    /(?:^|_)(?:add|apply|approve|assign|close|commit|create|delete|deploy|edit|execute|install|merge|patch|post|publish|push|remove|reopen|reply|resolve|run|send|set|submit|transition|update|upload|write)(?:_|$)/.test(
      normalized,
    )
  ) {
    return `Tool ${toolName} may mutate state and is blocked until the current plan is approved.`;
  }
  if (/^(?:get|list|search|read|fetch|query|find|inspect|show|lookup|describe|view)(?:_|$)/.test(normalized)) {
    return undefined;
  }
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
  if (input.agent !== role || Array.isArray(input.tasks) || Array.isArray(input.chain)) {
    return `${role} must run as one fresh single subagent, not in a chain or parallel batch.`;
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
  const expected = approvedPlan.verification?.[role];
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
  return undefined;
}

function acceptanceLedgerError(
  details: unknown,
  role: VerificationRole,
  expected: VerificationCommand[],
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

function completionGateError(workflow: ActiveWorkflow, cwd: string): string | undefined {
  if (workflow.pendingFollowUp) {
    return "A user follow-up is waiting for a newly approved plan iteration.";
  }
  const planError = approvedPlanError(workflow, cwd);
  if (planError) return planError;
  const approvedPlan = workflow.approvedPlan!;
  if (approvedPlan.kind === "read-only") {
    try {
      if (captureRepositorySnapshot(approvedPlan.cwd) !== approvedPlan.repositorySha256) {
        return "The repository changed after read-only plan approval; return to planning and reapprove.";
      }
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    return undefined;
  }

  const gate = workflow.executionGate;
  if (!gate) {
    return "The approved code plan has not produced a verified worker and reviewer gate.";
  }
  if (gate.planSha256 !== approvedPlan.sha256) {
    return "Execution gates belong to an older plan revision.";
  }
  const targetError = codeTargetError(approvedPlan, gate.cwd);
  if (targetError) return targetError;
  if (gate.worker !== "verified") {
    return gate.workerReason || "The latest worker runtime acceptance ledger is not verified.";
  }
  if (gate.reviewer !== "verified") {
    return gate.reviewerReason || "A fresh reviewer with all approved checks and no findings is still required.";
  }
  if (!gate.reviewerRepositorySha256) {
    return "The fresh reviewer repository snapshot is unavailable.";
  }
  try {
    if (captureRepositorySnapshot(gate.cwd) !== gate.reviewerRepositorySha256) {
      return "The canonical repository changed after the fresh reviewer passed; rerun worker and reviewer gates.";
    }
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return undefined;
}

export default function registerWorkflowCommands(
  pi: ExtensionAPI,
  runtime?: WorkflowRuntime,
): void {
  let activeWorkflow: ActiveWorkflow | null = null;
  let transitionInProgress = false;

  const setActiveWorkflow = (workflow: ActiveWorkflow | null) => {
    activeWorkflow = workflow;
    persistWorkflow(pi, workflow);
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
        text = loadWorkflowIterationMessage(queued, queued.pendingFollowUp);
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

  const restoreCurrentBranch = (context: ExtensionContext) => {
    activeWorkflow = restoreWorkflow(context.sessionManager.getBranch());
    transitionInProgress = false;
  };

  pi.on("session_start", async (_event, context) => {
    restoreCurrentBranch(context);
    if (activeWorkflow?.pendingFollowUp) {
      context.ui.notify("Workflow follow-up preserved; run /workflow-retry when ready.", "warning");
    }
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
    }
  });

  pi.on("tool_result", async (event, context) => {
    if (!activeWorkflow || activeWorkflow.pendingFollowUp || !isRecord(event.input)) return;

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
          executionGate: undefined,
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
          approvedPlan: submission.plan,
          executionGate: undefined,
          planSubmission: undefined,
        });
      } catch (error) {
        setActiveWorkflow({
          ...activeWorkflow,
          approvedPlan: undefined,
          executionGate: undefined,
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
    const role = event.input.agent;
    if (role === "scout") {
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
    if (role !== "worker" && role !== "reviewer") return;
    const gate = activeWorkflow.executionGate;
    const approvedPlan = activeWorkflow.approvedPlan;
    if (
      !gate ||
      !approvedPlan?.verification ||
      gate.planSha256 !== approvedPlan.sha256 ||
      gate.cwd !== event.input.cwd
    ) {
      return;
    }
    if (
      role === "worker" &&
      (gate.worker !== "pending" || gate.workerToolCallId !== event.toolCallId)
    ) {
      return;
    }
    if (
      role === "reviewer" &&
      (gate.reviewer !== "pending" || gate.reviewerToolCallId !== event.toolCallId)
    ) {
      return;
    }

    let error = acceptanceLedgerError(event.details, role, approvedPlan.verification[role]);
    if (role === "worker") {
      let repositorySha256: string | undefined;
      if (!error) {
        try {
          repositorySha256 = captureRepositorySnapshot(gate.cwd);
        } catch (snapshotError) {
          error = snapshotError instanceof Error ? snapshotError.message : String(snapshotError);
        }
      }
      setActiveWorkflow({
        ...activeWorkflow,
        executionGate: {
          ...gate,
          worker: error ? "failed" : "verified",
          reviewer: "required",
          workerRepositorySha256: repositorySha256,
          reviewerRepositorySha256: undefined,
          reviewerToolCallId: undefined,
          workerReason: error,
          reviewerReason: undefined,
        },
      });
      return;
    }
    let repositorySha256: string | undefined;
    let repositoryChanged = false;
    if (!error) {
      try {
        repositorySha256 = captureRepositorySnapshot(gate.cwd);
        if (repositorySha256 !== gate.workerRepositorySha256) {
          repositoryChanged = true;
          error = "Canonical repository changed after the worker gate; run a new worker before review.";
        }
      } catch (snapshotError) {
        error = snapshotError instanceof Error ? snapshotError.message : String(snapshotError);
      }
    }
    setActiveWorkflow({
      ...activeWorkflow,
      executionGate: {
        ...gate,
        worker: repositoryChanged ? "failed" : gate.worker,
        reviewer: error ? "failed" : "verified",
        reviewerRepositorySha256: error ? undefined : repositorySha256,
        workerReason: repositoryChanged
          ? "Canonical repository changed after the worker gate."
          : gate.workerReason,
        reviewerReason: error,
      },
    });
  });

  pi.on("tool_call", async (event, context) => {
    const input = isRecord(event.input) ? event.input : {};
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
      const mutationError = planningMutationError(event.toolName, input, context.cwd);
      return mutationError ? { block: true, reason: mutationError } : undefined;
    }

    if (phaseResponse.result.phase !== "executing") {
      if (workerRequested || reviewerRequested) {
        return { block: true, reason: "worker and reviewer may run only after the current plan is approved." };
      }
      return;
    }

    const planError = approvedPlanError(activeWorkflow, context.cwd);
    if (planError) return { block: true, reason: planError };
    const approvedPlan = activeWorkflow.approvedPlan!;

    if (workerRequested) {
      const existingGate = activeWorkflow.executionGate;
      if (existingGate?.worker === "pending" || existingGate?.reviewer === "pending") {
        return { block: true, reason: "Another worker or reviewer gate is already running." };
      }
      const error = verifiedAcceptanceError(input, "worker");
      if (error) return { block: true, reason: error };
      const contractError = verificationContractError(input, "worker", approvedPlan);
      if (contractError) return { block: true, reason: contractError };
      setActiveWorkflow({
        ...activeWorkflow,
        executionGate: {
          cwd: input.cwd as string,
          planSha256: approvedPlan.sha256,
          worker: "pending",
          reviewer: "required",
          workerToolCallId: event.toolCallId,
        },
      });
      return;
    }

    if (reviewerRequested) {
      const error = verifiedAcceptanceError(input, "reviewer");
      if (error) return { block: true, reason: error };
      const contractError = verificationContractError(input, "reviewer", approvedPlan);
      if (contractError) return { block: true, reason: contractError };
      const gate = activeWorkflow.executionGate;
      if (
        !gate ||
        gate.planSha256 !== approvedPlan.sha256 ||
        gate.cwd !== input.cwd ||
        gate.worker !== "verified"
      ) {
        return {
          block: true,
          reason: "reviewer requires the current approved plan's verified worker acceptance ledger first.",
        };
      }
      if (gate.reviewer === "pending") {
        return { block: true, reason: "The current reviewer gate is already running." };
      }
      try {
        if (
          !gate.workerRepositorySha256 ||
          captureRepositorySnapshot(gate.cwd) !== gate.workerRepositorySha256
        ) {
          setActiveWorkflow({
            ...activeWorkflow,
            executionGate: {
              ...gate,
              worker: "failed",
              reviewer: "required",
              workerReason: "Canonical repository changed after the worker gate.",
            },
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
      setActiveWorkflow({
        ...activeWorkflow,
        executionGate: {
          ...gate,
          reviewer: "pending",
          reviewerToolCallId: event.toolCallId,
          reviewerRepositorySha256: undefined,
          reviewerReason: undefined,
        },
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
        if (!input || (spec.validate && !spec.validate(input))) {
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

        const workflow: ActiveWorkflow = { name, input, iteration: 1 };
        let message: string;
        try {
          message = loadWorkflowMessage(workflow);
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
      const pending = activeWorkflow.pendingFollowUp ? "; follow-up pending" : "";
      const approved = activeWorkflow.approvedPlan
        ? `; approved ${activeWorkflow.approvedPlan.path} @${activeWorkflow.approvedPlan.sha256.slice(0, 8)}`
        : "";
      const contract = activeWorkflow.approvedPlan?.verification
        ? `; contract worker[${activeWorkflow.approvedPlan.verification.worker.map((item) => item.id).join(",")}], reviewer[${activeWorkflow.approvedPlan.verification.reviewer.map((item) => item.id).join(",")}]`
        : "";
      const gates = activeWorkflow.executionGate
        ? `; gates worker=${activeWorkflow.executionGate.worker}, reviewer=${activeWorkflow.executionGate.reviewer}`
        : "";
      const scout = activeWorkflow.planningScoutGate
        ? `; iteration-scout=${activeWorkflow.planningScoutGate.status}`
        : "";
      context.ui.notify(
        `Workflow ${activeWorkflow.name}; iteration ${activeWorkflow.iteration}${pending}${approved}${contract}${gates}${scout}.`,
        "info",
      );
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
      setActiveWorkflow(null);
      context.ui.notify("Workflow loop aborted without a completion claim.", "warning");
    },
  });
}
