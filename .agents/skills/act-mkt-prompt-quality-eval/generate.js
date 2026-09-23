// Generate Enhanced Content via GenAI Gateway
// Usage: node generate.js
// Env vars:
//   OUTPUT_DIR         — output directory (required)
//   ASSISTANT_ID       — GPT assistant slug (required unless SYSTEM_PROMPT_FILE set)
//   SYSTEM_PROMPT_FILE — path to custom system prompt file (overrides ASSISTANT_ID)
//   COMPONENT          — components to generate (comma-sep, default: all)
//   LANGUAGE_IDS       — target language IDs (comma-sep, default: 1)
//   GEN_MODEL          — GenAI model (default: gemini-2.5-flash)
//   GEN_TEMPERATURE    — temperature (default: 0.5)
//   GEN_MAX_TOKENS     — max tokens (default: 8000)
//   GEN_CONCURRENCY    — parallel generations (default: 3)
//   OPENAI_BASE_URL    — GenAI endpoint (default: https://genai-gateway.agoda.is/v1)

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const OUTPUT_DIR = process.env.OUTPUT_DIR;
if (!OUTPUT_DIR) { console.error('OUTPUT_DIR env var is required'); process.exit(1); }

const ASSISTANT_ID = process.env.ASSISTANT_ID;
const SYSTEM_PROMPT_FILE = process.env.SYSTEM_PROMPT_FILE;
if (!ASSISTANT_ID && !SYSTEM_PROMPT_FILE) {
  console.error('ERROR: Either ASSISTANT_ID or SYSTEM_PROMPT_FILE must be set');
  process.exit(1);
}

const outputDir = path.resolve(OUTPUT_DIR);
const JSONL_FILE = path.join(outputDir, 'activity-details.jsonl');
const GEN_MODEL = process.env.GEN_MODEL || 'gemini-2.5-flash';
const GEN_TEMPERATURE = parseFloat(process.env.GEN_TEMPERATURE || '0.5');
const GEN_MAX_TOKENS = parseInt(process.env.GEN_MAX_TOKENS || '8000', 10);
const GEN_CONCURRENCY = Math.max(1, parseInt(process.env.GEN_CONCURRENCY || '3', 10));

const client = new OpenAI({
  baseURL: process.env.OPENAI_BASE_URL || 'https://genai-gateway.agoda.is/v1',
});

// Component field mapping from ActivityContentReadInjector.scala:34-50
const COMPONENT_FIELDS = {
  title: ['activityInfo.title'],
  description: ['activityInfo.title', 'activityInfo.description', 'supplierInfo.providerName'],
  'product-information': [
    'activityInfo.title', 'activityInfo.description', 'supplierInfo.providerName',
    'additionalInfoList', 'imageList', 'inclusionRefs', 'exclusionRefs',
    'itineraryRef', 'genericSection'
  ]
};

// Language mapping from LanguageMapping.cs / activity-prompt-builder.py
const LANGUAGE_MAP = {
  1: 'English', 2: 'French', 3: 'German', 4: 'Italian', 5: 'Spanish',
  6: 'Japanese', 7: 'T.Chinese / Hongkong', 8: 'S.Chinese / Mainland', 9: 'Korean',
  10: 'Greek', 11: 'Russian', 12: 'Portuguese', 13: 'Dutch', 14: 'English / Canada',
  15: 'English / India', 16: 'English / United Kingdom', 17: 'English / South-Africa',
  18: 'English / Australia', 19: 'English / Singapore', 20: 'T. Chinese / Taiwan',
  21: 'English / New Zealand', 22: 'Thai', 23: 'Malay', 24: 'Vietnamese', 25: 'Swedish',
  26: 'Indonesian', 27: 'Polish', 28: 'Norwegian', 29: 'Danish', 30: 'Finnish',
  31: 'Czech', 32: 'Turkish', 33: 'Catalan', 34: 'Hungarian', 36: 'Bulgarian',
  37: 'Romanian', 38: 'Slovenian', 39: 'Hebrew', 40: 'Arabic', 41: 'Dutch / Belgium',
  42: 'English / Ireland', 43: 'Portuguese / Brazil', 44: 'Spanish / Argentina',
  45: 'Spanish / Mexico', 46: 'Lithuanian', 47: 'Latvian', 48: 'Croatian', 49: 'Estonian',
  50: 'Ukrainian', 51: 'Filipino', 52: 'French / Canada'
};

// User prompt template from ActivityProductAssistantSync.yaml:42-50
const USER_PROMPT_TEMPLATE = `<Input>
<parameters>
<details><![CDATA[{details}]]></details>
<metadata><![CDATA[{metadata}]]></metadata>
<language><![CDATA[{language}]]></language>
</parameters>
</Input>`;

// Parse component and language CLI args
const requestedComponents = process.env.COMPONENT
  ? process.env.COMPONENT.split(',').map(c => c.trim().toLowerCase())
  : Object.keys(COMPONENT_FIELDS);

const requestedLangIds = process.env.LANGUAGE_IDS
  ? process.env.LANGUAGE_IDS.split(',').map(l => parseInt(l.trim(), 10))
  : [1];

// Extract nested field using dot-notation path (ActivityContentReadInjector.scala:56-60)
function getNestedField(obj, path) {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !(part in current)) return null;
    current = current[part];
  }
  return current !== null && current !== undefined ? current : null;
}

// Filter details for component (ActivityContentReadInjector.scala:67-95)
function filterDetailsForComponent(detailsObj, component) {
  if (!detailsObj || typeof detailsObj !== 'object') return '{}';

  const normalizedComponent = component.toLowerCase();
  const fieldsToKeep = COMPONENT_FIELDS[normalizedComponent];
  if (!fieldsToKeep) return JSON.stringify(detailsObj); // Unknown component: keep all

  const filtered = {};
  for (const fieldPath of fieldsToKeep) {
    const value = getNestedField(detailsObj, fieldPath);
    if (value !== null) {
      filtered[fieldPath] = value;
    }
  }
  return JSON.stringify(filtered, null, 0);
}

// Fetch system prompt from GPT Assistants API or file
let cachedSystemPrompt = null;
async function fetchSystemPrompt() {
  if (cachedSystemPrompt) return cachedSystemPrompt;

  if (SYSTEM_PROMPT_FILE) {
    const filePath = path.resolve(SYSTEM_PROMPT_FILE);
    console.log(`[SystemPrompt] Reading from file: ${filePath}`);
    cachedSystemPrompt = fs.readFileSync(filePath, 'utf-8').trim();
    return cachedSystemPrompt;
  }

  const url = `https://gpt-assistants-api-prod.privatecloud.sg.agoda.is/v1/assistants/slug/${ASSISTANT_ID}`;
  console.log(`[SystemPrompt] Fetching assistant: ${ASSISTANT_ID}`);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch assistant: ${resp.status} ${resp.statusText}`);
  const data = await resp.json();
  cachedSystemPrompt = data.assistant_definition.system_message;
  console.log(`[SystemPrompt] Fetched (${cachedSystemPrompt.length} chars)`);
  return cachedSystemPrompt;
}

// Generate content via GenAI Gateway
async function generateContent(systemPrompt, userPrompt) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: GEN_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: GEN_TEMPERATURE,
        max_tokens: GEN_MAX_TOKENS,
      });
      return response.choices[0].message.content.trim();
    } catch (err) {
      const status = err.status || err.statusCode;
      const retryable = status === 429 || (status >= 500 && status < 600);
      if (retryable && attempt < 2) {
        const delay = 1000 * Math.pow(2, attempt);
        console.warn(`  [GenAI] Retry ${attempt + 1}, waiting ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

// CSV utils
function csvEscape(str) {
  if (!str) return '';
  str = String(str).replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (str.includes(',') || str.includes('"')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// Get already-generated keys from CSV
function getGeneratedKeys(csvPath) {
  if (!fs.existsSync(csvPath)) return new Set();
  const lines = fs.readFileSync(csvPath, 'utf-8').split('\n').filter(l => l.trim());
  if (lines.length <= 1) return new Set();
  const keys = new Set();
  for (const line of lines.slice(1)) {
    const match = line.match(/^(\d+),([^,]+),(\d+)/);
    if (match) keys.add(`${match[1]}_${match[2]}_${match[3]}`); // activity_id_component_lang_id
  }
  return keys;
}

// Append to CSV
let writeQueues = {};
function appendCSV(csvPath, row) {
  if (!writeQueues[csvPath]) writeQueues[csvPath] = Promise.resolve();
  writeQueues[csvPath] = writeQueues[csvPath].then(() => fs.appendFileSync(csvPath, row + '\n'));
  return writeQueues[csvPath];
}

// Main
(async () => {
  if (!fs.existsSync(JSONL_FILE)) {
    console.error(`ERROR: activity-details.jsonl not found at ${JSONL_FILE}`);
    console.error('Run fetch-details.js first.');
    process.exit(1);
  }

  console.log(`[Config] Model: ${GEN_MODEL}, Temp: ${GEN_TEMPERATURE}, MaxTokens: ${GEN_MAX_TOKENS}, Concurrency: ${GEN_CONCURRENCY}`);
  console.log(`[Config] Components: ${requestedComponents.join(', ')}`);
  console.log(`[Config] Languages: ${requestedLangIds.map(id => `${id}(${LANGUAGE_MAP[id] || 'Unknown'})`).join(', ')}`);

  const systemPrompt = await fetchSystemPrompt();

  // Prepare CSV files and headers
  const csvHeaders = {};
  for (const component of requestedComponents) {
    for (const langId of requestedLangIds) {
      const csvPath = path.join(outputDir, `generated-${component}-${langId}.csv`);
      const header = 'activity_id,component,language_id,language_name,details_filtered,enhanced_content,generation_model,generation_error';
      if (!fs.existsSync(csvPath)) fs.writeFileSync(csvPath, header + '\n');
      csvHeaders[`${component}_${langId}`] = { csvPath, generatedKeys: getGeneratedKeys(csvPath) };
    }
  }

  // Build task queue from JSONL
  const tasks = [];
  const rl = readline.createInterface({ input: fs.createReadStream(JSONL_FILE), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.error) continue; // Skip entries with fetch errors
      for (const component of requestedComponents) {
        for (const langId of requestedLangIds) {
          const key = `${entry.activity_id}_${component}_${langId}`;
          const csvKey = `${component}_${langId}`;
          if (!csvHeaders[csvKey].generatedKeys.has(key)) {
            tasks.push({ entry, component, langId, csvPath: csvHeaders[csvKey].csvPath });
          }
        }
      }
    } catch {}
  }

  const totalTasks = tasks.length + Object.values(csvHeaders).reduce((sum, h) => sum + h.generatedKeys.size, 0);
  console.log(`\nTotal tasks: ${totalTasks}, Already generated: ${totalTasks - tasks.length}, Remaining: ${tasks.length}`);
  if (tasks.length === 0) { console.log('All activities already generated!'); return; }

  let generated = totalTasks - tasks.length;
  let errors = 0;

  async function processTask(task) {
    const { entry, component, langId, csvPath } = task;
    const languageName = LANGUAGE_MAP[langId] || `Language_${langId}`;

    try {
      const detailsFiltered = filterDetailsForComponent(entry.details, component);
      const metadataJson = JSON.stringify(entry.metadata || {});
      const userPrompt = USER_PROMPT_TEMPLATE
        .replace('{details}', detailsFiltered)
        .replace('{metadata}', metadataJson)
        .replace('{language}', languageName);

      const enhancedContent = await generateContent(systemPrompt, userPrompt);

      const row = [
        entry.activity_id, component, langId, csvEscape(languageName),
        csvEscape(detailsFiltered.substring(0, 5000)), // Truncate for CSV sanity
        csvEscape(enhancedContent),
        GEN_MODEL, ''
      ].join(',');
      await appendCSV(csvPath, row);
    } catch (err) {
      errors++;
      const row = [
        entry.activity_id, component, langId, csvEscape(LANGUAGE_MAP[langId] || ''),
        '', '', GEN_MODEL, csvEscape(err.message.substring(0, 100))
      ].join(',');
      await appendCSV(csvPath, row);
    }

    generated++;
    if (generated % 5 === 0) console.log(`  ${generated}/${totalTasks} generated (${errors} errors)...`);
  }

  // Worker pool
  const queue = [...tasks];
  const workers = Array.from({ length: GEN_CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const task = queue.shift();
      if (task) await processTask(task);
    }
  });

  await Promise.all(workers);

  console.log(`\n=== GENERATION COMPLETE ===`);
  console.log(`Generated: ${generated}/${totalTasks}`);
  console.log(`Errors: ${errors}`);
  console.log(`Output: ${outputDir}/generated-*.csv`);
})();
