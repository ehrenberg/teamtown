import { err, ok, type Result } from '@teamtown/kernel';

const MAX_LENGTH = 80;

export function groupName(raw: string): Result<string, 'invalid-group-name'> {
  const name = raw.trim();
  return name.length > 0 && name.length <= MAX_LENGTH ? ok(name) : err('invalid-group-name');
}
