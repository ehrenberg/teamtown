# ADR-0034: Threads, mentions and reactions (M3b)

- **Status:** Accepted
- **Date:** 2026-11-01
- **Deciders:** Product owner

## Context

M3b adds threads, mentions and reactions to the messaging of M3a (ADR-0033; brainstorming M3). The chat panel is
narrow (about 360 px) and sits next to the world. There is no Notifications context yet, and roles arrive only with
M4. Reactions are meant to show briefly above the avatar, which touches the world and the privacy of private
channels and DMs (ADR-0012, ADR-0026).

## Decision

- **Threads open inline:** replies expand under their root message in the channel; there is no second panel and
  no separate thread view.
- **Followed threads:** whoever wrote the root, replied or was mentioned in a thread follows it automatically and
  can stop following. A "Threads" entry in the sidebar counts unread replies in followed threads. Thread replies do
  not raise the channel's unread counter.
- **"Also send to channel":** a checkbox on the reply composer posts the reply to the channel as well, where it
  counts as unread like any message.
- **Mentions:** only `@person`, chosen from a list while typing. Mentioned people see the message highlighted and
  an `@` counter in the sidebar. No browser or OS notifications yet (Notifications context), no `@channel` /
  `@here` (needs roles, M4).
- **Mentioning a non-member:** the mention stays in the text but notifies nobody. The sender gets a hint that the
  person isn't in the channel, with an "Add to channel" button when they may add people. In public channels every
  member may add others from now on (this extends ADR-0033, where people only joined public channels themselves).
- **Reactions:** any Unicode emoji, with a quick bar of six frequent emoji and a full picker. The picker uses
  **frimousse** (MIT, headless React, styled with our tokens); its Emojibase data is served by our own server, never
  from a third-party CDN.
- **Avatar emote:** a reaction shows briefly as an emote above the reacting person's avatar, for everyone on the
  same floor, but **only for reactions in public channels**. Reactions in private channels and DMs stay in the chat.

## Alternatives considered

| Option                                                                         | Why not                                                |
| ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Thread replaces the channel in the panel                                       | Owner preferred staying in the channel                 |
| Second panel next to the chat                                                  | Makes the world much narrower                          |
| Unread replies only at the root message                                        | Replies get lost easily                                |
| Replies count like normal messages                                             | Noisy in active channels                               |
| `@channel` / `@here` now                                                       | Without roles every member could notify everyone       |
| Browser notifications now                                                      | Anticipates the Notifications context; bigger slice    |
| Fixed set of about 8 reactions                                                 | Less expressive than the tools people are used to      |
| emoji-picker-react, emoji-mart                                                 | Own styling that is hard to fit to the design tokens   |
| Emote for members only, or for every reaction                                  | Owner chose public channels only, visible to the floor |
| Mention notifies non-members of public channels, or only members can be picked | Owner chose the hint                                   |

## Consequences

- New dependency `frimousse` (MIT, AGPL-compatible); the Emojibase data (MIT) is bundled as a static asset so
  self-hosted instances make no outside calls.
- Each follower keeps a read marker per thread (the last read reply only, no reading times), like the channel read
  marker of ADR-0033.
- The emote is a transient world event: it is never persisted or logged (ADR-0012), and it carries only the
  person and the emoji, never the message.
- Follow-ups: browser/OS notifications and the "pigeonhole" inbox (brainstorming M6) with the Notifications
  context; `@channel` / `@here` with M4 roles.
