#!/usr/bin/env python3
"""
Complete Confluence publishing automation for dev-feature-signoff.

Usage:
    confluence_publish_complete.py --page-id ID --media-dir DIR --markdown-file FILE [--video-dir DIR] [--config PATH]

AUTHENTICATION:
- This script uses ONLY ~/.confluence/feature-sign-off-publish-config.yml for credentials
- NO MCP authentication or connection required
- All REST API calls use HTTP Basic Auth (email + PAT from config file)
- Credentials are validated by the skill before this script runs

WHY NOT MCP:
- MCP CANNOT upload binary attachments (media files)
- MCP CANNOT get fileId needed for ADF media nodes
- REST API is the ONLY way to properly embed images in Confluence pages

Workflow:
1. Load credentials from config file (default: ~/.confluence/feature-sign-off-publish-config.yml)
2. Upload screenshots as attachments via REST API → get fileId for each
3. Upload videos from --video-dir (default: {media-dir}/videos, if present) the same way
4. Convert markdown to ADF format
5. Inject media nodes into sanity table (media nodes reference fileId)
6. Link uploaded videos into the "Video Evidence" table by matching filenames
7. Update page with complete ADF content via REST API

Config File Format:
    hosts:
      agoda.atlassian.net:
        email: your.email@agoda.com
        token: ATATT3xFfGF0...
        wiki_path: /wiki

CRITICAL: Credentials must be configured in config file first.
         The skill's authentication setup creates ~/.confluence/feature-sign-off-publish-config.yml

NOTE: This config file is specific to dev-feature-signoff skill. There is no
      dependency on any external confluence-cli tool. This skill uses direct REST API calls.
"""

import argparse
import json
import mimetypes
import os
import sys
from pathlib import Path
from typing import Dict, List, Tuple
import re
from urllib.parse import quote

import requests
from requests.auth import HTTPBasicAuth
import yaml

# Import our markdown-to-ADF converter
from markdown_to_adf import markdown_to_adf

IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif'}
VIDEO_EXTENSIONS = {'.webm'}


def normalize_confluence_url(url: str) -> str:
    """
    Normalize Confluence URL to base domain without /wiki suffix or trailing slash.

    Handles both formats:
        - "https://agoda.atlassian.net" -> "https://agoda.atlassian.net"
        - "https://agoda.atlassian.net/wiki" -> "https://agoda.atlassian.net"

    This ensures we don't create double /wiki/wiki/ paths when building API URLs.
    """
    url = url.rstrip('/')
    if url.endswith('/wiki'):
        url = url[:-5]  # Remove '/wiki'
    return url



def check_attachment_exists(confluence_url: str, page_id: str, filename: str,
                           auth: HTTPBasicAuth) -> Tuple[str, str, str]:
    """
    Check if attachment exists and return (attachmentId, fileId, collection).
    Returns (None, None, None) if not found.
    """
    url = f"{confluence_url}/wiki/rest/api/content/{page_id}/child/attachment"
    params = {"filename": filename, "expand": "version,extensions"}

    try:
        resp = requests.get(url, params=params, auth=auth, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        results = data.get('results', [])
        if results and len(results) > 0:
            att = results[0]
            att_id = att.get('id')
            file_id = att.get('extensions', {}).get('fileId')
            collection = att.get('extensions', {}).get('collectionName')
            return (att_id, file_id, collection)
    except Exception:
        pass

    return (None, None, None)


def upload_and_get_file_ids(
    confluence_url: str,
    page_id: str,
    media_dir: Path,
    auth: HTTPBasicAuth,
    extensions: set,
    label: str = "files"
) -> Dict[str, Tuple[str, str, str]]:
    """
    Upload media files or get existing ones. Returns mapping of filename -> (attachmentId, fileId, collection).

    Returns:
        Dict mapping "1252815_A_desktop.png" -> ("att123", "uuid-here", "contentId-123")
    """
    if not media_dir.is_dir():
        return {}

    file_paths = [
        f for f in media_dir.iterdir()
        if f.is_file() and f.suffix.lower() in extensions
    ]

    if not file_paths:
        print(f"No {label} found in {media_dir}", file=sys.stderr)
        return {}

    print(f"Processing {len(file_paths)} {label}...", file=sys.stderr)

    file_mapping = {}

    for file_path in file_paths:
        filename = file_path.name
        mime_type = mimetypes.guess_type(filename)[0] or 'application/octet-stream'

        # Check if already exists
        att_id, file_id, collection = check_attachment_exists(confluence_url, page_id, filename, auth)

        if att_id and file_id:
            # Already exists, use existing IDs
            file_mapping[filename] = (att_id, file_id, collection)
            print(f"  ✓ {filename} (existing, reusing)", file=sys.stderr)
            continue

        # Upload new file
        upload_url = f"{confluence_url}/wiki/rest/api/content/{page_id}/child/attachment"
        headers = {"X-Atlassian-Token": "no-check"}

        try:
            with file_path.open('rb') as f:
                files = {'file': (filename, f, mime_type)}
                resp = requests.post(upload_url, headers=headers, files=files, auth=auth, timeout=60)
                resp.raise_for_status()

                data = resp.json()
                results = data.get('results', [])
                if not results:
                    print(f"  ✗ {filename}: No results in response", file=sys.stderr)
                    continue

                att_id = results[0].get('id')

                # Get fileId
                att_url = f"{confluence_url}/wiki/rest/api/content/{att_id}"
                att_resp = requests.get(att_url, params={"expand": "extensions"}, auth=auth, timeout=30)
                att_resp.raise_for_status()

                att_data = att_resp.json()
                file_id = att_data.get('extensions', {}).get('fileId')
                collection = att_data.get('extensions', {}).get('collectionName')

                if file_id:
                    file_mapping[filename] = (att_id, file_id, collection)
                    print(f"  ✓ {filename} uploaded (new)", file=sys.stderr)
                else:
                    print(f"  ✗ {filename}: Could not get fileId", file=sys.stderr)

        except Exception as e:
            print(f"  ✗ {filename}: {e}", file=sys.stderr)

    print(f"\nSuccessfully mapped {len(file_mapping)}/{len(file_paths)} files", file=sys.stderr)
    return file_mapping


def parse_markdown_sanity_table(markdown_content: str) -> List[Dict]:
    """
    Parse the sanity testing table from markdown and extract activity data.

    Returns list of dicts with: id, category, url_a, url_b, note
    """
    activities = []

    # Find the sanity table
    table_start = markdown_content.find('| **Activity ID** | **Category**')
    if table_start == -1:
        return activities

    table_end = markdown_content.find('\n\n**Note**:', table_start)
    if table_end == -1:
        table_end = markdown_content.find('\n\n##', table_start)

    table_section = markdown_content[table_start:table_end]
    lines = table_section.split('\n')

    for line in lines[2:]:  # Skip header and separator
        if not line.strip() or not line.startswith('|'):
            continue

        parts = [p.strip() for p in line.split('|')]
        if len(parts) < 7:
            continue

        activity_id = parts[1]
        if not activity_id.isdigit():
            continue

        category = parts[2]
        url_a = re.search(r'https://[^\)]+', parts[3])
        url_b = re.search(r'https://[^\)]+', parts[5])

        # Extract note from remarks, remove image links
        note = parts[7]
        note = re.sub(r'\[View [AB]\]\([^\)]+\)', '', note).strip()
        note = re.sub(r'\s*\|\s*', '', note).strip()

        activities.append({
            'id': activity_id,
            'category': category,
            'url_a': url_a.group(0) if url_a else '',
            'url_b': url_b.group(0) if url_b else '',
            'note': note
        })

    return activities


def inject_images_into_sanity_table(
    adf_content: List[Dict],
    file_mapping: Dict[str, Tuple[str, str, str]],
    jira_id: str
) -> List[Dict]:
    """
    Find sanity testing table in ADF content and inject images into A/B columns.

    This replaces [x] checkmarks with actual embedded images.

    Why: We want images to display inline in table cells, not just as attachments.
    How: Replace paragraph content containing ✅ with mediaGroup nodes.

    Returns modified content list.
    """
    # Group files by activity ID for quick lookup
    file_ids_map = {}
    for filename, (att_id, file_id, collection) in file_mapping.items():
        # Match pattern: {activityId}_{variant}_{device}.{ext}
        # Examples: 1252815_A_desktop.png, 1252815_b_desktop.png, 1252815-A-mobile.jpg
        # Support: underscore or hyphen separators, case-insensitive variants, any device name, common image extensions
        match = re.match(r'(\d+)[_-]([ABab])[_-](\w+)\.(png|jpg|jpeg|gif)', filename, re.IGNORECASE)
        if match:
            activity_id, variant, device, ext = match.groups()
            variant = variant.upper()  # Normalize to uppercase
            if activity_id not in file_ids_map:
                file_ids_map[activity_id] = {}
            file_ids_map[activity_id][variant] = (file_id, collection)

    # Find the sanity testing table
    # Look for heading containing "Sanity Testing"
    table_idx = None
    for i, node in enumerate(adf_content):
        if node.get('type') == 'heading':
            heading_text = ''
            for text_node in node.get('content', []):
                if text_node.get('type') == 'text':
                    heading_text += text_node.get('text', '')

            if 'Sanity Testing' in heading_text:
                # Find next table node
                for j in range(i + 1, len(adf_content)):
                    if adf_content[j].get('type') == 'table':
                        table_idx = j
                        break
                break

    if table_idx is None:
        print("  ⚠️  Sanity testing table not found in document", file=sys.stderr)
        return adf_content

    # Get the table
    table = adf_content[table_idx]
    rows = table.get('content', [])

    if not rows:
        return adf_content

    # Skip header row (index 0)
    # Process data rows (index 1+)
    for row in rows[1:]:  # Skip header
        cells = row.get('content', [])

        if len(cells) < 7:
            continue  # Not the right table structure

        # Get activity ID from first cell
        activity_id = None
        first_cell_para = cells[0].get('content', [{}])[0]
        for text_node in first_cell_para.get('content', []):
            if text_node.get('type') == 'text':
                activity_id = text_node.get('text', '').strip()
                break

        if not activity_id or not activity_id.isdigit():
            continue

        file_ids = file_ids_map.get(activity_id, {})

        # Replace [x] with embedded image in "When A" column (index 3)
        # The markdown has [x] which gets converted to ✅ in ADF
        # We want to REPLACE the ✅ paragraph with the actual screenshot
        if 'A' in file_ids:
            file_id_a, collection_a = file_ids['A']

            # Check if cell already has media (prevent duplicates on re-runs)
            has_media = False
            for content_node in cells[3]['content']:
                if content_node.get('type') == 'mediaGroup':
                    # Media already exists, update its fileId to handle re-uploads
                    for media in content_node.get('content', []):
                        if media.get('type') == 'media':
                            media['attrs']['id'] = file_id_a
                            media['attrs']['collection'] = collection_a
                    has_media = True
                    break

            if not has_media:
                # Clear any existing content (checkmarks, text) and add image
                cells[3]['content'] = [{
                    "type": "mediaGroup",
                    "content": [{"type": "media", "attrs": {
                        "type": "file",
                        "id": file_id_a,
                        "collection": collection_a,
                        "width": 300
                    }}]
                }]

        # Replace [x] with embedded image in "When B" column (index 5)
        if 'B' in file_ids:
            file_id_b, collection_b = file_ids['B']

            # Check if cell already has media (prevent duplicates on re-runs)
            has_media = False
            for content_node in cells[5]['content']:
                if content_node.get('type') == 'mediaGroup':
                    # Media already exists, update its fileId to handle re-uploads
                    for media in content_node.get('content', []):
                        if media.get('type') == 'media':
                            media['attrs']['id'] = file_id_b
                            media['attrs']['collection'] = collection_b
                    has_media = True
                    break

            if not has_media:
                # Clear any existing content (checkmarks, text) and add image
                cells[5]['content'] = [{
                    "type": "mediaGroup",
                    "content": [{"type": "media", "attrs": {
                        "type": "file",
                        "id": file_id_b,
                        "collection": collection_b,
                        "width": 300
                    }}]
                }]

    return adf_content


def _attachment_download_url(confluence_url: str, page_id: str, filename: str) -> str:
    """Build a direct download URL for a Confluence attachment on a page."""
    return f"{confluence_url}/wiki/download/attachments/{page_id}/{quote(filename)}"


def inject_videos_into_video_table(
    adf_content: List[Dict],
    video_file_mapping: Dict[str, Tuple[str, str, str]],
    confluence_url: str,
    page_id: str
) -> Tuple[List[Dict], set]:
    """
    Find the "Video Evidence" table and replace the Video column's placeholder
    text/link with a real link to the uploaded attachment.

    Why: mirrors inject_images_into_sanity_table, but videos are linked (not
    inline-embedded) since the Video Evidence table has one video per row
    rather than an A/B screenshot pair.

    Returns (adf_content, matched_filenames) so callers can report videos
    that were uploaded but had no matching row in the table.
    """
    matched_filenames = set()

    # Find heading containing "Video Evidence"
    table_idx = None
    for i, node in enumerate(adf_content):
        if node.get('type') == 'heading':
            heading_text = ''.join(
                t.get('text', '') for t in node.get('content', []) if t.get('type') == 'text'
            )
            if 'Video Evidence' in heading_text:
                for j in range(i + 1, len(adf_content)):
                    if adf_content[j].get('type') == 'table':
                        table_idx = j
                        break
                break

    if table_idx is None:
        print("  ⚠️  Video Evidence table not found in document", file=sys.stderr)
        return adf_content, matched_filenames

    table = adf_content[table_idx]
    rows = table.get('content', [])

    for row in rows[1:]:  # Skip header row
        cells = row.get('content', [])
        if len(cells) < 2:
            continue

        # Video column is index 1: | Scenario | Video | Duration | Status | Notes |
        video_cell = cells[1]
        cell_text = ''
        for para in video_cell.get('content', []):
            for text_node in para.get('content', []):
                if text_node.get('type') != 'text':
                    continue
                cell_text += text_node.get('text', '')
                # Markdown links (e.g. "[Watch](media/videos/x.webm)") put the
                # filename in the href, not the visible text - check that too.
                for mark in text_node.get('marks', []):
                    if mark.get('type') == 'link':
                        cell_text += ' ' + mark.get('attrs', {}).get('href', '')

        # Match against uploaded filenames by basename
        matched_filename = None
        for filename in video_file_mapping:
            if filename in cell_text:
                matched_filename = filename
                break

        if not matched_filename:
            continue

        att_id, file_id, collection = video_file_mapping[matched_filename]
        download_url = _attachment_download_url(confluence_url, page_id, matched_filename)

        video_cell['content'] = [{
            "type": "paragraph",
            "content": [{
                "type": "text",
                "text": f"📹 {matched_filename}",
                "marks": [{"type": "link", "attrs": {"href": download_url}}]
            }]
        }]
        matched_filenames.add(matched_filename)

    return adf_content, matched_filenames


def build_adf_with_images(
    markdown_file: Path,
    file_mapping: Dict[str, Tuple[str, str, str]],
    video_file_mapping: Dict[str, Tuple[str, str, str]] = None,
    confluence_url: str = '',
    page_id: str = ''
) -> dict:
    """
    Convert FULL markdown document to ADF and inject images into sanity table.

    This now converts the ENTIRE signoff.md (all sections), then enhances
    the sanity testing table with embedded images.
    """
    # Read markdown
    with open(markdown_file, 'r') as f:
        md_content = f.read()

    # Extract JIRA ID
    jira_match = re.search(r'(ACT[A-Z]?-\d+)', md_content)
    jira_id = jira_match.group(1) if jira_match else 'ACTD-XXX'

    print(f"  Converting full markdown document to ADF...", file=sys.stderr)

    # Convert full document to ADF
    adf_doc = markdown_to_adf(md_content)

    print(f"  Injecting {len(file_mapping)} images into sanity table...", file=sys.stderr)

    # Inject images into the sanity testing table
    adf_doc['content'] = inject_images_into_sanity_table(
        adf_doc['content'],
        file_mapping,
        jira_id
    )

    matched_videos = set()
    if video_file_mapping:
        print(f"  Linking {len(video_file_mapping)} videos into video evidence table...", file=sys.stderr)
        adf_doc['content'], matched_videos = inject_videos_into_video_table(
            adf_doc['content'],
            video_file_mapping,
            confluence_url,
            page_id
        )
        unmatched = set(video_file_mapping) - matched_videos
        for filename in unmatched:
            print(f"  ⚠️  {filename} uploaded but no matching row in Video Evidence table", file=sys.stderr)

    # Add footer
    from datetime import datetime
    footer_text = f"Generated: {datetime.now().strftime('%Y-%m-%d')} via /dev-feature-signoff skill | {len(file_mapping)} screenshots embedded"
    if video_file_mapping:
        footer_text += f" | {len(matched_videos)} videos linked"
    adf_doc['content'].append({
        "type": "rule"
    })
    adf_doc['content'].append({
        "type": "paragraph",
        "content": [{
            "type": "text",
            "text": footer_text,
            "marks": [{"type": "em"}]
        }]
    })

    return adf_doc


def main():
    parser = argparse.ArgumentParser(description="Complete Confluence publishing with embedded images")
    parser.add_argument('--confluence-url', help='Confluence base URL (overrides host lookup)')
    parser.add_argument('--host', default='agoda.atlassian.net', help='Confluence host name for config lookup (default: agoda.atlassian.net)')
    parser.add_argument('--page-id', required=True, help='Page ID to update')
    parser.add_argument('--media-dir', required=True, help='Directory containing screenshots')
    parser.add_argument('--video-dir', help='Directory containing videos (default: {media-dir}/videos, if it exists)')
    parser.add_argument('--markdown-file', required=True, help='Markdown sign-off document')
    parser.add_argument('--config', default='~/.confluence/feature-sign-off-publish-config.yml', help='Config file with Confluence credentials')

    args = parser.parse_args()

    # Show clear authentication info
    print("", file=sys.stderr)
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", file=sys.stderr)
    print("🔐 Confluence Publishing - Authentication", file=sys.stderr)
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", file=sys.stderr)
    print("", file=sys.stderr)
    print("ℹ️  Using credentials from yml file ONLY", file=sys.stderr)
    print(f"📁 Config: {args.config}", file=sys.stderr)
    print(f"🌐 Host: {args.host}", file=sys.stderr)
    print("", file=sys.stderr)
    print("⚠️  Note: MCP authentication is NOT used", file=sys.stderr)
    print("    This script uses REST API with email + PAT", file=sys.stderr)
    print("", file=sys.stderr)
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", file=sys.stderr)
    print("", file=sys.stderr)

    # Load credentials from config file
    config_path = os.path.expanduser(args.config)

    print("Loading credentials...", file=sys.stderr)
    try:
        with open(config_path) as f:
            config = yaml.safe_load(f)
    except FileNotFoundError:
        print("", file=sys.stderr)
        print("❌ ERROR: Config file not found", file=sys.stderr)
        print(f"   File: {config_path}", file=sys.stderr)
        print("", file=sys.stderr)
        print("💡 Solution:", file=sys.stderr)
        print("   Run: /dev-feature-signoff {jira_id} publish", file=sys.stderr)
        print("   The skill will prompt for email + PAT and create the config file.", file=sys.stderr)
        print("", file=sys.stderr)
        print("ℹ️  Note: This is separate from MCP authentication", file=sys.stderr)
        print("   MCP cannot upload binary files, so we need yml credentials.", file=sys.stderr)
        sys.exit(1)
    except yaml.YAMLError as e:
        print("", file=sys.stderr)
        print("❌ ERROR: Invalid YAML in config file", file=sys.stderr)
        print(f"   File: {config_path}", file=sys.stderr)
        print(f"   Error: {e}", file=sys.stderr)
        sys.exit(1)

    # Extract credentials for specified host
    try:
        email = config['hosts'][args.host]['email']
        token = config['hosts'][args.host]['token']
    except (KeyError, TypeError) as e:
        print("", file=sys.stderr)
        print(f"❌ ERROR: Missing credentials for host '{args.host}'", file=sys.stderr)
        print(f"   File: {config_path}", file=sys.stderr)
        print("", file=sys.stderr)
        print("Expected structure:", file=sys.stderr)
        print("  hosts:", file=sys.stderr)
        print(f"    {args.host}:", file=sys.stderr)
        print("      email: your.email@company.com", file=sys.stderr)
        print("      token: ATATT3x...", file=sys.stderr)
        print("", file=sys.stderr)
        print(f"📋 Available hosts: {list(config.get('hosts', {}).keys())}", file=sys.stderr)
        print("", file=sys.stderr)
        print("💡 Solution:", file=sys.stderr)
        print("   Run: /dev-feature-signoff {jira_id} publish", file=sys.stderr)
        print("   The skill will prompt for email + PAT.", file=sys.stderr)
        sys.exit(1)

    if not email or not token:
        print("", file=sys.stderr)
        print(f"❌ ERROR: Empty credentials for host '{args.host}'", file=sys.stderr)
        print(f"   File: {config_path}", file=sys.stderr)
        print("", file=sys.stderr)
        print("💡 Solution:", file=sys.stderr)
        print("   Run the skill's authentication setup to configure credentials.", file=sys.stderr)
        sys.exit(1)

    print(f"✓ Loaded credentials for {args.host}", file=sys.stderr)
    print(f"  Email: {email[:3]}...@{email.split('@')[1] if '@' in email else 'unknown'}", file=sys.stderr)
    print("", file=sys.stderr)

    # Determine Confluence URL
    if args.confluence_url:
        # User explicitly provided URL - use it
        confluence_url = normalize_confluence_url(args.confluence_url)
    else:
        # Build URL from host
        confluence_url = normalize_confluence_url(f"https://{args.host}")

    auth = HTTPBasicAuth(email, token)
    media_dir = Path(args.media_dir)
    markdown_file = Path(args.markdown_file)
    video_dir = Path(args.video_dir) if args.video_dir else media_dir / 'videos'

    # Step 1: Upload and get file IDs
    print("\n=== Step 1: Upload Screenshots ===", file=sys.stderr)
    file_mapping = upload_and_get_file_ids(confluence_url, args.page_id, media_dir, auth, IMAGE_EXTENSIONS, label="screenshots")

    if not file_mapping:
        print("ERROR: No files uploaded successfully", file=sys.stderr)
        sys.exit(1)

    video_file_mapping = {}
    if video_dir.is_dir():
        print("\n=== Step 1b: Upload Videos ===", file=sys.stderr)
        video_file_mapping = upload_and_get_file_ids(confluence_url, args.page_id, video_dir, auth, VIDEO_EXTENSIONS, label="videos")

    # Step 2: Build ADF with embedded images
    print("\n=== Step 2: Build ADF Document ===", file=sys.stderr)
    adf = build_adf_with_images(markdown_file, file_mapping, video_file_mapping, confluence_url, args.page_id)
    print(f"Built ADF with {len(file_mapping)} embedded images and {len(video_file_mapping)} linked videos", file=sys.stderr)

    # Step 3: Get current page version
    print("\n=== Step 3: Get Current Page Version ===", file=sys.stderr)
    get_url = f"{confluence_url}/wiki/api/v2/pages/{args.page_id}"

    try:
        page_resp = requests.get(get_url, auth=auth, timeout=30)
        page_resp.raise_for_status()
        page_data = page_resp.json()
        current_version = page_data.get('version', {}).get('number', 1)
        current_title = page_data.get('title', '[Sign-off] Updated')
        next_version = current_version + 1
        print(f"Current version: {current_version}, will update to: {next_version}", file=sys.stderr)
    except Exception as e:
        print(f"ERROR getting page version: {e}", file=sys.stderr)
        print("Defaulting to version 2", file=sys.stderr)
        next_version = 2
        current_title = "[Sign-off] Updated"

    # Step 4: Update Confluence page
    print("\n=== Step 4: Update Confluence Page ===", file=sys.stderr)
    update_url = f"{confluence_url}/wiki/api/v2/pages/{args.page_id}"

    version_message = f"Updated with {len(file_mapping)} embedded screenshots"
    if video_file_mapping:
        version_message += f" and {len(video_file_mapping)} videos"
    version_message += " via /dev-feature-signoff"

    payload = {
        "id": args.page_id,
        "status": "current",
        "title": current_title,  # Keep existing title
        "body": {
            "representation": "atlas_doc_format",
            "value": json.dumps(adf)
        },
        "version": {
            "number": next_version,
            "message": version_message
        }
    }

    try:
        resp = requests.put(update_url, json=payload, auth=auth, timeout=60)
        resp.raise_for_status()
        print("✅ Page updated successfully!", file=sys.stderr)
        print(f"🔗 {confluence_url}/wiki/spaces/ACV/pages/{args.page_id}", file=sys.stderr)
    except requests.exceptions.HTTPError as e:
        print(f"ERROR updating page: {e}", file=sys.stderr)
        print(f"Response: {e.response.text}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
