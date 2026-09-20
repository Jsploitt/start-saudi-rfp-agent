import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* The source tree. These travel with the image and are read-only at runtime. */
export const KIT_DIR = join(ROOT, 'start-saudi-kit');
export const PUBLIC_DIR = join(ROOT, 'public');
export const FIXTURES_DIR = join(ROOT, 'fixtures');

/* Everything written at runtime lives under one mounted volume, so a container
   restart finds the database and the generated documents where it left them.
   Unset, it falls back to the source tree, which is what a dev checkout wants. */
export const DATA_DIR = process.env.DATA_DIR ?? ROOT;
export const RUNS_DIR = join(DATA_DIR, 'runs');
export const UPLOADS_DIR = join(DATA_DIR, 'uploads');
export const DB_PATH = join(DATA_DIR, 'app.db');
