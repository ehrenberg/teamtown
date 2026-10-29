import { encode } from '@msgpack/msgpack';
import { describe, expect, it } from 'vitest';
import { decodeClientCommand, decodeServerEvent, encodeMessage } from './codec.ts';
import type { ClientCommand, ServerEvent } from './messages.ts';

describe('realtime codec', () => {
  it('round-trips a client command through MessagePack', () => {
    const ping: ClientCommand = { t: 'Ping', id: 'c-1', p: { clientTime: 1_000 } };

    expect(decodeClientCommand(encodeMessage(ping))).toEqual({ ok: true, value: ping });
  });

  it('round-trips a server event through MessagePack', () => {
    const pong: ServerEvent = { t: 'Pong', p: { clientTime: 1_000, serverTime: 1_050 } };

    expect(decodeServerEvent(encodeMessage(pong))).toEqual({ ok: true, value: pong });
  });

  it('rejects bytes that are not MessagePack', () => {
    expect(decodeClientCommand(new Uint8Array([0xc1]))).toEqual({ ok: false, error: 'malformed' });
  });

  it('rejects unknown message types and wrong payloads', () => {
    expect(decodeClientCommand(encode({ t: 'DropTables', p: {} }))).toEqual({ ok: false, error: 'invalid' });
    expect(decodeClientCommand(encode({ t: 'Ping', p: { clientTime: 'now' } }))).toEqual({
      ok: false,
      error: 'invalid',
    });
  });

  it('does not accept server events as client commands', () => {
    const pong = encode({ t: 'Pong', p: { clientTime: 1, serverTime: 2 } });

    expect(decodeClientCommand(pong)).toEqual({ ok: false, error: 'invalid' });
  });
});
