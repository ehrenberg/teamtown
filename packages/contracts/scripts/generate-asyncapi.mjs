// Generates docs/api/asyncapi.yaml from the Zod realtime contracts, the single source for message shapes
// (docs/architecture/world-and-realtime.md §5).
// Usage: node packages/contracts/scripts/generate-asyncapi.mjs [--check]
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { z } from 'zod';
import {
  ClientCommand,
  REALTIME_PATH,
  REALTIME_PROTOCOL_VERSION,
  REALTIME_SUBPROTOCOL,
  ServerEvent,
} from '../src/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(here, '../../../docs/api/asyncapi.yaml');

/** One line per message; the generator fails when a message has none. */
const summaries = {
  Authenticate:
    'Authenticates the connection with the OIDC access token. Must be the first command; send again with a refreshed token.',
  Ping: 'Clock sync: sends the local time and receives the server time back (Pong).',
  JoinFloor:
    'Enters a floor or switches floors. The server places the avatar at a spawn point and sends a FloorSnapshot.',
  MoveTo: 'Walks to a tile on the current floor. The server computes and validates the path.',
  LockConversation: 'Locks the own conversation: it takes in no new people. Any participant may lock it.',
  UnlockConversation: 'Unlocks the own conversation.',
  RequestConversationToken: 'Asks for a fresh media token for the own conversation, e.g. after a reconnect.',
  SetDoorMode: 'Changes the door mode of the room the person is in. Any occupant may do this until M4.',
  KnockOnRoom: 'Knocks on an occupied knock-mode room. Everyone inside sees the request; it expires after 60 s.',
  CancelKnock: 'Withdraws the own knock.',
  AnswerKnock: 'Admits or declines a knock on the room the person is in. The first answer counts.',
  RequestRoomCallToken: 'Asks for a fresh media token for the call of the room the person is in.',
  StartCall: 'Rings someone who is online, on any floor.',
  InviteToCall: 'Rings one more person into the own call. Any participant may; at most 8 people per call.',
  AnswerCall: 'Accepts or declines the call one is being rung for.',
  LeaveCall: 'Hangs up. A call ends when fewer than two participants are left.',
  RequestDirectCallToken: 'Asks for a fresh media token for the own direct call, e.g. after a reconnect.',
  ListOnlinePeople: 'Asks for everyone who is online, on any floor; answered with OnlinePeople.',
  SetCamera: 'Switches the own camera on (only inside a conversation or call) or off.',
  StartScreenShare: 'Shares the own screen in a room call or direct call; takes over from the previous sharer.',
  StopScreenShare: 'Stops sharing the own screen.',
  StartMeetingLog: 'Starts a logged meeting in the own room call; the sender becomes its host.',
  EndMeetingLog: 'The host ends the logged meeting; the call goes on unlogged.',
  AnswerMeetingLog: 'Joins (consents to) or declines a logged meeting, from inside the room or before walking in.',
  Authenticated: 'The connection is authenticated.',
  Pong: 'Answer to Ping with the server time.',
  FloorSnapshot:
    'Full state of a floor (avatars, conversations, live door modes and room calls), sent after joining it.',
  AvatarJoined: 'Someone entered the floor. Sent to everyone on the floor.',
  AvatarLeft: 'Someone left the floor. Sent to everyone on the floor.',
  AvatarPathStarted: 'Someone started walking along a server-validated path. Sent to everyone on the floor.',
  ConversationFormed: 'A proximity conversation formed. Sent to everyone on the floor.',
  ConversationChanged: 'Participants or the lock of a conversation changed. Sent to everyone on the floor.',
  ConversationDissolved: 'A conversation ended. Sent to everyone on the floor.',
  ConversationAccessGranted:
    'Media access to a conversation: LiveKit URL and a token valid for 30 s. Sent only to the participant it is for.',
  DoorModeChanged: 'The live door mode of a room changed. Sent to everyone on the floor.',
  RoomCallChanged: 'Who is in a room call changed; no participants means it ended. Sent to everyone on the floor.',
  KnockRequested: 'Someone knocked. Sent to the occupants of the room and to the requester.',
  KnockAnswered: 'A knock was admitted, declined, expired or cancelled. Sent to the occupants and to the requester.',
  RoomCallAccessGranted:
    'Media access to a room call: LiveKit URL and a token valid for 30 s. Sent only to the occupant it is for.',
  DirectCallChanged: 'A direct call started ringing or changed. Sent to its participants and invitees only.',
  DirectCallEnded: 'A direct call ended. Sent to its participants and invitees only.',
  CallInvitationAnswered:
    'Someone accepted, declined, did not answer, was busy, or the ringing was cancelled. Sent to participants and invitees.',
  DirectCallAccessGranted:
    'Media access to a direct call: LiveKit URL and a token valid for 30 s. Sent only to the participant it is for.',
  OnCallChanged: 'Someone started or stopped being in a direct call (not with whom). Sent to everyone on the floor.',
  OnlinePeople: 'Everyone who is online, with their floor. Sent only to the requester.',
  CameraChanged: 'Someone switched their camera on or off. Sent to everyone on the floor; no picture.',
  ScreenShareChanged: 'Who shares the screen in the own call now. Sent to the call and the previous sharer.',
  MeetingLogChanged: 'A room started or stopped being logged. Sent to everyone on the floor; no title.',
  MeetingLogDetails: 'The logged meeting one is in, or null once it ended. Sent to its participants.',
  MeetingLogConsentRequested: 'Asks someone inside a logged room for consent. Sent only to them.',
  Ack: 'The command with this correlation ID succeeded.',
  Nack: 'The command failed. Codes are stable and translated in the client.',
};

function messagesOf(union, io) {
  return Object.fromEntries(
    union.options.map((schema) => {
      const name = schema.shape.t.value;
      const summary = summaries[name];
      if (!summary) throw new Error(`Add a summary for the realtime message "${name}" to generate-asyncapi.mjs.`);
      const { $schema: _, ...payload } = z.toJSONSchema(schema, { target: 'draft-7', io });
      return [name, { name, title: name, summary, payload }];
    }),
  );
}

const commands = messagesOf(ClientCommand, 'input');
const events = messagesOf(ServerEvent, 'output');
const refs = (messages) => Object.keys(messages).map((name) => ({ $ref: `#/channels/realtime/messages/${name}` }));

const document = {
  asyncapi: '3.0.0',
  info: {
    title: 'TeamTown realtime protocol',
    version: String(REALTIME_PROTOCOL_VERSION),
    description: [
      'One WebSocket per client. Every message is a MessagePack-encoded envelope `{ t, id?, p }`:',
      '`t` is the message type, `id` an optional correlation ID, `p` the payload.',
      'Commands go client → server and are answered with `Ack` or `Nack` when they carry an `id`.',
      'Events go server → client.',
      '',
      `The protocol version is negotiated with the WebSocket subprotocol \`${REALTIME_SUBPROTOCOL}\`.`,
      '',
      'Generated from `packages/contracts` by `pnpm asyncapi`. Do not edit by hand.',
    ].join('\n'),
    license: { name: 'AGPL-3.0-only', url: 'https://www.gnu.org/licenses/agpl-3.0.html' },
  },
  defaultContentType: 'application/msgpack',
  servers: {
    local: { host: 'localhost:3000', protocol: 'ws', pathname: REALTIME_PATH, description: 'Local development' },
  },
  channels: {
    realtime: {
      address: REALTIME_PATH,
      messages: { ...commands, ...events },
    },
  },
  operations: {
    receiveCommands: {
      action: 'receive',
      channel: { $ref: '#/channels/realtime' },
      summary: 'Commands the server accepts from a client.',
      messages: refs(commands),
    },
    sendEvents: {
      action: 'send',
      channel: { $ref: '#/channels/realtime' },
      summary: 'Events the server sends to a client.',
      messages: refs(events),
    },
  },
};

const yaml = stringify(document, { lineWidth: 0, aliasDuplicateObjects: false });

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(outputPath, 'utf8');
  } catch {
    // missing file is reported below
  }
  if (current !== yaml) {
    console.error('docs/api/asyncapi.yaml is out of date. Run `pnpm asyncapi` and commit the result.');
    process.exit(1);
  }
  console.log('docs/api/asyncapi.yaml is up to date.');
} else {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, yaml);
  console.log(`Wrote ${outputPath}`);
}
