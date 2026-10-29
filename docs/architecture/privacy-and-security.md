# Privacy & Security

Privacy is TeamTown's #1 quality goal. Decided: **live position, no history**
([ADR-0012](adr/0012-presence-privacy-no-history.md)).

## 1. Privacy principles (binding)

1. **No movement history.** Positions, paths and room entries exist only in memory while a person is online.
   They are never written to the database, logs, analytics or backups.
2. **No attendance analytics per person.** No "online time", no "time at desk", no reports about individuals.
   Aggregated, anonymous, instance-wide metrics (e.g. "concurrent users") are allowed for operations.
3. **No meeting history by default.** Who met whom is not stored. (Messages in room walls are, of course,
   persisted like any channel message.) A room host may explicitly start a **logged meeting** (ADR-0026).
   Only then are the title, participants and times stored. Each participant must explicitly consent before
   joining, and logs are deleted automatically after the configured retention period (default 90 days, ADR-0027).
4. **Visibility control.** Every person can switch to ghost mode or focus mode at any time.
5. **Transparency.** An in-app page "What TeamTown stores about you" lists exactly what is persisted.
6. **Telemetry without personal data.** In logs, metrics and traces (ADR-0019), log person IDs only where needed for debugging, never positions or
   message content. The log retention period is configurable.

These principles must also be enforced in code review: a PR that persists presence data is rejected.

## 2. GDPR & works council (Betriebsrat) notes

- TeamTown is designed so that a company can argue it is **not suitable for performance or behaviour
  monitoring** (relevant under § 87 (1) no. 6 BetrVG). The principles above are the basis for that.
- Self-hosting gives the company full data sovereignty. No data leaves the instance (no telemetry
  at all, ADR-0024).
- Planned: data export per person (Art. 20 GDPR), deletion and anonymisation of leavers, retention
  policies per channel (see brainstorming A8, A9).
- Recording (if built later) only with explicit consent of all participants and a visible indicator.

## 3. Security architecture

| Topic          | Approach                                                                                                                                                                                                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication | OIDC authorization code flow + PKCE via Keycloak. TeamTown stores no passwords. Desktop: system browser login + `teamtown://` deep-link callback (ADR-0023).                                                                                                                  |
| Session        | Short-lived access tokens, refresh via Keycloak. WebSocket authenticated at handshake and re-validated on token refresh.                                                                                                                                                      |
| Authorization  | Every command and request is checked in the application layer via `AccessPolicy` ([permissions.md](permissions.md)).                                                                                                                                                          |
| Media          | LiveKit tokens are minted server-side per room with minimal grants. Track subscriptions are controlled by the server.                                                                                                                                                         |
| Transport      | TLS everywhere (reverse proxy). WebRTC is DTLS-SRTP encrypted.                                                                                                                                                                                                                |
| Input          | Validate every REST and realtime payload with schemas (Zod) at the edge. Sanitise rendered Markdown.                                                                                                                                                                          |
| Files          | Content-type sniffing, size limits, served from a separate path with `Content-Disposition` and a strict CSP                                                                                                                                                                   |
| Web security   | Strict CSP, no inline scripts, SameSite cookies, CSRF protection for cookie-based flows                                                                                                                                                                                       |
| Electron       | `contextIsolation: true`, `nodeIntegration: false`, sandboxed renderer, minimal preload API, only our own origin allowed. Builds are unsigned at first (ADR-0025). Auto-update works on Windows and Linux; on macOS it requires signing, so users update manually until then. |
| Dependencies   | Renovate/Dependabot, `pnpm audit` in CI, lockfile committed                                                                                                                                                                                                                   |
| Secrets        | Only via environment variables or Docker secrets, never committed. `.env.example` documents them.                                                                                                                                                                             |
| Rate limits    | On login, message posting, knocks and file uploads                                                                                                                                                                                                                            |
| Disclosure     | `SECURITY.md` with a private reporting channel                                                                                                                                                                                                                                |

## 4. Threat model highlights (to be expanded)

| Threat                                              | Mitigation                                                                    |
| --------------------------------------------------- | ----------------------------------------------------------------------------- |
| Eavesdropping on a locked room by a modified client | Server-controlled LiveKit subscriptions; room calls in separate LiveKit rooms |
| Walking through locked doors via forged movement    | Server-authoritative paths and room entry checks                              |
| Guest escalating to internal channels               | Guest role scoped to explicit resources; private-by-default listing APIs      |
| Inferring presence history through the API          | No historical presence endpoints exist                                        |
| XSS via messages                                    | Markdown subset with a sanitiser, CSP                                         |
