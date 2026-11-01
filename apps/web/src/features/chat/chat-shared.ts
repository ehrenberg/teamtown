import type { ChannelSummary, PeopleListResponse } from '@teamtown/contracts';
import type { TFunction } from 'i18next';
import { ApiError } from '../../api/api-client.ts';

export type Person = PeopleListResponse['people'][number];

export const OVERLAY = 'fixed inset-0 bg-espresso/40';
export const CONTENT =
  'fixed top-1/2 left-1/2 flex w-[min(30rem,90vw)] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-md bg-surface-raised p-5 shadow-raised';
export const INPUT = 'min-h-6 rounded-md border border-border-subtle bg-surface-sunken px-3 py-2 text-sm';

/** `#name` for channels; the other people's names for DMs. */
export function channelTitle(
  channel: ChannelSummary,
  myPersonId: string | null,
  people: ReadonlyMap<string, Person>,
  t: TFunction,
): string {
  if (channel.kind !== 'direct') return `#${channel.name ?? ''}`;
  const others = channel.members
    .filter((personId) => personId !== myPersonId)
    .map((personId) => people.get(personId)?.displayName ?? t('chat.someone'));
  return others.length > 0 ? others.join(', ') : t('chat.justYou');
}

/** A refusal in plain words (brand guide §6); unknown codes get a generic sentence. */
export function errorText(error: unknown, t: TFunction): string {
  const code = error instanceof ApiError ? error.code : null;
  const known = code !== null && t(`chat.error.${code}`, { defaultValue: '' });
  return known || t('chat.error.generic');
}
