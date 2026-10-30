import { useFrame } from '@react-three/fiber';
import type { ConversationContract } from '@teamtown/contracts';
import { useRef } from 'react';
import { DoubleSide, Vector3, type Group } from 'three';
import { useConversationStore } from '../../stores/conversation-store.ts';
import { avatarAnchors } from '../labels/label-registry.ts';
import { WORLD_PALETTE } from '../palette.ts';

const MARGIN = 0.55;
const MIN_RADIUS = 0.9;
const point = new Vector3();
const centre = new Vector3();

export function ConversationBubbles() {
  const conversations = useConversationStore((state) => state.conversations);
  return (
    <group>
      {Object.values(conversations).map((conversation) => (
        <Bubble key={conversation.conversationId} conversation={conversation} />
      ))}
    </group>
  );
}

function Bubble({ conversation }: { readonly conversation: ConversationContract }) {
  const group = useRef<Group>(null);

  useFrame(() => {
    const node = group.current;
    if (!node) return;
    const positions: Vector3[] = [];
    for (const personId of conversation.participants) {
      const anchor = avatarAnchors.get(personId);
      if (anchor) positions.push(anchor.getWorldPosition(point).clone());
    }
    node.visible = positions.length >= 2;
    if (!node.visible) return;
    centre.set(0, 0, 0);
    for (const position of positions) centre.add(position);
    centre.divideScalar(positions.length);
    const radius = Math.max(MIN_RADIUS, ...positions.map((p) => Math.hypot(p.x - centre.x, p.z - centre.z) + MARGIN));
    node.position.set(centre.x, 0.012, centre.z);
    node.scale.setScalar(radius);
  });

  const outline = conversation.locked ? WORLD_PALETTE.terracotta : WORLD_PALETTE.sageDark;
  return (
    <group ref={group} visible={false}>
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[1, 48]} />
        <meshBasicMaterial color={WORLD_PALETTE.sage} transparent opacity={0.22} depthWrite={false} side={DoubleSide} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.002}>
        <ringGeometry args={[conversation.locked ? 0.93 : 0.96, 1, 48]} />
        <meshBasicMaterial color={outline} transparent opacity={0.8} depthWrite={false} side={DoubleSide} />
      </mesh>
    </group>
  );
}
