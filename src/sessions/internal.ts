/**
 * A second listener, on loopback only, that serves the generated documents with
 * no auth.
 *
 * Once /runs/* is behind the session cookie, Chromium gets a 401 and prints the
 * login page instead of the proposal. Chromium could be given the cookie, but
 * that means export/pdf.ts learning about auth, and that file belongs to another
 * session. A loopback origin keeps it untouched.
 *
 * Never 0.0.0.0, and the port is never published.
 */

import express from 'express';
import type { Server } from 'node:http';
import { PUBLIC_DIR, RUNS_DIR } from '../paths.js';

let server: Server | null = null;
let origin: string | null = null;

export function startInternalStatic(): Promise<string> {
  if (origin) return Promise.resolve(origin);

  const app = express();
  app.use('/runs', express.static(RUNS_DIR));
  app.use(express.static(PUBLIC_DIR)); // /assets and the brand tokens

  return new Promise((resolve, reject) => {
    const requested = Number(process.env.INTERNAL_PORT ?? 0); // 0: let the OS pick
    const listener = app.listen(requested, '127.0.0.1', () => {
      const address = listener.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Internal static listener did not bind to a port.'));
        return;
      }
      server = listener;
      origin = `http://127.0.0.1:${address.port}`;
      resolve(origin);
    });
    listener.on('error', reject);
  });
}

export function internalOrigin(): string | null {
  return origin;
}

export function stopInternalStatic(): void {
  server?.close();
  server = null;
  origin = null;
}
