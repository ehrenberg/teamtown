import type { ChannelSummary } from '@teamtown/contracts';
import { describe, expect, it } from 'vitest';
import { pickChannels, pickPeople } from './palette-entries.ts';

const channel = (overrides: Partial<ChannelSummary>): ChannelSummary => ({
  channelId: overrides.name ?? 'c',
  kind: 'public',
  group: false,
  name: 'team',
  creatorId: null,
  floorId: null,
  roomId: null,
  members: [],
  archived: false,
  unreadCount: 0,
  mentionCount: 0,
  lastMessageAt: null,
  readMarker: null,
  canManage: false,
  canArchive: false,
  canPin: false,
  canDeleteAny: false,
  ...overrides,
});
const titleOf = (c: ChannelSummary) => (c.kind === 'room' ? (c.name ?? '') : `#${c.name ?? ''}`);
const browse = (name: string, isMember: boolean) => ({
  channelId: name,
  name,
  memberCount: 1,
  archived: false,
  isMember,
});
const person = (personId: string, displayName: string) => ({ personId, displayName, avatarColor: '#000000' });

describe('pickChannels', () => {
  it('ignores case and finds a channel by part of its name', () => {
    const found = pickChannels('MARK', [channel({ name: 'marketing' }), channel({ name: 'team' })], [], titleOf);

    expect(found.map((entry) => entry.label)).toEqual(['#marketing']);
  });

  it('adds public channels I have not joined, and room walls, only once something is typed (P-29)', () => {
    const mine = [channel({ name: 'team' }), channel({ name: 'teamraum', kind: 'room' })];
    const others = [browse('team', true), browse('team-nord', false)];

    expect(pickChannels('', mine, others, titleOf).map((entry) => entry.label)).toEqual(['#team']);
    expect(pickChannels('team', mine, others, titleOf)).toMatchObject([
      { label: '#team', kind: 'channel' },
      { label: 'teamraum', kind: 'room' },
      { label: '#team-nord', kind: 'not-joined' },
    ]);
  });

  it('leaves out 1:1 DMs and archived channels, but keeps group DMs', () => {
    const mine = [
      channel({ name: 'pair', kind: 'direct' }),
      channel({ name: 'group', kind: 'direct', group: true }),
      channel({ name: 'old', archived: true }),
    ];

    expect(pickChannels('', mine, [], titleOf).map((entry) => entry.label)).toEqual(['#group']);
  });

  it('shows at most five entries per section', () => {
    const mine = Array.from({ length: 8 }, (_, index) => channel({ name: `team-${String(index)}` }));

    expect(pickChannels('team', mine, [], titleOf)).toHaveLength(5);
  });
});

describe('pickPeople', () => {
  const people = [person('me', 'Anna Ich'), person('b', 'Anna Berg'), person('c', 'Ben Krüger')];

  it('finds others by name, never me', () => {
    expect(pickPeople('anna', people, 'me').map((found) => found.personId)).toEqual(['b']);
  });

  it('stays empty until something is typed', () => {
    expect(pickPeople('  ', people, 'me')).toEqual([]);
  });
});
