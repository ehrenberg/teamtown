/** The custom scheme registered by the desktop app (ADR-0023); also used for invite links later. */
export const PROTOCOL = 'teamtown';
export const AUTH_CALLBACK_URL = `${PROTOCOL}://auth/callback`;

/**
 * On Windows and Linux the OS starts a second app instance with the deep link as a command-line
 * argument; on macOS it arrives via the `open-url` event instead.
 */
export const findDeepLink = (argv: readonly string[]): string | null =>
  argv.find((argument) => argument.toLowerCase().startsWith(`${PROTOCOL}://`)) ?? null;

export type AuthCallback =
  | { readonly kind: 'code'; readonly code: string; readonly state: string }
  | { readonly kind: 'error'; readonly error: string; readonly state: string | null };

/** Parses `teamtown://auth/callback?...`; returns null for any other deep link. */
export function parseAuthCallback(link: string): AuthCallback | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.protocol !== `${PROTOCOL}:` || url.host !== 'auth' || url.pathname.replace(/\/$/, '') !== '/callback') {
    return null;
  }
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  if (error) return { kind: 'error', error, state };
  const code = url.searchParams.get('code');
  return code && state ? { kind: 'code', code, state } : { kind: 'error', error: 'invalid_callback', state };
}
