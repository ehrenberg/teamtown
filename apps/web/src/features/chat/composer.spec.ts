import type { ChannelSummary } from '@teamtown/contracts';
import { describe, expect, it } from 'vitest';
import { canAddPeople } from './composer.tsx';

const aDirectMessage = (members: readonly string[], group: boolean): ChannelSummary => ({
  channelId: 'dm-1',
  kind: 'direct',
  group,
  name: null,
  creatorId: null,
  floorId: null,
  roomId: null,
  members: [...members],
  archived: false,
  unreadCount: 0,
  mentionCount: 0,
  lastMessageAt: null,
  readMarker: null,
});

describe('canAddPeople', () => {
  it('lets either member add someone to a 1:1 DM', () => {
    const pair = aDirectMessage(['anna', 'ben'], false);

    expect(canAddPeople(pair, 'anna')).toBe(true);
    expect(canAddPeople(pair, 'carl')).toBe(false);
  });

  it('stops accepting people when a group DM has eight members', () => {
    const fullGroup = aDirectMessage(
      Array.from({ length: 8 }, (_, index) => `person-${String(index)}`),
      true,
    );

    expect(canAddPeople(fullGroup, 'person-0')).toBe(false);
  });
});
