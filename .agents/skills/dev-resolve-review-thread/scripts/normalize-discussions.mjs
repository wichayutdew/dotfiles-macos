import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function normalizeDiscussions(discussions) {
  if (!Array.isArray(discussions)) throw new Error('Expected a paginated discussion array');
  return discussions.map(discussion => {
    // REST puts thread state on resolvable notes; trailing chatter has no state.
    const root = discussion.notes?.find(note => note.resolvable === true);
    const state = typeof discussion.resolvable === 'boolean' ? discussion : root;
    return { ...discussion, resolvable: state?.resolvable === true, resolved: state?.resolved === true };
  });
}

function isMain() {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false; // Imports may have no filesystem entry point (for example eval).
  }
}

if (isMain()) {
  console.log(JSON.stringify(normalizeDiscussions(JSON.parse(readFileSync(process.argv[2], 'utf8')))));
}
