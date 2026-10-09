# dev-peer-review evals

The evals exercise independent GitLab MR review. They are offline prompts: runs
may fetch context when credentials are available, but they must not post,
resolve, approve, merge, apply suggestions, or push.

`evals.json` is the active source of truth for prompts and assertions. The copied
Homunculus GitHub eval outputs were intentionally removed because v1 of this
skill is GitLab-only.

Useful assertions check that the run:

- uses only the diff plus MR-body description, evidence, and test result summary
  as material review inputs
- ignores reviewer, CodeBuddy, bot comments, suggestions, and feedback unless
  review-thread resolution is explicitly requested
- validates peer-review findings with commands, reproductions, or concrete
  read-only evidence
- drafts peer-review comments without creating CodeBuddy action IDs
- keeps rejected claims out of drafted MR comments
- writes a complete schema-version-1 review record to the selected `.peer-review`
  store while keeping the full human-readable chat report
