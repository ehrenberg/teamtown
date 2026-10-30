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

  it('round-trips the conversation messages', () => {
    const lock: ClientCommand = { t: 'LockConversation', id: 'c-2', p: { conversationId: 'conv-1' } };
    const changed: ServerEvent = {
      t: 'ConversationChanged',
      p: {
        floorId: 'ground-floor',
        conversation: {
          conversationId: 'conv-1',
          participants: ['3f0e8a4c-9d1b-4c5e-8f2a-1b2c3d4e5f60', '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'],
          locked: true,
        },
      },
    };
    const access: ServerEvent = {
      t: 'ConversationAccessGranted',
      p: { conversationId: 'conv-1', url: 'ws://localhost:7880', token: 'jwt' },
    };

    expect(decodeClientCommand(encodeMessage(lock))).toEqual({ ok: true, value: lock });
    expect(decodeServerEvent(encodeMessage(changed))).toEqual({ ok: true, value: changed });
    expect(decodeServerEvent(encodeMessage(access))).toEqual({ ok: true, value: access });
  });

  it('round-trips the room messages', () => {
    const lena = '3f0e8a4c-9d1b-4c5e-8f2a-1b2c3d4e5f60';
    const commands: ClientCommand[] = [
      { t: 'SetDoorMode', id: 'c-3', p: { roomId: 'elbe', doorMode: 'locked' } },
      { t: 'KnockOnRoom', p: { roomId: 'elbe' } },
      { t: 'CancelKnock', p: { knockId: 'k-1' } },
      { t: 'AnswerKnock', id: 'c-4', p: { knockId: 'k-1', admit: true } },
      { t: 'RequestRoomCallToken', p: { roomId: 'elbe' } },
    ];
    const events: ServerEvent[] = [
      { t: 'DoorModeChanged', p: { floorId: 'ground-floor', roomId: 'elbe', doorMode: 'knock' } },
      { t: 'RoomCallChanged', p: { floorId: 'ground-floor', roomCall: { roomId: 'elbe', participants: [lena] } } },
      {
        t: 'KnockRequested',
        p: { knockId: 'k-1', floorId: 'ground-floor', roomId: 'elbe', requester: lena, expiresAt: 1_060_000 },
      },
      { t: 'KnockAnswered', p: { knockId: 'k-1', roomId: 'elbe', outcome: 'admitted' } },
      { t: 'RoomCallAccessGranted', p: { roomId: 'elbe', url: 'ws://localhost:7880', token: 'jwt' } },
    ];

    for (const command of commands) {
      expect(decodeClientCommand(encodeMessage(command))).toEqual({ ok: true, value: command });
    }
    for (const event of events) {
      expect(decodeServerEvent(encodeMessage(event))).toEqual({ ok: true, value: event });
    }
  });

  it('round-trips the direct call messages', () => {
    const anna = '3f0e8a4c-9d1b-4c5e-8f2a-1b2c3d4e5f60';
    const ben = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
    const commands: ClientCommand[] = [
      { t: 'StartCall', id: 'c-5', p: { personId: ben } },
      { t: 'InviteToCall', p: { callId: 'call-1', personId: ben } },
      { t: 'AnswerCall', p: { callId: 'call-1', accept: true } },
      { t: 'LeaveCall', p: { callId: 'call-1' } },
      { t: 'RequestDirectCallToken', p: { callId: 'call-1' } },
      { t: 'ListOnlinePeople', id: 'c-6', p: {} },
    ];
    const events: ServerEvent[] = [
      {
        t: 'DirectCallChanged',
        p: {
          call: {
            callId: 'call-1',
            participants: [anna],
            invitations: [{ personId: ben, invitedBy: anna, ringsUntil: 1_030_000 }],
          },
        },
      },
      { t: 'DirectCallEnded', p: { callId: 'call-1' } },
      { t: 'CallInvitationAnswered', p: { callId: 'call-1', personId: ben, outcome: 'busy' } },
      { t: 'DirectCallAccessGranted', p: { callId: 'call-1', url: 'ws://localhost:7880', token: 'jwt' } },
      { t: 'OnCallChanged', p: { floorId: 'ground-floor', personId: anna, onCall: true } },
      {
        t: 'OnlinePeople',
        p: { people: [{ personId: ben, displayName: 'Ben', avatarColor: '#2F6F8F', floorId: 'upper-floor' }] },
      },
    ];

    for (const command of commands) {
      expect(decodeClientCommand(encodeMessage(command))).toEqual({ ok: true, value: command });
    }
    for (const event of events) {
      expect(decodeServerEvent(encodeMessage(event))).toEqual({ ok: true, value: event });
    }
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
