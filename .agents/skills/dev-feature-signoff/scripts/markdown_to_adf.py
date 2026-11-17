#!/usr/bin/env python3
"""
Convert Markdown to Atlassian Document Format (ADF).

Supports:
- Headings (# ## ###)
- Paragraphs
- Lists (ordered and unordered)
- Tables
- Bold, italic, code
- Links
- Checkboxes [ ] [x]
"""

import re
import json
from typing import List, Dict, Any, Tuple


def parse_inline_marks(text: str) -> List[Dict[str, Any]]:
    """
    Parse inline formatting (bold, italic, code, links) into ADF text nodes.

    Returns list of text nodes with marks.
    """
    nodes = []

    # Simple implementation: split by formatting markers
    # For now, we'll do a basic pass - handle links, bold, italic, code

    # Handle links: [text](url)
    link_pattern = r'\[([^\]]+)\]\(([^\)]+)\)'

    # Split text by links
    parts = re.split(link_pattern, text)

    i = 0
    while i < len(parts):
        if i + 2 < len(parts) and parts[i + 1]:
            # This is a link - parts[i] is before, parts[i+1] is link text, parts[i+2] is URL
            if parts[i]:
                nodes.extend(_parse_simple_marks(parts[i]))

            # Add link node
            nodes.append({
                "type": "text",
                "text": parts[i + 1],
                "marks": [{"type": "link", "attrs": {"href": parts[i + 2]}}]
            })
            i += 3
        else:
            if parts[i]:
                nodes.extend(_parse_simple_marks(parts[i]))
            i += 1

    return nodes if nodes else [{"type": "text", "text": text}]


def _parse_simple_marks(text: str) -> List[Dict[str, Any]]:
    """Parse bold, italic, code from text segment."""
    # Simplified: just return as plain text
    # Full implementation would handle **bold**, *italic*, `code`

    # Handle bold: **text**
    if '**' in text:
        parts = text.split('**')
        nodes = []
        for i, part in enumerate(parts):
            if i % 2 == 1:  # Odd index = inside bold
                nodes.append({"type": "text", "text": part, "marks": [{"type": "strong"}]})
            elif part:
                nodes.append({"type": "text", "text": part})
        return nodes

    # Handle italic: *text* (but not **)
    if '*' in text and '**' not in text:
        parts = text.split('*')
        nodes = []
        for i, part in enumerate(parts):
            if i % 2 == 1:  # Odd index = inside italic
                nodes.append({"type": "text", "text": part, "marks": [{"type": "em"}]})
            elif part:
                nodes.append({"type": "text", "text": part})
        return nodes

    # Handle code: `text`
    if '`' in text:
        parts = text.split('`')
        nodes = []
        for i, part in enumerate(parts):
            if i % 2 == 1:  # Odd index = inside code
                nodes.append({"type": "text", "text": part, "marks": [{"type": "code"}]})
            elif part:
                nodes.append({"type": "text", "text": part})
        return nodes

    return [{"type": "text", "text": text}]


def parse_table(lines: List[str], start_idx: int) -> Tuple[Dict[str, Any], int]:
    """
    Parse markdown table into ADF table node.

    Returns (table_node, next_line_idx)
    """
    # Find table boundaries
    end_idx = start_idx
    while end_idx < len(lines) and lines[end_idx].strip().startswith('|'):
        end_idx += 1

    table_lines = lines[start_idx:end_idx]

    # Parse header
    header_line = table_lines[0]
    headers = [cell.strip() for cell in header_line.split('|')[1:-1]]  # Skip first and last empty

    # Skip separator line (line 1)
    # Parse data rows (line 2+)
    rows = []

    # Header row
    header_cells = []
    for header in headers:
        header_cells.append({
            "type": "tableHeader",
            "content": [{
                "type": "paragraph",
                "content": parse_inline_marks(header)
            }]
        })

    rows.append({"type": "tableRow", "content": header_cells})

    # Data rows
    for line in table_lines[2:]:  # Skip header and separator
        if not line.strip():
            continue

        cells = [cell.strip() for cell in line.split('|')[1:-1]]
        row_cells = []

        for cell in cells:
            # Handle checkboxes: [x] or [ ]
            # Only convert if cell contains ONLY checkbox (prevents accidental conversion of text like "version [x.y]")
            cell_stripped = cell.strip()
            if cell_stripped in ['[x]', '[X]', '☑', '✓', '✔']:
                cell = '✅'
            elif cell_stripped in ['[ ]', '☐']:
                cell = '⬜'

            row_cells.append({
                "type": "tableCell",
                "content": [{
                    "type": "paragraph",
                    "content": parse_inline_marks(cell) if cell else [{"type": "text", "text": ""}]
                }]
            })

        rows.append({"type": "tableRow", "content": row_cells})

    table_node = {
        "type": "table",
        "attrs": {"isNumberColumnEnabled": False, "layout": "default"},
        "content": rows
    }

    return table_node, end_idx


def parse_list(lines: List[str], start_idx: int) -> Tuple[Dict[str, Any], int]:
    """
    Parse markdown list into ADF list node.

    Returns (list_node, next_line_idx)
    """
    # Detect list type
    first_line = lines[start_idx].strip()
    is_ordered = first_line[0].isdigit()

    list_type = "orderedList" if is_ordered else "bulletList"

    items = []
    idx = start_idx

    while idx < len(lines):
        line = lines[idx].strip()

        # Check if still in list
        if not line:
            break

        if is_ordered and not line[0].isdigit():
            break

        if not is_ordered and not line.startswith(('-', '*', '+')):
            break

        # Extract list item text
        if is_ordered:
            # Remove "1. " prefix
            text = re.sub(r'^\d+\.\s*', '', line)
        else:
            # Remove "- " or "* " prefix
            text = re.sub(r'^[-*+]\s*', '', line)

        items.append({
            "type": "listItem",
            "content": [{
                "type": "paragraph",
                "content": parse_inline_marks(text)
            }]
        })

        idx += 1

    list_node = {
        "type": list_type,
        "content": items
    }

    return list_node, idx


def markdown_to_adf(markdown_text: str) -> Dict[str, Any]:
    """
    Convert markdown text to ADF document.

    Returns ADF JSON structure.
    """
    lines = markdown_text.split('\n')
    content = []

    idx = 0
    while idx < len(lines):
        line = lines[idx].strip()

        # Skip empty lines
        if not line:
            idx += 1
            continue

        # Heading
        if line.startswith('#'):
            level = len(re.match(r'^#+', line).group())
            text = line[level:].strip()
            content.append({
                "type": "heading",
                "attrs": {"level": min(level, 6)},
                "content": parse_inline_marks(text)
            })
            idx += 1

        # Table
        elif line.startswith('|'):
            table_node, next_idx = parse_table(lines, idx)
            content.append(table_node)
            idx = next_idx

        # Ordered list
        elif re.match(r'^\d+\.\s', line):
            list_node, next_idx = parse_list(lines, idx)
            content.append(list_node)
            idx = next_idx

        # Unordered list
        elif line.startswith(('-', '*', '+')):
            list_node, next_idx = parse_list(lines, idx)
            content.append(list_node)
            idx = next_idx

        # Code block
        elif line.startswith('```'):
            # Find end of code block
            end_idx = idx + 1
            while end_idx < len(lines) and not lines[end_idx].strip().startswith('```'):
                end_idx += 1

            code_lines = lines[idx + 1:end_idx]
            lang = line[3:].strip() or 'text'

            content.append({
                "type": "codeBlock",
                "attrs": {"language": lang},
                "content": [{
                    "type": "text",
                    "text": '\n'.join(code_lines)
                }]
            })

            idx = end_idx + 1

        # Horizontal rule
        elif line in ['---', '***', '___']:
            content.append({"type": "rule"})
            idx += 1

        # Paragraph (default)
        else:
            # Collect multi-line paragraphs
            para_lines = [line]
            idx += 1

            while idx < len(lines) and lines[idx].strip() and not lines[idx].strip().startswith(('#', '|', '-', '*', '+', '```')):
                # Check if next line is not a list item or heading
                next_line = lines[idx].strip()
                if not re.match(r'^\d+\.\s', next_line):
                    para_lines.append(next_line)
                    idx += 1
                else:
                    break

            para_text = ' '.join(para_lines)

            content.append({
                "type": "paragraph",
                "content": parse_inline_marks(para_text)
            })

    return {
        "version": 1,
        "type": "doc",
        "content": content
    }


if __name__ == '__main__':
    # Test
    sample_md = """# Test Document

## Section 1

This is a paragraph with **bold** and *italic* text.

- List item 1
- List item 2
- List item 3

## Section 2

| Column 1 | Column 2 |
|----------|----------|
| Value 1  | Value 2  |
| Value 3  | Value 4  |
"""

    adf = markdown_to_adf(sample_md)
    print(json.dumps(adf, indent=2))
