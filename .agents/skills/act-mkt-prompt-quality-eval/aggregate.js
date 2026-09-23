// Weighted Aggregation — Calculate total_mark and summary stats
// Usage: node aggregate.js [component] [lang_id]
//   If no args provided, aggregates all scored-*.csv files in OUTPUT_DIR
// Env vars:
//   OUTPUT_DIR — output directory (required)
//   WEIGHTS    — JSON object of dimension weights (optional, default below)

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = process.env.OUTPUT_DIR;
if (!OUTPUT_DIR) { console.error('OUTPUT_DIR env var is required'); process.exit(1); }

const outputDir = path.resolve(OUTPUT_DIR);
const DEFAULT_WEIGHTS = { fluency: 0.20, grammar: 0.15, structure: 0.15, relevance: 0.25, completeness: 0.15, tone: 0.10 };
const WEIGHTS = process.env.WEIGHTS ? JSON.parse(process.env.WEIGHTS) : DEFAULT_WEIGHTS;
const DIMS = Object.keys(WEIGHTS);

function parseCSVRow(row) {
  const fields = []; let current = ''; let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (inQuotes) {
      if (ch === '"' && row[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { fields.push(current); current = ''; }
      else { current += ch; }
    }
  }
  fields.push(current);
  return fields;
}

function csvEscape(str) {
  if (!str) return '';
  str = String(str).replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (str.includes(',') || str.includes('"')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function aggregateScoredCsv(scoredCsvPath) {
  const basename = path.basename(scoredCsvPath, '.csv'); // e.g., "scored-title-1"
  const match = basename.match(/^scored-(.+)-(\d+)$/);
  if (!match) {
    console.warn(`Skipping unrecognized file: ${basename}`);
    return;
  }
  const [, component, langId] = match;
  const summaryCsvPath = path.join(outputDir, `summary-${component}-${langId}.csv`);

  console.log(`\n[${component}-${langId}] Reading: ${scoredCsvPath}`);
  const lines = fs.readFileSync(scoredCsvPath, 'utf-8').split('\n').filter(l => l.trim());
  const header = parseCSVRow(lines[0]);
  const dataRows = lines.slice(1);

  // Map header names to indices
  const colIdx = {};
  header.forEach((h, i) => { colIdx[h.trim()] = i; });

  // Output header: insert total_mark after language_id
  const outHeader = 'activity_id,component,language_id,total_mark,fluency,grammar,structure,relevance,completeness,tone,score_mode,score_error';
  const outLines = [outHeader];

  const sums = {};
  DIMS.forEach(d => { sums[d] = 0; });
  let totalMarkSum = 0;
  let validCount = 0;

  for (const line of dataRows) {
    const fields = parseCSVRow(line);
    const activityId = fields[colIdx['activity_id']];
    const comp = fields[colIdx['component']];
    const langIdStr = fields[colIdx['language_id']];
    const scoreMode = fields[colIdx['score_mode']] || '';
    const scoreError = fields[colIdx['score_error']] || '';

    const scores = {};
    let hasScores = false;
    for (const d of DIMS) {
      const val = Number(fields[colIdx[d]]) || 0;
      scores[d] = val;
      if (val > 0) hasScores = true;
    }

    let totalMark = 0;
    if (hasScores) {
      for (const d of DIMS) {
        totalMark += scores[d] * WEIGHTS[d];
      }
      totalMark = Math.round(totalMark * 10) / 10;
      validCount++;
      DIMS.forEach(d => { sums[d] += scores[d]; });
      totalMarkSum += totalMark;
    }

    const row = [
      activityId, comp, langIdStr, totalMark,
      scores.fluency, scores.grammar, scores.structure,
      scores.relevance, scores.completeness, scores.tone,
      scoreMode, csvEscape(scoreError)
    ].join(',');
    outLines.push(row);
  }

  fs.writeFileSync(summaryCsvPath, outLines.join('\n') + '\n');

  console.log(`\n[${component}-${langId}] === AGGREGATION COMPLETE ===`);
  console.log(`[${component}-${langId}] Valid: ${validCount}/${dataRows.length}`);
  console.log(`[${component}-${langId}] Weights: ${DIMS.map(d => `${d}(${(WEIGHTS[d] * 100).toFixed(0)}%)`).join(' + ')}`);
  console.log(`[${component}-${langId}] Averages:`);
  console.log(`  ${'total_mark'.padEnd(15)} ${validCount > 0 ? (totalMarkSum / validCount).toFixed(1) : 0}`);
  DIMS.forEach(d => {
    const avg = validCount > 0 ? (sums[d] / validCount).toFixed(1) : 0;
    console.log(`  ${d.padEnd(15)} ${avg}`);
  });
  console.log(`[${component}-${langId}] Output: ${summaryCsvPath}`);
}

// Main
(() => {
  const args = process.argv.slice(2);
  let filesToAggregate = [];

  if (args.length === 2) {
    // Aggregate specific component + lang_id
    const [component, langId] = args;
    const scoredCsvPath = path.join(outputDir, `scored-${component}-${langId}.csv`);
    if (!fs.existsSync(scoredCsvPath)) {
      console.error(`ERROR: ${scoredCsvPath} not found`);
      process.exit(1);
    }
    filesToAggregate = [scoredCsvPath];
  } else if (args.length === 0) {
    // Aggregate all scored-*.csv files
    const files = fs.readdirSync(outputDir);
    filesToAggregate = files
      .filter(f => f.startsWith('scored-') && f.endsWith('.csv'))
      .map(f => path.join(outputDir, f));
    if (filesToAggregate.length === 0) {
      console.error('ERROR: No scored-*.csv files found in OUTPUT_DIR');
      process.exit(1);
    }
  } else {
    console.error('Usage: node aggregate.js [component] [lang_id]');
    console.error('  If no args, aggregates all scored-*.csv files in OUTPUT_DIR');
    process.exit(1);
  }

  console.log(`Aggregating ${filesToAggregate.length} file(s)`);

  for (const file of filesToAggregate) {
    aggregateScoredCsv(file);
  }

  console.log('\n=== ALL FILES AGGREGATED ===');
})();
