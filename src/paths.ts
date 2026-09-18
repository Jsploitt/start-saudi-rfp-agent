import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const KIT_DIR = join(ROOT, 'start-saudi-kit');
export const PUBLIC_DIR = join(ROOT, 'public');
export const RUNS_DIR = join(ROOT, 'runs');
export const FIXTURES_DIR = join(ROOT, 'fixtures');
