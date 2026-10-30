import { createSocket } from 'node:dgram';
import { createServer } from 'node:net';
import { dispose, Room, RoomEvent } from '@livekit/rtc-node';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConversationMedia } from '../application/conversation-media.ts';
import { MeetingsEventStream } from '../application/meetings-event-stream.ts';
import { LiveKitMediaGateway } from './livekit-media-gateway.ts';

/** WebRTC ports are mapped 1:1, because LiveKit tells clients the port numbers it listens on. */
const LIVEKIT_IMAGE = 'livekit/livekit-server:v1.13.11';
const API_KEY = 'devkey';
const API_SECRET = 'secret';

const canBind = (port: number, kind: 'tcp' | 'udp') =>
  new Promise<boolean>((resolve) => {
    if (kind === 'udp') {
      const socket = createSocket('udp4');
      socket.once('error', () => {
        resolve(false);
      });
      socket.bind(port, '0.0.0.0', () =>
        socket.close(() => {
          resolve(true);
        }),
      );
      return;
    }
    const server = createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.listen(port, '0.0.0.0', () =>
      server.close(() => {
        resolve(true);
      }),
    );
  });

/** A free port outside the ranges Windows reserves for Hyper-V (usually above 49152). */
async function freePort(kind: 'tcp' | 'udp'): Promise<number> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const port = 20_000 + Math.floor(Math.random() * 20_000);
    if (await canBind(port, kind)) return port;
  }
  throw new Error(`No free ${kind} port found`);
}

describe('LiveKit conversation rooms (integration)', () => {
  let container: StartedTestContainer | undefined;
  let gateway: LiveKitMediaGateway;
  let media: ConversationMedia;
  const rooms: Room[] = [];

  beforeAll(async () => {
    const tcpPort = await freePort('tcp');
    const udpPort = await freePort('udp');
    const started = await new GenericContainer(LIVEKIT_IMAGE)
      .withCommand(['--dev', '--bind', '0.0.0.0', '--node-ip', '127.0.0.1'])
      .withEnvironment({ LIVEKIT_CONFIG: `rtc:\n  tcp_port: ${tcpPort}\n  udp_port: ${udpPort}\n` })
      .withExposedPorts(
        7880,
        { container: tcpPort, host: tcpPort },
        { container: udpPort, host: udpPort, protocol: 'udp' },
      )
      .withWaitStrategy(Wait.forListeningPorts())
      .start();
    container = started;
    const signal = `${started.getHost()}:${started.getMappedPort(7880)}`;
    gateway = new LiveKitMediaGateway({
      clientUrl: `ws://${signal}`,
      apiUrl: `http://${signal}`,
      apiKey: API_KEY,
      apiSecret: API_SECRET,
    });
    media = new ConversationMedia(gateway, new MeetingsEventStream());
  }, 120_000);

  afterAll(async () => {
    for (const room of rooms) await room.disconnect();
    await dispose();
    await container?.stop();
  });

  async function join(roomName: string, identity: string) {
    const room = new Room();
    rooms.push(room);
    const disconnected = new Promise<void>((resolve) =>
      room.once(RoomEvent.Disconnected, () => {
        resolve();
      }),
    );
    await room.connect(gateway.clientUrl, await gateway.issueToken(roomName, identity));
    return { room, disconnected };
  }

  const within = <T>(promise: Promise<T>, ms: number) =>
    Promise.race([
      promise.then(() => true),
      new Promise<boolean>((resolve) =>
        setTimeout(() => {
          resolve(false);
        }, ms),
      ),
    ]);

  it('removes someone who leaves the conversation from its room', async () => {
    await join('conversation:c1', 'anna');
    const ben = await join('conversation:c1', 'ben');

    await media.apply([
      {
        type: 'ConversationChanged',
        floorId: 'ground-floor',
        conversation: { conversationId: 'c1', participants: ['anna', 'carl'], locked: false },
        joined: ['carl'],
        left: ['ben'],
      },
    ]);

    expect(await within(ben.disconnected, 5_000)).toBe(true);
    expect(await gateway.listParticipants('conversation:c1')).toEqual(['anna']);
  }, 60_000);

  it('throws out a modified client that sits in a room it does not belong to', async () => {
    await join('conversation:c2', 'anna');
    // Mallory kept a token from an earlier conversation and reconnects with it.
    const mallory = await join('conversation:c2', 'mallory');

    await media.reconcile(new Map([['c2', ['anna', 'ben']]]));

    expect(await within(mallory.disconnected, 5_000)).toBe(true);
    expect(await gateway.listParticipants('conversation:c2')).toEqual(['anna']);
  }, 60_000);

  it('closes rooms of conversations that ended', async () => {
    const dora = await join('conversation:c3', 'dora');

    await media.reconcile(new Map());

    expect(await within(dora.disconnected, 5_000)).toBe(true);
    expect(await gateway.listRooms()).not.toContain('conversation:c3');
  }, 60_000);
});
