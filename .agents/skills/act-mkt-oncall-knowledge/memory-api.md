# Hindsight publication contract

Use supported authenticated gateway operations and inspect their current schemas. The gateway owns bank selection; never supply a bank override, create a bank, copy credentials or change authentication as a workaround. An installed skill or responding URL alone does not prove authenticated access.

| Purpose | Supported operation / observed fields |
| --- | --- |
| Resolve browsing scope | `get_knowledge_base_tree()` → nested roots/children, folders `kf-...`, pages `kp-...`, parent_id, mental_model_id |
| Find/read pages | `search_knowledge_base(query, limit)`, `get_knowledge_page(page_id)` |
| Retain source evidence | `retain(content, context, timestamp, tags, metadata, document_id, strategy, update_mode)`; `sync_retain` may wait only for retention |
| Reconcile retained evidence | `recall`, `list_memories`, `get_memory` with actual supported tags/source fields and original chunks |
| Await asynchronous work | `get_operation(operation_id)` |
| Create missing top-level folder | `create_knowledge_folder(name, parent_id)` |
| Create feature guide | `create_knowledge_page(name, source_query, parent_id, tags, max_tokens, trigger, refresh_after_consolidation)` |
| Update page policy | `update_knowledge_node(node_id, source_query, tags, max_tokens, trigger, refresh_after_consolidation)` |
| Refresh existing feature | `refresh_mental_model(mental_model_id)` |

Create-page results have exposed page_id, mental_model_id and operation_id; inspect actual results rather than assuming acceptance means complete content. Generic hindsight_ingest_document/list_pages/read_page wrappers do not provide folder-targeted page creation: a document named `oncall/...` is not a page under that folder. If required operations are hidden, use the host's maintained authenticated client's supported interface or report the missing capability. Ship no personal client-checkout path or new credential storage, and do not claim ingestion-only success as page publication.

## Identities and strict scope

```bash
python3 scripts/knowledge_contract.py identity --rotation-id 10189 --esc-id 63710
python3 scripts/knowledge_contract.py page-query --feature offer-visibility --name 'Offer visibility'
```

An escalation document ID is `oncall:<rotation_id>:<esc_id>`, independent of collection dates and notification row count. Replace the full verified source under that identity, preserving all linked threads and source rows. Retained source tags are `oncall`, `rotation-id:<id>` and every contributed `feature:<slug>`. Metadata carries source URLs/IDs/dates using the actual string-value schema. Source records from different rotations cannot replace each other.

Feature-page tags are exactly `oncall` and one `feature:<slug>`, across rotations in this authenticated team bank. Use strict all-tag matching. Resolve exact top-level `oncall` and use its ID as the direct page parent; create no rotation folder. Folder placement controls browsing, not source isolation. Triage-only sources must not enter an oncall page. Untagged legacy pages need deliberate source/scope review before reuse; do not bulk-migrate historical content.

Set trigger settings using the current schema:

```json
{
  "mode": "delta",
  "tags_match": "all_strict",
  "exclude_mental_models": true,
  "fact_types": ["world", "experience", "observation"],
  "include_chunks": true,
  "recall_chunks_max_tokens": 8192,
  "refresh_after_consolidation": true
}
```

Also enable page-level refresh_after_consolidation where supported. Size max_tokens/chunk budgets to cover verified guidance and previous still-valid evidence within service limits. The helper source query requires feature-only guidance, exact six headings, literal citations, dates, applicability and uncertainty. A multi-feature escalation's other fixes belong on their own pages; mention them here only for a source-backed dependency or nonapplicability warning.

Await source availability, not merely retain completion. Original world/experience facts and chunks carry document IDs/URLs/caveats that observations can omit. Recall all three fact types with chunks and verify citations/source identities. Use delta normally. After deficient readback or a material source-query correction, Classify and Verify the repair, set mode full, refresh and verify the rebuilt content, then restore delta. A delta no-new-facts result cannot repair omitted citations. Preserve incident and verification dates; a recent page refresh alone proves no recent system verification.

## Readback and retries

Pipe JSON containing markdown, nonempty sourceLinks, requiredTerms, exact pageTags, parentId and expectedParentId into:

```bash
python3 scripts/knowledge_contract.py check-page --feature offer-visibility
```

Expected parent is the verified top-level oncall folder. The helper checks exact family/feature tags, parent, all six level-two headings once in order with nonempty bodies, required literal URLs and critical condition/uncertainty terms. An independent semantic check must also verify evidence status, earlier still-valid citations, dates, conditions, absence of unrelated knowledge and generation completion. Matching terms alone is insufficient. Compare every remediation verb and operational meaning to the source: no unsupported alternative or equivalence is permitted. Preserve exact hypothesis attribution and uncertainty without inventing who proposed/rejected it or whether it was tested/ruled out.

Reconcile source/page/model/operation identities before each retry. Inspect pending operations and retained content before repeating a timed-out write. Serialize this curator's writes; no exactly-once claim is justified without server support. Report bounded persistent failures with confirmed/remaining work in conversation, not a new ledger, checkpoint or ticket archive. No source mutation, Git or Confluence publication occurs.
