import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import {
  ChannelListResponse,
  ChannelSummarySchema,
  decodeServerEvent,
  encodeMessage,
  FloorListResponse,
  FloorPlan,
  HealthResponse,
  MeResponse,
  MeetingLogListResponse,
  MessagePageResponse,
  MessageSchema,
  SearchMessagesResponse,
  PeopleListResponse,
  ThreadListResponse,
  REALTIME_PATH,
  REALTIME_SUBPROTOCOL,
  type ClientCommand,
  type ServerEvent,
} from '@teamtown/contracts';
import { err, ok } from '@teamtown/kernel';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { createApp } from './create-app.ts';
import type { TokenVerifier } from './modules/identity/public-api.ts';

/**
 * End-to-end test of the server: real PostgreSQL (Testcontainers), real migrations and seeds, real
 * HTTP and WebSockets. Only the OIDC token verification is replaced, so no Keycloak is needed.
 */
const people: Record<string, { subject: string; displayName: string }> = {
  'token-lena': { subject: 'sub-lena', displayName: 'Lena Hoffmann' },
  'token-ben': { subject: 'sub-ben', displayName: 'Ben Krüger' },
  'token-mia': { subject: 'sub-mia', displayName: 'Mia Schulz' },
};

const fakeVerifier: TokenVerifier = {
  verify: (token) => {
    const person = people[token];
    return Promise.resolve(
      person ? ok({ ...person, email: null, expiresAt: Date.now() + 3_600_000 }) : err('invalid-token'),
    );
  },
};

class TestClient {
  readonly events: ServerEvent[] = [];
  readonly #socket: WebSocket;
  #counter = 0;

  constructor(url: string, protocols: string[] = [REALTIME_SUBPROTOCOL]) {
    this.#socket = new WebSocket(url, protocols);
    this.#socket.binaryType = 'nodebuffer';
    this.#socket.on('message', (data: Buffer) => {
      const event = decodeServerEvent(new Uint8Array(data));
      if (event.ok) this.events.push(event.value);
    });
  }

  opened(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#socket.once('open', () => {
        resolve();
      });
      this.#socket.once('error', reject);
    });
  }

  closed(): Promise<number> {
    return new Promise((resolve) =>
      this.#socket.once('close', (code) => {
        resolve(code);
      }),
    );
  }

  /** Sends a command with a correlation id and waits for its Ack or Nack. */
  async command(command: Omit<ClientCommand, 'id'>): Promise<ServerEvent> {
    const id = `c-${++this.#counter}`;
    this.#socket.send(encodeMessage({ ...command, id } as ClientCommand));
    return this.waitFor((event) => (event.t === 'Ack' || event.t === 'Nack') && event.p.id === id);
  }

  async waitFor(predicate: (event: ServerEvent) => boolean, timeoutMs = 5000): Promise<ServerEvent> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const found = this.events.find(predicate);
      if (found) return found;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`Timed out; received: ${this.events.map((event) => event.t).join(', ')}`);
  }

  close(): void {
    this.#socket.close();
  }
}

describe('TeamTown server (integration)', () => {
  let database: StartedPostgreSqlContainer;
  let app: NestFastifyApplication;
  let baseUrl: string;
  let realtimeUrl: string;

  beforeAll(async () => {
    database = await new PostgreSqlContainer('postgres:18.6-alpine').start();
    app = await createApp(
      {
        NODE_ENV: 'test',
        HOST: '127.0.0.1',
        PORT: 0,
        DATABASE_URL: database.getConnectionUri(),
        DATABASE_MIGRATE_ON_START: true,
        OIDC_ISSUER: 'http://issuer.invalid/realms/test',
        OIDC_AUDIENCE: 'teamtown-api',
        LOG_LEVEL: 'info',
        MEETING_LOG_RETENTION_DAYS: 90,
        FILES_STORAGE_PATH: './data/files-test',
        FILES_CLAMAV_PORT: 3310,
      },
      { tokenVerifier: fakeVerifier },
    );
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}/api`;
    realtimeUrl = `ws://127.0.0.1:${port}${REALTIME_PATH}`;
  }, 180_000);

  afterAll(async () => {
    await app.close();
    await database.stop();
  });

  const get = (path: string, token?: string) =>
    fetch(`${baseUrl}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  const remove = (path: string, token: string) =>
    fetch(`${baseUrl}${path}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
  const send = (method: 'POST' | 'PATCH' | 'PUT', path: string, token: string, body: unknown) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  async function connect(token: string): Promise<TestClient> {
    const client = new TestClient(realtimeUrl);
    await client.opened();
    expect(await client.command({ t: 'Authenticate', p: { accessToken: token } })).toMatchObject({ t: 'Ack' });
    return client;
  }

  describe('REST', () => {
    it('reports health according to the contract', async () => {
      const response = await get('/health');
      expect(HealthResponse.safeParse(await response.json()).success).toBe(true);
    });

    it('requires a valid token', async () => {
      expect((await get('/me')).status).toBe(401);
      expect((await get('/me', 'forged')).status).toBe(401);
    });

    it('creates the person on first contact and keeps the same id afterwards', async () => {
      const first = MeResponse.parse(await (await get('/me', 'token-lena')).json());
      const second = MeResponse.parse(await (await get('/me', 'token-lena')).json());

      expect(first.displayName).toBe('Lena Hoffmann');
      expect(second.personId).toBe(first.personId);
    });

    it('lists the seeded floors and serves their plans', async () => {
      const list = FloorListResponse.parse(await (await get('/floors', 'token-lena')).json());
      expect(list.floors.map((floor) => floor.floorId)).toEqual(['ground-floor', 'upper-floor']);

      const plan = FloorPlan.parse(await (await get('/floors/ground-floor/plan', 'token-lena')).json());
      expect(plan.rooms.map((room) => room.name)).toContain('Elbe');
      expect((await get('/floors/basement/plan', 'token-lena')).status).toBe(404);
    });
  });

  describe('realtime', () => {
    it('rejects connections without the protocol version', async () => {
      const client = new TestClient(realtimeUrl, []);
      await expect(client.opened()).rejects.toThrow();
    });

    it('requires authentication before other commands', async () => {
      const client = new TestClient(realtimeUrl);
      await client.opened();

      expect(await client.command({ t: 'JoinFloor', p: { floorId: 'ground-floor' } })).toMatchObject({
        t: 'Nack',
        p: { code: 'not-authenticated' },
      });
      expect(await client.command({ t: 'Authenticate', p: { accessToken: 'forged' } })).toMatchObject({
        t: 'Nack',
        p: { code: 'invalid-token' },
      });
      client.close();
    });

    it('lets two people see each other walk, switch floors and leave', async () => {
      const lena = await connect('token-lena');
      const ben = await connect('token-ben');
      const authenticated = await lena.waitFor((event) => event.t === 'Authenticated');
      const lenaId = authenticated.t === 'Authenticated' ? authenticated.p.personId : '';

      await lena.command({ t: 'JoinFloor', p: { floorId: 'ground-floor' } });
      await ben.command({ t: 'JoinFloor', p: { floorId: 'ground-floor' } });
      const snapshot = await ben.waitFor((event) => event.t === 'FloorSnapshot');
      expect(snapshot.t === 'FloorSnapshot' && snapshot.p.avatars).toHaveLength(2);

      // Walk into the meeting room Elbe: the path must go through its door at x = 28.
      expect(await lena.command({ t: 'MoveTo', p: { target: { x: 32, y: 9 } } })).toMatchObject({ t: 'Ack' });
      const path = await ben.waitFor((event) => event.t === 'AvatarPathStarted');
      expect(path.t === 'AvatarPathStarted' && path.p.movement.path).toContainEqual({ x: 28, y: 7 });
      expect(path.t === 'AvatarPathStarted' && path.p.personId).toBe(lenaId);

      expect(await lena.command({ t: 'MoveTo', p: { target: { x: 4, y: 4 } } })).toMatchObject({
        t: 'Nack',
        p: { code: 'unreachable' },
      });

      await lena.command({ t: 'JoinFloor', p: { floorId: 'upper-floor' } });
      await ben.waitFor((event) => event.t === 'AvatarLeft');

      lena.close();
      ben.close();
    });

    it('logs a meeting only with consent, keeps others out and shows the log to its participants', async () => {
      const lena = await connect('token-lena');
      const ben = await connect('token-ben');
      const mia = await connect('token-mia');
      for (const client of [lena, ben, mia]) await client.command({ t: 'JoinFloor', p: { floorId: 'ground-floor' } });

      // Both walk into the empty meeting room Elbe and end up in its room call.
      await lena.command({ t: 'MoveTo', p: { target: { x: 32, y: 9 } } });
      await ben.command({ t: 'MoveTo', p: { target: { x: 33, y: 9 } } });
      await lena.waitFor(
        (event) => event.t === 'RoomCallChanged' && event.p.roomCall.participants.length === 2,
        20_000,
      );

      expect(await lena.command({ t: 'StartMeetingLog', p: { title: 'Sprint review' } })).toMatchObject({ t: 'Ack' });
      await mia.waitFor((event) => event.t === 'MeetingLogChanged' && event.p.active);
      const asked = await ben.waitFor((event) => event.t === 'MeetingLogConsentRequested');
      expect(asked).toMatchObject({ p: { roomId: 'elbe', title: 'Sprint review' } });
      expect(await ben.command({ t: 'AnswerMeetingLog', p: { roomId: 'elbe', join: true } })).toMatchObject({
        t: 'Ack',
      });

      // Nobody walks in without consenting, whatever the door says.
      expect(await mia.command({ t: 'MoveTo', p: { target: { x: 34, y: 9 } } })).toMatchObject({
        t: 'Nack',
        p: { code: 'consent-required' },
      });

      const logs = MeetingLogListResponse.parse(await (await get('/meeting-logs', 'token-ben')).json());
      expect(logs.logs).toHaveLength(1);
      expect(logs.logs[0]?.title).toBe('Sprint review');
      expect(logs.logs[0]?.participants.map((p) => p.displayName)).toEqual(['Lena Hoffmann', 'Ben Krüger']);
      const meetingId = logs.logs[0]?.meetingId ?? '';
      expect(MeetingLogListResponse.parse(await (await get('/meeting-logs', 'token-mia')).json()).logs).toEqual([]);

      expect((await remove(`/meeting-logs/${meetingId}`, 'token-mia')).status).toBe(404);
      expect((await remove(`/meeting-logs/${meetingId}`, 'token-ben')).status).toBe(403);
      expect((await remove(`/meeting-logs/${meetingId}`, 'token-lena')).status).toBe(204);
      expect(MeetingLogListResponse.parse(await (await get('/meeting-logs', 'token-ben')).json()).logs).toEqual([]);

      for (const client of [lena, ben, mia]) client.close();
    }, 60_000);
  });

  describe('messaging', () => {
    const idOf = async (token: string) => MeResponse.parse(await (await get('/me', token)).json()).personId;
    const channelsOf = async (token: string) =>
      ChannelListResponse.parse(await (await get('/channels', token)).json()).channels;

    it('puts everyone into #general and #random and lists people for DMs', async () => {
      const names = (await channelsOf('token-mia'))
        .filter((channel) => channel.kind !== 'room')
        .map((channel) => channel.name)
        .sort();
      expect(names).toEqual(['general', 'random']);
      expect((await remove(`/channels/general/members/me`, 'token-mia')).status).toBe(403);

      const people = PeopleListResponse.parse(await (await get('/people', 'token-mia')).json()).people;
      expect(people.map((person) => person.displayName)).toContain('Lena Hoffmann');
    });

    it('creates one room wall per published room and lets members use it without entering the room', async () => {
      const floors = FloorListResponse.parse(await (await get('/floors', 'token-mia')).json()).floors;
      const expected = (
        await Promise.all(
          floors.map(async (floor) => {
            const plan = FloorPlan.parse(await (await get(`/floors/${floor.floorId}/plan`, 'token-mia')).json());
            return plan.rooms.map((room) => ({ floorId: floor.floorId, roomId: room.id, name: room.name }));
          }),
        )
      ).flat();
      const walls = (await channelsOf('token-mia')).filter((channel) => channel.kind === 'room');
      expect(walls.map(({ floorId, roomId, name }) => ({ floorId, roomId, name }))).toEqual(
        expect.arrayContaining(expected),
      );
      expect(walls).toHaveLength(expected.length);

      const wall = walls.find((channel) => channel.floorId === 'ground-floor' && channel.roomId === 'elbe');
      expect(wall).toBeDefined();
      const posted = await send('POST', `/channels/${wall?.channelId ?? ''}/messages`, 'token-mia', {
        body: 'Persistent room note',
      });
      expect(posted.status).toBe(201);
      await channelsOf('token-ben');
      const history = MessagePageResponse.parse(
        await (await get(`/channels/${wall?.channelId ?? ''}/messages`, 'token-ben')).json(),
      );
      expect(history.messages.map((message) => message.body)).toContain('Persistent room note');
    });

    it('keeps a private channel and its messages to its members, live and with unread counts', async () => {
      const benId = await idOf('token-ben');
      const ben = await connect('token-ben');
      const created = await send('POST', '/channels', 'token-lena', { kind: 'private', name: 'Leads' });
      const channel = ChannelSummarySchema.parse(await created.json());
      expect(channel).toMatchObject({ name: 'leads', kind: 'private', unreadCount: 0 });
      const path = `/channels/${channel.channelId}`;

      // Not a member: the channel doesn't exist as far as Mia and Ben can tell.
      expect((await get(`${path}/messages`, 'token-mia')).status).toBe(404);
      expect((await send('POST', `${path}/messages`, 'token-ben', { body: 'hi' })).status).toBe(404);
      expect((await send('POST', '/channels', 'token-mia', { kind: 'public', name: 'leads' })).status).toBe(409);

      expect((await send('POST', `${path}/members`, 'token-lena', { personIds: [benId] })).status).toBe(201);
      await ben.waitFor((event) => event.t === 'ChannelChanged' && event.p.channelId === channel.channelId);

      const posted = MessageSchema.parse(
        await (await send('POST', `${path}/messages`, 'token-lena', { body: '**Moin** <script>' })).json(),
      );
      const pushed = await ben.waitFor((event) => event.t === 'MessagePosted');
      expect(pushed).toMatchObject({ p: { message: { messageId: posted.messageId, body: '**Moin** <script>' } } });

      const unread = async () =>
        (await channelsOf('token-ben')).find((c) => c.channelId === channel.channelId)?.unreadCount;
      expect(await unread()).toBe(1);
      expect((await send('PUT', `${path}/read-marker`, 'token-ben', { messageId: posted.messageId })).status).toBe(204);
      expect(await unread()).toBe(0);
      await ben.waitFor((event) => event.t === 'ReadMarkerMoved');

      // Only the author edits and deletes; deleting removes the body.
      const messagePath = `${path}/messages/${posted.messageId}`;
      expect((await send('PATCH', messagePath, 'token-ben', { body: 'x' })).status).toBe(403);
      expect((await send('PATCH', messagePath, 'token-lena', { body: 'Moin!' })).status).toBe(200);
      expect((await remove(messagePath, 'token-lena')).status).toBe(204);
      await ben.waitFor((event) => event.t === 'MessageDeleted');
      const page = MessagePageResponse.parse(await (await get(`${path}/messages`, 'token-ben')).json());
      expect(page.messages).toEqual([expect.objectContaining({ body: '', deleted: true })]);

      ben.close();
    });

    it('opens one 1:1 DM per pair and refuses bad requests plainly', async () => {
      const lenaId = await idOf('token-lena');
      const benId = await idOf('token-ben');
      const first = ChannelSummarySchema.parse(
        await (await send('POST', '/direct-messages', 'token-lena', { personIds: [benId] })).json(),
      );
      const second = ChannelSummarySchema.parse(
        await (await send('POST', '/direct-messages', 'token-ben', { personIds: [lenaId] })).json(),
      );
      expect(second.channelId).toBe(first.channelId);
      expect(first).toMatchObject({ kind: 'direct', group: false, name: null });

      const miaId = await idOf('token-mia');
      await send('POST', `/channels/${first.channelId}/messages`, 'token-lena', { body: 'pair history' });
      const converted = ChannelSummarySchema.parse(
        await (await send('POST', `/channels/${first.channelId}/members`, 'token-ben', { personIds: [miaId] })).json(),
      );
      expect(converted).toMatchObject({ channelId: first.channelId, kind: 'direct', group: true });
      expect(
        MessagePageResponse.parse(
          await (await get(`/channels/${first.channelId}/messages`, 'token-mia')).json(),
        ).messages.map((message) => message.body),
      ).toEqual(['pair history']);
      const freshPair = ChannelSummarySchema.parse(
        await (await send('POST', '/direct-messages', 'token-lena', { personIds: [benId] })).json(),
      );
      expect(freshPair).toMatchObject({ kind: 'direct', group: false });
      expect(freshPair.channelId).not.toBe(first.channelId);

      // Regression: a group DM is found again by its members (array parameters in raw SQL).
      const openGroup = async (token: string, personIds: string[]) =>
        ChannelSummarySchema.parse(await (await send('POST', '/direct-messages', token, { personIds })).json());
      const group = await openGroup('token-lena', [benId, miaId]);
      expect(group).toMatchObject({ kind: 'direct', group: true });
      expect((await openGroup('token-mia', [lenaId, benId])).channelId).toBe(group.channelId);

      const unknown = await send('POST', '/direct-messages', 'token-lena', {
        personIds: ['00000000-0000-4000-8000-000000000000'],
      });
      expect(unknown.status).toBe(400);
      expect(await unknown.json()).toMatchObject({ message: 'unknown-person' });
      expect((await send('POST', '/channels', 'token-lena', { kind: 'secret' })).status).toBe(400);
    });

    it('finds messages by inflected words and file names, but never what one may not read (M3e)', async () => {
      const search = async (token: string, query: string) =>
        SearchMessagesResponse.parse(
          await (await get(`/search/messages?q=${encodeURIComponent(query)}`, token)).json(),
        ).results.map((result) => result.message.body);
      const post = async (channelId: string, token: string, body: string) =>
        MessageSchema.parse(await (await send('POST', `/channels/${channelId}/messages`, token, { body })).json());

      const open = ChannelSummarySchema.parse(
        await (await send('POST', '/channels', 'token-lena', { kind: 'public', name: 'suche-offen' })).json(),
      );
      const closed = ChannelSummarySchema.parse(
        await (await send('POST', '/channels', 'token-lena', { kind: 'private', name: 'suche-geheim' })).json(),
      );
      await post(open.channelId, 'token-lena', 'Die Rechnungen sind da');
      await post(open.channelId, 'token-lena', 'The invoices arrived');
      await post(closed.channelId, 'token-lena', 'Die geheimen Rechnungen');

      // German and English forms, and the start of a word while typing.
      expect(await search('token-lena', 'rechnung')).toEqual(
        expect.arrayContaining(['Die Rechnungen sind da', 'Die geheimen Rechnungen']),
      );
      expect(await search('token-lena', 'invoice')).toEqual(['The invoices arrived']);
      expect(await search('token-lena', 'rechn')).toContain('Die Rechnungen sind da');

      // Mia isn't in the private channel, but may read the public one she hasn't joined.
      expect(await search('token-mia', 'rechnung')).toEqual(['Die Rechnungen sind da']);
      expect((await get(`/search/messages?q=rechnung&channelId=${closed.channelId}`, 'token-mia')).status).toBe(404);
      expect((await get('/search/messages?q=x', 'token-mia')).status).toBe(400);

      // "Only in this conversation", and a deleted message is gone.
      const scoped = SearchMessagesResponse.parse(
        await (await get(`/search/messages?q=rechnung&channelId=${open.channelId}`, 'token-lena')).json(),
      );
      expect(scoped.results).toMatchObject([
        { channel: { channelId: open.channelId, name: 'suche-offen' }, snippet: 'Die Rechnungen sind da' },
      ]);
      const doomed = await post(open.channelId, 'token-lena', 'Vergänglicher Satz');
      expect(await search('token-lena', 'vergänglich')).toEqual(['Vergänglicher Satz']);
      await remove(`/channels/${open.channelId}/messages/${doomed.messageId}`, 'token-lena');
      expect(await search('token-lena', 'vergänglich')).toEqual([]);
    });

    it('keeps replies in threads, counts mentions and shows public reactions in the office (M3b)', async () => {
      const [lenaId, benId, miaId] = await Promise.all(['token-lena', 'token-ben', 'token-mia'].map(idOf));
      const lena = await connect('token-lena');
      const ben = await connect('token-ben');
      for (const client of [lena, ben]) await client.command({ t: 'JoinFloor', p: { floorId: 'ground-floor' } });

      const crew = ChannelSummarySchema.parse(
        await (await send('POST', '/channels', 'token-lena', { kind: 'public', name: 'crew' })).json(),
      );
      const path = `/channels/${crew.channelId}`;
      // In public channels members add others (ADR-0034).
      expect((await send('POST', `${path}/members`, 'token-lena', { personIds: [benId, miaId] })).status).toBe(201);

      const root = MessageSchema.parse(
        await (await send('POST', `${path}/messages`, 'token-lena', { body: 'Wer kommt mit?' })).json(),
      );
      const reply = MessageSchema.parse(
        await (
          await send('POST', `${path}/messages`, 'token-ben', {
            body: `Ich! <@${lenaId}>`,
            threadRootId: root.messageId,
          })
        ).json(),
      );
      expect(reply).toMatchObject({ threadRootId: root.messageId, alsoInChannel: false, thread: null });
      await lena.waitFor((event) => event.t === 'ThreadActivity' && event.p.rootMessageId === root.messageId);

      const page = MessagePageResponse.parse(await (await get(`${path}/messages`, 'token-lena')).json());
      expect(page.messages.map((message) => message.body)).toEqual(['Wer kommt mit?']);
      expect(page.messages[0]?.thread).toMatchObject({ replyCount: 1, replierIds: [benId] });
      const replies = MessagePageResponse.parse(
        await (await get(`${path}/messages/${root.messageId}/replies`, 'token-mia')).json(),
      );
      expect(replies.messages.map((message) => message.body)).toEqual([`Ich! <@${lenaId}>`]);

      const lenaThreads = async () =>
        ThreadListResponse.parse(await (await get('/threads', 'token-lena')).json()).threads;
      expect(await lenaThreads()).toMatchObject([{ channelId: crew.channelId, unreadCount: 1 }]);
      expect((await channelsOf('token-lena')).find((c) => c.channelId === crew.channelId)?.mentionCount).toBe(1);
      const threadPath = `${path}/threads/${root.messageId}`;
      expect(
        (await send('PUT', `${threadPath}/read-marker`, 'token-lena', { messageId: reply.messageId })).status,
      ).toBe(204);
      expect((await lenaThreads())[0]?.unreadCount).toBe(0);
      expect((await channelsOf('token-lena')).find((c) => c.channelId === crew.channelId)?.mentionCount).toBe(0);
      expect((await remove(`${threadPath}/follow`, 'token-lena')).status).toBe(204);
      expect(await lenaThreads()).toEqual([]);

      // A mention in the channel counts independently of thread-reply mentions.
      await send('POST', `${path}/messages`, 'token-mia', { body: `Hey <@${benId}>` });
      const benCrew = (await channelsOf('token-ben')).find((channel) => channel.channelId === crew.channelId);
      expect(benCrew).toMatchObject({ unreadCount: 2, mentionCount: 1 });
      expect((await channelsOf('token-lena')).find((c) => c.channelId === crew.channelId)?.unreadCount).toBe(1);

      const reactionPath = `${path}/messages/${root.messageId}/reactions`;
      const reacted = MessageSchema.parse(
        await (await send('PUT', `${reactionPath}/${encodeURIComponent('👍')}`, 'token-ben', {})).json(),
      );
      expect(reacted.reactions).toEqual([{ emoji: '👍', personIds: [benId] }]);
      await lena.waitFor((event) => event.t === 'ReactionChanged' && event.p.added);
      expect(await lena.waitFor((event) => event.t === 'AvatarEmoted')).toMatchObject({
        p: { personId: benId, emoji: '👍' },
      });
      const invalid = await send('PUT', `${reactionPath}/abc`, 'token-ben', {});
      expect(invalid.status).toBe(400);
      expect(await invalid.json()).toMatchObject({ message: 'invalid-emoji' });

      lena.close();
      ben.close();
    });
  });
});
