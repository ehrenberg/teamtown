/**
 * Development helper: a colleague who follows you around the office and repeats what you say one second later,
 * so you can test microphone, volume and panning alone. Signs in as the demo user `demo2`.
 *
 *   pnpm dev:echo            (needs `pnpm stack:up` and `pnpm dev`)
 *   ECHO_FOLLOW="Demo User"  whom to follow (display name; default: the first other person on the floor)
 */
import {
  AudioSource,
  AudioStream,
  LocalAudioTrack,
  Room,
  RoomEvent,
  TrackKind,
  TrackPublishOptions,
  TrackSource,
  type RemoteTrack,
} from '@livekit/rtc-node';
import {
  decodeServerEvent,
  encodeMessage,
  REALTIME_SUBPROTOCOL,
  type AvatarState,
  type ClientCommand,
  type ServerEvent,
} from '@teamtown/contracts';
import WebSocket from 'ws';

const SERVER = process.env.ECHO_SERVER ?? 'http://localhost:3000';
const TOKEN_URL = process.env.ECHO_TOKEN_URL ?? 'http://localhost:8080/realms/teamtown/protocol/openid-connect/token';
const FLOOR = process.env.ECHO_FLOOR ?? 'ground-floor';
const FOLLOW = process.env.ECHO_FOLLOW;
const ECHO_DELAY_MS = 1_000;
const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
] as const;

async function accessToken(): Promise<string> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'teamtown-api-tests',
      username: 'demo2',
      password: 'demo2',
    }),
  });
  if (!response.ok) throw new Error(`Sign-in failed (${String(response.status)}); is the stack running?`);
  return ((await response.json()) as { access_token: string }).access_token;
}

const socket = new WebSocket(`${SERVER.replace(/^http/, 'ws')}/realtime`, REALTIME_SUBPROTOCOL);
let me: string | null = null;
let target: string | null = null;
const avatars = new Map<string, AvatarState>();
let counter = 0;
let room: Room | null = null;
let conversationId: string | null = null;
let attempt = 0;

const send = (command: Omit<ClientCommand, 'id'>) => {
  socket.send(encodeMessage({ ...command, id: `e${String(++counter)}` } as ClientCommand));
};

/** Walks to a free tile next to where the followed person stands or is heading; `retry` tries the next one. */
function follow(retry = false): void {
  const person = target ? avatars.get(target) : undefined;
  if (!person) return;
  attempt = retry ? attempt + 1 : 0;
  const goal = person.movement?.path.at(-1) ?? person.tile;
  const taken = new Set(
    [...avatars.values()].filter((a) => a.personId !== me).map((a) => `${String(a.tile.x)},${String(a.tile.y)}`),
  );
  const free = NEIGHBOURS.map(([dx, dy]) => ({ x: goal.x + dx, y: goal.y + dy })).filter(
    (tile) => !taken.has(`${String(tile.x)},${String(tile.y)}`),
  );
  const tile = free[attempt];
  if (tile) send({ t: 'MoveTo', p: { target: tile } });
}

function chooseTarget(): void {
  if (target && avatars.has(target)) return;
  const others = [...avatars.values()].filter((a) => a.personId !== me);
  target = (FOLLOW ? others.find((a) => a.displayName === FOLLOW) : others[0])?.personId ?? null;
  const name = target ? avatars.get(target)?.displayName : null;
  console.warn(name ? `Following ${name}.` : 'Waiting for someone to join the floor…');
  follow();
}

/** Plays everything the others say back into the conversation, one second later. */
async function joinConversation(id: string, url: string, token: string): Promise<void> {
  const next = new Room();
  const source = new AudioSource(48_000, 1);
  next.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
    if (track.kind !== TrackKind.KIND_AUDIO) return;
    void (async () => {
      for await (const frame of new AudioStream(track, 48_000, 1)) {
        setTimeout(() => void source.captureFrame(frame).catch(() => undefined), ECHO_DELAY_MS);
      }
    })();
  });
  await next.connect(url, token, { autoSubscribe: true, dynacast: false });
  const options = new TrackPublishOptions();
  options.source = TrackSource.SOURCE_MICROPHONE;
  await next.localParticipant?.publishTrack(LocalAudioTrack.createAudioTrack('echo', source), options);
  const previous = room;
  room = next;
  conversationId = id;
  await previous?.disconnect();
  console.warn('In a conversation: talk, and you will hear yourself a second later.');
}

function onEvent(event: ServerEvent): void {
  switch (event.t) {
    case 'Authenticated':
      me = event.p.personId;
      send({ t: 'JoinFloor', p: { floorId: FLOOR } });
      return;
    case 'FloorSnapshot':
      avatars.clear();
      for (const avatar of event.p.avatars) avatars.set(avatar.personId, avatar);
      chooseTarget();
      return;
    case 'AvatarJoined':
      avatars.set(event.p.avatar.personId, event.p.avatar);
      chooseTarget();
      return;
    case 'AvatarLeft':
      avatars.delete(event.p.personId);
      if (event.p.personId === target) {
        target = null;
        chooseTarget();
      }
      return;
    case 'AvatarPathStarted': {
      const avatar = avatars.get(event.p.personId);
      if (avatar) avatars.set(avatar.personId, { ...avatar, tile: event.p.movement.from, movement: event.p.movement });
      if (event.p.personId === target) follow();
      return;
    }
    case 'ConversationAccessGranted':
      if (event.p.conversationId !== conversationId) {
        void joinConversation(event.p.conversationId, event.p.url, event.p.token).catch((error: unknown) => {
          console.error('Could not join the conversation:', error);
        });
      }
      return;
    case 'ConversationDissolved':
      if (event.p.conversationId === conversationId) {
        conversationId = null;
        void room?.disconnect();
        room = null;
        console.warn('The conversation ended. Walk back to me, or I will follow you.');
      }
      return;
    case 'Nack':
      if (event.p.code === 'unreachable') follow(true);
      return;
    default:
  }
}

socket.binaryType = 'nodebuffer';
socket.on('open', () => {
  void accessToken().then((token) => {
    send({ t: 'Authenticate', p: { accessToken: token } });
  });
});
socket.on('message', (data: Buffer) => {
  const event = decodeServerEvent(new Uint8Array(data));
  if (event.ok) onEvent(event.value);
});
socket.on('close', () => {
  console.warn('Disconnected from the TeamTown server.');
  process.exit(0);
});

const stop = () => {
  void room?.disconnect().finally(() => {
    socket.close();
  });
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
console.warn('Echo colleague starting (Ctrl+C to stop)…');
