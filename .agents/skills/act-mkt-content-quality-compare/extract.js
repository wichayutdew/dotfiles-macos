// Content Quality Extraction — Multi-language, full-section version
// Usage: node extract.js <locale>
// Env vars:
//   OUTPUT_DIR   — output directory (required, e.g., content-quality/ACTB-2314-xxx)
//   IDS_FILE     — path to activity IDs file relative to OUTPUT_DIR (default: sample-ids.txt)
//   RUN_TAG      — optional tag for output filenames (e.g., "indonesia" → results-indonesia-<locale>.csv)
//   EXP_ID       — experiment ID (e.g., ACTB-2314). Auto-constructs A/B params.
//   EXP_CONTROL  — control param override (default: expUser=B)
//   EXP_VARIANT  — variant letter (default: B)
//   EXP_PARAM_A  — full override for A-side param (default: auto from EXP_CONTROL)
//   EXP_PARAM_B  — full override for B-side param (default: auto from EXP_ID + EXP_VARIANT)

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const locale = process.argv[2];
if (!locale) { console.error('Usage: node extract.js <locale>'); process.exit(1); }

const config = { browserLocale: locale };

const OUTPUT_DIR = process.env.OUTPUT_DIR;
if (!OUTPUT_DIR) { console.error('OUTPUT_DIR env var is required'); process.exit(1); }

const BASE_URL = `https://hkg.agoda.com/${locale}/activities/detail`;
const NUM_WORKERS = 5;
const TIMEOUT = 30000;
const RENDER_WAIT = 2500;
const EXP_ID = process.env.EXP_ID;
const EXP_VARIANT = process.env.EXP_VARIANT || 'B';
const EXP_PARAM_A = process.env.EXP_PARAM_A || process.env.EXP_CONTROL || 'expUser=B';
const EXP_PARAM_B = process.env.EXP_PARAM_B || (EXP_ID ? `expList=${EXP_ID}=${EXP_VARIANT}` : null);
if (!EXP_PARAM_B) {
  console.error('Either EXP_ID or EXP_PARAM_B env var is required');
  process.exit(1);
}

const outputDir = path.resolve(OUTPUT_DIR);
const idsFile = path.join(outputDir, process.env.IDS_FILE || 'sample-ids.txt');
const tag = process.env.RUN_TAG ? `-${process.env.RUN_TAG}` : '';
const csvPath = path.join(outputDir, `results${tag}-${locale}.csv`);

const allIds = Array.from(new Set(
  fs.readFileSync(idsFile, 'utf-8')
    .split('\n').map(l => l.trim()).filter(l => l && /^\d+$/.test(l)).map(Number)
));

const CSV_HEADER = [
  'activity_id',
  'a_title', 'b_title',
  'a_description', 'b_description',
  'a_sections', 'b_sections',
  'a_error', 'b_error',
].join(',');

function csvEscape(str) {
  if (!str) return '';
  str = str.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (str.includes(',') || str.includes('"')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function getCompletedIds() {
  if (!fs.existsSync(csvPath)) return new Set();
  const lines = fs.readFileSync(csvPath, 'utf-8').split('\n').filter(l => l.trim());
  if (lines.length <= 1) return new Set();
  const ids = new Set();
  for (const line of lines.slice(1)) {
    const id = line.split(',')[0];
    if (id && /^\d+$/.test(id)) ids.add(Number(id));
  }
  return ids;
}

async function extractContent(page, activityId, variant) {
  const expParam = variant === 'A' ? EXP_PARAM_A : EXP_PARAM_B;
  const url = `${BASE_URL}?activityid=${activityId}&${expParam}`;

  try {
    for (let attempt = 0; ; attempt++) {
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: TIMEOUT });
        break;
      } catch (navErr) {
        if (attempt >= 2) throw navErr;
        await page.waitForTimeout(1000);
      }
    }
    await page.waitForTimeout(RENDER_WAIT);

    // Expand all accordions
    const accordions = page.locator('button[aria-expanded="false"]');
    const count = await accordions.count();
    for (let i = 0; i < count; i++) {
      try { await accordions.nth(i).click({ timeout: 2000 }); await page.waitForTimeout(300); } catch (_) {}
    }
    if (count > 0) await page.waitForTimeout(800);

    // Click "Show more" / "Read more" buttons to reveal truncated content
    const showMoreBtns = page.locator('button:has-text("Show more"), button:has-text("Read more"), button:has-text("show more"), button:has-text("read more")');
    const showMoreCount = await showMoreBtns.count();
    for (let i = 0; i < showMoreCount; i++) {
      try { await showMoreBtns.nth(i).click({ timeout: 2000 }); await page.waitForTimeout(300); } catch (_) {}
    }
    if (showMoreCount > 0) await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      const titleEl = document.querySelector('[data-testid="details-title"]');
      const title = titleEl ? titleEl.textContent.trim() : '';

      const descEl = document.querySelector('[data-testid="overview-description"]');
      const description = descEl ? descEl.textContent.trim() : '';

      const sections = [];
      const h2s = document.querySelectorAll('h2');
      for (const h2 of h2s) {
        const name = h2.textContent.trim();
        if (!name) continue;

        let content = '';
        let sib = h2.nextElementSibling;
        while (sib && sib.tagName !== 'H2') {
          content += sib.textContent.trim() + ' ';
          sib = sib.nextElementSibling;
        }
        content = content.trim();

        if (!content) {
          const parent = h2.closest('section') || h2.parentElement;
          if (parent) content = parent.textContent.replace(name, '').trim();
        }

        sections.push({
          name,
          content_length: content.length,
          content_preview: content.substring(0, 2000),
        });
      }

      return { title, description, sections };
    });

    return { activityId, variant, ...result, error: '' };
  } catch (err) {
    return { activityId, variant, title: '', description: '', sections: [], error: err.message.substring(0, 100) };
  }
}

let writeQueue = Promise.resolve();
function appendCSVRow(row) {
  writeQueue = writeQueue.then(() => fs.appendFileSync(csvPath, row + '\n'));
  return writeQueue;
}

let completedCount = 0;
let totalToProcess = 0;
const startTime = Date.now();

async function worker(workerId, browser, ids) {
  const context = await browser.newContext({
    locale: config.browserLocale,
  });

  for (const activityId of ids) {
    const page = await context.newPage();
    try {
      const a = await extractContent(page, activityId, 'A');
      const b = await extractContent(page, activityId, 'B');

      const row = [
        activityId,
        csvEscape(a.title), csvEscape(b.title),
        csvEscape(a.description), csvEscape(b.description),
        csvEscape(JSON.stringify(a.sections)),
        csvEscape(JSON.stringify(b.sections)),
        csvEscape(a.error), csvEscape(b.error),
      ].join(',');
      await appendCSVRow(row);

      completedCount++;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const rate = elapsed > 0 ? (completedCount / elapsed * 60).toFixed(1) : '0';
      const aSecs = a.sections.map(s => s.name.substring(0, 15)).join('|');
      const bSecs = b.sections.map(s => s.name.substring(0, 15)).join('|');
      console.log(`[${locale}:W${workerId}] ${completedCount}/${totalToProcess} Activity ${activityId} A:[${aSecs}] B:[${bSecs}] (${rate}/min)`);
    } catch (err) {
      completedCount++;
      console.error(`[${locale}:W${workerId}] ERROR ${activityId}: ${err.message.substring(0, 60)}`);
      const row = [activityId, '', '', '', '', '[]', '[]', csvEscape(err.message.substring(0, 100)), csvEscape(err.message.substring(0, 100))].join(',');
      await appendCSVRow(row);
    } finally {
      await page.close();
    }
  }
  await context.close();
}

(async () => {
  const completedIds = getCompletedIds();
  const remainingIds = allIds.filter(id => !completedIds.has(id));
  totalToProcess = remainingIds.length;

  console.log(`[${locale}] Total: ${allIds.length}, Done: ${completedIds.size}, Remaining: ${remainingIds.length}, Workers: ${NUM_WORKERS}`);

  if (remainingIds.length === 0) { console.log(`[${locale}] All done!`); return; }

  if (!fs.existsSync(csvPath)) {
    fs.writeFileSync(csvPath, CSV_HEADER + '\n');
  }

  const browser = await chromium.launch({ headless: true });
  const workerIds = Array.from({ length: NUM_WORKERS }, () => []);
  remainingIds.forEach((id, i) => workerIds[i % NUM_WORKERS].push(id));

  await Promise.all(workerIds.map((ids, i) => worker(i, browser, ids)));
  await browser.close();

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`[${locale}] Done! ${completedCount} activities in ${totalTime} min → ${csvPath}`);
})();
