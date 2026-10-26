# Media Capture Guide

Concepts behind screenshot and video capture. The runnable scripts are generated
from `scripts/capture_image.sh.template` and `scripts/capture-video.sh.template`.

## Screenshots vs Videos

**Screenshots** — static A/B visual regression, quick layout/sanity checks.
**Videos** — multi-step flows (booking, search→filter→detail), interactive
features (forms, modals, carousels), and A/B behavior differences.

## Prerequisites

- `playwright-cli`: `npm install -g @playwright/cli`
- `ffmpeg` (videos only): required for `.webm`→`.mp4` conversion

## Screenshot capture

1. Parse the document sanity table → `{activity_id, urlA, urlB}` per row. The URLs come directly from the table — whatever the user confirmed during document generation.
2. Copy `scripts/capture_image.sh.template` to the output `scripts/capture_image.sh`, fill the
   `ACTIVITIES` array with the parsed URLs, `chmod +x`.
3. Test-first: `./scripts/capture_image.sh --test-only` (first entity), review the screenshots to verify they're correct, then `./scripts/capture_image.sh` for the full batch.
4. Browser opens once and is reused; each capture waits `sleep 5` after `goto`.
5. Output: `media/{id}_{A|B}_desktop.png`. Then tick the sanity-table checkboxes and optionally add `[A](media/..) [B](media/..)` links in Remarks.

## Video capture

Element references (`e5`, `e12`, …) are **not stable** across pages, reloads, or
A/B variants, so the element map is rebuilt **per scenario at runtime**:
navigate → snapshot → fuzzy-map steps → record → clear map → next scenario.

1. Parse the "Detailed Test Scenarios" section → `{id, name, url, steps[]}`.
2. Copy `scripts/capture-video.sh.template` to the output `scripts/capture-video.sh`,
   fill the `SCENARIOS` array (`"{id}|{name}|{url}|{step1}|{step2}|..."`).
3. Copy `scripts/convert-videos.sh` alongside it; `chmod +x` both. The capture
   script's final step runs `./scripts/convert-videos.sh ./media/videos`, so every
   `--test-only`, `--scenario`, and batch run ends in `.mp4`. **Conversion failure
   = capture failure.** Never update or publish the document before `.mp4` exist.
4. Test-first is **mandatory**: `./scripts/capture-video.sh --test-only`, then
   validate mappings (below) before the batch.

### Step mapping

| Document step | playwright-cli |
|---|---|
| Navigate to X | `goto {url}` |
| Click button/link | `click {ref}` |
| Enter / fill text | `fill {ref} "text"` |
| Select option | `select {ref} "value"` |
| Scroll | `eval "window.scrollTo(...)"` |
| Wait N seconds | `sleep N` |

### Fuzzy mapping confidence & approval

Each step is matched to a snapshot element with a confidence score:
exact selector 100% · text match 90% · attribute/class overlap 70–85% ·
position 60–75% · type-only 50%. **Mappings below 80% require user approval.**

After the test recording, show the mappings used and flag any `< 80%`, then ask
the user to confirm elements were clicked correctly before running the batch.
Options: approve · use alternative match · custom selector · skip step.

Fuzzy matching is flaky on dynamic content (carousels, lazy-load), A/B variants,
time-sensitive elements (date pickers), and modal/dropdown states — which is why
test-first approval is never skipped.

## MP4 conversion

`scripts/convert-videos.sh` wraps ffmpeg (H.264/AAC) for Confluence/Slack
compatibility and smaller files. Keep recordings under 60s; include both A/B
variants; use CRF 23–24 for balanced quality/size.

Add a `## 🎬 Video Evidence` table to the document with **exactly these columns,
in this order** — the publish script locates the video by position (last column):

```
| Scenario | Activity | Description | Duration | Video |
```

Put the `.mp4` reference (filename or `[label](media/videos/{file}.mp4)` link) in
the final **Video** column and the `ffprobe` duration in **Duration**. The publish
script matches each row's Video cell against uploaded `.mp4` files and replaces it
with an inline player. Changing this column order will break video embedding.
