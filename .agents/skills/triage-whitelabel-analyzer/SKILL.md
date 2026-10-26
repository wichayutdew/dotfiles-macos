---
name: triage-whitelabel-analyzer
description: Analyze Agoda whitelabel feature configurations, check feature enablement, compare whitelabel configs, and find enabled whitelabels. Use when investigating whitelabel features, feature flags, whitelabel configurations, or debugging whitelabel-specific issues.
---

# Whitelabel Feature Configuration Analyzer

Utilities for analyzing Agoda whitelabel feature configurations using the Whitelabel Service API.

## Overview

This skill provides Python scripts to:

1. Check if specific features are enabled for whitelabels
2. Compare configurations between two whitelabels
3. Find all whitelabels where a feature is enabled

**Base API URL:** `https://whitelabel-service-api-prod.hk.agoda.is`


## Available Scripts

All scripts are located in the `scripts/` directory and fetch data directly from the production API in real-time.

### 1. Check Feature Enablement

Check if a specific feature is enabled for a whitelabel.

**Usage:**

```bash
python3 ${SKILL_ROOT}/scripts/check_feature.py <feature_name> <whitelabel_id_or_name>
```

**Examples:**

```bash
# By whitelabel ID
python3 ${SKILL_ROOT}/scripts/check_feature.py NotFoundSeoLinks 6301

# By whitelabel name
python3 ${SKILL_ROOT}/scripts/check_feature.py NotFoundSeoLinks WestJetUat1

# Check Activities features
python3 ${SKILL_ROOT}/scripts/check_feature.py ActivitiesRightHeaderItems 6401
```

**Output Includes:**

- Feature enabled status (boolean)
- Number of matching rules
- Detailed rule information:
  - Whitelabel ID (0 = applies to all)
  - Device Type ID (0 = all devices)
  - Origin filter
  - Experiment name and variant (if A/B testing)
  - Origin state

**When to Use:**

- Debugging why a feature appears/doesn't appear for a whitelabel
- Verifying feature flag configuration
- Understanding feature rollout status

---

### 2. Compare Whitelabel Configurations

Compare configurations between two whitelabels.

**Modes:**

#### Global Diff (Entire Configuration)

```bash
python3 ${SKILL_ROOT}/scripts/diff_whitelabels.py <whitelabel1> <whitelabel2>
```

**Examples:**

```bash
python3 ${SKILL_ROOT}/scripts/diff_whitelabels.py 6301 6302
python3 ${SKILL_ROOT}/scripts/diff_whitelabels.py WestJetUat1 AnotherWhitelabel
```

#### Local Diff (Specific Path)

Compare a specific nested property using dot notation:

```bash
python3 ${SKILL_ROOT}/scripts/diff_whitelabels.py <whitelabel1> <whitelabel2> --path <object.path>
```

**Common Paths:**

```bash
# Compare gateway URLs
python3 ${SKILL_ROOT}/scripts/diff_whitelabels.py 6301 6302 --path customDomains.gateway

# Compare help center configuration
python3 ${SKILL_ROOT}/scripts/diff_whitelabels.py WestJetUat1 6302 --path configuration.helpCenter

# Compare booking form URLs
python3 ${SKILL_ROOT}/scripts/diff_whitelabels.py 6301 6302 --path customDomains.bookingForm

# Compare activities booking form
python3 ${SKILL_ROOT}/scripts/diff_whitelabels.py 6301 6302 --path customDomains.activitiesBookingForm

# Compare behaviors
python3 ${SKILL_ROOT}/scripts/diff_whitelabels.py 6301 6302 --path behaviors

# Compare specific behavior with features
python3 ${SKILL_ROOT}/scripts/diff_whitelabels.py 6301 6302 --path behaviorWithFeatures
```

**Output Shows:**

- Values changed (old vs new)
- Items added to whitelabel 2
- Items removed from whitelabel 2
- Type changes
- Array differences

**When to Use:**

- Understanding configuration differences between partners
- Debugging whitelabel-specific behavior differences
- Preparing configuration for new whitelabel
- Auditing configuration changes

---

### 3. Find Whitelabels with Enabled Feature

Find all whitelabels where a specific feature is enabled.

**Usage:**

```bash
python3 ${SKILL_ROOT}/scripts/find_enabled_whitelabels.py <feature_name>
```

**Examples:**

```bash
python3 ${SKILL_ROOT}/scripts/find_enabled_whitelabels.py ActivitiesRightHeaderItems
python3 ${SKILL_ROOT}/scripts/find_enabled_whitelabels.py NotFoundSeoLinks
python3 ${SKILL_ROOT}/scripts/find_enabled_whitelabels.py ActivityAttractionDetailsDeeplink
```

**Output Includes:**

- List of specific whitelabels with the feature enabled
- Rule details (device type, origin, experiment info)
- Summary count

**When to Use:**

- Understanding feature rollout scope
- Finding test whitelabels for a feature
- Auditing feature enablement across partners
- Planning feature deprecation

---

## API Endpoints Reference

### Feature Configuration API

**URL:** `https://whitelabel-service-api-prod.hk.agoda.is/api/v4/feature-configuration`

**Response Structure:**

- `features`: Object mapping feature names to IDs
- `featuresRules`: Array of feature rules (whitelabel + feature + conditions)
- `whiteLabels`: Array of detailed whitelabel configurations
- `version`: Timestamp-based version identifier

### Whitelabels API

**URL:** `https://whitelabel-service-api-prod.hk.agoda.is/api/v4/white-labels`

**Returns:** Array of whitelabels with:

- `key`: UUID identifier
- `id`: Numeric whitelabel ID
- `name`: Whitelabel name
- `isRmPartner`: Revenue management partner flag
- `isEnterprisePartner`: Enterprise partner flag

---

## Key Concepts

### Feature Rules

Each feature rule contains:

- `featureId`: Reference to feature
- `whiteLabelId`: Target whitelabel
- `deviceTypeId`: Target device (0 = all devices)
- `origin`: Origin filter ("*" = all origins)
- `isEnabled`: Boolean flag
- `experimentName`: A/B test experiment name (obselete, optional)
- `variant`: Experiment variant (obselete, optional)
- `originState`: Additional origin state filter (optional)

### Rule Priority

More specific rules take precedence:

1. Rules with specific `origin` override `origin="*"`
2. Rules with specific `deviceTypeId` override `deviceTypeId=0`

### Whitelabel Configuration Paths

Important configuration paths for diff operations:

- `customDomains.gateway`: Gateway API URL
- `customDomains.mainSite`: Main site URL
- `customDomains.bookingForm`: Booking form URL
- `customDomains.activitiesBookingForm`: Activities booking form URL
- `configuration.helpCenter`: Help center settings
- `configuration.userManageBooking`: User booking management settings
- `behaviors`: Behavior flags
- `behaviorWithFeatures`: Client-specific behavior configurations

---

## Workflow Examples

### Example 1: Debug Missing Feature

**Scenario:** Partner reports a feature isn't showing up

```bash
# Step 1: Check if feature is enabled for their whitelabel
python3 ${SKILL_ROOT}/scripts/check_feature.py ActivitiesRightHeaderItems 6401

# Step 2: If disabled, find which whitelabels have it enabled
python3 ${SKILL_ROOT}/scripts/find_enabled_whitelabels.py ActivitiesRightHeaderItems

# Step 3: Compare config with a working whitelabel
python3 ${SKILL_ROOT}/scripts/diff_whitelabels.py 6401 6301 --path behaviorWithFeatures
```

### Example 2: Feature Rollout Audit

**Scenario:** Verify feature is enabled only for pilot whitelabels

```bash
# Find all whitelabels with feature enabled
python3 ${SKILL_ROOT}/scripts/find_enabled_whitelabels.py NewExperimentalFeature

# Verify specific whitelabels
python3 ${SKILL_ROOT}/scripts/check_feature.py NewExperimentalFeature 6401
python3 ${SKILL_ROOT}/scripts/check_feature.py NewExperimentalFeature 6402
```

---

## Tips

### Feature Name Discovery
If unsure of exact feature name, fetch from API:
```bash
curl -s "https://whitelabel-service-api-prod.hk.agoda.is/api/v4/feature-configuration" | jq '.features | keys'
```

### Performance
- Scripts fetch data in real-time from API
- Typical response time: 1-3 seconds
- No caching - always gets latest configuration

### Error Handling
- Feature not found: Check exact spelling (case-sensitive)
- Whitelabel not found: Verify ID or name exists
- Network errors: Check VPN connection to Agoda network

---

## Important Notes

- Feature names are case-sensitive

---

## Troubleshooting

**Feature not found:**

- Verify exact feature name (case-sensitive)
- List all features using API to find correct name

**Whitelabel not found:**

- Verify whitelabel ID or name
- Check if whitelabel exists in the system
