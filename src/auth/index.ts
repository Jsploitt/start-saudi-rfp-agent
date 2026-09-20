/**
 * A shared passcode, and a signed cookie.
 *
 * The cookie is not a style preference. EventSource cannot set an Authorization
 * header, so a bearer token would force the UI off EventSource and onto a
 * hand-rolled fetch-stream reader. The token is stateless, so a restart does not
 * sign everyone out — which matters, because a restart is how this deploys.
 *
 * CSRF is covered by SameSite=Lax plus a content-type requirement on mutating
 * routes: a cross-site HTML form can send urlencoded or multipart, never
 * application/json, and it cannot set X-Requested-With.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { NextFunction, Request, Response } from 'express';
import { upsertUser, getUser } from '../db/store.js';

export const COOKIE = 'ss_session';
const MAX_AGE_S = 30 * 24 * 60 * 60;

export type AuthUser = { id: string; name: string };

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

let warned = false;

function secret(): Uint8Array {
  const raw = process.env.SESSION_SECRET;
  if (raw && raw.length >= 16) return new TextEncoder().encode(raw);
  if (!warned) {
    warned = true;
    console.warn(
      'SESSION_SECRET is unset or too short. Using a per-process key: every restart signs ' +
        'everyone out. Set a long random SESSION_SECRET before hosting this.'
    );
  }
  return EPHEMERAL_SECRET;
}
const EPHEMERAL_SECRET = randomBytes(32);

/** Unset, a passcode is generated and printed once, so nothing is ever open. */
let generatedPasscode: string | null = null;
export function passcode(): string {
  const configured = process.env.ACCESS_PASSCODE;
  if (configured) return configured;
  if (!generatedPasscode) {
    generatedPasscode = randomBytes(4).toString('hex');
    console.warn(
      `ACCESS_PASSCODE is unset. This run's passcode is: ${generatedPasscode}\n` +
        '  It changes every restart. Set ACCESS_PASSCODE before hosting this.'
    );
  }
  return generatedPasscode;
}

/** Constant time, and length-safe: timingSafeEqual throws on a length mismatch. */
export function passcodeMatches(supplied: string): boolean {
  const a = Buffer.from(String(supplied));
  const b = Buffer.from(passcode());
  if (a.length !== b.length) {
    // Still do the comparison, so a wrong length is not measurably faster.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

export async function issueToken(user: AuthUser): Promise<string> {
  return new SignJWT({ name: user.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(secret());
}

export async function readToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    const name = typeof payload.name === 'string' ? payload.name : '';
    /* The row is the record; the token only asserts which row. */
    return getUser(payload.sub) ?? { id: payload.sub, name };
  } catch {
    return null;
  }
}

export function login(name: string): Promise<string> {
  const clean = name.trim().slice(0, 80) || 'Guest';
  return issueToken({ id: upsertUser(clean), name: clean });
}

export function cookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    /* Behind Railway's proxy the app speaks http, so Secure keys off the
       deployment rather than off req.protocol. */
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_S * 1000,
  };
}

/** Guards every /api route but login and healthz, and the /runs mount. */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = (req.cookies as Record<string, string> | undefined)?.[COOKIE];
  const user = token ? await readToken(token) : null;
  if (!user) {
    res.status(401).json({ error: 'Not signed in.', code: 'unauthenticated' });
    return;
  }
  req.user = user;
  next();
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * A cross-site form can only send urlencoded, multipart or plain text, and it
 * cannot set a custom header. Requiring one or the other is the whole defence.
 */
export function requireSameOrigin(req: Request, res: Response, next: NextFunction): void {
  if (!MUTATING.has(req.method)) return next();

  const type = String(req.get('content-type') ?? '').toLowerCase();
  if (type.startsWith('application/json')) return next();
  if (type.startsWith('multipart/form-data') && req.get('x-requested-with') === 'fetch') {
    return next();
  }

  res.status(415).json({
    error:
      'Mutating requests must be application/json, or multipart with X-Requested-With: fetch.',
    code: 'bad_content_type',
  });
}
