#!/bin/bash
# Test script for sample-activities-offers skill
# Can be run locally or in CI

set -e

SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SKILL_DIR"

echo "=== Testing sample-activities-offers skill ==="
echo

# Run consolidated validation
node validate.js

echo
echo "=== All tests passed! ==="
