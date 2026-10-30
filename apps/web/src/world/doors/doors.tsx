import { useFrame } from '@react-three/fiber';
import type { FloorPlan } from '@teamtown/contracts';
import { DoorOpen, Hand, Lock } from 'lucide-react';
import { useMemo } from 'react';
import { Vector3 } from 'three';
import { useRoomStore, type DoorMode } from '../../stores/room-store.ts';
import { metres, tileCentreToWorld } from '../coordinates.ts';
import { WORLD_PALETTE } from '../palette.ts';
import { adjustableRoomDoors, type DoorOpening } from './room-doors.ts';

/** Door signs hang a bit above the low inner walls. */
const SIGN_HEIGHT = 1.45;
const PANEL_HEIGHT = 1.0;
const PANEL_THICKNESS = 0.05;

const signElements = new Map<string, HTMLElement>();
const signAnchors = new Map<string, Vector3>();
const point = new Vector3();

const SIGN_STYLE: Readonly<Record<DoorMode, { readonly icon: typeof Lock; readonly className: string }>> = {
  open: { icon: DoorOpen, className: 'bg-sage-700 text-white' },
  knock: { icon: Hand, className: 'bg-status-away text-espresso' },
  locked: { icon: Lock, className: 'bg-terracotta-700 text-white' },
};

function DoorPanel({ opening, locked }: { readonly opening: DoorOpening; readonly locked: boolean }) {
  const [x, z] = tileCentreToWorld(opening.x, opening.y);
  const width = metres(1);
  return (
    <mesh position={[x, PANEL_HEIGHT / 2, z]} castShadow receiveShadow>
      <boxGeometry
        args={opening.horizontal ? [width, PANEL_HEIGHT, PANEL_THICKNESS] : [PANEL_THICKNESS, PANEL_HEIGHT, width]}
      />
      <meshStandardMaterial color={locked ? WORLD_PALETTE.terracotta : WORLD_PALETTE.wood} />
    </mesh>
  );
}

/**
 * Closed doors (knock or locked) get a door leaf in the opening; open doors stay a gap. Lives inside the canvas
 * and also moves the door signs (`DoorSigns`) to their doors on every frame.
 */
export function DoorLeaves({ plan }: { readonly plan: FloorPlan }) {
  const groups = useMemo(() => adjustableRoomDoors(plan), [plan]);
  const doorModes = useRoomStore((state) => state.doorModes);

  useFrame(({ camera, size }) => {
    for (const [roomId, element] of signElements) {
      const anchor = signAnchors.get(roomId);
      if (!anchor) continue;
      point.copy(anchor).project(camera);
      const x = ((point.x + 1) / 2) * size.width;
      const y = ((1 - point.y) / 2) * size.height;
      element.style.visibility = 'visible';
      element.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  });

  return (
    <group>
      {groups.map(({ roomId, openings }) => {
        const mode = doorModes[roomId] ?? 'open';
        if (mode === 'open') return null;
        return openings.map((opening) => (
          <DoorPanel key={`${roomId}:${opening.x},${opening.y}`} opening={opening} locked={mode === 'locked'} />
        ));
      })}
    </group>
  );
}

/**
 * Door signs as plain DOM above the canvas: the door mode as colour, icon and text. Hidden from assistive
 * technology: the rooms list is the accessible equivalent.
 */
export function DoorSigns({ plan, labels }: { readonly plan: FloorPlan; readonly labels: Record<DoorMode, string> }) {
  const groups = useMemo(() => adjustableRoomDoors(plan), [plan]);
  const doorModes = useRoomStore((state) => state.doorModes);
  const knocks = useRoomStore((state) => state.knocks);
  const knockedRooms = new Set(Object.values(knocks).map((knock) => knock.roomId));
  const names = useMemo(() => new Map(plan.rooms.map((room) => [room.id, room.name])), [plan]);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {groups.map(({ roomId, sign }) => {
        const mode = doorModes[roomId] ?? 'open';
        const { icon: Icon, className } = SIGN_STYLE[mode];
        const [x, z] = tileCentreToWorld(sign.x, sign.y);
        return (
          <span
            key={roomId}
            ref={(element) => {
              if (!element) return;
              signElements.set(roomId, element);
              signAnchors.set(roomId, new Vector3(x, SIGN_HEIGHT, z));
              return () => {
                signElements.delete(roomId);
                signAnchors.delete(roomId);
              };
            }}
            style={{ visibility: 'hidden' }}
            className={`absolute top-0 left-0 inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap shadow-raised ${className}`}
          >
            <span className={knockedRooms.has(roomId) ? 'inline-flex motion-safe:animate-knock' : 'inline-flex'}>
              <Icon className="size-3" />
            </span>
            {names.get(roomId)} · {labels[mode]}
          </span>
        );
      })}
    </div>
  );
}
