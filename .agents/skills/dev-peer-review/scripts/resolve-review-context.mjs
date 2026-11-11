import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Run inside the reviewer. Derive bundled resources from this installed module,
// never from the implementation parent's cwd or a sibling installation layout.
export function resolveReviewContext(
  skillDirectory = path.dirname(path.dirname(fs.realpathSync(fileURLToPath(import.meta.url))))
) {
  if (!path.isAbsolute(skillDirectory)) throw new Error('Peer skill directory must be absolute');
  const context = {
    skillPath: path.join(skillDirectory, 'SKILL.md'),
    schemaPath: path.join(skillDirectory, 'references/review-record-schema.md'),
    storeScript: path.join(skillDirectory, 'scripts/store-review.mjs'),
    publishScript: path.join(skillDirectory, 'scripts/publish-review.mjs'),
    publishingPath: path.join(skillDirectory, 'references/publishing.md'),
  };
  for (const file of Object.values(context)) {
    try {
      fs.accessSync(file, fs.constants.R_OK);
      if (!fs.statSync(file).isFile()) throw new Error('not a file');
    } catch {
      throw new Error(`blocked: peer-review dependency unavailable: ${file}`);
    }
  }
  return context;
}

function isMain() {
  try {
    return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false; // Imports may have no filesystem entry point (for example eval).
  }
}

if (isMain()) {
  console.log(JSON.stringify(resolveReviewContext()));
}
