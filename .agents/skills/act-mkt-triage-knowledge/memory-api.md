# Hindsight publication contract

Use the authenticated gateway's actual tools and schemas. Prefer the host's managed Activities memory connection; an installed skill or responding URL is not authenticated access. The gateway owns bank selection: never add a bank override, create a bank, expose/copy credentials or change authentication as a workaround.

## Required capabilities

| Purpose | Gateway operation / observed fields |
| --- | --- |
| Browse exact parent IDs | `get_knowledge_base_tree()` → nested `roots`, folders `kf-...`, pages `kp-...`, `children`, `parent_id`, backing `mental_model_id` |
| Find/read knowledge | `search_knowledge_base(query, limit)`, `get_knowledge_page(page_id)` |
| Retain ticket evidence | `retain(content, context, timestamp, tags, metadata, document_id, strategy, update_mode)`; optional `sync_retain` waits for retention, not necessarily consolidation |
| Reconcile source facts | `recall`, `list_memories`, `get_memory` with supported source/tag fields; inspect raw chunks/source metadata when available |
| Track asynchronous work | `get_operation(operation_id)`; record completion/failure/pending state |
| Create a missing folder | `create_knowledge_folder(name, parent_id)` |
| Create a feature page | `create_knowledge_page(name, source_query, parent_id, tags, max_tokens, trigger, refresh_after_consolidation)` |
| Update existing page policy | `update_knowledge_node(node_id, source_query, tags, max_tokens, trigger, refresh_after_consolidation)`; preserve unrelated settings |
| Explicitly refresh existing page | `refresh_mental_model(mental_model_id)`; read schema/result and track any operation |

The observed create-page result contains `page_id`, `mental_model_id` and `operation_id`; content is generated asynchronously. Inspect current schemas rather than assuming this shape forever. Generic wrappers named `hindsight_ingest_document`, `hindsight_list_pages` and `hindsight_read_page` do not expose folder-targeted page creation. A document named `triage/...` is not a page in that folder. If the host hides required operations, use its maintained authenticated gateway client's supported interface or report the missing capability. Do not hardcode a developer's client checkout path, implement a credential store or silently fall back to ingestion-only success.

## Stable identities and scope

A ticket document identity is `triage:<URL-quoted-profile>:<channel>:<root-timestamp>`, independent of sprint dates and URL variants. Use the helper rather than recomputing it:

```bash
python3 scripts/knowledge_contract.py identity --profile PROFILE --channel CHANNEL --message-ts TIMESTAMP
python3 scripts/knowledge_contract.py page-query --feature FEATURE-SLUG --name 'Feature name'
```

Retained ticket tags are `triage`, `support-profile:<profile>` and every `feature:<slug>` it contributes to. Page tags are exactly `triage` and one `feature:<slug>`, using strict all-tag matching. The authenticated bank is the team boundary: relevant evidence from multiple profiles can enrich the same feature page directly under the exact top-level `triage` folder. A profile is provenance, not a page boundary. Folder placement controls browsing, not retrieval isolation. Keep tags stable when matching existing features; an untagged legacy page must be reviewed/migrated deliberately before reuse, not treated as isolated by its title.

Set `trigger.tags_match` to the supported strict-all value (`all_strict` in the verified API), `exclude_mental_models: true`, `fact_types: ["world", "experience", "observation"]`, `include_chunks: true` and `refresh_after_consolidation: true`. Enable sufficient `recall_chunks_max_tokens` for the relevant retained evidence. This keeps feature pages grounded in their retained evidence rather than sibling summaries. Use delta refresh normally. Include raw source facts as well as observations: observation-only generation can omit literal source URLs and uncertainty even when retention succeeded. Raw facts provide document IDs, source metadata and chunks needed for provenance. The refresh must inspect the original chunks rather than treating their absence from observations as absence from the source. After a failed readback or material query correction, perform a full refresh with `trigger.mode: full`, verify the repaired content, then restore `trigger.mode: delta` for normal consolidation updates. A successful delta operation reporting no new facts does not repair missing citations. Scope the source query to the exact triage namespace and feature, require the six headings, source links, dates, applicability conditions, and explicit uncertainty/corrections. A page's facts can still be stale even when its last refresh succeeded; assess source and verification dates.

Choose a bounded `max_tokens` sufficient for the verified draft and existing still-valid knowledge. Start from the service's page default when sufficient, increase within the actual schema/service limits when necessary, and verify coverage after generation. Do not drop ticket findings merely to fit a budget. Split a broad feature only when its subtopics are independently useful and source-backed.

## Readback

Pipe a JSON object containing `markdown`, nonempty `sourceLinks`, `requiredTerms`, exact `pageTags`, `parentId` and `expectedParentId` into:

```bash
python3 scripts/knowledge_contract.py check-page --feature FEATURE-SLUG
```

The expected parent ID comes from the verified top-level `triage` folder. `pageTags` must contain exactly `triage` and this one `feature:<slug>`; retained multi-feature tickets carry all assigned feature tags. The helper requires all six exact level-two headings once, in order, with nonempty bodies, plus required links/terms and exact folder/tag scope. The verifier separately checks meaning, evidence status, historic still-valid citations/conditions and async-operation completion. An evidence-free placeholder is not a feature page to publish. Keep unresolved work in conversation, not a new ledger or checkpoint document. No claim of exactly-once publication is justified without server support; serialize writers affecting the same feature and reconcile remote identities before retries.
