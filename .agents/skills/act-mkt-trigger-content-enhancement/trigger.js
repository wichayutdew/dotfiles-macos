// Content Enhancement Trigger
// Calls activity-marketing API to trigger GPT content enhancement for a list of activity IDs.
// Usage:
//   node trigger.js --ids-file=top-10k-activities.txt
//   node trigger.js --ids-file=top-10k-activities.txt --dry-run
//   node trigger.js --ids-file=top-10k-activities.txt --lookback-date=20260320 --api-url=https://...

const fs = require('fs');

// --- Arg parsing (no deps) ---

function parseArgs(argv = process.argv.slice(2)) {
  const flags = {};
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const [key, ...rest] = arg.slice(2).split('=');
      flags[key] = rest.length ? rest.join('=') : true;
    }
  }
  return flags;
}

// --- Config ---

function loadConfig(argv = process.argv.slice(2)) {
  const flags = parseArgs(argv);

  if (!flags['ids-file']) {
    console.error('Usage: node trigger.js --ids-file=<file> [--dry-run] [--lookback-date=YYYYMMDD] [--api-url=URL]');
    console.error('\nOptions:');
    console.error('  --ids-file       File with activity IDs (one per line, or CSV with activity_id column)');
    console.error('  --dry-run        Test without triggering actual workflows');
    console.error('  --lookback-date  Override lookback date (YYYYMMDD format, default: 17 days ago)');
    console.error('  --api-url        Activity-marketing API base URL');
    process.exit(1);
  }

  return {
    idsFile: flags['ids-file'],
    isDryRun: flags['dry-run'] === true,
    lookbackDate: flags['lookback-date'] ? parseInt(flags['lookback-date'], 10) : null,
    apiUrl: flags['api-url'] || 'https://activity-marketing-prod.privatecloud.hk.agoda.is',
  };
}

// --- Load activity IDs ---

function parseCsvRow(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function normalizeCsvValue(value) {
  return value.replace(/^"(.*)"$/, '$1').trim();
}

function loadActivityIds(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l);

  if (lines.length === 0) {
    console.error('Error: File is empty');
    process.exit(1);
  }

  // Detect CSV header
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes('activity_id') || firstLine.includes('activityid');
  let ids = [];

  if (hasHeader) {
    const header = parseCsvRow(lines[0]).map(value => normalizeCsvValue(value).toLowerCase());
    const activityIdIndex = header.findIndex(value => value === 'activity_id' || value === 'activityid');

    if (activityIdIndex === -1) {
      console.error('Error: CSV header must include an activity_id column');
      process.exit(1);
    }

    ids = lines
      .slice(1)
      .map(line => {
        const columns = parseCsvRow(line);
        const value = columns[activityIdIndex];
        return parseInt(normalizeCsvValue(value || ''), 10);
      })
      .filter(id => !isNaN(id) && id > 0);
  } else {
    ids = lines
      .map(line => parseInt(line, 10))
      .filter(id => !isNaN(id) && id > 0);
  }

  return ids;
}

// --- API call ---

async function triggerContentEnhancement(activityIds, config) {
  const url = `${config.apiUrl}/v2/seo/content-enhancement`;

  const body = {
    activityIds,
    isDryRun: config.isDryRun,
  };
  if (config.lookbackDate) {
    body.lookbackDate = config.lookbackDate;
  }

  console.log(`POST ${url}`);
  console.log(`  activityIds: ${activityIds.length} IDs`);
  console.log(`  isDryRun: ${config.isDryRun}`);
  if (config.lookbackDate) console.log(`  lookbackDate: ${config.lookbackDate}`);
  console.log('');

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API error ${response.status}: ${errorBody}`);
  }

  return response.json();
}

// --- Main ---

async function main() {
  const config = loadConfig();
  const activityIds = loadActivityIds(config.idsFile);
  console.log(`Loaded ${activityIds.length} activity IDs from ${config.idsFile}`);

  if (activityIds.length > 10000) {
    console.error(`Error: ${activityIds.length} IDs exceeds API limit of 10,000`);
    process.exit(1);
  }

  if (activityIds.length === 0) {
    console.error('Error: No valid activity IDs found in file');
    process.exit(1);
  }

  if (config.isDryRun) {
    console.log('[DRY RUN MODE]\n');
  }

  try {
    const result = await triggerContentEnhancement(activityIds, config);

    console.log('=== Content Enhancement Trigger Summary ===');
    console.log(`Input activity IDs:      ${result.input}`);
    console.log(`Successfully triggered:  ${result.totalTriggered}`);
    console.log(`Failed:                  ${result.totalFailed}`);
    const filtered = result.input - result.totalTriggered - result.totalFailed;
    if (filtered > 0) {
      console.log(`Not eligible (filtered): ${filtered}`);
      console.log(`  (Activities must be ingested within 17-day lookback window to be eligible)`);
    }

    if (config.isDryRun) {
      console.log('\n[DRY RUN] No workflows were actually triggered.');
      console.log('Remove --dry-run flag to trigger for real.');
    }

    process.exit(result.totalFailed > 0 ? 1 : 0);
  } catch (err) {
    console.error(`\nError: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  loadConfig,
  loadActivityIds,
  main,
  parseArgs,
  parseCsvRow,
};
