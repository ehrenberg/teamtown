# ADR-0037: Pull request review with Ponytail

- **Status:** Accepted
- **Date:** 2026-11-04
- **Deciders:** Product owner

## Context

CI checks formatting, types, boundaries and tests, but nothing reviews whether a change is right, safe and as small as
it can be, or whether it follows the project's rules. Much of the code is written with an AI agent, so that gap matters.
[Ponytail](https://github.com/DietrichGebert/ponytail) (MIT) is a plugin for coding agents that steers them towards the
smallest complete change and brings `/ponytail-review`. It has no CI integration of its own.

## Decision

- We use **Ponytail** in this project, as a Claude Code plugin enabled in `.claude/settings.json`, **pinned to a
  release tag**: its hooks run on every session, so a new version is a change we review and commit.
- It runs at level **`lite`**: it builds what was asked and names a smaller option in one line, and the person chooses.
  `CLAUDE.md` takes precedence over it, and the golden rules above all.
- The review instance for pull requests is the project skill **`/pr-review`**, run **locally** before a PR. It combines
  the CI checks, `ponytail-review` and the TeamTown rules, and ends with a verdict. It is part of the Definition of Done.
- A human review stays required (`docs/engineering/workflow.md`). The report prepares it.

## Alternatives considered

| Option                          | Why not                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| GitHub bot that comments on PRs | Needs an API key as a secret, costs per PR, sends the code to an API; not wanted for now |
| GitHub bot as a required check  | The same, and an LLM's verdict would block merges and could be wrong                     |
| Ponytail at level `full`        | Decides by itself what to leave out, which conflicts with golden rule 1                  |
| Ponytail for reviews only       | Gives up its effect on the amount of code written                                        |
| Following Ponytail's `main`     | Unreviewed code would run in every session                                               |

## Consequences

- Nothing enforces the review: it depends on discipline, and contributors without Claude Code use the checklist in
  `docs/engineering/workflow.md` instead.
- Everyone working in this repository with Claude Code gets asked to trust the plugin. It is off for anyone who sets
  `"ponytail@ponytail": false` in `.claude/settings.local.json`.
- Ponytail's band writes per-task costs and token counts to `~/.config/ponytail/` on each machine. We configure no
  webhook, so nothing leaves the machine and ADR-0024 (no telemetry) is unaffected, which concerns TeamTown itself anyway.
- Updating means reading the release's hooks and bumping `ref`.
- A `shortcut: <the limit>, <when to upgrade>` comment marks a deliberate limit; reviews treat it as a decision.
