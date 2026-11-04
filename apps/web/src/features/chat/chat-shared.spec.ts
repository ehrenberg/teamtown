import type { ChannelSummary } from '@teamtown/contracts';
import { describe, expect, it } from 'vitest';
import { canPin, messageExcerpt } from './chat-shared.ts';

const aChannel = (overrides: Partial<ChannelSummary>): ChannelSummary => ({
  channelId: 'c1',
  kind: 'public',
  group: false,
  name: 'team',
  creatorId: 'anna',
  floorId: null,
  roomId: null,
  members: ['anna', 'ben'],
  archived: false,
  unreadCount: 0,
  mentionCount: 0,
  lastMessageAt: null,
  readMarker: null,
  ...overrides,
});

describe('canPin', () => {
  it('lets only the creator pin in a channel (P-25)', () => {
    expect(canPin(aChannel({}), 'anna')).toBe(true);
    expect(canPin(aChannel({}), 'ben')).toBe(false);
    expect(canPin(aChannel({ kind: 'private' }), 'ben')).toBe(false);
  });

  it('lets any member pin in a DM or on a room wall (P-26)', () => {
    expect(canPin(aChannel({ kind: 'direct', creatorId: null }), 'ben')).toBe(true);
    expect(canPin(aChannel({ kind: 'room', creatorId: null }), 'ben')).toBe(true);
    expect(canPin(aChannel({ kind: 'room', creatorId: null }), 'carl')).toBe(false);
  });

  it('lets nobody pin in an archived channel', () => {
    expect(canPin(aChannel({ archived: true }), 'anna')).toBe(false);
  });
});

describe('messageExcerpt', () => {
  it('drops Markdown marks and mention tokens, and shortens long text', () => {
    expect(messageExcerpt('**Hi** <@abc>, see `this`')).toBe('Hi @…, see this');
    expect(messageExcerpt('x'.repeat(70))).toBe(`${'x'.repeat(60)}…`);
  });
});
