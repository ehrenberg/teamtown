import { err, ok, type Result } from '@teamtown/kernel';

const VALID_NAME = /^[a-z0-9_-]{1,40}$/;

/**
 * Normalises what someone typed into a channel name (ADR-0033): without the `#`, lowercase, spaces become `-`.
 * Valid names have 1–40 characters from `a–z`, `0–9`, `-` and `_`.
 */
export function channelName(raw: string): Result<string, 'invalid-channel-name'> {
  const name = raw.trim().replace(/^#+/, '').trim().toLowerCase().replace(/\s+/g, '-');
  return VALID_NAME.test(name) ? ok(name) : err('invalid-channel-name');
}
