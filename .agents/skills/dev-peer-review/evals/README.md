# dev-peer-review evals

`evals.json` contains offline prompts and assertions. Use fixture MR data and the
local fake-glab boundary; never send live comments, labels, replies, approvals,
merges, source changes or pushes for an evaluation. An independent acceptance
pass should exercise both standalone output and the implementation parent's
actual readable chat handoff. Static instruction inspection is not an independent
behavioral exercise.

Check independent review from the complete diff and material MR-body evidence,
bounded proof, rejected hypotheses and no reliance on review threads. Only after
collection may native history be inspected to reconcile publication receipts.

The concise report shows clean/findings/incomplete status, exact reviewed SHA,
confirmed/blocking/unverified counts, short actionable findings, review/CI state,
material gaps and the absolute stored-record path. Its chat-only `Posted to MR`
section summarizes actual receipt-derived summary/inline content with native
links, including reused old titles and partial/skipped/unconfirmed/error states.
The MR summary never embeds that bookkeeping section. Full trigger/proof,
successful command lists and rejected hypotheses stay inline/local unless asked. Raw JSON stays local unless requested. An incomplete review with zero
confirmed findings must never look clean. Failed CI or a label error alone does
not make review verification incomplete.

Exercise automatic original summaries and confirmed inline findings through fake
glab: one summary per SHA, same-SHA completion update, new-SHA history, unchanged
inline reuse, valid old/new diff positions, per-effect head checks, partial/lost
responses, uncertain reconciliation and explicit caller restrictions. Verify that
publication leaves immutable version-1 evidence and dispatcher digest/provenance
checks unchanged; a published incomplete summary cannot pass the review gate.

Run deterministic behavior tests with:

```text
node --test tests/*.test.mjs skills/dev-peer-review/tests/*.test.mjs
```

The production CLI is exercised with argv, stdin JSON, host/project encoding,
pagination and failure responses. These passes do not establish live GitLab
behavior. A live smoke check requires a separately designated MR and authorization;
do not post synthetic findings to the skill's development MR.
