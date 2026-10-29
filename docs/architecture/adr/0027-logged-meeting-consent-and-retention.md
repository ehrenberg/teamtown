# ADR-0027: Explicit consent and retention for logged meetings

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Product owner

## Context

[ADR-0026](0026-admin-access-and-meeting-logs.md) made meeting logs opt-in per meeting, but left consent
mechanics and retention open. Logged meetings store personal data (who attended when), so GDPR
requires a clear legal basis and data minimisation.

## Decision

- **Explicit consent per participant.** When entering a room with a logged meeting (or joining its call),
  a dialog explains what is stored ("title, participants, start and end time") and offers
  **Join** / **Don't join**. Only after the person clicks **Join** do they enter and appear in the log.
  The consent (person, meeting, timestamp) is stored with the log.
- Declining keeps the person outside the room. Nothing about them is stored.
- **Retention is configurable by admins, default 90 days.** Expired logs are deleted automatically by a
  scheduled job. Hosts can delete their meeting logs earlier.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Implicit consent by entering, with a visible sign | Legally weaker; consent not demonstrable |
| Unlimited retention | Contradicts data minimisation |

## Consequences

- `MeetingLog` holds `consents[] {personId, consentedAt}` and an `expiresAt` derived from the retention setting.
- Joining a logged meeting is never automatic, including via direct "walk there" or "go to" commands.
- List mode and the command palette show the same consent dialog.
