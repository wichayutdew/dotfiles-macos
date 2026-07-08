---
name: lint-commands
description: Linting, formatting, and test commands for Kotlin, Scala, Java, and TypeScript projects.
---

# Lint & Quality Commands

## Kotlin (Gradle)

```bash
./gradlew ktlintCheck       # lint
./gradlew ktlintFormat      # auto-fix formatting
./gradlew detekt            # static analysis
./gradlew test              # tests
./gradlew check             # all checks
```

## Scala (SBT)

```bash
sbt scalafmtCheck           # format check
sbt scalafmt                # auto-fix formatting
sbt "scalafix --check"      # static analysis
sbt test                    # tests
sbt "clean compile test scalafmtCheck"  # all checks
```

## Java (Gradle)

```bash
./gradlew checkstyleMain checkstyleTest   # lint
./gradlew spotbugsMain                    # static analysis
./gradlew spotlessCheck                   # format check
./gradlew spotlessApply                   # auto-fix
./gradlew test                            # tests
./gradlew check                           # all checks
```

## Java (Maven)

```bash
mvn checkstyle:check        # lint
mvn spotbugs:check          # static analysis
mvn test                    # tests
mvn verify                  # all checks
```

## TypeScript / React

```bash
pnpm run lint               # lint
pnpm run lint -- --fix      # auto-fix lint
pnpx prettier --check .     # format check
npx prettier --write .      # auto-fix format
npx tsc --noEmit            # type check
npm test                    # tests
npm run lint && npx prettier --check . && npx tsc --noEmit && npm test  # all
```

## Report Format

```markdown
## Quality Check

**Status**: ✅ READY TO PUSH | ❌ ISSUES FOUND

| Check | Status | Notes |
|-------|--------|-------|
| Lint | ✅/❌ | [N issues] |
| Format | ✅/❌ | [run fix command] |
| Static Analysis | ✅/❌ | [details] |
| Tests | ✅/❌ | [N/N passing] |
```
