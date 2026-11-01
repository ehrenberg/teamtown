import * as Popover from '@radix-ui/react-popover';
import { MessageSchema, type MessageContract } from '@teamtown/contracts';
import { EmojiPicker } from 'frimousse';
import { SmilePlus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiDelete, apiSend } from '../../api/api-client.ts';
import { channelPath } from './composer.tsx';

/** The quick bar (decided 2026-11-01, ADR-0034). */
export const QUICK_EMOJI = ['👍', '❤️', '😂', '🎉', '👀', '🙏'] as const;
/** Self-hosted Emojibase data (vite.config.ts), never a CDN. */
const EMOJIBASE_URL = '/emojibase';
/** Names listed in a chip's label before "and N more". */
const NAMES_SHOWN = 3;

const reactionPath = (message: MessageContract, emoji: string) =>
  `${channelPath(message.channelId)}/messages/${encodeURIComponent(message.messageId)}/reactions/${encodeURIComponent(emoji)}`;

/** Adds or removes my reaction; the push updates everyone's view, mine included. */
export function toggleReaction(message: MessageContract, emoji: string, mine: boolean): Promise<unknown> {
  return mine
    ? apiDelete(reactionPath(message, emoji))
    : apiSend('PUT', reactionPath(message, emoji), {}, MessageSchema);
}

/** Reaction chips under a message: emoji and count, pressed when I reacted; the label names the people. */
export function ReactionChips({
  message,
  myPersonId,
  nameOf,
  canReact,
  onError,
}: {
  readonly message: MessageContract;
  readonly myPersonId: string | null;
  readonly nameOf: (personId: string) => string;
  readonly canReact: boolean;
  readonly onError: (failure: unknown) => void;
}) {
  const { t } = useTranslation();
  if (message.reactions.length === 0) return null;
  return (
    <ul aria-label={t('chat.reactions')} className="mt-1 flex flex-wrap gap-1">
      {message.reactions.map((reaction) => {
        const mine = myPersonId !== null && reaction.personIds.includes(myPersonId);
        const names = reaction.personIds.slice(0, NAMES_SHOWN).map(nameOf);
        const more = reaction.personIds.length - names.length;
        const label = t('chat.reactionLabel', {
          emoji: reaction.emoji,
          names: more > 0 ? t('chat.namesAndMore', { names: names.join(', '), count: more }) : names.join(', '),
          count: reaction.personIds.length,
        });
        return (
          <li key={reaction.emoji}>
            <button
              type="button"
              aria-pressed={mine}
              aria-label={label}
              title={label}
              disabled={!canReact}
              onClick={() => {
                toggleReaction(message, reaction.emoji, mine).catch(onError);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface-raised px-2 py-0.5 text-xs aria-pressed:border-terracotta-500 aria-pressed:bg-terracotta-100 disabled:cursor-default"
            >
              <span aria-hidden="true">{reaction.emoji}</span>
              <span aria-hidden="true" className="font-medium">
                {reaction.personIds.length}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** "More reactions": every Unicode emoji, searchable, with skin tones (frimousse, ADR-0034). */
export function ReactionPicker({ onPick }: { readonly onPick: (emoji: string) => void }) {
  const { t, i18n } = useTranslation();
  const label = t('chat.moreReactions');
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={label}
        title={label}
        className="grid size-7 place-items-center rounded-sm hover:bg-neutral-100"
      >
        <SmilePlus aria-hidden="true" className="size-3.5" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="left"
          align="start"
          sideOffset={6}
          aria-label={label}
          className="z-30 rounded-md border border-border-subtle bg-surface-raised shadow-raised"
        >
          <EmojiPicker.Root
            locale={i18n.language.startsWith('de') ? 'de' : 'en'}
            emojibaseUrl={EMOJIBASE_URL}
            columns={8}
            onEmojiSelect={({ emoji }) => {
              setOpen(false);
              onPick(emoji);
            }}
            className="flex h-80 w-[19rem] flex-col"
          >
            <EmojiPicker.Search
              aria-label={t('chat.searchEmoji')}
              placeholder={t('chat.searchEmoji')}
              className="m-2 rounded-md border border-border-subtle bg-surface-sunken px-2 py-1 text-sm"
            />
            <EmojiPicker.Viewport className="relative flex-1 outline-hidden">
              <EmojiPicker.Loading className="absolute inset-0 grid place-items-center text-sm text-text-secondary">
                {t('chat.loading')}
              </EmojiPicker.Loading>
              <EmojiPicker.Empty className="absolute inset-0 grid place-items-center text-sm text-text-secondary">
                {t('chat.noEmoji')}
              </EmojiPicker.Empty>
              <EmojiPicker.List
                className="pb-2 select-none"
                components={{
                  CategoryHeader: ({ category, ...props }) => (
                    <div
                      {...props}
                      className="bg-surface-raised px-3 pt-2 pb-1 text-xs font-medium text-text-secondary"
                    >
                      {category.label}
                    </div>
                  ),
                  Row: ({ children, ...props }) => (
                    <div {...props} className="scroll-my-1 px-2">
                      {children}
                    </div>
                  ),
                  Emoji: ({ emoji, ...props }) => (
                    <button
                      {...props}
                      className="grid size-8 place-items-center rounded-sm text-lg data-[active]:bg-neutral-100"
                    >
                      {emoji.emoji}
                    </button>
                  ),
                }}
              />
            </EmojiPicker.Viewport>
            <div className="flex items-center justify-end border-t border-border-subtle px-2 py-1">
              <EmojiPicker.SkinToneSelector
                aria-label={t('chat.skinTone')}
                className="grid size-7 place-items-center rounded-sm hover:bg-neutral-100"
              />
            </div>
          </EmojiPicker.Root>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
