# ADR-0016: Internationalisation with English and German

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Product owner

## Context

TeamTown targets German companies and an international open-source community.

## Decision

- The UI supports **English (base) and German** from day one. Further languages can be contributed.
- All UI strings come from message catalogues. There is no hard-coded user-facing text.
- Server responses carry error **codes**, and translation happens in the client.
- Code, comments, commit messages and project documentation are in **English**.

## Consequences

- Every UI change includes EN and DE strings.
- The i18n library is chosen in [ADR-0020](0020-frontend-state-and-i18n.md) (i18next).
