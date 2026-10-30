import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import {
  decodeServerEvent,
  encodeMessage,
  FloorListResponse,
  FloorPlan,
  HealthResponse,
  MeResponse,
  MeetingLogListResponse,
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
});
