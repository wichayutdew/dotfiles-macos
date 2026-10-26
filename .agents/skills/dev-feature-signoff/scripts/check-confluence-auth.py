#!/usr/bin/env python3
"""Check Confluence authentication from config file."""
import sys
import yaml
import requests
from pathlib import Path
from requests.auth import HTTPBasicAuth


def check_auth(config_path: str, host: str) -> int:
    """
    Check if Confluence credentials are valid.

    Args:
        config_path: Path to YAML config file
        host: Confluence host (e.g., agoda.atlassian.net)

    Returns:
        0 if valid, 1 if invalid, 2 if config missing
    """
    config_file = Path(config_path).expanduser()

    if not config_file.exists():
        print(f"❌ Config not found: {config_path}")
        print(f"   Run: {Path(__file__).parent}/save-confluence-credentials.sh")
        return 2

    with open(config_file) as f:
        config = yaml.safe_load(f)

    if not config or "hosts" not in config:
        print(f"❌ Invalid config format in: {config_path}")
        return 2

    if host not in config.get("hosts", {}):
        print(f"❌ Host {host} not in config")
        print(f"   Available hosts: {', '.join(config['hosts'].keys())}")
        return 2

    host_config = config["hosts"][host]
    email = host_config.get("email")
    token = host_config.get("token")
    wiki_path = host_config.get("wiki_path", "/wiki")

    if not email or not token:
        print(f"❌ Missing email or token for host: {host}")
        return 2

    # Test auth with simple API call
    url = f"https://{host}{wiki_path}/rest/api/user/current"
    try:
        response = requests.get(url, auth=HTTPBasicAuth(email, token), timeout=10)
    except requests.exceptions.RequestException as e:
        print(f"❌ Connection failed: {e}")
        return 1

    if response.status_code == 200:
        user = response.json()
        print(f"✅ Authenticated as: {user.get('displayName', email)}")
        print(f"   Email: {user.get('email', email)}")
        return 0
    else:
        print(f"❌ Authentication failed: HTTP {response.status_code}")
        if response.status_code == 401:
            print("   Token may be expired. Regenerate at:")
            print("   https://id.atlassian.com/manage-profile/security/api-tokens")
        return 1


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: check-confluence-auth.py <config_path> <host>")
        print("Example: check-confluence-auth.py ~/.confluence/feature-sign-off-publish-config.yml agoda.atlassian.net")
        sys.exit(1)

    sys.exit(check_auth(sys.argv[1], sys.argv[2]))
