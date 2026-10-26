#!/usr/bin/env bash
# Save Confluence credentials to config file
# Usage: ./save-confluence-credentials.sh <email> <token> <host>

set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 <email> <token> <host>"
  echo "Example: $0 user@agoda.com token123 agoda.atlassian.net"
  exit 1
fi

EMAIL="${1}"
TOKEN="${2}"
HOST="${3}"
CONFIG_FILE="${HOME}/.confluence/feature-sign-off-publish-config.yml"

# Validate inputs
if [[ ! "${EMAIL}" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
  echo "❌ Invalid email format: ${EMAIL}"
  exit 1
fi

if [[ -z "${TOKEN}" ]]; then
  echo "❌ Token cannot be empty"
  exit 1
fi

# Test credentials before saving
echo "Testing credentials..."
RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
  -u "${EMAIL}:${TOKEN}" \
  "https://${HOST}/wiki/rest/api/user/current" || echo "000")

if [[ "${RESPONSE}" != "200" ]]; then
  echo "❌ Credential validation failed (HTTP ${RESPONSE})"
  if [[ "${RESPONSE}" == "401" ]]; then
    echo "   Check your email and token"
  elif [[ "${RESPONSE}" == "000" ]]; then
    echo "   Connection failed - check host: ${HOST}"
  fi
  exit 1
fi

# Create directory
mkdir -p "$(dirname "${CONFIG_FILE}")"

# Save to YAML config
cat > "${CONFIG_FILE}" <<EOF
# Confluence Publishing Configuration
# Generated: $(date)
# DO NOT commit this file to version control

hosts:
  ${HOST}:
    email: ${EMAIL}
    token: ${TOKEN}
    wiki_path: /wiki
EOF

# Set restrictive permissions
chmod 600 "${CONFIG_FILE}"

echo "✅ Credentials saved to ${CONFIG_FILE}"
echo "   Permissions: $(stat -f '%A' "${CONFIG_FILE}" 2>/dev/null || stat -c '%a' "${CONFIG_FILE}" 2>/dev/null)"
echo ""
echo "Verify with:"
echo "  $(dirname "$0")/check-confluence-auth.py ${CONFIG_FILE} ${HOST}"
exit 0
