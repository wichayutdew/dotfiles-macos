#!/usr/bin/env python3
"""
Compare configurations between two whitelabels.

Supports two modes:
1. Global diff: Compare entire configuration
2. Local diff: Compare specific path (e.g., customDomains.gateway)

Usage:
    # Global diff
    python diff_whitelabels.py <whitelabel1> <whitelabel2>

    # Local diff with path
    python diff_whitelabels.py <whitelabel1> <whitelabel2> --path <object.path>

Example:
    python diff_whitelabels.py 6301 6302
    python diff_whitelabels.py WestJetUat1 6302 --path customDomains.gateway
    python diff_whitelabels.py 6301 6302 --path configuration.helpCenter
"""

import json
import sys
import requests
from typing import Any, Optional, Dict, List, Tuple
from deepdiff import DeepDiff


API_BASE_URL = "https://whitelabel-service-api-prod.hk.agoda.is"


def load_config():
    """Fetch the feature configuration from API."""
    url = f"{API_BASE_URL}/api/v4/feature-configuration"
    print(f"Fetching configuration from {url}...", file=sys.stderr)

    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"Error fetching configuration: {e}", file=sys.stderr)
        sys.exit(1)


def get_whitelabel(config: dict, whitelabel_identifier: str) -> Optional[dict]:
    """
    Get whitelabel configuration by ID or name.

    Args:
        config: Configuration dict
        whitelabel_identifier: Either numeric ID or whitelabel name

    Returns:
        Whitelabel configuration dict, or None if not found
    """
    # Try as numeric ID first
    try:
        wl_id = int(whitelabel_identifier)
        for wl in config.get('whiteLabels', []):
            if wl.get('whiteLabelId') == wl_id:
                return wl
    except ValueError:
        # Not numeric, search by name
        for wl in config.get('whiteLabels', []):
            if wl.get('whiteLabelName') == whitelabel_identifier:
                return wl

    return None


def get_nested_value(obj: dict, path: str) -> Tuple[Any, bool]:
    """
    Get value from nested object using dot notation path.

    Args:
        obj: The object to traverse
        path: Dot-separated path (e.g., "customDomains.gateway")

    Returns:
        Tuple of (value, found) where found indicates if path exists
    """
    keys = path.split('.')
    current = obj

    for key in keys:
        if isinstance(current, dict) and key in current:
            current = current[key]
        else:
            return None, False

    return current, True


def format_diff_output(diff: DeepDiff, path: Optional[str] = None) -> str:
    """Format DeepDiff output in a readable way."""
    if not diff:
        return "No differences found"

    output = []

    # Values changed
    if 'values_changed' in diff:
        output.append("\n📝 VALUES CHANGED:")
        for key, change in diff['values_changed'].items():
            output.append(f"  {key}")
            output.append(f"    Old: {change['old_value']}")
            output.append(f"    New: {change['new_value']}")

    # Items added
    if 'dictionary_item_added' in diff:
        output.append("\n➕ ITEMS ADDED (in whitelabel 2):")
        for item in diff['dictionary_item_added']:
            output.append(f"  {item}")

    # Items removed
    if 'dictionary_item_removed' in diff:
        output.append("\n➖ ITEMS REMOVED (from whitelabel 2):")
        for item in diff['dictionary_item_removed']:
            output.append(f"  {item}")

    # Type changes
    if 'type_changes' in diff:
        output.append("\n🔄 TYPE CHANGES:")
        for key, change in diff['type_changes'].items():
            output.append(f"  {key}")
            output.append(f"    Old type: {change['old_type']}")
            output.append(f"    New type: {change['new_type']}")

    # Iterable changes
    if 'iterable_item_added' in diff:
        output.append("\n➕ ARRAY ITEMS ADDED:")
        for key, value in diff['iterable_item_added'].items():
            output.append(f"  {key}: {value}")

    if 'iterable_item_removed' in diff:
        output.append("\n➖ ARRAY ITEMS REMOVED:")
        for key, value in diff['iterable_item_removed'].items():
            output.append(f"  {key}: {value}")

    return '\n'.join(output) if output else "No differences found"


def global_diff(wl1: dict, wl2: dict) -> str:
    """Perform global diff on entire whitelabel configurations."""
    diff = DeepDiff(
        wl1,
        wl2,
        ignore_order=True,
        verbose_level=2,
        exclude_paths=["root['whiteLabelId']", "root['whiteLabelName']", "root['whiteLabelKey']"]
    )

    return format_diff_output(diff)


def local_diff(wl1: dict, wl2: dict, path: str) -> str:
    """Perform local diff on a specific path within whitelabel configurations."""
    value1, found1 = get_nested_value(wl1, path)
    value2, found2 = get_nested_value(wl2, path)

    if not found1 and not found2:
        return f"Path '{path}' not found in either whitelabel"
    elif not found1:
        return f"Path '{path}' not found in whitelabel 1"
    elif not found2:
        return f"Path '{path}' not found in whitelabel 2"

    # Both values exist, compare them
    if value1 == value2:
        return f"No differences at path '{path}'"

    # Show the values
    output = [f"\nValues at path '{path}':"]
    output.append(f"\nWhitelabel 1:")
    output.append(f"{json.dumps(value1, indent=2)}")
    output.append(f"\nWhitelabel 2:")
    output.append(f"{json.dumps(value2, indent=2)}")

    # If both are dicts or lists, do a deep diff
    if isinstance(value1, (dict, list)) and isinstance(value2, (dict, list)):
        diff = DeepDiff(value1, value2, ignore_order=True, verbose_level=2)
        output.append(f"\nDetailed Diff:")
        output.append(format_diff_output(diff, path))

    return '\n'.join(output)


def main():
    if len(sys.argv) < 3:
        print("Usage: python diff_whitelabels.py <whitelabel1> <whitelabel2> [--path <object.path>]")
        print("\nExamples:")
        print("  python diff_whitelabels.py 6301 6302")
        print("  python diff_whitelabels.py WestJetUat1 6302 --path customDomains.gateway")
        print("  python diff_whitelabels.py 6301 6302 --path configuration.helpCenter")
        sys.exit(1)

    wl1_identifier = sys.argv[1]
    wl2_identifier = sys.argv[2]

    # Check for --path argument
    path = None
    if len(sys.argv) >= 5 and sys.argv[3] == '--path':
        path = sys.argv[4]

    # Load configuration from API
    config = load_config()

    # Get whitelabels
    wl1 = get_whitelabel(config, wl1_identifier)
    if wl1 is None:
        print(f"Error: Whitelabel '{wl1_identifier}' not found")
        sys.exit(1)

    wl2 = get_whitelabel(config, wl2_identifier)
    if wl2 is None:
        print(f"Error: Whitelabel '{wl2_identifier}' not found")
        sys.exit(1)

    # Display header
    print(f"\n{'='*80}")
    print(f"Whitelabel Configuration Comparison")
    print(f"{'='*80}")
    print(f"Whitelabel 1: {wl1.get('whiteLabelName')} (ID: {wl1.get('whiteLabelId')})")
    print(f"Whitelabel 2: {wl2.get('whiteLabelName')} (ID: {wl2.get('whiteLabelId')})")

    if path:
        print(f"Path: {path}")
        print(f"{'='*80}")
        result = local_diff(wl1, wl2, path)
    else:
        print(f"Mode: Global Diff")
        print(f"{'='*80}")
        result = global_diff(wl1, wl2)

    print(result)
    print(f"\n{'='*80}\n")


if __name__ == "__main__":
    main()
