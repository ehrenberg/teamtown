---
name: adr
description: Record a new Architecture Decision Record for TeamTown in docs/architecture/adr/. Use when the product owner has made an architecture/technology decision, or a decided ADR must be superseded.
---

# Record an ADR

Only record **decisions the product owner actually made**. If the decision is still open, do not write an
ADR. Ask the owner instead (2–4 options with trade-offs, recommendation first), or add it to
`docs/product/open-questions.md`.

## Steps

1. Read `docs/architecture/adr/README.md` to find the next free number (4 digits, zero-padded).
2. Copy the structure of `docs/architecture/adr/0000-template.md` into
   `docs/architecture/adr/NNNN-kebab-case-title.md`.
3. Fill in:
   - **Status:** `Accepted` (decided) or `Proposed` (explicitly requested as a draft)
   - **Date:** today's date (YYYY-MM-DD)
   - **Context:** the forces and constraints, linked to quality goals in `docs/architecture/overview.md` §1
   - **Decision:** active voice ("We use …"), concrete
   - **Alternatives considered:** every option that was discussed, with the reason it was not chosen
   - **Consequences:** positive, negative and follow-ups
4. If it supersedes an ADR: set the old ADR's status to `Superseded by ADR-NNNN` (the only allowed edit
   to an accepted ADR) and link back to it.
5. Add a row to the table in `docs/architecture/adr/README.md`.
6. Remove the matching entry from `docs/product/open-questions.md`, and update any doc that still
   calls this topic a "proposal" (search for the topic in `docs/`).
7. If it affects coding rules or the stack summary, update `CLAUDE.md`.

Keep ADRs short (≈ one screen), in English.
