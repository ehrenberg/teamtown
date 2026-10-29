<p align="center">
  <img src="design/brand/logo-horizontal.svg" alt="TeamTown" width="360">
</p>

<p align="center"><strong>Where teams live.</strong><br>
Open-source, self-hostable team communication in a soft low-poly isometric replica of your real office.</p>

---

> 🚧 **Status: early development.** The foundation (M0) is in place; features follow milestone by milestone
> ([roadmap](docs/product/roadmap.md)). Start with the [documentation](docs/README.md).

## What is TeamTown?

TeamTown replaces chat-and-call tools like Microsoft Teams with a living, isometric 3D office:

- 🚶 **Walk** to a colleague to talk, with proximity audio that fades in as you get close
- 🚪 **Rooms with real doors:** open, knock-to-enter, or locked for private meetings
- 💬 **Channels and direct messages** with threads, mentions, files and scoped roles
- 🛠️ **Build your real office** with an in-app tile editor
- 🔒 **Privacy by design:** live presence, **no** movement history, no surveillance features
- ♿ **Spatial is optional:** everything also works in list mode and via the keyboard
- 🖥️ **Web and desktop** (Electron), English and German

See the [interactive design mockup](design/mockups/app-shell.html) (open it in a browser).

## Quick start

Requirements: [pnpm](https://pnpm.io) 12 and Docker. Node.js 24 is downloaded by pnpm for this project automatically.

```bash
pnpm install       # dependencies + Git hooks
pnpm setup:browsers  # Chromium for rendering the docs diagrams (once)
pnpm stack:up      # Postgres, Keycloak, LiveKit, observability (see docker/README.md)
pnpm dev           # server on :3000, web client on http://localhost:5173
pnpm check         # everything CI checks
```

## Tech stack (decided)

TypeScript monorepo (pnpm, Turborepo) · NestJS modular monolith (DDD, hexagonal) · PostgreSQL + MikroORM ·
Keycloak (OIDC) · WebSocket + MessagePack · LiveKit (audio/video) · React, React Three Fiber · Radix + Tailwind ·
Electron · Caddy · Grafana observability stack · Docker Compose.

Website: `teamtown.bastianswelt.de` · Demo: `demo.teamtown.bastianswelt.de` _(coming soon)_

Every decision is documented as an [Architecture Decision Record](docs/architecture/adr/README.md).

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [CLAUDE.md](CLAUDE.md) (also useful for humans: it is the
condensed rulebook).

## License

[GNU Affero General Public License v3.0](LICENSE). If you run a modified TeamTown as a network service, you must make your changes available.
