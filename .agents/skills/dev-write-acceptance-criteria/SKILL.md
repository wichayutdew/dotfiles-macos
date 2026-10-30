---
name: dev-write-acceptance-criteria
description: Write or review acceptance criteria for a Jira story, task, or bug as pass/fail contracts. Use when drafting the Acceptance Criteria section of a ticket, rewriting vague ACs, or checking whether existing ACs are testable (e.g. "write ACs for ACT-1234", "are these ACs good?", "tighten the acceptance criteria").
---

# Write Acceptance Criteria

Acceptance criteria (ACs) are pass/fail contracts for the story. They are not a backlog of implementation steps and not a slogan.

**The bar:** someone who was not in the standup can mark every AC pass or fail in one session, using only the AC text and a start state they can set up, without asking on Slack. If they can't, the line is a note, not an AC.

## Rules

### 1. Shape

- **One AC = one observable outcome.** You can demo it. People may argue about *how* it's built, never about *whether* it passes.
- **Independent.** If AC-2 fails, AC-1 still has a clear pass/fail result.
- **Given / When / Then is the default.** Each clause must be real:
  - **Given**: a start state a tester can set up (user on Activities home, empty search overlay, no booking context, city = Bangkok). Name a fixture or test data when the state depends on data.
  - **When**: one action (a click, a request, a pipeline run).
  - **Then**: what is on screen, in the API response, or in the data, checkable without reading the code.
- A plain rule line is fine for a static constraint if it still passes the bar ("Section shows at most 10 items"). Never write a fake Given ("Given the feature exists").

### 2. One verifier per AC

Pick who checks the AC and phrase the Then in their terms. Label each AC with its verifier.

| Verifier | Then looks like |
|---|---|
| UI | overlay, list, URL, hidden slot, copy text |
| API | status code, JSON field and value, absence of a bad value (no `cityId=0`) |
| Data | query Q at grain X returns no duplicates / no NULL in column Y |

Process items (docs written, dashboard created, Calculon closed, tests added) are **not** ACs. They belong in the Definition of Done (DoD). If the ticket has no DoD section, list them under Technical Notes.

A story may mix verifiers as separate, labelled ACs. Never mix two verifiers in one sentence.

### 3. Cover the boring cases

Besides the happy path, add an AC for each of these that applies:

- **Empty**: no results, empty list, no history.
- **Invalid**: bad input, unsupported locale, unmapped ID.
- **Error**: downstream fails or times out. Say what the user or caller sees.
- **Don't break the sibling**: neighbouring sections, flows, or variants still behave as before.
- **Non-functional**, only when measurable: "overlay renders in < 300 ms p95 on QA", "screen reader announces the section title".

### 4. Experiments (A/B)

If the story *is* the experiment, the variant goes in the Given. Write separate ACs per variant:

- **A (control)**: behaviour identical to current production. Name what to compare.
- **B**: the new behaviour.

Never put both variants in one paragraph.

### 5. What does not belong in an AC

Move these to the right section of the ticket:

| Not an AC | Put it in |
|---|---|
| Implementation: method names, file paths, repo lists, cache keys, "companion Hive work" | Technical Notes / What Needs to Happen |
| An experiment ID as the only subject ("integrate ACT-6686", "close Calculon") | Context, or DoD |
| Process items: docs, dashboards, tests added, experiment closed | DoD (or Technical Notes if there is no DoD section) |
| Out-of-scope notes | Out of Scope |
| "Documented for ACT-XXXX", "uses agreed mapping rules", "coherent identity" | Rewrite as an observable Then, or drop |

If a requirement is about internals (e.g. cache isolation), write the observable consequence instead: "two requests that differ only in currency return prices in their own currency; neither returns the other's cached response."

### 6. Then phrases that fail the bar

Reject or rewrite any Then that contains:

- "works correctly", "as expected", "behaves properly"
- "logged correctly" / "analytics tracked" without an event name, trigger, and required fields
- "able to navigate correctly" without the destination URL or screen
- "as agreed", "per the mapping", "documented", "consistent", "coherent"
- placeholders: `X`, `TBD`, `<event>`, "the relevant field"

If a value is genuinely unknown (event name not yet defined), the AC is not ready. Say so in the ticket rather than writing a placeholder.

### 7. Size signal

More than ~8 ACs, or ACs spanning many verifiers and surfaces, usually means the story should be split. Flag it instead of writing a long list.

## Instructions

1. **Collect inputs.** Read the ticket's Context, What Needs to Happen, designs, and experiment setup. Note which surfaces (UI, API, data) actually change.
2. **List the outcomes.** Write one line per observable outcome a customer, caller, or analyst would notice. Merge duplicates, then split any line that contains "and" across two outcomes.
3. **Assign a verifier** (UI / API / Data) to each outcome.
4. **Write each AC** using the rules above, with a concrete, settable Given.
5. **Add the boring cases** from rule 3 and, for experiments, the per-variant ACs from rule 4.
6. **Move non-ACs out** (rule 5) into Technical Notes, Out of Scope, or the DoD.
7. **Self-check every line** against the checklist below. Rewrite or remove anything that fails.
8. **Report gaps.** If an AC can't be completed because a value is unknown (event name, threshold, fixture), list it as an open question instead of guessing.

## Self-check

For each AC:

- [ ] One outcome, one verifier, labelled
- [ ] Given can be set up by a tester without the author
- [ ] When is a single action
- [ ] Then is observable without reading code, with no phrase from rule 6
- [ ] Pass/fail stays defined if any other AC fails

For the set:

- [ ] At least one happy path
- [ ] Empty / invalid / error / sibling cases covered where they apply
- [ ] Each experiment variant has its own AC
- [ ] No process items, implementation details, or out-of-scope notes
- [ ] ~8 ACs or fewer, or a split is proposed

## Output Format

Markdown checklist, one AC per line, numbered and labelled with the verifier. This drops straight into the `## Acceptance Criteria` section used by `dev-jira-ticket`.

```markdown
- [ ] **AC-1 (UI)** Given …, when …, then ….
- [ ] **AC-2 (API)** Given …, when …, then ….
- [ ] **AC-3 (UI, edge: empty)** Given …, when …, then ….
```

## Examples

### Navigation with analytics

Bad:

- [ ] Able to navigate correctly from home to details, and analytics logged correctly.

Good (event and field names are illustrative):

- [ ] **AC-1 (UI)** Given I am on Activities home, when I click an activity card, then I land on `/activities/detail/<activityId>` for that activity.
- [ ] **AC-2 (Data)** Given I click an activity card on Activities home, when the details page loads, then `activity_details_viewed` fires once with `page=details` and `source=home`.

### Experiment variant B with a sibling check

Bad (two outcomes, unsettable Given):

- [ ] Given experiment B and a sellable city that maps to a country with a non-empty destination list, when I open the empty search overlay, then Destinations You'll Love shows that list (not customer-origin tops) and Near Me / Recent / Suggestions are unchanged.

Good:

- [ ] **AC-1 (UI, B)** Given experiment B and city = Bangkok (maps to TH, destination list non-empty), when I open the empty search overlay, then Destinations You'll Love shows the TH destination list, not the customer-origin top destinations.
- [ ] **AC-2 (UI, B, sibling)** Given experiment B and city = Bangkok, when I open the empty search overlay, then Near Me, Recent, and Suggestions show the same content as in A.
- [ ] **AC-3 (UI, B, edge: empty)** Given experiment B and a city whose country has an empty destination list, when I open the empty search overlay, then Destinations You'll Love is hidden and Near Me still shows.
- [ ] **AC-4 (UI, A)** Given experiment A and city = Bangkok, when I open the empty search overlay, then Destinations You'll Love shows customer-origin top destinations, as in production today.

### Schema change (Data verifier)

Table and column names are illustrative:

- [ ] **AC-1 (Data)** Given the pipeline has run for 2026-10-01, when I query `activities.booking_attribution` for that date, then column `search_city_id` exists and is populated for every row whose source booking has a search city.
- [ ] **AC-2 (Data, edge: NULL)** Given a source booking with no search city, when the pipeline runs, then `search_city_id` is NULL for that row and the row is not dropped.
- [ ] **AC-3 (Data, no double-count)** Given the pipeline has run for 2026-10-01, when I count rows per `booking_id` in `activities.booking_attribution`, then every `booking_id` appears exactly once.

## Anti-Patterns

- **AC as task list**: "Add field to DTO", "Update `getTextSearchLocation`". These are implementation, not outcomes.
- **Slogan AC**: "Users get relevant destinations". Not pass/fail.
- **Both variants in one AC**: write one AC per variant.
- **Compound Then**: "shows X and Y is unchanged". Split it.
- **Author-only Given**: "a city that maps correctly". Name the fixture.
- **Process as AC**: "Documentation updated", "Calculon closed". Move to DoD.
