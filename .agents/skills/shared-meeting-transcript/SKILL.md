---
name: shared-meeting-transcript
description: Find and retrieve Teams meeting recordings, transcripts, and AI-generated summaries from Glean/SharePoint. Use when user asks to find a meeting recording, transcript, or summary by meeting name or topic — e.g. "find the transcript for X meeting", "get the recording of yesterday's standup", "what was discussed in the X meeting".
---

# Meeting Transcript

## Overview

Meetings at Agoda are auto-transcribed and summarized by the GPT Meeting Bot, which stores results in the SharePoint site `GPT Meeting Bot`. Recordings are stored in the organizer's OneDrive under `/Recordings/`. Use Glean to locate both.

## Workflow

### Step 1: Search Glean

Transcripts and summaries are stored in `o365sharepoint` (GPT Meeting Bot site), not `microsoftteams`. Skip the app filter and search by keywords:

```
query: "<meeting name keywords> transcript"
```

Tips:
- Use 3-5 distinctive keywords from the meeting title — avoid generic words like "meeting" or "discussion"
- If looking specifically for a recording, add `recording` to the query
- If no results, simplify keywords further or try alternate phrasing of the meeting topic
- If still no results, try `app: o365sharepoint` to narrow to SharePoint only

### Step 2: Identify results

Glean typically returns up to 3 relevant items:

| Item | Source | What it is |
|------|--------|------------|
| `*-Summary.docx` | `o365sharepoint` / GPT Meeting Bot | AI summary with timestamped decisions, action items, discussion topics |
| `*-Transcript` | `o365sharepoint` / GPT Meeting Bot | Full VTT-style transcript with speaker labels and timestamps |
| `*-Meeting Recording.mp4` | `o365onedrive` | Video recording on organizer's OneDrive |

### Step 3: Present to User

Return:
- Direct links to recording and transcript/summary
- The AI-generated summary content inline if available (it's already extracted in the Glean snippet)
- Key decisions and action items from the summary

## Notes

- Transcripts are available almost immediately after a meeting ends (within ~15 min).
- The GPT Meeting Bot summary includes: attendees, AI summary with timestamped video links, discussion points, action items, and blockers.
- If the meeting hasn't ended yet, say so rather than searching.
- If the organizer didn't record, there will be no recording but there may still be a transcript.
- To get the full transcript text, use `glean__read_document` with the transcript URL. The response is large (~100KB) and gets persisted to a file. The Read tool will fail on it even with offset/limit (checks total size first). Use bash `sed` to read in chunks instead:
  ```bash
  sed -n '1,500p' <persisted-file-path>
  sed -n '501,1000p' <persisted-file-path>
  # etc. in ~500 line chunks
  ```
