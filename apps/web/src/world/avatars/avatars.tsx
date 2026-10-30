import { usePresenceStore } from '../../stores/presence-store.ts';
import { AvatarFigure } from './avatar-figure.tsx';

/** All avatars on the current floor, straight from the presence store. */
export function Avatars() {
  const avatars = usePresenceStore((state) => state.avatars);
  return (
    <group>
      {Object.values(avatars).map((avatar) => (
        <AvatarFigure key={avatar.personId} avatar={avatar} />
      ))}
    </group>
  );
}
