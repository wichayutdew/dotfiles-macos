---
name: dev-discover-project-conventions
description: Inspect an existing repository with little or no agent documentation and infer its actual project conventions from code and config. Use when a user or agent needs to determine language or framework style, architecture patterns, build/test/lint tools, paradigm choices, component patterns, state management, testing conventions, or practical guidance before making changes in an unfamiliar codebase.
---

# Discover Project Conventions

Infer the conventions a repository actually follows. Treat this as a read-only discovery pass unless the user explicitly asks to create or update docs.

## Core Rules

- Prefer facts from local files over assumptions.
- Do not read `.env` files. If an environment value matters, ask the user to confirm it.
- Ignore generated and dependency directories: `.git`, `node_modules`, `dist`, `build`, `target`, `.next`, `out`, `coverage`, `.gradle`, `.idea`.
- Cite concrete evidence with file paths and line references when possible.
- Distinguish "observed", "likely", and "unknown". Do not overstate weak evidence.
- If the repo already has `AGENTS.md`, `CLAUDE.md`, or similar instructions, read them first and treat code/config as verification, not as a replacement for explicit guidance.
- If no repo path is provided, analyze the current working directory.

## Discovery Workflow

1. Identify the root and current state:
   - Run `git rev-parse --show-toplevel` when inside a git repo.
   - Run `git status --short` to see whether the worktree is dirty.
   - Use the repo root as the analysis boundary unless the user named a module path.

2. Find explicit guidance:
   - Check for `AGENTS.md`, `CLAUDE.md`, `.cursor/rules`, `.windsurfrules`, `.github/copilot-instructions.md`, `README*`, `CONTRIBUTING*`, `docs/`, and module README files.
   - If instructions conflict with code, report the conflict and prefer explicit instructions for future edits unless they are clearly stale.

3. Inventory stack and tools:
   - Build systems: `package.json`, lockfiles, `pom.xml`, `build.gradle*`, `settings.gradle*`, `build.sbt`, `pyproject.toml`, `requirements*.txt`, `go.mod`, `Cargo.toml`, `*.csproj`, `Makefile`, `justfile`.
   - CI: `.github/workflows`, `.gitlab-ci.yml`, `.gitlab/`, `Jenkinsfile`, `buildkite`.
   - Formatting and linting: ESLint, Prettier, Biome, Scalafmt, Scalafix, Checkstyle, Ruff, Black, Mypy, Spotless, ktlint.
   - Testing: Jest, Vitest, Playwright, Cypress, ScalaTest, MUnit, Specs2, JUnit, pytest, Go test.

4. Sample the codebase deliberately:
   - Start with source roots and recently changed or central files.
   - Use counts for broad patterns, then inspect representative files to confirm what the counts mean.
   - Avoid treating examples, tests, generated files, fixtures, or vendored code as primary style evidence unless the repo mainly consists of tests.

## Convention Heuristics

### Scala

Classify the dominant Scala style as `FP`, `OOP`, or `mixed`.

Evidence for FP:
- Imports or dependencies for Cats, Cats Effect, ZIO, Scalaz, Monix, FS2, Doobie, Http4s, Tapir.
- Types such as `IO`, `Task`, `ZIO`, `EitherT`, `OptionT`, `Kleisli`, `Resource`, `Ref`, `Validated`, `NonEmptyList`.
- Tagless-final style, effect-polymorphic services, immutable domain models, pure transformations, error values instead of thrown exceptions.

Evidence for OOP:
- Service classes with constructor-injected dependencies and imperative methods.
- Heavy use of `class`, inheritance, mutable state, `var`, Java-style beans, exceptions for expected failures, null checks.
- Framework-driven controllers or repositories where side effects are performed directly in methods.

Report `mixed` when both styles are significant. Call out module differences instead of forcing one repo-wide answer.

### React

Classify component style as function components, class components, or mixed.

Evidence for function components:
- `function Component`, arrow components, `React.FC`, hooks such as `useState`, `useEffect`, `useMemo`, `useCallback`, custom `use*` hooks.

Evidence for class components:
- `extends React.Component`, `extends Component`, lifecycle methods such as `componentDidMount`, `componentDidUpdate`, `componentWillUnmount`, `render()`.

Also identify:
- State management: React Query, Redux Toolkit, Zustand, MobX, Apollo, Context, local hook state.
- Styling: CSS modules, Sass, styled-components, Emotion, Tailwind, MUI, Ant Design, internal component libraries.
- Routing and data fetching: React Router, Next.js, Remix, Vite, custom API clients.

### TypeScript And JavaScript

Look for:
- Module system: ESM, CommonJS, mixed.
- Type strictness: `strict`, `noImplicitAny`, explicit return types, generated types, API schemas.
- Test style: unit, integration, component, end-to-end, snapshot-heavy.
- Error handling and async conventions: `Result` wrappers, exceptions, rejected promises, typed errors.

### Python

Look for:
- Package and environment tooling: `uv`, Poetry, pip-tools, requirements files, tox, nox.
- Type style: Pydantic models, dataclasses, type hints, Mypy, Pyright.
- Frameworks: FastAPI, Flask, Django, Click, Typer.
- Test and lint style: pytest, unittest, Ruff, Black, isort.

### Java, Kotlin, C#, Go

Look for:
- Frameworks and dependency injection style.
- Error handling conventions.
- Formatting and linting tools.
- Test frameworks and fixture patterns.
- Project layout and generated code boundaries.

## Output Format

Use this structure unless the user asks for a different format:

```markdown
**Scope**
- Root or module analyzed:
- Existing agent docs:
- Dirty worktree notes:

**Stack And Tools**
- Languages and frameworks:
- Package/build tools:
- Test commands:
- Lint/format commands:
- CI entrypoints:

**Observed Conventions**
- Architecture:
- Language style:
- Frontend style:
- Testing style:
- Error handling:
- Data access/API patterns:
- Naming and layout:

**Evidence**
- `<file>:<line>`: what it proves
- `<file>:<line>`: what it proves

**Confidence And Gaps**
- High confidence:
- Medium confidence:
- Unknown or conflicting:

**Guidance For Future Changes**
- Follow:
- Avoid:
- Verify with:
```

Keep the report concise. Prefer the highest-signal examples over exhaustive file lists.

## When The User Wants Docs

If the user asks to turn the findings into `AGENTS.md`, `CLAUDE.md`, or module docs:

1. Present the convention report first.
2. Ask before creating or overwriting instruction files.
3. Keep generated docs limited to conventions that were actually observed or explicitly supplied by the user.
