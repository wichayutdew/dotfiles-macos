// Content Quality Extraction — API mode (Activity Search GraphQL)
// Usage: node extract-api.js <locale>
// Env vars:
//   OUTPUT_DIR       — output directory (required, e.g., content-quality/ACTB-2314-xxx)
//   IDS_FILE         — path to activity IDs file relative to OUTPUT_DIR (default: sample-ids.txt)
//   RUN_TAG          — optional tag for output filenames (e.g., "indonesia" → results-indonesia-<locale>.csv)
//   EXP_ID           — experiment ID (required for B-side, e.g., ACTB-2314)
//   EXP_VARIANT      — variant letter (default: B)
//   API_HOST         — Activity Search host (default: https://activity-search.privatecloud.hk.agoda.is)
//   API_CONCURRENCY  — parallel requests (default: 10)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const locale = process.argv[2];
if (!locale) { console.error('Usage: node extract-api.js <locale>'); process.exit(1); }

const OUTPUT_DIR = process.env.OUTPUT_DIR;
if (!OUTPUT_DIR) { console.error('OUTPUT_DIR env var is required'); process.exit(1); }

const EXP_ID = process.env.EXP_ID;
if (!EXP_ID) { console.error('EXP_ID env var is required'); process.exit(1); }

const EXP_VARIANT = process.env.EXP_VARIANT || 'B';
const API_HOST = (process.env.API_HOST || 'https://activity-search.privatecloud.hk.agoda.is').replace(/\/$/, '');
const API_CONCURRENCY = Math.max(1, parseInt(process.env.API_CONCURRENCY, 10) || 10);
const API_URL = `${API_HOST}/activities/graphql`;

const LOCALE_TO_LANG = {
  'en-us': { id: '1', locale: 'EN' },
  'fr-fr': { id: '2', locale: 'FR' },
  'de-de': { id: '3', locale: 'DE' },
  'it-it': { id: '4', locale: 'IT' },
  'es-es': { id: '5', locale: 'ES' },
  'ja-jp': { id: '6', locale: 'JA' },
  'zh-hk': { id: '7', locale: 'ZH-HK' },
  'zh-cn': { id: '8', locale: 'ZH-CN' },
  'ko-kr': { id: '9', locale: 'KO' },
  'el-gr': { id: '10', locale: 'EL' },
  'ru-ru': { id: '11', locale: 'RU' },
  'pt-pt': { id: '12', locale: 'PT' },
  'nl-nl': { id: '13', locale: 'NL' },
  'en-ca': { id: '14', locale: 'EN' },
  'en-in': { id: '15', locale: 'EN' },
  'en-gb': { id: '16', locale: 'EN' },
  'en-za': { id: '17', locale: 'EN' },
  'en-au': { id: '18', locale: 'EN' },
  'en-sg': { id: '19', locale: 'EN' },
  'zh-tw': { id: '20', locale: 'ZH-TW' },
  'en-nz': { id: '21', locale: 'EN' },
  'th-th': { id: '22', locale: 'TH' },
  'ms-my': { id: '23', locale: 'MS' },
  'vi-vn': { id: '24', locale: 'VI' },
  'sv-se': { id: '25', locale: 'SV' },
  'id-id': { id: '26', locale: 'ID' },
  'pl-pl': { id: '27', locale: 'PL' },
  'nb-no': { id: '28', locale: 'NB' },
  'da-dk': { id: '29', locale: 'DA' },
  'fi-fi': { id: '30', locale: 'FI' },
  'cs-cz': { id: '31', locale: 'CS' },
  'tr-tr': { id: '32', locale: 'TR' },
  'ca-es': { id: '33', locale: 'CA' },
  'hu-hu': { id: '34', locale: 'HU' },
  'hi-in': { id: '35', locale: 'HI' },
  'bg-bg': { id: '36', locale: 'BG' },
  'ro-ro': { id: '37', locale: 'RO' },
  'sl-si': { id: '38', locale: 'SL' },
  'he-il': { id: '39', locale: 'HE' },
  'ar-ae': { id: '40', locale: 'AR' },
  'nl-be': { id: '41', locale: 'NL' },
  'en-ie': { id: '42', locale: 'EN' },
  'pt-br': { id: '43', locale: 'PT' },
  'es-ar': { id: '44', locale: 'ES' },
  'es-mx': { id: '45', locale: 'ES' },
  'lt-lt': { id: '46', locale: 'LT' },
  'lv-lv': { id: '47', locale: 'LV' },
  'hr-hr': { id: '48', locale: 'HR' },
  'et-ee': { id: '49', locale: 'ET' },
  'uk-ua': { id: '50', locale: 'UK' },
  'tl-ph': { id: '51', locale: 'TL' },
  'fr-ca': { id: '52', locale: 'FR' },
};

const langInfo = LOCALE_TO_LANG[locale];
if (!langInfo) { console.error(`Unknown locale: ${locale}. See LOCALE_TO_LANG in script.`); process.exit(1); }

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

function buildHeaders() {
  return {
    'Content-Type': 'application/json',
    'AG-CORRELATION-ID': crypto.randomUUID(),
    'AG-ANALYTICS-SESSION-ID': crypto.randomUUID(),
    'AG-USER-ID': '00000000-0000-0000-0000-000000000000',
    'AG-CID': '111',
    'AG-ORIGIN': 'TH',
    'AG-LANGUAGE-ID': langInfo.id,
    'AG-LANGUAGE-LOCALE': langInfo.locale,
    'AG-PLATFORM-ID': '1',
    'AG-WHITELABEL-ID': '1',
  };
}

function buildBody(activityId, side) {
  const experimentInfo = side === 'B'
    ? { forcedExperiments: [{ experiment: EXP_ID, variant: EXP_VARIANT }] }
    : {};

  return {
    DetailsRequest: {
      context: {
        currency: 'USD',
        experimentInfo,
      },
      contentRequest: {
        imageRequest: { count: 1, width: 800, height: 800 },
      },
      detailsRequest: {
        activityId,
      },
    },
  };
}

function responseSections(detail) {
  if (!detail) return [];
  const sections = [];

  for (const gs of detail.genericSection || []) {
    const text = (gs.content || []).map(c => [c.title, c.description].filter(Boolean).join(': ')).join(' ');
    sections.push({ name: gs.title || gs.sectionType || 'generic', content_length: text.length, content_preview: text.substring(0, 2000) });
  }

  for (const ad of detail.additionalDetails || []) {
    sections.push({ name: ad.additionalType || 'additional', content_length: (ad.description || '').length, content_preview: (ad.description || '').substring(0, 2000) });
  }

  for (const list of [{ key: 'inclusions', label: 'Inclusions' }, { key: 'exclusions', label: 'Exclusions' }]) {
    const items = detail[list.key];
    if (items && items.length > 0) {
      const text = items.flatMap(inc => (inc.benefitItems || []).map(b => [b.name, b.description].filter(Boolean).join(': '))).join('; ');
      sections.push({ name: list.label, content_length: text.length, content_preview: text.substring(0, 2000) });
    }
  }

  for (const itin of detail.itineraries || []) {
    const parts = [itin.description || ''];
    for (const day of itin.itineraryDays || []) {
      parts.push(day.title || '', day.description || '');
    }
    const text = parts.filter(Boolean).join(' ');
    sections.push({ name: 'Itinerary', content_length: text.length, content_preview: text.substring(0, 2000) });
  }

  for (const offer of detail.offerDetails || []) {
    const text = [offer.title, offer.description].filter(Boolean).join(': ');
    sections.push({ name: 'Offer: ' + (offer.title || 'detail'), content_length: text.length, content_preview: text.substring(0, 2000) });
  }

  for (const log of detail.logistics || []) {
    const text = log.pickupSummary?.specialInstructions || '';
    if (text) {
      sections.push({ name: 'Logistics', content_length: text.length, content_preview: text.substring(0, 2000) });
    }
  }

  if (detail.ticketing?.redemption?.specialInstructions) {
    const text = detail.ticketing.redemption.specialInstructions;
    sections.push({ name: 'Ticketing', content_length: text.length, content_preview: text.substring(0, 2000) });
  }

  return sections;
}

function parseResponse(data) {
  const content = data?.content;
  if (!content) return { title: '', description: '', sections: [], error: 'no content in response' };

  const title = content.activity?.title || '';
  const description = content.activity?.description || '';
  const sections = responseSections(content.detail);

  return { title, description, sections, error: '' };
}

async function fetchDetails(activityId, side) {
  const headers = buildHeaders();
  const body = buildBody(activityId, side);

  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const status = response.status;
        const retryable = status === 429 || (status >= 500 && status < 600);
        if (retryable && attempt < 2) {
          const delay = 1000 * Math.pow(2, attempt);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        return { title: '', description: '', sections: [], error: `HTTP ${status}` };
      }

      const data = await response.json();
      return parseResponse(data);
    } catch (err) {
      if (attempt < 2) {
        const delay = 1000 * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return { title: '', description: '', sections: [], error: err.message.substring(0, 100) };
    }
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

async function processActivity(activityId) {
  const a = await fetchDetails(activityId, 'A');
  const b = await fetchDetails(activityId, 'B');

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
  const elapsed = (Date.now() - startTime) / 1000;
  const rate = elapsed > 0 ? (completedCount / elapsed * 60).toFixed(1) : '0';
  const aSecs = a.sections.map(s => s.name.substring(0, 15)).join('|');
  const bSecs = b.sections.map(s => s.name.substring(0, 15)).join('|');
  console.log(`[${locale}] ${completedCount}/${totalToProcess} Activity ${activityId} A:[${aSecs}] B:[${bSecs}] (${rate}/min)`);
}

(async () => {
  const completedIds = getCompletedIds();
  const remainingIds = allIds.filter(id => !completedIds.has(id));
  totalToProcess = remainingIds.length;

  console.log(`[${locale}] API mode — Host: ${API_HOST}`);
  console.log(`[${locale}] Experiment: ${EXP_ID} variant=${EXP_VARIANT}, Lang: ${langInfo.id} (${langInfo.locale})`);
  console.log(`[${locale}] Total: ${allIds.length}, Done: ${completedIds.size}, Remaining: ${remainingIds.length}, Concurrency: ${API_CONCURRENCY}`);

  if (remainingIds.length === 0) { console.log(`[${locale}] All done!`); return; }

  if (!fs.existsSync(csvPath)) {
    fs.writeFileSync(csvPath, CSV_HEADER + '\n');
  }

  // Parallel executor with bounded concurrency
  const queue = [...remainingIds];
  const workers = Array.from({ length: API_CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const id = queue.shift();
      if (id !== undefined) {
        try {
          await processActivity(id);
        } catch (err) {
          completedCount++;
          console.error(`[${locale}] ERROR ${id}: ${err.message.substring(0, 60)}`);
          const row = [id, '', '', '', '', '[]', '[]', csvEscape(err.message.substring(0, 100)), csvEscape(err.message.substring(0, 100))].join(',');
          await appendCSVRow(row);
        }
      }
    }
  });
  await Promise.all(workers);

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`[${locale}] Done! ${completedCount} activities in ${totalTime} min → ${csvPath}`);
})();
