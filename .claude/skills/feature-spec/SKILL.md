---
name: feature-spec
description: Write a TeamTown feature specification from docs/features/_template.md, usually based on an idea ID from docs/product/brainstorming.md. Use before implementing any user-facing feature.
---

# Write a feature spec

## Steps

1. Identify the feature and its brainstorming ID (e.g. `C4 Knock knock`) in `docs/product/brainstorming.md`.
   Check `docs/product/mvp-scope.md` and the roadmap to see whether it is decided to be built. If it is
   not decided, **ask the product owner before writing the spec**.
2. Create `docs/features/<context>-<kebab-name>.md` from `docs/features/_template.md`.
3. Fill every section using the **ubiquitous language** (`docs/architecture/domain-model.md` §1). Add new
   terms to the glossary rather than inventing synonyms.
4. Mandatory checks, each answered explicitly in the spec:
   - **Non-spatial path:** how it works in list mode and the command palette
   - **Permissions:** which permissions at which scope (`docs/architecture/permissions.md`); new ones are added to the catalogue there
   - **Privacy impact:** nothing from presence is persisted or logged (ADR-0012)
   - **Contracts:** REST and/or realtime messages (names: commands imperative, events past tense)
   - **i18n:** EN + DE strings; voice per `docs/design/brand-guide.md` §6
   - **Acceptance criteria** in Given/When/Then form
5. List anything undecided under "Open questions" and present those questions to the owner. Don't fill gaps with assumptions.
6. Link the spec from the brainstorming entry (add `→ spec` after the idea name).
