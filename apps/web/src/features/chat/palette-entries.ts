import type { BrowseChannelsResponse, ChannelSummary, PeopleListResponse } from '@teamtown/contracts';

/** Entries per section (P-29), so that "Messages" stays in reach. */
const SECTION_SIZE = 5;

export interface ChannelEntry {
  readonly channelId: string;
  readonly label: string;
  readonly kind: 'channel' | 'room' | 'not-joined';
}

const matches = (name: string, query: string) => name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());

/**
 * My channels and room walls, then public channels I haven't joined; only those with a name matching the query, and
 * with an empty query only my channels. 1:1 DMs are left out: their person is in the "People" section.
 */
export function pickChannels(
  query: string,
  mine: readonly ChannelSummary[],
  browse: BrowseChannelsResponse['channels'],
  titleOf: (channel: ChannelSummary) => string,
): ChannelEntry[] {
  const own: ChannelEntry[] = mine
    .filter((channel) => (channel.kind !== 'direct' || channel.group) && !channel.archived)
    .filter((channel) => query.trim() !== '' || channel.kind !== 'room')
    .map((channel) => ({
      channelId: channel.channelId,
      label: titleOf(channel),
      kind: channel.kind === 'room' ? 'room' : 'channel',
    }));
  const others: ChannelEntry[] =
    query.trim() === ''
      ? []
      : browse
          .filter((channel) => !channel.isMember)
          .map((channel) => ({ channelId: channel.channelId, label: `#${channel.name}`, kind: 'not-joined' }));
  return [...own, ...others].filter((entry) => matches(entry.label, query)).slice(0, SECTION_SIZE);
}

/** Everyone else by name; nobody until something is typed, since the list would only be noise. */
export function pickPeople(
  query: string,
  people: PeopleListResponse['people'],
  myPersonId: string | null,
): PeopleListResponse['people'] {
  if (query.trim() === '') return [];
  return people
    .filter((person) => person.personId !== myPersonId && matches(person.displayName, query))
    .slice(0, SECTION_SIZE);
}
