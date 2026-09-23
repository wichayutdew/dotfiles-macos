// Content Quality Aggregation — Calculate weighted total_mark and summary stats
// Usage: node aggregate.js <locale>
// Env vars:
//   OUTPUT_DIR — output directory (required, e.g., content-quality/ACTB-2314-xxx)
//   RUN_TAG    — optional tag for input/output filenames (e.g., "indonesia")
//   WEIGHTS    — JSON object of dimension weights (optional, default below)

const fs = require('fs');
const path = require('path');

const locale = process.argv[2];
if (!locale) { console.error('Usage: node aggregate.js <locale>'); process.exit(1); }

const OUTPUT_DIR = process.env.OUTPUT_DIR;
if (!OUTPUT_DIR) { console.error('OUTPUT_DIR env var is required'); process.exit(1); }

const DEFAULT_WEIGHTS = { fluency: 0.20, grammar: 0.15, structure: 0.15, relevance: 0.25, completeness: 0.15, tone: 0.10 };
const WEIGHTS = process.env.WEIGHTS ? JSON.parse(process.env.WEIGHTS) : DEFAULT_WEIGHTS;
const DIMS = Object.keys(WEIGHTS);

const outputDir = path.resolve(OUTPUT_DIR);
const tag = process.env.RUN_TAG ? `-${process.env.RUN_TAG}` : '';
const INPUT_CSV = path.join(outputDir, `scored${tag}-${locale}.csv`);
const OUTPUT_CSV = path.join(outputDir, `summary${tag}-${locale}.csv`);

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

console.log(`[${locale}] Reading: ${INPUT_CSV}`);
const lines = fs.readFileSync(INPUT_CSV, 'utf-8').split('\n').filter(l => l.trim());
const header = parseCSVRow(lines[0]);
const dataRows = lines.slice(1);

// Map header names to indices
const colIdx = {};
header.forEach((h, i) => { colIdx[h.trim()] = i; });

// Scored CSV columns: activity_id,fluency,grammar,structure,relevance,completeness,tone,a_title,b_title,a_section_names,b_section_names,score_error
const outHeader = 'activity_id,total_mark,fluency,grammar,structure,relevance,completeness,tone,a_title,b_title,a_section_names,b_section_names,score_error';
const outLines = [outHeader];

const sums = {};
DIMS.forEach(d => { sums[d] = 0; });
let totalMarkSum = 0;
let validCount = 0;

for (const line of dataRows) {
  const fields = parseCSVRow(line);
  const activityId = fields[colIdx['activity_id']];
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
    activityId, totalMark,
    scores.fluency, scores.grammar, scores.structure,
    scores.relevance, scores.completeness, scores.tone,
    csvEscape(fields[colIdx['a_title']]),
    csvEscape(fields[colIdx['b_title']]),
    csvEscape(fields[colIdx['a_section_names']]),
    csvEscape(fields[colIdx['b_section_names']]),
    csvEscape(scoreError),
  ].join(',');
  outLines.push(row);
}

fs.writeFileSync(OUTPUT_CSV, outLines.join('\n') + '\n');

console.log(`\n[${locale}] === AGGREGATION COMPLETE ===`);
console.log(`[${locale}] Valid: ${validCount}/${dataRows.length}`);
console.log(`[${locale}] Weights: ${DIMS.map(d => `${d}(${(WEIGHTS[d] * 100).toFixed(0)}%)`).join(' + ')}`);
console.log(`[${locale}] Averages:`);
console.log(`  ${'total_mark'.padEnd(15)} ${validCount > 0 ? (totalMarkSum / validCount).toFixed(1) : 0}`);
DIMS.forEach(d => {
  const avg = validCount > 0 ? (sums[d] / validCount).toFixed(1) : 0;
  console.log(`  ${d.padEnd(15)} ${avg}`);
});
console.log(`[${locale}] Output: ${OUTPUT_CSV}`);
