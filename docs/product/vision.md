# Product Vision

> **TeamTown: Where teams live.** *(DE: Wo Teams zuhause sind.)*
> The office you can walk into from anywhere.
> A self-hostable, open-source communication platform that replaces chat-and-call tools like
> Microsoft Teams with a living, isometric 3D replica of your real office.

## The problem

Remote and hybrid teams lost something that chat and video tools never replaced:

| What the office gave us                         | What Teams/Slack/Zoom give us                    |
|-------------------------------------------------|--------------------------------------------------|
| You *see* who is around and whether they're free | A status dot that is wrong half the time         |
| Spontaneous "got a minute?" at someone's desk    | Scheduling a 30-minute call for a 2-minute question |
| Open door = come in, closed door = not now       | Every ping interrupts equally                    |
| Meeting rooms you *walk into*                    | Links, lobbies, "can you hear me?"               |
| Overhearing, serendipity, belonging              | Silence between meetings                         |

## The idea

TeamTown renders **your real office** as a soft low-poly isometric world. Every person has an avatar.
You **walk** to a colleague to talk — audio fades in as you get close. Meeting rooms are actual rooms:
open, knock-to-enter or locked. Channels and direct messages cover everything asynchronous, with
rights and roles fit for business.

**Space is the interface for presence and synchronous communication; channels are the interface for
asynchronous communication.** Both are first-class and connected (every room can have its own chat).

## Product principles

1. **Business first, joy second — but never no joy.** It must be fully usable for a 9-to-5 workday.
   Delight is the seasoning, not the meal.
2. **Spatial is optional.** Every action has a non-spatial equivalent (command palette, lists, keyboard).
   The 3D world is a view, never a gate. → Accessibility and low-end hardware stay first-class.
3. **Privacy by design.** Live presence, no history. No surveillance features, ever.
   TeamTown must be acceptable to a German works council (Betriebsrat).
4. **Familiar metaphors over new concepts.** Doors, desks, rooms, knocking. If it needs a tutorial,
   the metaphor is wrong.
5. **Own your data.** Open source (AGPL-3.0), self-hostable with a single `docker compose up`.

## Target audience

- **Primary:** Hybrid and remote companies of **50–500 people** (Mittelstand) with a real office that
  they want to mirror digitally.
- **Secondary:** Tech teams and agencies who want an open-source, self-hosted alternative to Teams/Slack.
- **Showcase:** The project itself is a public portfolio piece. A demo instance runs on a small VPS.

### Personas (sketches)

| Persona | Context | Needs from TeamTown |
|---------|---------|---------------------|
| **Lena, Product Manager** | Remote 3 days/week | Quickly see who is free, drop in without scheduling, run stand-ups in "her" room |
| **Murat, Developer** | Deep-focus work | A reliable focus mode, async channels, no distraction from the "game" aspect |
| **Sabine, Office & IT Admin** | Runs the instance | Build the office once, manage roles, onboard people via SSO, meet privacy requirements |
| **Jonas, Team Lead** | Hybrid team | Feel team presence, hold town halls, keep the team connected |
| **Guest (customer/freelancer)** | External | Join a single meeting room via link without seeing internal channels |

## What TeamTown is not

- Not a game, metaverse or VR product. No avatars in wild costumes during a board meeting
  (unless the company wants that).
- Not a monitoring tool. No "time at desk" statistics, no movement logs.
- Not a document suite. We integrate with file and office tools rather than rebuild them.

## Success criteria for the showcase (decided)

- A visitor can open the demo, create an avatar, walk around and talk to a bot colleague within **60 seconds**.
- The codebase is approachable: a new contributor runs the stack locally in **< 15 minutes**.
- Architecture and decisions are fully traceable in `docs/` (ADRs).

The showcase runs at `demo.teamtown.bastianswelt.de`, and the website at `teamtown.bastianswelt.de` (ADR-0025).
