import { usePresenceStore } from '../../stores/presence-store.ts';
import { labelElements } from './label-registry.ts';

/**
 * Name labels as plain DOM above the canvas (crisp text, no per-label React roots).
 * Hidden from assistive technology: the people list is the accessible equivalent.
 */
export function AvatarLabels() {
  const avatars = usePresenceStore((state) => state.avatars);
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {Object.values(avatars).map((avatar) => (
        <span
          key={avatar.personId}
          data-person-id={avatar.personId}
          ref={(element) => {
            if (element) labelElements.set(avatar.personId, element);
            return () => {
              labelElements.delete(avatar.personId);
            };
          }}
          style={{ visibility: 'hidden' }}
          className={
            avatar.personId === myPersonId
              ? 'absolute top-0 left-0 rounded-full bg-espresso px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-cream shadow-raised'
              : 'absolute top-0 left-0 rounded-full bg-surface-raised px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-text-primary shadow-raised'
          }
        >
          {avatar.displayName}
        </span>
      ))}
    </div>
  );
}
