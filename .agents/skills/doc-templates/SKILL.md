---
name: doc-templates
description: Documentation templates — ADR, changelog, README, API docs, inline KDoc/ScalaDoc/Javadoc/TSDoc.
---

# Documentation Templates

## ADR (Architecture Decision Record)

```markdown
# ADR-NNN: [Title]

**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Deprecated | Superseded by ADR-XXX
**Deciders**: [who]

## Context
[What problem, what forces]

## Decision
[What we decided]

## Consequences

**Positive**: [benefits]
**Negative**: [trade-offs]

## Alternatives Considered
| Option | Pros | Cons | Why rejected |
|--------|------|------|-------------|
```

## Changelog (Keep a Changelog format)

```markdown
## [Unreleased]

### Added
- [feature] (#issue)

### Changed
- [change] (#issue)

### Fixed
- [fix] (#issue)

### Security
- [patch] (#issue)
```

## README Module

```markdown
# Module Name

Brief one-liner.

## Overview
[2-3 sentences: what it does, how it fits]

## Usage
```lang
[minimal working example]
```

## Configuration
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|

## Testing
```bash
[test command]
```
```

## API Endpoint

```markdown
## `METHOD /path`

[One line description]

**Request**
```json
{ "field": "type // description" }
```

**Response 200**
```json
{ "field": "value" }
```

**Errors**: 400 [reason] | 403 [reason] | 404 [reason]
```

## Inline Docs

**Kotlin (KDoc)**
```kotlin
/**
 * [What it does, 1-2 sentences]
 *
 * @param name [description]
 * @return [what is returned]
 */
```

**Scala (ScalaDoc)**
```scala
/** [What it does]
 *
 * @param name [description]
 * @return [what is returned]
 */
```

**Java (Javadoc)**
```java
/**
 * [What it does]
 *
 * @param name [description]
 * @return [what is returned]
 * @throws ExceptionType [when]
 */
```

**TypeScript (TSDoc)**
```typescript
/**
 * [What it does]
 * @param name - [description]
 * @returns [what is returned]
 */
```
