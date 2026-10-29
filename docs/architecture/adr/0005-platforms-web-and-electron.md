# ADR-0005: Web and Electron desktop app from day one

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Product owner

## Context

A Teams replacement needs a desktop presence: tray icon, reliable OS notifications, autostart, global
shortcuts and robust screen sharing. Guests and quick onboarding need a browser version.

## Decision

- The **web client** (`apps/web`) is the single UI codebase.
- The **desktop app** (`apps/desktop`) is an **Electron** shell around the web client. It adds native
  capabilities through a minimal, typed preload bridge.
- The web client accesses native features only through a `PlatformBridge` port. There is a web
  implementation using browser APIs and a desktop implementation using the Electron preload.

## Alternatives considered

| Option                   | Why not                                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Tauri                    | System WebView (WebKit on macOS/Linux) with inconsistent WebRTC and screen-capture behaviour, a risk for calls |
| Web first, desktop later | Rejected by product decision; desktop is part of the MVP                                                       |

## Consequences

- Consistent Chromium behaviour for WebRTC and WebGL across desktop operating systems.
- Larger install size and memory footprint (accepted, as with Teams, Slack and Discord).
- Electron security hardening is mandatory (see [privacy-and-security.md](../privacy-and-security.md)).
