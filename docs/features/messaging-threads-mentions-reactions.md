# Feature: Threads, mentions and reactions

- **Status:** Done (2026-11-01), except the command palette entry and a screen reader check (see below)
- **Brainstorming ID:** M3 Threads, mentions, reactions
- **Bounded context(s):** Messaging, Presence (avatar emote), realtime gateway, REST
- **Milestone:** M3b (ADR-0033, ADR-0034)

## Problem / user value

As a team member, I want to answer a message without derailing the channel, call someone's attention to a message
and react without writing, so that chats stay readable and quick feedback costs one click.

## Behaviour

1. **Threads** (ADR-0034).
   - Any message in a channel or DM can get replies; together they are its **thread**. Threads are one level deep:
     answering a reply answers the same root (decided 2026-11-01).
   - Below a root with replies the channel shows "3 replies", the newest reply time and up to three repliers'
     avatars. Activating it expands the thread **inline** under the root; it shows the replies (newest 50, "Show
     older replies" loads more (decided 2026-11-01)) and a reply composer. Activating it again collapses the thread.
   - **"Also send to channel":** a checkbox on the reply composer. Such a reply is still part of the thread and also
     appears in the channel, marked "replied to a thread" with a short excerpt of the root; it counts as unread in
     the channel. It is one message, shown in both places, so editing and deleting change both (decided 2026-11-01).
   - A deleted root keeps its place as "Message deleted" so the thread stays readable (decided 2026-11-01). Archived channels
     take no replies.
2. **Followed threads** (ADR-0034).
   - The root's author, everyone who replies and everyone mentioned in the thread follow it automatically. The
     thread menu has "Stop following" and "Follow".
   - Each follower has a **thread read marker** (the newest reply they read). Replies by others after it are unread.
   - Thread replies don't raise the channel's unread counter (except "also sent to channel" ones).
   - The sidebar gets an entry **"Threads"** above "Channels" with the number of unread replies (number **and**
     dot). It opens the threads view in the chat panel: the newest 30 followed threads, newest activity first, those
     with unread replies marked _(proposal: all followed threads rather than only unread ones, so a thread doesn't
     vanish while one reads it)_, each with its channel name, the root and the replies expanded, and a reply
     composer. Reading a thread to its end moves its marker.
3. **Mentions** (ADR-0034).
   - Typing `@` in a composer opens a list of people, channel members first, filtered as one types; arrow keys and
     Enter pick, Escape closes. The message stores the person's ID, not the name (decided 2026-11-01), and shows
     "@Display Name" as a highlighted chip, so a later name change shows up everywhere.
   - A mentioned **member** sees the message highlighted and gets an `@` counter on the channel in the sidebar
     (number **and** `@` shape) until they read past the message. Mentions in thread replies count under "Threads"
     instead, because the mentioned member follows the thread _(proposal)_.
   - Editing a message counts newly added mentions; removing a mention withdraws it (decided 2026-11-01).
   - Mentioning a **non-member** notifies nobody; the mention stays in the text. After sending, the sender sees a
     hint "Cem isn't in #design" with "Add to channel" when they may add people: in public channels every member
     (extends ADR-0033), in private channels the creator, in group DMs every member (up to 8). In a 1:1 DM the hint
     has no button.
   - No `@channel` / `@here`, no browser or OS notifications yet (ADR-0034).
4. **Reactions** (ADR-0034).
   - Members react to a message with any Unicode emoji: a quick bar with six emoji (👍 ❤️ 😂 🎉 👀 🙏, decided 2026-11-01)
     and "More reactions" for the full picker (frimousse, searchable, skin tones). A person reacts at most once per
     emoji per message; reacting again removes it. At most 20 different emoji per message (decided 2026-11-01).
   - Under the message each emoji shows as a chip with its count, pressed when one reacted oneself; activating it
     toggles one's own reaction. Its label lists who reacted ("👍 Anna, Ben and 2 more").
   - Reactions on a deleted message are removed with it. Archived channels take no new reactions.
5. **Avatar emote** (ADR-0034). When someone adds a reaction in a **public** channel, the emoji floats above their
   avatar for about three seconds for everyone on the same floor. With reduced motion it fades in and out without
   moving. Reactions in private channels and DMs show no emote.
6. **Live.** Replies, thread summaries, reactions, mention counters and thread markers reach the open clients at
   once; after a reconnect the client reloads them with the channel list.

## Acceptance criteria

- [x] Given a message, when a member replies, then the channel shows the reply count under the message and the
      thread expands inline with the reply; the channel's unread counter of the others doesn't change.
- [x] Given a reply with "Also send to channel", then it shows in the thread and in the channel, and counts as
      unread in the channel for the others.
- [x] Given a thread one follows, when someone else replies, then the "Threads" entry counts the reply; when one
      reads the thread to its end, the counter clears in all of one's clients.
- [x] Given a followed thread, when one stops following it, then new replies don't count anymore.
- [x] Given a member mentioned with `@`, then they see the message highlighted and an `@` counter on the channel
      until they read past it; they follow the thread if the mention is in a reply (counted under "Threads").
- [x] Given a mention of a non-member, then the person isn't notified and the sender sees the hint, with "Add to
      channel" when they may add people.
- [x] Given a message, when a member picks 👍 and then picks it again, then the chip appears with count 1 for
      everyone and disappears again.
- [x] Given a reaction in a public channel, then people on the reactor's floor see the emote above the avatar;
      given a reaction in a private channel or DM, then nobody sees an emote.
- [x] Given a private channel, then non-members get `404` for its threads, replies and reactions (server-side check,
      integration test).
- [ ] Non-spatial path: everything works without the 3D view: threads, the threads view, mentions and reactions in
      the chat panel; command palette entry "Go to threads" with the palette. The emote is decoration only.
      _(The chat panel and sidebar work by keyboard; the command palette doesn't exist yet.)_
- [x] Accessibility: the thread toggle is a button with `aria-expanded` and the reply count in its label; the
      mention list is a combobox (`aria-activedescendant`); reaction chips are toggle buttons (`aria-pressed`) whose
      label names emoji, count and people; the picker works by keyboard; the emote is `aria-hidden`. _(Not yet
      checked with a screen reader.)_
- [x] i18n: all new strings in EN and DE, plurals included.

## Permissions

Replying and reacting are posting (`message.post`, members only). Until M4 the local rules of ADR-0033 apply,
extended by ADR-0034:

| Action                                   | Allowed for                                                         |
| ---------------------------------------- | ------------------------------------------------------------------- |
| Reply, react, mention                    | members                                                             |
| Follow or stop following a thread        | people who can read the channel                                     |
| Add someone to a channel (from the hint) | public: every member (new); private: the creator; group DM: members |

No new permissions in the catalogue. As before, not being allowed to read a channel answers `404`.

## Domain changes

- **`Message`:** `threadRootId?`, `alsoInChannel`, `mentions[]` (person IDs from the body),
  `reactions[] { emoji, personIds[] }`. Invariants: a reply's root is in the same channel and is not itself a reply;
  at most 20 different emoji; one reaction per person and emoji; deleting clears body, mentions and reactions.
- **Thread summary** of a root: `replyCount`, `lastReplyAt`, `replierIds` (newest three). Derived from the replies
  when a page is read (one grouped query per page), so it can't drift; live pushes update it in the client.
- **`Thread`** (new aggregate, per root) with its **follows** (per person: `following`, `readMarker?`). Follows are
  created automatically on reply or mention; "Stop following" keeps the row with `following = false` so a later
  reply doesn't follow again. Reading a thread without a follow stores nothing.
- **`Membership`:** mention counter derived from unread messages that mention the person (no stored counter).
- **Channel:** in public channels members may add others (`Channel.invite`; joining oneself stays as it was).
- **Domain events**, all through the Messaging outbox: `MessagePosted` (now also replies), `ReactionChanged`
  (one person's reaction added or removed; `inOffice` for public channels) and `ThreadActivity` (to followers when
  replies arrive, and to the person when their follow or marker changes). The realtime gateway turns
  `ReactionChanged` with `inOffice` into the transient `AvatarEmoted` for the reactor's floor. `PersonMentioned`
  stays in the catalogue for the Notifications context; nothing consumes it yet, so it isn't emitted.

## API & realtime contracts

REST, schemas in `packages/contracts/src/messaging/`:

- `MessageSchema` gains `threadRootId`, `alsoInChannel`, `mentions`, `reactions [{ emoji, personIds }]` and
  `thread { replyCount, lastReplyAt, replierIds } | null`. `ChannelSummary` gains `mentionCount`.
- `GET /api/channels/{id}/messages`: the channel without thread replies, except "also sent to channel" ones.
- `GET /api/channels/{id}/messages/{rootId}/replies?before={messageId}&limit=50`: a thread, oldest first.
- `POST /api/channels/{id}/messages` `{ body, threadRootId?, alsoInChannel? }`.
- `PUT` / `DELETE /api/channels/{id}/messages/{messageId}/reactions/{emoji}` (idempotent).
- `GET /api/threads`: the newest 30 followed threads (channel, root with summary, unread replies).
- `PUT /api/channels/{id}/threads/{rootId}/read-marker` `{ messageId }`,
  `PUT` / `DELETE /api/channels/{id}/threads/{rootId}/follow`.
- New error codes: `invalid-thread-root`, `too-many-reactions` (409), `invalid-emoji`.
- `/emojibase/{en,de}/{data,messages}.json`: the Emojibase data for the picker, shipped with the web app as static
  files (copied from `emojibase-data` at build time), so no request leaves the instance.

Realtime events (to the members' open connections unless noted):

- `MessagePosted` for replies too (with `threadRootId`; clients count it on the root),
  `ReactionChanged { channelId, messageId, personId, emoji, added }`.
- `ThreadActivity { channelId, rootMessageId }`: to followers and the person whose follow or marker changed; they
  reload their threads. Mention counts come with the channel list, which `MessagePosted` already reloads.
- `AvatarEmoted { floorId, personId, emoji }`: to everyone on the reactor's floor, public channels only.

## Privacy impact

- Replies, mentions and reactions are content and are stored like messages (ADR-0033); who reacted is visible to
  the channel's members. Bodies and emoji are never logged (counts only).
- Thread read markers hold the last read reply only, no reading times.
- The avatar emote is a transient world event: not persisted, not logged, only person and emoji, and only for
  public channels, so private channels and DMs don't leak activity into the office (ADR-0034, ADR-0012).

## UI / design

- **Message row:** on hover or focus a small toolbar: quick reactions, "More reactions", "Reply in thread", and for
  one's own messages edit and delete. Reaction chips and the thread summary sit under the body.
- **Thread inline:** replies indented with a vertical line in `border-subtle`, the composer below them with the
  checkbox "Also send to #channel" (for DMs: "Also send to the conversation").
- **Mentions:** chip in `terracotta` tint; a message that mentions me gets a left accent bar and a tinted
  background (colour **and** shape).
- **Sidebar:** "Threads" entry with icon `MessagesSquare`; channel rows show an `@` badge next to the unread count.
- **Picker:** frimousse in a Radix Popover, styled with tokens; data from the own instance.
- **World:** the emoji rises above the avatar's name label and fades (3 s); with reduced motion it only fades.

## Not yet covered by automated tests

- "Also send to the channel", "Stop following" and the non-member hint in the browser (covered by use-case,
  server integration and Postman tests).
- The "Follow" / "Stop following" button of an inline thread knows the follow state only for the newest 30
  followed threads (it reads the threads list); older followed threads show "Follow".

## Open questions

- The two rules marked _(proposal)_: the threads view lists all recent followed threads (unread ones marked), and
  mentions in thread replies count under "Threads" rather than on the channel's `@` counter.
