# ADR-0025: Showcase hosting, hostnames and website

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Product owner

## Context

ADR-0013 split hosting into a VPS (app) and the owner's classic webhosting (static content). Provider,
hostnames and website tooling were open.

## Decision

- **VPS provider: netcup.**
- **Hostnames** (base domain `teamtown.bastianswelt.de`, still to be created by the owner):

  | Hostname                        | Content                                   | Hosted on                   |
  | ------------------------------- | ----------------------------------------- | --------------------------- |
  | `teamtown.bastianswelt.de`      | Landing page, documentation under `/docs` | Classic webhosting (static) |
  | `demo.teamtown.bastianswelt.de` | TeamTown app (web client, API, WebSocket) | netcup VPS                  |
  | `auth.teamtown.bastianswelt.de` | Keycloak                                  | netcup VPS                  |

  LiveKit and Grafana hostnames on the VPS are defined in the deployment docs.

- **Website: Astro + Starlight** in `apps/website`. It renders the Markdown in `docs/` and is exported
  statically, then uploaded to the webhosting via FTP(S) from GitHub Actions.
- **Desktop builds are unsigned at first.** The docs explain the SmartScreen and Gatekeeper warnings.

## Consequences

- DNS: the apex `teamtown.` record points to the webhosting; `demo.` and `auth.` point to the VPS.
- The cookie and CORS configuration must account for separate subdomains.
- Code signing can be added later without architectural changes.
