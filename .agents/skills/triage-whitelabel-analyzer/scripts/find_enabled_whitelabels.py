#!/usr/bin/env python3
"""
Find all whitelabels where a specific feature is enabled.

Usage:
    python find_enabled_whitelabels.py <feature_name>

Example:
    python find_enabled_whitelabels.py ActivitiesRightHeaderItems
"""

import json
import sys
import requests
from typing import Dict, List, Set, Optional


API_BASE_URL = "https://whitelabel-service-api-prod.hk.agoda.is"


def fetch_config() -> dict:
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


def get_feature_id(config: dict, feature_name: str) -> Optional[int]:
    """Get feature ID by feature name."""
    return config.get('features', {}).get(feature_name)


def find_enabled_whitelabels(config: dict, feature_id: int) -> Dict[str, List[dict]]:
    """
    Find all whitelabels where a feature is enabled.

    Returns:
        Dictionary with:
        - 'global': List of rules applying to all whitelabels (whiteLabelId=0)
        - 'specific': List of {whiteLabelId, whiteLabelName, rule_details}
    """
    result = {
        'global': [],
        'specific': []
    }

    # Build whiteLabelId to name mapping
    wl_id_to_name = {}
    for wl in config.get('whiteLabels', []):
        wl_id_to_name[wl.get('whiteLabelId')] = wl.get('whiteLabelName')

    # Check all feature rules
    for rule in config.get('featuresRules', []):
        if rule.get('featureId') != feature_id:
            continue

        if not rule.get('isEnabled', False):
            continue

        rule_details = {
            'deviceTypeId': rule.get('deviceTypeId', 0),
            'origin': rule.get('origin', '*'),
            'experimentName': rule.get('experimentName'),
            'variant': rule.get('variant'),
            'originState': rule.get('originState')
        }

        wl_id = rule.get('whiteLabelId', 0)

        if wl_id == 0:
            # Global rule (applies to all)
            result['global'].append(rule_details)
        else:
            # Specific whitelabel
            result['specific'].append({
                'whiteLabelId': wl_id,
                'whiteLabelName': wl_id_to_name.get(wl_id, f"Unknown ({wl_id})"),
                'rule': rule_details
            })

    return result


def main():
    if len(sys.argv) != 2:
        print("Usage: python find_enabled_whitelabels.py <feature_name>")
        print("\nExample:")
        print("  python find_enabled_whitelabels.py ActivitiesRightHeaderItems")
        sys.exit(1)

    feature_name = sys.argv[1]

    # Fetch configuration from API
    config = fetch_config()

    # Get feature ID
    feature_id = get_feature_id(config, feature_name)
    if feature_id is None:
        print(f"Error: Feature '{feature_name}' not found", file=sys.stderr)
        sys.exit(1)

    # Find enabled whitelabels
    result = find_enabled_whitelabels(config, feature_id)

    # Display results
    print(f"\n{'='*80}")
    print(f"Feature: {feature_name} (ID: {feature_id})")
    print(f"{'='*80}\n")

    # Check for global rules
    has_global = len(result['global']) > 0
    if has_global:
        print("🌍 This feature has GLOBAL rules (enabled for ALL whitelabels)\n")

    # Specific whitelabels
    if result['specific']:
        # Group by whitelabel for cleaner output
        wl_groups = {}
        for item in result['specific']:
            wl_name = item['whiteLabelName']
            if wl_name not in wl_groups:
                wl_groups[wl_name] = []
            wl_groups[wl_name].append(item)

        # Sort by whitelabel name
        for wl_name in sorted(wl_groups.keys()):
            items = wl_groups[wl_name]
            wl_id = items[0]['whiteLabelId']
            print(f"  • {wl_name} (ID: {wl_id})")

            # Show rule details only if there are multiple rules or special conditions
            if len(items) > 1:
                for item in items:
                    rule = item['rule']
                    details = []
                    if rule['deviceTypeId'] != 0:
                        details.append(f"deviceType={rule['deviceTypeId']}")
                    if rule['origin'] != '*':
                        details.append(f"origin={rule['origin']}")
                    if rule['experimentName']:
                        details.append(f"experiment={rule['experimentName']}")

                    if details:
                        print(f"      - {', '.join(details)}")
    else:
        if not has_global:
            print("  No whitelabels found with this feature enabled")

    # Total count
    total_specific = len(set(item['whiteLabelId'] for item in result['specific']))

    print(f"\n{'='*80}")
    if has_global and total_specific > 0:
        print(f"Total: GLOBAL (all whitelabels) + {total_specific} specific whitelabel(s)")
    elif has_global:
        print(f"Total: GLOBAL (enabled for all whitelabels)")
    else:
        print(f"Total: {total_specific} whitelabel(s)")
    print(f"{'='*80}\n")


if __name__ == "__main__":
    main()
