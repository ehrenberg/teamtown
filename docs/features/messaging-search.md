# Feature: Search and command palette

- **Status:** In progress
- **Brainstorming ID:** M8 Full-text search, X2 Command palette (first part)
- **Bounded context(s):** Messaging, web client
- **Milestone:** M3e (ADR-0033, ADR-0024)

## Problem / user value

As a team member, I want to find a message, file, channel or person from one place, by keyboard, so that I can get
back to what was said without remembering where, and without using the office.

## Behaviour

1. **Opening.** `Ctrl/⌘+K` opens the command palette from anywhere in the app, also while typing in the composer;
   a "Search" button in the top bar does the same (P-29). Escape closes it and returns the focus to where it was.
2. **What the palette holds (P-29).** One search field and one list, in this order: **Go to** ("Go to threads"),
   **Channels** (my channels, room walls, public channels I haven't joined), **People** (opens the DM), **Messages**.
   With an empty field it shows "Go to" and my channels. Calling, status and walking to a room are later palette
   entries, not part of this slice.
3. **Matching channels and people.** The name contains what was typed, ignoring case, in the client, immediately.
   Each section shows at most 5 entries.
4. **Searching messages (P-30).** From 2 characters on, and shortly after typing stops, the palette also searches
   message text and attachment **file names**, never file contents. All words must match. English and German words
   match their inflected forms ("Rechnungen" finds "Rechnung"), and the last characters typed also match the start
   of a word, so results appear while typing. There is no typo tolerance (ADR-0024) and no search syntax.
5. **Reach (P-31).** Messages come from everything the person may read: channels and DMs they are in, room walls,
   archived channels, and public channels they haven't joined. Thread replies count. Deleted messages are never
   found. Each result shows where it is.
6. **Order and narrowing (P-32).** The best matches come first, the newer one on a tie. While a conversation is open,
   an "Only in {{title}}" option narrows the messages to it; it is off by default and not remembered. Results load
   in pages of 20 with "Show more". There are no other filters in this slice.
7. **Opening a result.** A message opens its conversation, scrolls to it and moves the focus there, loading older
   pages if needed; a reply opens its thread under the root (same as the "Pinned" view). A public channel I'm not in
   opens to read, with its "Join" action in place of the composer.
8. **Errors.** A failed search shows a plain-language line in the Messages section; channels and people keep working.

## Acceptance criteria

- [ ] Given a person presses `Ctrl/⌘+K` while typing in the composer, then the palette opens; Escape closes it and the
      focus returns to the composer.
- [ ] Given a message "Die Rechnungen sind da", when someone who can read it searches "rechnung", then it is found.
- [ ] Given a message in a private channel or a DM, when someone who isn't a member searches its words, then it is not
      found, and asking for that `channelId` directly answers `404`.
- [ ] Given a public channel the person hasn't joined, when they open a result from it, then they read the conversation
      at that message and can join it.
- [ ] Given a message with an attachment "Angebot-2026.pdf" and no text, when someone searches "angebot", then it is
      found, and the result names the file.
- [ ] Given a deleted message, then its words no longer find it.
- [ ] Given a reply in a thread, when its result is opened, then the conversation scrolls to the root with the thread
      open.
- [ ] Given a conversation is open and "Only in …" is on, then only messages of that conversation are found.
- [ ] Given more than 20 matches, then "Show more" adds the next 20.
- [ ] Non-spatial path: everything works without the 3D view; the palette **is** the keyboard path, and it also gives
      M3a–M3c their pending entries (channels, DMs, threads, room walls).
- [ ] Accessibility: the field is a labelled combobox with a listbox; arrow keys and Enter work; the number of results
      is announced; the focus is trapped in the dialog and returned afterwards.
- [ ] i18n: all new strings exist in English and German, using German **du**.

## Permissions

No new permission. Searching needs no permission of its own: results are limited to channels the person passes
`channel.read` for. Until M4 that is `Channel.canRead` (ADR-0033), which also decides the "public channels I haven't
joined" and room-wall cases; M4 moves the check to `AccessPolicy`, as ADR-0024 expects. `channelId` of a channel one
can't read answers `404`, like everywhere else.

## Domain changes

- **`MessageSearch`** port (Messaging, ADR-0024), with a PostgreSQL adapter. The aggregates are unchanged.
- `messaging.message` gets a generated `search_vector` over the body (German, English and an unstemmed `simple`
  configuration, the last one for matching the start of a word) with a GIN index. Attachment file names get their own
  GIN expression index on `messaging.attachment`. Generated values follow every edit, and an emptied body after a
  delete leaves nothing to find.
- `searchTerms` (domain): turns the typed text into the words to look for; pure and test-driven.
- Glossary addition: **Command palette** — "One search field for going to, and finding, anything" (no domain type).

## API & realtime contracts

New in `packages/contracts/src/messaging/search.ts`:

- `GET /api/search/messages?q={text}&channelId={id}&offset={n}&limit={n}`: `q` has 2 to 200 characters, `limit` is at
  most 50, default 20. Answers `{ results: [{ message, snippet, channel: { channelId, kind, name, members } }], hasMore }`.
  `snippet` is plain text around the match, empty for a message without text. `404` for an unreadable `channelId`.

The palette's channel and people entries use the existing `GET /api/channels`, `/api/channels/browse` and
`/api/people`. Opening a channel the person isn't in uses the existing `GET /api/channels/{id}`. There are no realtime
messages: results are a snapshot of the moment of the search.

## Privacy impact

Search reads message text the person may already read, so it shows nothing new. It stores nothing: no search history,
no "recent searches", no index per person. Search terms are content, so they must not reach logs or traces: the
existing request serializer drops query strings from logs and the telemetry filter drops `url.query` from spans. No
presence data is touched (ADR-0012), and neither `search_vector` nor the palette holds positions or room entries.

## UI / design

- Top bar: "Search" button with a `Ctrl K` hint between the floor switcher and the actions, as sketched in
  `docs/design/design-system.md`.
- Palette: a Radix dialog near the top of the screen with the field, the optional "Only in …" checkbox and the list.
  A message result shows the conversation, author, time and snippet (or the file name). Sections have visible headings.
- No world representation.

## Open questions

_None._ P-29 to P-32 were decided on 2026-11-04. Details within those decisions (for example the debounce time) are
implementation details.
