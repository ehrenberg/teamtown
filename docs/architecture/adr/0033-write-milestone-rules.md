# ADR-0033: Write milestone (M3): slicing, channel rules before roles, chat panel

- **Status:** Accepted
- **Date:** 2026-11-01
- **Deciders:** Product owner

## Context

M3 adds persistent messaging (MVP scope M1–M4, M7, M8; [domain model](../domain-model.md) "Messaging"). Channels
need access rules before roles and channel policies exist (M4), and the chat needs a place in a layout that so far
belongs to the world. Messages are content, not presence: persisting them does not touch ADR-0012.

## Decision

- **Slicing:** M3a channels and DMs (post, edit, delete, unread) → M3b threads, mentions, reactions → M3c room walls
  → M3d files → M3e search. Each slice is usable on its own.
- **Channel rules until M4:** everyone may create public and private channels. The **creator** moderates: rename,
  archive and invite people into a private channel. Everyone may edit and delete their own messages.
  Announcement channels come with M4. M4 replaces these rules with roles (Channel Moderator) and channel policies.
- **Chat panel:** channels and DMs are listed in the left sidebar; an open channel is a collapsible panel to the
  right of the world, so the office and the chat are visible at the same time.
- **M3a scope:** unread counters (a read marker per person and channel), seed channels `#general` and `#random`
  that everyone joins automatically, group DMs with at most **8** people, and a Markdown subset (bold, italic,
  inline code, code block, links, lists).

## Alternatives considered

| Option                             | Why not                                            |
| ---------------------------------- | -------------------------------------------------- |
| 3 slices                           | Bigger steps with fewer usable intermediate states |
| DMs first, channels later          | Channels are the core of team communication        |
| Every member manages a channel     | Less control over private channels                 |
| Only fixed seed channels before M4 | Too limiting for a usable chat                     |
| Toggle between office and chat     | Hides the office while chatting                    |
| Overlay drawer                     | Covers part of the world                           |
| Plain text with auto-linked URLs   | Code and lists are everyday needs in teams         |

## Consequences

- The read marker is per person and channel and holds only the last read message, never reading times or a history.
- The world gets narrower while the chat panel is open; the panel must be collapsible and keyboard-reachable.
- Follow-ups: feature specs for M3b–M3e; M4 migrates channel creators to the Channel Moderator role.
