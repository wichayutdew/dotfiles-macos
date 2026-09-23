// Fetch Activity Details via gRPC detailSeo endpoint
// Usage: node fetch-details.js
// Env vars:
//   OUTPUT_DIR       — output directory (required, e.g., prompt-quality-eval/my-run)
//   IDS_FILE         — path to activity IDs file (default: sample-ids.txt)
//   GRPC_HOST        — gRPC endpoint (default: activity-contentread-production.privatecloud.hk.agoda.is:80)
//   FETCH_CONCURRENCY — parallel requests (default: 10)

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

const OUTPUT_DIR = process.env.OUTPUT_DIR;
if (!OUTPUT_DIR) { console.error('OUTPUT_DIR env var is required'); process.exit(1); }

const outputDir = path.resolve(OUTPUT_DIR);
const IDS_FILE = process.env.IDS_FILE || 'sample-ids.txt';
const idsFilePath = path.resolve(outputDir, IDS_FILE);
const GRPC_HOST = process.env.GRPC_HOST || 'activity-contentread-production.privatecloud.hk.agoda.is:80';
const FETCH_CONCURRENCY = Math.max(1, parseInt(process.env.FETCH_CONCURRENCY, 10) || 10);
const OUTPUT_JSONL = path.join(outputDir, 'activity-details.jsonl');

// Check for grpcurl
async function checkGrpcurl() {
  try {
    await execAsync('which grpcurl');
  } catch {
    console.error('ERROR: grpcurl not found. Install with: brew install grpcurl');
    process.exit(1);
  }
}

// Read activity IDs from file
function readActivityIds() {
  if (!fs.existsSync(idsFilePath)) {
    console.error(`ERROR: IDs file not found: ${idsFilePath}`);
    process.exit(1);
  }
  const lines = fs.readFileSync(idsFilePath, 'utf-8').split('\n');
  const ids = new Set();
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\d+$/.test(trimmed)) ids.add(parseInt(trimmed, 10));
  }
  return Array.from(ids);
}

// Get already-fetched IDs from output JSONL
function getFetchedIds() {
  if (!fs.existsSync(OUTPUT_JSONL)) return new Set();
  const lines = fs.readFileSync(OUTPUT_JSONL, 'utf-8').split('\n').filter(l => l.trim());
  const ids = new Set();
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.activity_id) ids.add(obj.activity_id);
    } catch {}
  }
  return ids;
}

// Call grpcurl for one activity
async function fetchActivityDetails(activityId) {
  const requestJson = JSON.stringify({
    requestContext: {
      sessionId: 'prompt-eval',
      correlationId: 'prompt-eval',
      userId: 'prompt-eval',
      whitelabelId: 0,
      locale: { languageId: 1 },
      isInternalTraffic: true
    },
    activityId
  });

  const cmd = `grpcurl -plaintext -d '${requestJson}' ${GRPC_HOST} com.agoda.activity.contentread.proto.ActivityContentReadService/activityDetailSeo`;

  try {
    const { stdout } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 }); // 10MB buffer
    const response = JSON.parse(stdout);

    // Check for error in response
    if (response.responseMeta?.error?.errorType) {
      return { activity_id: activityId, error: response.responseMeta.error.errorType };
    }

    return {
      activity_id: activityId,
      details: response.details || {},
      metadata: response.detailsMeta || {}
    };
  } catch (err) {
    return { activity_id: activityId, error: err.message.substring(0, 100) };
  }
}

// Append result to JSONL
let writeQueue = Promise.resolve();
function appendJsonl(obj) {
  const line = JSON.stringify(obj) + '\n';
  writeQueue = writeQueue.then(() => fs.appendFileSync(OUTPUT_JSONL, line));
  return writeQueue;
}

(async () => {
  await checkGrpcurl();

  const activityIds = readActivityIds();
  const fetchedIds = getFetchedIds();
  const remaining = activityIds.filter(id => !fetchedIds.has(id));

  console.log(`Total IDs: ${activityIds.length}, Already fetched: ${fetchedIds.size}, Remaining: ${remaining.length}`);
  console.log(`Concurrency: ${FETCH_CONCURRENCY}, Output: ${OUTPUT_JSONL}`);

  if (remaining.length === 0) { console.log('All activities already fetched!'); return; }

  let fetched = fetchedIds.size;
  let errors = 0;

  async function processId(activityId) {
    const result = await fetchActivityDetails(activityId);
    await appendJsonl(result);
    if (result.error) errors++;
    fetched++;
    if (fetched % 10 === 0) console.log(`  ${fetched}/${activityIds.length} fetched (${errors} errors)...`);
  }

  // Parallel worker pool
  const queue = [...remaining];
  const workers = Array.from({ length: FETCH_CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const id = queue.shift();
      if (id) await processId(id);
    }
  });

  await Promise.all(workers);

  console.log(`\n=== FETCH COMPLETE ===`);
  console.log(`Fetched: ${fetched}/${activityIds.length}`);
  console.log(`Errors: ${errors}`);
  console.log(`Output: ${OUTPUT_JSONL}`);
})();
