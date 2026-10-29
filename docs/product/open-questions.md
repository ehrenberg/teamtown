# Open Questions & Pending Decisions

Everything in the first table is **undecided** and needs a decision by the product owner. Once decided,
record it in an ADR (architecture) or the relevant product doc, and move it to the decision log below.

Legend: 💡 = recommendation by the architect (not a decision).

## Open

*No open questions right now.* New questions are added here as they come up (template: ID, question, options, recommendation).

## Decision log (2026-10-29)

| ID | Topic | Decision | Recorded in |
|----|-------|----------|-------------|
| P-01 | MVP feature cut | As proposed (plus multiple floors, see P-09) | [mvp-scope.md](mvp-scope.md) |
| P-02 | Roadmap order | As proposed | [roadmap.md](roadmap.md) |
| P-03 | Claim | **"Where teams live."** / "Wo Teams zuhause sind." | [brand-guide.md](../design/brand-guide.md) |
| P-04 | German address form | **du** | brand guide, ADR-0020 |
| P-05 | Admins reading private channels | **No**, manage only | ADR-0026 |
| P-06 | Guests starting DMs | **Only reply** | [permissions.md](../architecture/permissions.md) |
| P-07 | Microphone default | Per-person setting, default **on** | [audio-video.md](../architecture/audio-video.md) |
| P-08 | Showcase demo mode | Guest login + demo bots + nightly reset | [deployment.md](../architecture/deployment.md) |
| P-09 | Multiple floors in the MVP | **Yes** | [mvp-scope.md](mvp-scope.md) |
| P-10 | Showcase success criteria | Confirmed (60 s / 15 min) | [vision.md](vision.md) |
| P-11 | Meeting history | **Opt-in per meeting** by the host | ADR-0026 |
| A-01 | File storage | Port + local volume, S3 optional | ADR-0017 |
| A-02 | Redis | Not in the MVP | ADR-0017 |
| A-03 | Reverse proxy | Caddy | ADR-0017 |
| A-04 | Client state | Zustand + TanStack Query | ADR-0020 |
| A-05 | i18n library | i18next | ADR-0020 |
| A-06 | Test tooling | Vitest, Playwright, Testcontainers, k6, Postman CLI | ADR-0021 |
| A-07 | Domain event delivery | Transactional outbox | ADR-0018 |
| A-08 | Observability | Full stack always on | ADR-0019 |
| A-09 | Boundary tooling | dependency-cruiser | ADR-0021 |
| A-10 | Desktop login | System browser + deep link | ADR-0023 |
| A-11 | Realtime gateway | In the server process | ADR-0022 |
| A-12 | LiveKit room mapping | As proposed | ADR-0022 |
| A-13 | Message search | PostgreSQL FTS | ADR-0024 |
| A-14 | Telemetry | None | ADR-0024 |
| O-01 | VPS provider | netcup | ADR-0025 |
| O-02 | Domains | `teamtown.bastianswelt.de` (website), `demo.` (app), `auth.` (Keycloak) | ADR-0025 |
| O-03 | Website generator | Astro + Starlight | ADR-0025 |
| O-04 | Code signing | Unsigned at first | ADR-0025 |
| O-05 | 3D asset sources | Git LFS in the repo | [world-art-direction.md](../design/world-art-direction.md) |
| O-06 | Code font & icons | JetBrains Mono + Lucide | brand guide |
| O-07 | Contribution model | DCO sign-off | [workflow.md](../engineering/workflow.md), CONTRIBUTING.md |
| O-08 | GitHub location | Personal account, repo `teamtown` (username → N-01) | workflow.md |
| O-09 | Git repository | Initialised with a first commit | — |
| O-10 | Code of conduct & security reporting | Contributor Covenant 2.1 + GitHub private vulnerability reporting | CODE_OF_CONDUCT.md, SECURITY.md |
| N-01 | GitHub username | `ehrenberg` → repository `ehrenberg/teamtown` | workflow.md, deployment.md |
| N-02 | Logged-meeting consent & retention | Explicit consent by click; retention configurable, default 90 days | ADR-0027 |
| N-03 | Code of conduct contact | Via GitHub (maintainer @ehrenberg, "Report content") | CODE_OF_CONDUCT.md |
| N-04 | Observability retention, Grafana host | Logs and traces 7 days, metrics 30 days; `grafana.teamtown.bastianswelt.de` | deployment.md |
| N-05 | LiveKit host | `rtc.teamtown.bastianswelt.de` | deployment.md |
| N-06 | netcup product | Chosen by the owner when ordering (minimum 8 vCores / 16 GB) | deployment.md |
| — | Commit identity | GitHub noreply address `2414183+ehrenberg@users.noreply.github.com` (repo-local git config) | — |
| — | `.idea/` | Ignored, stays local | .gitignore |
