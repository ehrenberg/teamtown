import { createHash, randomBytes } from 'node:crypto';

/** Proof Key for Code Exchange (RFC 7636), method S256. */
export interface PkcePair {
  readonly verifier: string;
  readonly challenge: string;
}

export const challengeFor = (verifier: string): string => createHash('sha256').update(verifier).digest('base64url');

export function createPkcePair(): PkcePair {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: challengeFor(verifier) };
}

/** Opaque value that binds the callback to the login this app started (CSRF protection). */
export const createState = (): string => randomBytes(16).toString('base64url');
