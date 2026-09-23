// Fetch B-side content for a given locale, filtered to a specific set of activity IDs.
// Output: flat CSV with activity_id, locale, title, description, product_info, error
//
// Usage: node fetch-content.js <locale>
// Env vars:
//   OUTPUT_DIR   — output directory (required)
//   IDS_FILE     — path to activity IDs file relative to OUTPUT_DIR (default: sample-ids.txt)
//   EXP_ID       — experiment ID (required, e.g., ACTB-2314)
//   EXP_VARIANT  — variant letter (default: B)
//   NUM_WORKERS  — parallel browser workers (default: 4)
//   TIMEOUT      — page navigation timeout ms (default: 45000)
//   RENDER_WAIT  — ms to wait after navigation (default: 3000)

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const locale = process.argv[2];
if (!locale) { console.error('Usage: node fetch-content.js <locale>'); process.exit(1); }

const OUTPUT_DIR = process.env.OUTPUT_DIR;
if (!OUTPUT_DIR) { console.error('OUTPUT_DIR env var required'); process.exit(1); }

const EXP_ID = process.env.EXP_ID;
if (!EXP_ID) { console.error('EXP_ID env var required'); process.exit(1); }

const EXP_VARIANT = process.env.EXP_VARIANT || 'B';
const NUM_WORKERS = Math.max(1, parseInt(process.env.NUM_WORKERS, 10) || 4);
const TIMEOUT = parseInt(process.env.TIMEOUT, 10) || 45000;
const RENDER_WAIT = parseInt(process.env.RENDER_WAIT, 10) || 3000;

const BASE_URL = `https://hkg.agoda.com/${locale}/activities/detail`;
const EXP_PARAM = `expList=${EXP_ID}%3D${EXP_VARIANT}`;

const outputDir = path.resolve(OUTPUT_DIR);
const idsFile = path.join(outputDir, process.env.IDS_FILE || 'sample-ids.txt');
const csvPath = path.join(outputDir, `content-${locale}.csv`);
const screenshotsDir = path.join(outputDir, 'screenshots');
fs.mkdirSync(screenshotsDir, { recursive: true });

const allIds = Array.from(new Set(
  fs.readFileSync(idsFile, 'utf-8')
    .split('\n').map(l => l.trim()).filter(l => l && /^\d+$/.test(l))
));

// Parse one CSV line into fields, respecting RFC-4180 quoting.
function parseCSVLine(line) {
  const fields = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQuote = false; }
      else { cur += ch; }
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === ',') { fields.push(cur); cur = ''; }
      else { cur += ch; }
    }
  }
  fields.push(cur);
  return fields;
}

// Returns IDs that succeeded (non-empty title, no error). Rewrites the CSV
// without failed rows so they are retried on the next run.
function loadCompletedIds() {
  if (!fs.existsSync(csvPath)) return new Set();

  const lines = fs.readFileSync(csvPath, 'utf-8').split('\n');
  const header = lines[0];
  const dataLines = lines.slice(1).filter(l => l.trim());

  const good = [];
  const completedIds = new Set();

  for (const line of dataLines) {
    // Columns: activity_id(0), locale(1), title(2), description(3), product_info(4), screenshot(5), error(6)
    const cols = parseCSVLine(line);
    const id = (cols[0] || '').trim();
    const title = (cols[2] || '').trim();
    const error = (cols[6] || '').trim();
    if (!id || !/^\d+$/.test(id)) continue;
    if (error || !title) {
      // failed row — drop so this ID is retried
      continue;
    }
    good.push(line);
    completedIds.add(id);
  }

  // Rewrite CSV keeping only successful rows
  fs.writeFileSync(csvPath, [header, ...good].filter(Boolean).join('\n') + '\n', 'utf-8');

  return completedIds;
}

function csvEscape(val) {
  if (val == null) return '""';
  const s = String(val).replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  return '"' + s.replace(/"/g, '""') + '"';
}

let writeQueue = Promise.resolve();
function appendRow(row) {
  writeQueue = writeQueue.then(() => fs.appendFileSync(csvPath, row + '\n', 'utf-8'));
  return writeQueue;
}

async function extractContent(page, activityId) {
  const url = `${BASE_URL}?activityId=${activityId}&${EXP_PARAM}`;
  let title = '', description = '', productInfo = '', screenshotFile = '', error = '';

  try {
    for (let attempt = 0; ; attempt++) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
        break;
      } catch (e) {
        if (attempt >= 2) throw e;
        await page.waitForTimeout(1500);
      }
    }
    await page.waitForTimeout(RENDER_WAIT);

    // Click "See more details" to open content overlay
    for (const sel of [
      'button:has-text("See more details")',
      'button:has-text("See more")',
      '[data-element-name="see-more-details"]',
    ]) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 2000 })) {
          await btn.click();
          await page.waitForTimeout(2000);
          break;
        }
      } catch (_) {}
    }

    // Expand accordions
    const accordions = page.locator('button[aria-expanded="false"]');
    const accCount = await accordions.count();
    for (let i = 0; i < accCount; i++) {
      try { await accordions.nth(i).click({ timeout: 1500 }); await page.waitForTimeout(200); } catch (_) {}
    }

    const result = await page.evaluate(() => {
      // Title: h1 or data-testid
      const titleEl = document.querySelector('[data-testid="details-title"], h1');
      const title = titleEl ? titleEl.textContent.trim() : '';

      // Description: data-testid or styled paragraph after overlay click
      const descEl = document.querySelector('[data-testid="overview-description"]');
      let description = descEl ? descEl.textContent.trim() : '';

      // Fallback: longest <p> that isn't nav/footer
      if (!description) {
        const paras = Array.from(document.querySelectorAll('p'));
        const best = paras
          .filter(p => p.textContent.trim().length > 80)
          .sort((a, b) => b.textContent.length - a.textContent.length)[0];
        if (best) description = best.textContent.trim();
      }

      // Product info: collect h2 sections (highlights, inclusions, etc.)
      // Skip booking-widget sections (Package options, dates, prices)
      const SKIP_SECTIONS = /^(package options|choose|select|booking|price|availability|date|participant|clear)/i;
      const sections = [];
      for (const h2 of document.querySelectorAll('h2')) {
        const name = h2.textContent.trim();
        if (!name || SKIP_SECTIONS.test(name)) continue;
        let content = '';
        let sib = h2.nextElementSibling;
        while (sib && sib.tagName !== 'H2') {
          content += sib.textContent.trim() + ' ';
          sib = sib.nextElementSibling;
        }
        if (!content.trim()) {
          const parent = h2.closest('section') || h2.parentElement;
          if (parent) content = parent.textContent.replace(name, '').trim();
        }
        if (content.trim()) sections.push(`${name}: ${content.trim()}`);
      }

      return { title, description, productInfo: sections.join(' | ') };
    });

    title = result.title;
    description = result.description;
    productInfo = result.productInfo;

    if (!title && !description) {
      screenshotFile = `${activityId}_${locale}_no_content.png`;
      await page.screenshot({ path: path.join(screenshotsDir, screenshotFile) });
      error = 'no_content_found';
    }
  } catch (e) {
    error = e.message.slice(0, 200);
    try {
      screenshotFile = `${activityId}_${locale}_error.png`;
      await page.screenshot({ path: path.join(screenshotsDir, screenshotFile) });
    } catch (_) {}
  }

  return { activityId, title, description, productInfo, screenshotFile, error };
}

let completedCount = 0;
let errorCount = 0;
let totalToProcess = 0;
const startTime = Date.now();

async function worker(workerId, browser, ids) {
  const context = await browser.newContext({
    locale,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  for (const activityId of ids) {
    const page = await context.newPage();
    try {
      const r = await extractContent(page, activityId);
      const row = [
        csvEscape(r.activityId), csvEscape(locale),
        csvEscape(r.title), csvEscape(r.description),
        csvEscape(r.productInfo), csvEscape(r.screenshotFile), csvEscape(r.error),
      ].join(',');
      await appendRow(row);
      completedCount++;
      if (r.error) {
        errorCount++;
        process.stderr.write(`[${locale}:W${workerId}] FETCH_ERROR ${activityId}: ${r.error}\n`);
      }
      const rate = ((completedCount / ((Date.now() - startTime) / 1000)) * 60).toFixed(0);
      console.log(`[${locale}:W${workerId}] ${completedCount}/${totalToProcess} id=${activityId} title=${r.title.slice(0, 40)} err=${r.error || 'ok'} (${rate}/min)`);
    } catch (e) {
      completedCount++;
      errorCount++;
      process.stderr.write(`[${locale}:W${workerId}] FATAL ${activityId}: ${e.message.slice(0, 80)}\n`);
      await appendRow([csvEscape(activityId), csvEscape(locale), '""', '""', '""', '""', csvEscape(e.message.slice(0, 100))].join(','));
    } finally {
      await page.close();
    }
  }
  await context.close();
}

(async () => {
  const completedIds = loadCompletedIds();
  const remaining = allIds.filter(id => !completedIds.has(id));
  totalToProcess = remaining.length;

  console.log(`[${locale}] Total: ${allIds.length}, done: ${completedIds.size}, remaining: ${remaining.length}, workers: ${NUM_WORKERS}`);
  console.log(`[${locale}] Exp: ${EXP_ID}=${EXP_VARIANT}  Timeout: ${TIMEOUT}ms  RenderWait: ${RENDER_WAIT}ms`);

  if (remaining.length === 0) { console.log(`[${locale}] All done.`); return; }

  if (!fs.existsSync(csvPath)) {
    fs.writeFileSync(csvPath, 'activity_id,locale,title,description,product_info,screenshot_file,error\n', 'utf-8');
  }

  const browser = await chromium.launch({ headless: true });
  const chunks = Array.from({ length: NUM_WORKERS }, () => []);
  remaining.forEach((id, i) => chunks[i % NUM_WORKERS].push(id));

  await Promise.all(chunks.map((ids, i) => worker(i, browser, ids)));
  await browser.close();

  const mins = ((Date.now() - startTime) / 60000).toFixed(1);
  if (errorCount > 0) {
    process.stderr.write(`[${locale}] Done with ${errorCount} error(s) out of ${completedCount} in ${mins} min → ${csvPath}\n`);
    process.exit(1);
  }
  console.log(`[${locale}] Done! ${completedCount} activities in ${mins} min → ${csvPath}`);
})();
