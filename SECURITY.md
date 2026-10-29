# Security Policy

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions or pull requests.**

Report them privately via GitHub's **private vulnerability reporting**:
go to the repository's **Security** tab → **Report a vulnerability**.

Please include:

- a description of the issue and its impact
- steps to reproduce or a proof of concept
- affected version or commit

We will acknowledge your report, keep you informed about the fix and credit you in the release notes
(unless you prefer to stay anonymous).

## Scope

TeamTown handles presence, audio/video and private messages. Reports about the following are especially welcome:

- access to locked rooms, private channels or private conversations (including media tracks)
- any way to obtain presence or movement history (TeamTown must not store it, see ADR-0012)
- privilege escalation between guests, members and admins
- authentication flaws (OIDC, desktop deep-link flow)

## Supported versions

TeamTown is in its planning phase and has no released versions yet. Once released, security fixes target the latest release.
