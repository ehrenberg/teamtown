import { decode, encode } from '@msgpack/msgpack';
import { err, ok, type Result } from '@teamtown/kernel';
import type { z } from 'zod';
import { ClientCommand, ServerEvent } from './messages.ts';

export type DecodeError = 'malformed' | 'invalid';

export const encodeMessage = (message: ClientCommand | ServerEvent): Uint8Array => encode(message);

function decodeWith<Schema extends z.ZodType>(schema: Schema, bytes: Uint8Array): Result<z.infer<Schema>, DecodeError> {
  let raw: unknown;
  try {
    raw = decode(bytes);
  } catch {
    return err('malformed');
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? ok(parsed.data) : err('invalid');
}

/** Used by the server: every incoming frame is validated before it reaches a handler. */
export const decodeClientCommand = (bytes: Uint8Array): Result<ClientCommand, DecodeError> =>
  decodeWith(ClientCommand, bytes);

/** Used by the client. */
export const decodeServerEvent = (bytes: Uint8Array): Result<ServerEvent, DecodeError> =>
  decodeWith(ServerEvent, bytes);
