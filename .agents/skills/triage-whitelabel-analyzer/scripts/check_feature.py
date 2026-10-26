#!/usr/bin/env python3
"""
Check if a specific feature is enabled for a whitelabel.

Usage:
    python check_feature.py <feature_name> <whitelabel_id_or_name>

Example:
    python check_feature.py NotFoundSeoLinks 6301
    python check_feature.py NotFoundSeoLinks WestJetUat1
"""

import json
import sys
import requests
from typing import Optional


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


def get_feature_id(config: dict, feature_name: str) -> Optional[int]:
    """Get feature ID by feature name."""
    return config.get('features', {}).get(feature_name)


def get_whitelabel_id(config: dict, whitelabel_identifier: str) -> Optional[int]:
    """
    Get whitelabel ID from either numeric ID or name.

    Args:
        config: Configuration dict
        whitelabel_identifier: Either numeric ID or whitelabel name

    Returns:
        Whitelabel ID as integer, or None if not found
    """
    # Try as numeric ID first
    try:
        wl_id = int(whitelabel_identifier)
        # Verify it exists
        for wl in config.get('whiteLabels', []):
            if wl.get('whiteLabelId') == wl_id:
                return wl_id
    except ValueError:
        # Not numeric, search by name
        for wl in config.get('whiteLabels', []):
            if wl.get('whiteLabelName') == whitelabel_identifier:
                return wl.get('whiteLabelId')

    return None


def check_feature_enabled(config: dict, feature_id: int, whitelabel_id: int) -> dict:
    """
    Check if a feature is enabled for a specific whitelabel.

    Returns:
        Dictionary with enabled status and matching rules
    """
    matching_rules = []

    for rule in config.get('featuresRules', []):
        # Check if rule applies to this feature
        if rule.get('featureId') != feature_id:
            continue

        # Check if rule applies to this whitelabel (0 = all whitelabels)
        rule_wl_id = rule.get('whiteLabelId', 0)
        if rule_wl_id != 0 and rule_wl_id != whitelabel_id:
            continue

        matching_rules.append({
            'whiteLabelId': rule_wl_id,
            'deviceTypeId': rule.get('deviceTypeId', 0),
            'origin': rule.get('origin', '*'),
            'isEnabled': rule.get('isEnabled', False),
            'experimentName': rule.get('experimentName'),
            'variant': rule.get('variant'),
            'originState': rule.get('originState')
        })

    # Determine overall enabled status
    # More specific rules (non-zero whiteLabelId) take precedence
    enabled = False
    if matching_rules:
        # Sort by specificity (specific whiteLabelId rules first)
        sorted_rules = sorted(matching_rules, key=lambda r: (r['whiteLabelId'] == 0, r['origin'] == '*'))
        enabled = sorted_rules[0]['isEnabled']

    return {
        'enabled': enabled,
        'matching_rules': matching_rules,
        'rules_count': len(matching_rules)
    }


def main():
    if len(sys.argv) != 3:
        print("Usage: python check_feature.py <feature_name> <whitelabel_id_or_name>")
        print("\nExample:")
        print("  python check_feature.py NotFoundSeoLinks 6301")
        print("  python check_feature.py NotFoundSeoLinks WestJetUat1")
        sys.exit(1)

    feature_name = sys.argv[1]
    whitelabel_identifier = sys.argv[2]

    # Load configuration from API
    config = load_config()

    # Get feature ID
    feature_id = get_feature_id(config, feature_name)
    if feature_id is None:
        print(f"Error: Feature '{feature_name}' not found")
        sys.exit(1)

    # Get whitelabel ID
    whitelabel_id = get_whitelabel_id(config, whitelabel_identifier)
    if whitelabel_id is None:
        print(f"Error: Whitelabel '{whitelabel_identifier}' not found")
        sys.exit(1)

    # Check if feature is enabled
    result = check_feature_enabled(config, feature_id, whitelabel_id)

    # Display results
    print(f"\n{'='*60}")
    print(f"Feature: {feature_name} (ID: {feature_id})")
    print(f"Whitelabel: {whitelabel_identifier} (ID: {whitelabel_id})")
    print(f"{'='*60}")
    print(f"\nEnabled: {result['enabled']}")
    print(f"Matching Rules: {result['rules_count']}")

    if result['matching_rules']:
        print("\nRule Details:")
        for idx, rule in enumerate(result['matching_rules'], 1):
            print(f"\n  Rule {idx}:")
            print(f"    Whitelabel ID: {rule['whiteLabelId']} {'(all)' if rule['whiteLabelId'] == 0 else ''}")
            print(f"    Device Type ID: {rule['deviceTypeId']} {'(all)' if rule['deviceTypeId'] == 0 else ''}")
            print(f"    Origin: {rule['origin']}")
            print(f"    Enabled: {rule['isEnabled']}")
            if rule['experimentName']:
                print(f"    Experiment: {rule['experimentName']}")
                print(f"    Variant: {rule['variant']}")
            if rule['originState']:
                print(f"    Origin State: {rule['originState']}")
    else:
        print("\nNo matching rules found (feature not configured for this whitelabel)")

    print(f"\n{'='*60}\n")


if __name__ == "__main__":
    main()
