# ADR-0026: Admins cannot read private content; meeting logs are opt-in

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Product owner

## Context

Two privacy questions affect the permission and data model: whether town admins can read private
channels, and whether room calls are recorded as meetings (title, participants, duration).

## Decision

1. **Admins manage but cannot read private content.** Town owners and admins can rename, archive and
   manage members of private channels and locked rooms. They have **no** permission that grants reading
   private messages. There is no break-glass mechanism.
2. **Meeting logs are opt-in per meeting.** By default nothing about a call is stored. A room host can
   start a call as a **logged meeting**. Only then are the title, participants and start/end time persisted.
   A logged meeting is clearly indicated on the door sign and in the call UI before and while people join.

## Consequences

- The permission catalogue has no "read all" permission. Admin tooling works on metadata only.
- Meetings gets one persisted aggregate, `MeetingLog`, created only by explicit host action. All other Meetings state stays in memory (ADR-0012).
- Details of logged meetings (consent mechanics, retention) are tracked in the open questions.
