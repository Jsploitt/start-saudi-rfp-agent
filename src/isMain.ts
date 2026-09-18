import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** `import.meta.url === argv[1]`, but correct on Windows. */
export function isMain(metaUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return resolve(fileURLToPath(metaUrl)) === resolve(entry);
}
