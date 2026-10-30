import { StatusDot } from '@teamtown/ui';
import { useTranslation } from 'react-i18next';
import { usePresenceStore } from '../../stores/presence-store.ts';

/** Non-spatial view of the floor (principle "spatial is optional"): everyone here, by name. */
export function PeopleList() {
  const { t } = useTranslation();
  const avatars = usePresenceStore((state) => state.avatars);
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const people = Object.values(avatars).sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <section aria-labelledby="people-heading" className="flex flex-col gap-2">
      <h2
        id="people-heading"
        className="font-display text-xs font-semibold tracking-wide text-text-secondary uppercase"
      >
        {t('office.people')}
      </h2>
      <p className="text-xs text-text-secondary">{t('office.peopleCount', { count: people.length })}</p>
      <ul className="flex flex-col gap-1">
        {people.map((person) => (
          <li
            key={person.personId}
            className="flex items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm hover:bg-neutral-200"
          >
            <span
              aria-hidden="true"
              className="grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: person.avatarColor }}
            >
              {person.displayName.slice(0, 1).toUpperCase()}
            </span>
            <span className="truncate">
              {person.displayName}
              {person.personId === myPersonId && <span className="text-text-secondary"> ({t('office.you')})</span>}
            </span>
            <StatusDot status="available" label={t('status.available')} className="ml-auto" />
          </li>
        ))}
      </ul>
    </section>
  );
}
