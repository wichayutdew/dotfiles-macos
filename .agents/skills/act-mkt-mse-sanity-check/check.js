// MSE Landing Sanity Check
// Verifies: search URL → highlighted card on search → click → detail page → offer auto-expanded & scrolled into view
// Usage: node check.js --activity-id=12345 --offer-id=67890 --city-id=456
//        node check.js --file=test-cases.csv
//        node check.js --json='[{"activityId":12345,"offerId":67890,"cityId":456}]'

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

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

const flags = parseArgs();
const config = {
  cid: flags.cid || '1909882',
  locale: flags.locale || 'en-us',
  domain: flags.domain || 'www.agoda.com',
  headed: flags.headed === true,
  screenshotDir: path.resolve(flags['screenshot-dir'] || './mse-screenshots'),
  workers: Math.max(1, parseInt(flags.workers, 10) || 3),
  exp: flags.exp || null,
  expUser: flags['exp-user'] || 'A',
};

// Experiment mode forces hkg.agoda.com (expUser/expList only work there)
if (config.exp && config.domain === 'www.agoda.com') {
  config.domain = 'hkg.agoda.com';
}

// --- Input loading ---

function parseJsonCases(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`Invalid JSON input: ${err.message}`);
    process.exit(1);
  }
  const arr = Array.isArray(data) ? data : [data];
  return arr.map(item => ({
    activityId: String(item.activityId || item.activity_id),
    offerId: String(item.offerId || item.offer_id),
    cityId: String(item.cityId || item.city_id),
    cid: String(item.cid || config.cid),
    label: item.label || `${item.activityId || item.activity_id}-${item.offerId || item.offer_id}`,
  }));
}

function loadTestCases() {
  // Inline JSON (agent-friendly, no temp file needed)
  if (flags.json) {
    return parseJsonCases(flags.json);
  }

  if (flags.file) {
    const content = fs.readFileSync(flags.file, 'utf-8');
    const trimmed = content.trimStart();

    // JSON file (by extension or content sniffing)
    if (flags.file.endsWith('.json') || trimmed[0] === '[' || trimmed[0] === '{') {
      return parseJsonCases(trimmed);
    }

    // CSV file
    const allLines = content.split('\n').map(l => l.trim()).filter(l => l);
    const lines = allLines[0] && allLines[0].startsWith('activity_id') ? allLines.slice(1) : allLines;
    return lines.map(line => {
      const [activity_id, offer_id, city_id, cid, label] = line.split(',').map(s => s.trim());
      return {
        activityId: activity_id,
        offerId: offer_id,
        cityId: city_id,
        cid: cid || config.cid,
        label: label || `${activity_id}-${offer_id}`,
      };
    });
  }

  if (!flags['activity-id'] || !flags['offer-id'] || !flags['city-id']) {
    console.error('Required: --activity-id, --offer-id, --city-id (or --file/--json for batch)');
    process.exit(1);
  }

  return [{
    activityId: flags['activity-id'],
    offerId: flags['offer-id'],
    cityId: flags['city-id'],
    cid: flags.cid || config.cid,
    label: `${flags['activity-id']}-${flags['offer-id']}`,
  }];
}

// --- CSV helpers ---

const MAX_ERROR_MESSAGE_LENGTH = 150;
const MAX_URL_LENGTH = 200;

function csvEscape(str) {
  if (!str) return '';
  str = str.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (str.includes(',') || str.includes('"')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function formatError(message, url) {
  const truncatedMsg = message.substring(0, MAX_ERROR_MESSAGE_LENGTH);
  if (!url) return truncatedMsg;
  const truncatedUrl = url.length > MAX_URL_LENGTH ? url.substring(0, MAX_URL_LENGTH) : url;
  return `${truncatedMsg} | URL: ${truncatedUrl}`;
}

const CSV_HEADER_BASE = 'activity_id,offer_id,city_id,label,pass,search_loaded,card_found,card_highlighted,card_clicked,detail_loaded,expanded_count,in_viewport,search_url,final_url,error';
const CSV_HEADER_EXP = 'activity_id,offer_id,city_id,label,exp_side,pass,search_loaded,card_found,card_highlighted,card_clicked,detail_loaded,expanded_count,in_viewport,search_url,final_url,error';

function getCSVHeader() { return config.exp ? CSV_HEADER_EXP : CSV_HEADER_BASE; }

function getCompletedLabels(csvPath) {
  if (!fs.existsSync(csvPath)) return new Set();
  const lines = fs.readFileSync(csvPath, 'utf-8').split('\n').filter(l => l.trim());
  if (lines.length <= 1) return new Set();
  const labels = new Set();
  for (const line of lines.slice(1)) {
    const label = line.split(',')[3];
    if (label) labels.add(label);
  }
  return labels;
}

// --- URL + navigation ---

function buildMSEUrl({ activityId, offerId, cityId, cid, domain, exp, expSide, expUser }) {
  const params = new URLSearchParams({
    cityId: String(cityId),
    selectedActivity: String(activityId),
    mseOfferId: String(offerId),
    cid: String(cid),
    currency: 'USD',
  });
  if (exp && expSide) {
    params.set('expUser', expUser);
    params.set('expList', `${exp}=${expSide}`);
  }
  return `https://${domain}/activities/search?${params}`;
}

async function navigateWithRetry(page, url, { timeout = 30000, retries = 2 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout });
      return;
    } catch (err) {
      if (attempt >= retries) throw err;
      await page.waitForTimeout(1000 * (attempt + 1));
    }
  }
}

// --- Core check ---

async function verifyOfferExpanded(page) {
  // Check for offer visibility using multiple strategies:
  // 1. Accordion-style: [aria-expanded="true"] (some offer layouts use accordions)
  // 2. Booking form: the offer booking form with date/traveler/price is visible
  const expandedCount = await page.locator('[aria-expanded="true"]').count();

  // Also check for the offer booking form area (date picker + "Next step" button)
  const bookingFormVisible = await page.locator('[data-testid="details-title"]').count() > 0
    && (await page.locator('text=Next step').count() > 0
        || await page.locator('text=Book now').count() > 0
        || await page.locator('text=Check availability').count() > 0);

  const totalExpanded = expandedCount + (bookingFormVisible ? 1 : 0);

  // Check if any offer-related element is visible in the viewport.
  // The page may auto-scroll to the package options section, so we check
  // multiple candidate elements and pass if ANY is in viewport.
  const inViewport = await page.evaluate(() => {
    const candidates = [
      // Accordion-style expanded offers
      ...document.querySelectorAll('[aria-expanded="true"]'),
      // "Next step" / "Book now" buttons indicating an active booking form
      ...Array.from(document.querySelectorAll('button, a[role="button"], span'))
        .filter(b => /next step|book now|check availability/i.test(b.textContent)),
      // Package options tab (the section header that gets scrolled to)
      ...document.querySelectorAll('[data-testid*="package-option"], [id*="package"]'),
    ];
    for (const el of candidates) {
      const rect = el.getBoundingClientRect();
      if (rect.top >= -50 && rect.top < window.innerHeight && rect.height > 0) {
        return true;
      }
    }
    return false;
  });

  return { expandedCount: totalExpanded, inViewport };
}

async function checkMSELanding(page, testCase, cfg, expSide = null) {
  const { activityId, offerId, cityId, cid } = testCase;
  const baseLabel = testCase.label || `${activityId}-${offerId}`;
  const label = expSide ? `${baseLabel}-${expSide}` : baseLabel;
  const searchUrl = buildMSEUrl({ activityId, offerId, cityId, cid, domain: cfg.domain, exp: cfg.exp, expSide, expUser: cfg.expUser });
  const result = {
    activityId, offerId, cityId, label, expSide,
    searchUrl,
    pass: false,
    searchLoaded: false, cardFound: false, cardHighlighted: false, cardClicked: false,
    detailLoaded: false, expandedCount: 0, inViewport: false,
    finalUrl: '', error: '',
  };

  try {
    // === Phase 1: Search page — find and click highlighted activity card ===

    // 1a. Navigate to MSE search URL
    await navigateWithRetry(page, searchUrl, { timeout: 45000 });
    result.searchLoaded = page.url().includes('/activities/search');

    // 1b. Wait for activity cards to render
    await page.waitForSelector('[data-activity-id]', { timeout: 15000 });

    // 1c. Take search page screenshot
    const dir = cfg.screenshotDir;
    await page.screenshot({ path: path.join(dir, `${label}-search.png`) });

    // 1d. Find the target activity card
    const cardSelector = `[data-activity-id="${activityId}"]`;
    const card = page.locator(cardSelector);
    const cardCount = await card.count();
    result.cardFound = cardCount > 0;

    if (!result.cardFound) {
      result.error = formatError(`Card not found on search page: ${cardSelector}`, searchUrl);
      return result;
    }

    // 1e. Check if card is highlighted (strong border class = MSE highlight)
    const cardClasses = await card.first().getAttribute('class') || '';
    const wrapperClasses = await card.first().locator('[data-testid="activities-card-wrapper"]').first().getAttribute('class') || '';
    result.cardHighlighted = wrapperClasses.includes('border-product-primary-strong') || cardClasses.includes('border-product-primary-strong');

    // 1f. Click the card and wait for detail page navigation
    //     Card has target="_blank", so we listen for a new page (popup)
    const [detailPage] = await Promise.all([
      page.context().waitForEvent('page', { timeout: 15000 }),
      card.first().click(),
    ]);
    result.cardClicked = true;

    // === Phase 2: Detail page — verify offer expansion ===

    // 2a. Wait for detail page to load
    await detailPage.waitForLoadState('networkidle', { timeout: 30000 });
    result.finalUrl = detailPage.url();
    result.detailLoaded = result.finalUrl.includes('/activities/detail') || result.finalUrl.includes('activityid=') || result.finalUrl.includes('activityId=');

    if (!result.detailLoaded) {
      result.error = `Detail page not loaded. URL: ${result.finalUrl}`;
      await detailPage.screenshot({ path: path.join(dir, `${label}-viewport.png`) });
      await detailPage.close();
      return result;
    }

    // 2b. Wait for detail page render + offer auto-expand animation
    //     IMPORTANT: Do NOT expand accordions — checking first-landing state
    await detailPage.waitForSelector('[data-testid="details-title"]', { timeout: 15000 });
    await detailPage.waitForTimeout(3000);

    // 2c. Verify offer expansion
    const v = await verifyOfferExpanded(detailPage);
    Object.assign(result, v);
    result.pass = result.cardFound && result.detailLoaded && result.expandedCount > 0 && result.inViewport;

    // 2d. Screenshots of detail page
    await detailPage.screenshot({ path: path.join(dir, `${label}-viewport.png`) });
    await detailPage.screenshot({ path: path.join(dir, `${label}-full.png`), fullPage: true });
    await detailPage.close();
  } catch (err) {
    const urlContext = result.finalUrl || searchUrl;
    result.error = formatError(err.message, urlContext);
  }

  return result;
}

// --- Main ---

// --- Discover mode: inspect search page DOM to find card selectors ---

async function discoverSearchPage(testCase, cfg) {
  const url = buildMSEUrl({ ...testCase, domain: cfg.domain });
  console.log(`\n=== DISCOVER MODE ===`);
  console.log(`URL: ${url}\n`);

  const browser = await chromium.launch({ headless: !cfg.headed });
  const context = await browser.newContext({ locale: cfg.locale });
  const page = await context.newPage();

  try {
    await navigateWithRetry(page, url, { timeout: 45000 });
    console.log(`Final URL: ${page.url()}\n`);

    // Wait a bit for SPA rendering
    await page.waitForTimeout(5000);

    fs.mkdirSync(cfg.screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(cfg.screenshotDir, 'discover-search.png'), fullPage: true });
    console.log(`Screenshot: ${path.join(cfg.screenshotDir, 'discover-search.png')}\n`);

    // Probe common card selectors
    const selectors = [
      `[data-activity-id]`,
      `[data-activity-id="${testCase.activityId}"]`,
      `[data-testid*="activity"]`,
      `[data-element-name*="activity"]`,
      `.activity-card`,
      `a[href*="activities/detail"]`,
      `a[href*="${testCase.activityId}"]`,
      `[class*="selected"]`,
      `[class*="highlight"]`,
      `[class*="ActivityCard"]`,
      `[class*="activityCard"]`,
      `[class*="SearchResult"]`,
      `[data-selenium*="activity"]`,
    ];

    for (const sel of selectors) {
      const count = await page.locator(sel).count();
      if (count > 0) {
        console.log(`[${count} match] ${sel}`);
        // Dump first match outer HTML (truncated)
        const html = await page.locator(sel).first().evaluate(el => el.outerHTML.substring(0, 600));
        console.log(`  → ${html}\n`);
      }
    }

    // Also dump all links containing "activities"
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="activities"]'))
        .slice(0, 10)
        .map(a => ({ href: a.href, text: a.textContent.trim().substring(0, 80), classes: a.className.substring(0, 100) }));
    });
    if (links.length) {
      console.log(`\n--- Links containing "activities" (first 10) ---`);
      links.forEach(l => console.log(`  ${l.href}\n    text: "${l.text}" classes: "${l.classes}"`));
    }

    // Dump body classes for context
    const bodyClasses = await page.evaluate(() => document.body.className);
    console.log(`\nbody classes: ${bodyClasses}`);

  } catch (err) {
    console.error(`Discovery error: ${err.message}`);
  } finally {
    await browser.close();
  }
}

(async () => {
  const testCases = loadTestCases();

  // Discovery mode: inspect search page and exit
  if (flags.discover) {
    await discoverSearchPage(testCases[0], config);
    return;
  }

  const csvPath = path.resolve('mse-results.csv');
  const completedLabels = getCompletedLabels(csvPath);

  // In experiment mode, build work items for both A and B sides
  const expSides = config.exp ? ['A', 'B'] : [null];
  const workItems = [];
  for (const tc of testCases) {
    for (const side of expSides) {
      const label = side ? `${tc.label}-${side}` : tc.label;
      if (!completedLabels.has(label)) {
        workItems.push({ tc, side });
      }
    }
  }

  const totalLabel = config.exp
    ? `${testCases.length} activities x 2 sides (${config.exp})`
    : `${testCases.length} activities`;
  console.log(`MSE Sanity Check — ${totalLabel}, Remaining: ${workItems.length}`);
  if (config.exp) console.log(`Experiment: ${config.exp} | Domain: ${config.domain} | expUser=${config.expUser}, expList=${config.exp}=A|B`);
  if (workItems.length === 0) { console.log('All done!'); return; }

  fs.mkdirSync(config.screenshotDir, { recursive: true });

  if (!fs.existsSync(csvPath)) {
    fs.writeFileSync(csvPath, getCSVHeader() + '\n');
  }

  const browser = await chromium.launch({ headless: !config.headed });
  const results = [];
  let writeQueue = Promise.resolve();

  function appendCSVRow(row) {
    writeQueue = writeQueue.then(() => fs.appendFileSync(csvPath, row + '\n'));
    return writeQueue;
  }

  // Round-robin distribute to workers
  const workerBuckets = Array.from({ length: Math.min(config.workers, workItems.length) }, () => []);
  workItems.forEach((wi, i) => workerBuckets[i % workerBuckets.length].push(wi));

  await Promise.all(workerBuckets.map(async (items, workerId) => {
    const context = await browser.newContext({
      locale: config.locale,
    });

    for (const { tc, side } of items) {
      const page = await context.newPage();
      const result = await checkMSELanding(page, tc, config, side);
      results.push(result);

      const sideTag = side ? `[${side}] ` : '';
      const status = result.pass ? '[PASS]' : '[FAIL]';
      let detail;
      if (result.pass) {
        detail = `card found${result.cardHighlighted ? '+highlighted' : ''}, ${result.expandedCount} expanded, in viewport`;
      } else if (!result.cardFound) {
        detail = result.error || 'Card not found on search page';
      } else if (!result.detailLoaded) {
        detail = result.error || 'Detail page not loaded after click';
      } else {
        detail = result.error || `${result.expandedCount} expanded, ${result.inViewport ? 'in viewport' : 'NOT in viewport'}`;
      }
      console.log(`${status} ${sideTag}Activity ${result.activityId} offer ${result.offerId} — ${detail}`);

      const rowParts = [
        result.activityId, result.offerId, result.cityId,
        csvEscape(result.label),
      ];
      if (config.exp) rowParts.push(result.expSide || '');
      rowParts.push(
        result.pass,
        result.searchLoaded, result.cardFound, result.cardHighlighted, result.cardClicked, result.detailLoaded,
        result.expandedCount, result.inViewport,
        csvEscape(result.searchUrl), csvEscape(result.finalUrl), csvEscape(result.error),
      );
      await appendCSVRow(rowParts.join(','));

      await page.close();
    }

    await context.close();
  }));

  await browser.close();

  const passCount = results.filter(r => r.pass).length;
  const failCount = results.length - passCount;

  console.log(`\n=== MSE Sanity Check ===`);
  console.log(`Total: ${results.length} | Pass: ${passCount} | Fail: ${failCount}`);

  // Experiment A/B comparison summary
  if (config.exp) {
    const sideA = results.filter(r => r.expSide === 'A');
    const sideB = results.filter(r => r.expSide === 'B');
    const passA = sideA.filter(r => r.pass).length;
    const passB = sideB.filter(r => r.pass).length;
    console.log(`\n--- Experiment ${config.exp} A/B Comparison ---`);
    console.log(`Side A (control): ${passA}/${sideA.length} pass`);
    console.log(`Side B (treatment): ${passB}/${sideB.length} pass`);

    // Show per-activity diffs
    const diffs = [];
    for (const a of sideA) {
      const b = sideB.find(r => r.activityId === a.activityId && r.offerId === a.offerId);
      if (b && a.pass !== b.pass) {
        diffs.push({ activityId: a.activityId, offerId: a.offerId, passA: a.pass, passB: b.pass });
      }
    }
    if (diffs.length > 0) {
      console.log(`\nDifferences (A vs B):`);
      for (const d of diffs) {
        console.log(`  Activity ${d.activityId} offer ${d.offerId}: A=${d.passA ? 'PASS' : 'FAIL'} B=${d.passB ? 'PASS' : 'FAIL'}`);
      }
    } else {
      console.log(`\nNo differences between A and B sides.`);
    }
  }

  console.log(`\nScreenshots: ${config.screenshotDir}/`);
  console.log(`Results: ${csvPath}`);
})();
