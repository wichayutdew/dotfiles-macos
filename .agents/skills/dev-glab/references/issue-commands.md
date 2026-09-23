# glab issue - Issue Commands

## Create

```bash
glab issue create \
  --title "Bug: checkout crashes on Safari" \
  --description "Steps to reproduce..." \
  --label "bug,mobile" --assignee username \
  --milestone "Q2-S1" --weight 3 --due-date 2025-06-30 \
  --confidential --yes
```

## List / View

```bash
glab issue list                      # open issues
glab issue list --closed --assignee @me --label "bug"
glab issue list --milestone "Q1-S4" --search "login" --per-page 100 -F json
glab issue view <id>
glab issue view <id> --comments -F json
glab issue view <id> --web
```

## Update / Close / Note

```bash
glab issue update <id> --title "new title" --label "in-progress"
glab issue update <id> --assignee user --milestone "Q2-S1"
glab issue close <id>
glab issue reopen <id>
glab issue note <id> --message "Investigating now"
```

## Labels

```bash
glab label list
glab label create --name "needs-review" --color "#e11d48" --description "Ready for review"
glab label delete "old-label"
```
