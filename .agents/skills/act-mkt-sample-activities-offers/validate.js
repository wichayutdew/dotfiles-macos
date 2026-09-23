#!/usr/bin/env node
// Consolidated validation for act-mkt-sample-activities-offers skill
// Validates SKILL.md and evals.json in a single pass

const fs = require('fs');
const path = require('path');

const SKILL_DIR = process.cwd();
const SKILL_MD = path.join(SKILL_DIR, 'SKILL.md');
const EVALS_JSON = path.join(SKILL_DIR, 'evals', 'evals.json');
const QUERIES_SQL = path.join(SKILL_DIR, 'queries.sql');

let errors = [];

// Validate SKILL.md (single read)
try {
  const skillMd = fs.readFileSync(SKILL_MD, 'utf-8');

  if (!skillMd.match(/^---\s*$/m)) {
    errors.push('SKILL.md: missing frontmatter delimiter');
  }

  const nameMatch = skillMd.match(/^name:\s*(.+?)\s*$/m);
  if (!nameMatch) {
    errors.push('SKILL.md: missing name field');
  } else if (nameMatch[1] !== 'act-mkt-sample-activities-offers') {
    errors.push(`SKILL.md: incorrect name field (expected act-mkt-sample-activities-offers, got ${nameMatch[1]})`);
  }

  if (!skillMd.match(/^description:/m)) {
    errors.push('SKILL.md: missing description field');
  }

  if (errors.length === 0) {
    console.log('✓ SKILL.md validated');
  }
} catch (err) {
  errors.push(`SKILL.md: ${err.message}`);
}

try {
  const queriesSql = fs.readFileSync(QUERIES_SQL, 'utf-8');
  if (!queriesSql.includes('top_bookings_activity_only')) {
    errors.push('queries.sql: missing top_bookings_activity_only template');
  }
  if (!queriesSql.includes('top_bookings_activity_offer')) {
    errors.push('queries.sql: missing top_bookings_activity_offer template');
  }
  if (!queriesSql.includes('stratified_geography_activity_only')) {
    errors.push('queries.sql: missing stratified_geography_activity_only template');
  }
  if (!queriesSql.includes('stratified_geography_activity_offer')) {
    errors.push('queries.sql: missing stratified_geography_activity_offer template');
  }
  if (!queriesSql.includes('stratified_category_activity_only')) {
    errors.push('queries.sql: missing stratified_category_activity_only template');
  }
  if (!queriesSql.includes('stratified_category_activity_offer')) {
    errors.push('queries.sql: missing stratified_category_activity_offer template');
  }
  if (errors.length === 0 || errors.every(e => !e.startsWith('queries.sql:'))) {
    console.log('✓ queries.sql validated');
  }
} catch (err) {
  errors.push(`queries.sql: ${err.message}`);
}

// Validate evals.json (single read)
try {
  const evalsContent = fs.readFileSync(EVALS_JSON, 'utf-8');
  const evals = JSON.parse(evalsContent);

  if (!evals.skill_name) {
    errors.push('evals.json: missing skill_name field');
  } else if (evals.skill_name !== 'act-mkt-sample-activities-offers') {
    errors.push(`evals.json: incorrect skill_name (expected act-mkt-sample-activities-offers, got ${evals.skill_name})`);
  }

  if (!Array.isArray(evals.evals)) {
    errors.push('evals.json: evals must be an array');
  } else {
    evals.evals.forEach((e, i) => {
      if (typeof e.id !== 'number') {
        errors.push(`evals.json: eval ${i} has invalid id (must be number)`);
      }
      if (typeof e.prompt !== 'string' || e.prompt.length === 0) {
        errors.push(`evals.json: eval ${i} has invalid or empty prompt`);
      }
      if (typeof e.expected_output !== 'string') {
        errors.push(`evals.json: eval ${i} has invalid expected_output`);
      }
      if (!Array.isArray(e.files)) {
        errors.push(`evals.json: eval ${i} has invalid files array`);
      }
    });

    if (errors.length === 0 || errors.every(e => !e.startsWith('evals.json:'))) {
      console.log(`✓ evals.json validated (${evals.evals.length} evals)`);
    }
  }
} catch (err) {
  if (err.code === 'ENOENT') {
    errors.push('evals.json: file not found');
  } else if (err instanceof SyntaxError) {
    errors.push(`evals.json: invalid JSON - ${err.message}`);
  } else {
    errors.push(`evals.json: ${err.message}`);
  }
}

// Report results
if (errors.length > 0) {
  console.error('\n❌ Validation failed:\n');
  errors.forEach(err => console.error(`  - ${err}`));
  process.exit(1);
}

console.log('\n✓ All validations passed');
