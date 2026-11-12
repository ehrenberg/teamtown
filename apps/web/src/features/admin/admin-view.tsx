import * as Dialog from '@radix-ui/react-dialog';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import {
  FloorPlan,
  Permission,
  type AssignmentContract,
  type GroupContract,
  type Principal,
  type RoleContract,
} from '@teamtown/contracts';
import { Button } from '@teamtown/ui';
import type { TFunction } from 'i18next';
import { Copy, Pencil, ShieldCheck, Trash2, X } from 'lucide-react';
import { useId, useMemo, useState, type ReactNode, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, apiDelete, apiGet, apiSend } from '../../api/api-client.ts';
import { useAccessOverview, useBrowseChannels, useFloors, useMyAccess, usePeople } from '../../api/queries.ts';
import { useAdminStore } from '../../stores/admin-store.ts';
import { areaOf, permissionLabel, roleLabel, type Area } from './roles.ts';
import { scopeLabel, scopesFor, type Places } from './scopes.ts';

const INPUT = 'rounded-md border border-border-subtle bg-surface-sunken px-2 py-1.5 text-sm';

/** A refusal in plain words (brand guide §6). */
function errorText(error: unknown, t: TFunction): string {
  const code = error instanceof ApiError ? error.code : null;
  const known = code !== null && t(`admin.error.${code}`, { defaultValue: '' });
  return known || t('admin.error.generic');
}

interface Actions {
  /** Runs a change, then reloads the overview; a refusal shows at the top of the view. */
  readonly run: (change: () => Promise<unknown>) => void;
}

function usePlaces(): Places {
  const floors = useFloors();
  const channels = useBrowseChannels(true);
  const plans = useQueries({
    queries: (floors.data?.floors ?? []).map(({ floorId }) => ({
      queryKey: ['floor-plan', floorId],
      queryFn: () => apiGet(`/floors/${encodeURIComponent(floorId)}/plan`, FloorPlan),
      staleTime: Number.POSITIVE_INFINITY,
    })),
  });
  return {
    floors: floors.data?.floors ?? [],
    plans: plans.flatMap((plan) => (plan.data ? [plan.data] : [])),
    channels: channels.data?.channels ?? [],
  };
}

function Assignments({
  assignments,
  roles,
  places,
  canManageOwners,
  who,
  actions,
}: {
  readonly assignments: readonly AssignmentContract[];
  readonly roles: readonly RoleContract[];
  readonly places: Places;
  readonly canManageOwners: boolean;
  readonly who: string;
  readonly actions: Actions;
}) {
  const { t } = useTranslation();
  if (assignments.length === 0) return <p className="text-xs text-text-secondary">{t('admin.noRoles')}</p>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {assignments.map((assignment) => {
        const known = roles.find((candidate) => candidate.roleId === assignment.roleId);
        const role = known ? roleLabel(known, t) : t('admin.unknownRole');
        const place = scopeLabel(assignment.scope, places, t);
        return (
          <li
            key={`${assignment.roleId}-${assignment.scope}`}
            className="flex items-center gap-1 rounded-full border border-border-subtle py-0.5 pr-1 pl-2.5 text-xs"
          >
            <span>
              <span className="font-semibold">{role}</span> · {place}
            </span>
            {(assignment.roleId !== 'owner' || canManageOwners) && (
              <button
                type="button"
                aria-label={t('admin.takeBack', { role, place, who })}
                title={t('admin.takeBack', { role, place, who })}
                onClick={() => {
                  actions.run(() => apiSend('DELETE', '/access/assignments', assignment));
                }}
                className="grid size-5 place-items-center rounded-full text-text-secondary hover:bg-neutral-100 hover:text-text-primary"
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function AssignForm({
  principal,
  who,
  roles,
  places,
  canManageOwners,
  actions,
}: {
  readonly principal: Principal;
  readonly who: string;
  readonly roles: readonly RoleContract[];
  readonly places: Places;
  readonly canManageOwners: boolean;
  readonly actions: Actions;
}) {
  const { t } = useTranslation();
  // Owner goes to people only, and only Owners give it (ADR-0038).
  const offered = roles.filter((role) => role.roleId !== 'owner' || (canManageOwners && principal.kind === 'person'));
  const [roleId, setRoleId] = useState('room-host');
  const [scope, setScope] = useState('town');
  const role = offered.find((candidate) => candidate.roleId === roleId) ?? offered[0];
  const scopes = role ? scopesFor(role.places, places, t) : [];
  const chosen = scopes.some((option) => option.scope === scope) ? scope : (scopes[0]?.scope ?? 'town');

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!role) return;
    actions.run(() => apiSend('PUT', '/access/assignments', { principal, roleId: role.roleId, scope: chosen }));
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-1.5">
      <select
        aria-label={t('admin.roleFor', { who })}
        value={role?.roleId ?? ''}
        onChange={(event) => {
          setRoleId(event.target.value);
        }}
        className={INPUT}
      >
        {offered.map((option) => (
          <option key={option.roleId} value={option.roleId}>
            {roleLabel(option, t)}
          </option>
        ))}
      </select>
      <select
        aria-label={t('admin.scopeFor', { who })}
        value={chosen}
        onChange={(event) => {
          setScope(event.target.value);
        }}
        className={`${INPUT} max-w-56`}
      >
        {scopes.map((option) => (
          <option key={option.scope} value={option.scope}>
            {option.label}
          </option>
        ))}
      </select>
      <Button type="submit" variant="secondary">
        {t('admin.assign')}
      </Button>
    </form>
  );
}

function PeopleTab({
  assignments,
  roles,
  places,
  canManageOwners,
  actions,
}: {
  readonly assignments: readonly AssignmentContract[];
  readonly roles: readonly RoleContract[];
  readonly places: Places;
  readonly canManageOwners: boolean;
  readonly actions: Actions;
}) {
  const { t } = useTranslation();
  const people = usePeople();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLocaleLowerCase();
  const list = (people.data?.people ?? []).filter((person) => person.displayName.toLocaleLowerCase().includes(needle));

  return (
    <>
      <input
        type="search"
        aria-label={t('admin.searchPeople')}
        placeholder={t('admin.searchPeople')}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
        className={`${INPUT} mb-3 w-full max-w-sm`}
      />
      <ul aria-label={t('admin.people')} className="flex flex-col gap-2">
        {list.map((person) => {
          const principal: Principal = { kind: 'person', id: person.personId };
          const own = assignments.filter((a) => a.principal.kind === 'person' && a.principal.id === person.personId);
          return (
            <li
              key={person.personId}
              className="flex flex-col gap-2 rounded-md border border-border-subtle bg-surface-raised p-3"
            >
              <p className="text-sm font-semibold">{person.displayName}</p>
              <Assignments
                assignments={own}
                roles={roles}
                places={places}
                canManageOwners={canManageOwners}
                who={person.displayName}
                actions={actions}
              />
              <AssignForm
                principal={principal}
                who={person.displayName}
                roles={roles}
                places={places}
                canManageOwners={canManageOwners}
                actions={actions}
              />
            </li>
          );
        })}
      </ul>
    </>
  );
}

function GroupCard({
  group,
  assignments,
  roles,
  places,
  actions,
}: {
  readonly group: GroupContract;
  readonly assignments: readonly AssignmentContract[];
  readonly roles: readonly RoleContract[];
  readonly places: Places;
  readonly actions: Actions;
}) {
  const { t } = useTranslation();
  const people = usePeople();
  const memberPicker = useId();
  const [picked, setPicked] = useState('');
  const path = `/access/groups/${encodeURIComponent(group.groupId)}`;
  const everyone = people.data?.people ?? [];
  const nameOf = (personId: string) => everyone.find((p) => p.personId === personId)?.displayName ?? t('admin.someone');
  const others = everyone.filter((person) => !group.memberIds.includes(person.personId));

  return (
    <li className="flex flex-col gap-2 rounded-md border border-border-subtle bg-surface-raised p-3">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-sm font-semibold">{group.name}</p>
        <button
          type="button"
          aria-label={t('admin.deleteGroup', { name: group.name })}
          title={t('admin.deleteGroup', { name: group.name })}
          onClick={() => {
            actions.run(() => apiDelete(path));
          }}
          className="grid size-7 place-items-center rounded-sm text-text-secondary hover:bg-neutral-100 hover:text-text-primary"
        >
          <Trash2 aria-hidden="true" className="size-3.5" />
        </button>
      </div>
      <ul aria-label={t('admin.membersOf', { name: group.name })} className="flex flex-wrap gap-1.5">
        {group.memberIds.map((personId) => (
          <li key={personId} className="flex items-center gap-1 rounded-full bg-neutral-100 py-0.5 pr-1 pl-2.5 text-xs">
            {nameOf(personId)}
            <button
              type="button"
              aria-label={t('admin.removeMember', { name: nameOf(personId), group: group.name })}
              title={t('admin.removeMember', { name: nameOf(personId), group: group.name })}
              onClick={() => {
                actions.run(() => apiDelete(`${path}/members/${encodeURIComponent(personId)}`));
              }}
              className="grid size-5 place-items-center rounded-full text-text-secondary hover:text-text-primary"
            >
              <X aria-hidden="true" className="size-3" />
            </button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!picked) return;
          setPicked('');
          actions.run(() => apiSend('PUT', `${path}/members/${encodeURIComponent(picked)}`, {}));
        }}
        className="flex items-center gap-1.5"
      >
        <select
          id={memberPicker}
          aria-label={t('admin.addMemberTo', { name: group.name })}
          value={picked}
          onChange={(event) => {
            setPicked(event.target.value);
          }}
          className={INPUT}
        >
          <option value="">{t('admin.pickPerson')}</option>
          {others.map((person) => (
            <option key={person.personId} value={person.personId}>
              {person.displayName}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary" disabled={!picked}>
          {t('admin.add')}
        </Button>
      </form>
      <Assignments
        assignments={assignments}
        roles={roles}
        places={places}
        canManageOwners={false}
        who={group.name}
        actions={actions}
      />
      <AssignForm
        principal={{ kind: 'group', id: group.groupId }}
        who={group.name}
        roles={roles}
        places={places}
        canManageOwners={false}
        actions={actions}
      />
    </li>
  );
}

function GroupsTab({
  groups,
  assignments,
  roles,
  places,
  actions,
}: {
  readonly groups: readonly GroupContract[];
  readonly assignments: readonly AssignmentContract[];
  readonly roles: readonly RoleContract[];
  readonly places: Places;
  readonly actions: Actions;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;
          setName('');
          actions.run(() => apiSend('POST', '/access/groups', { name: trimmed }));
        }}
        className="mb-3 flex items-center gap-1.5"
      >
        <input
          aria-label={t('admin.groupName')}
          placeholder={t('admin.groupName')}
          value={name}
          maxLength={80}
          onChange={(event) => {
            setName(event.target.value);
          }}
          className={`${INPUT} w-full max-w-sm`}
        />
        <Button type="submit" variant="secondary">
          {t('admin.createGroup')}
        </Button>
      </form>
      {groups.length === 0 && <p className="text-sm text-text-secondary">{t('admin.noGroups')}</p>}
      <ul aria-label={t('admin.groups')} className="flex flex-col gap-2">
        {groups.map((group) => (
          <GroupCard
            key={group.groupId}
            group={group}
            assignments={assignments.filter((a) => a.principal.kind === 'group' && a.principal.id === group.groupId)}
            roles={roles}
            places={places}
            actions={actions}
          />
        ))}
      </ul>
    </>
  );
}

const AREAS: readonly Area[] = ['town', 'rooms', 'channels', 'direct'];

/** Name and permissions of a custom role, grouped by area (P-36). */
function RoleForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  readonly initial: { readonly name: string; readonly permissions: readonly Permission[] };
  readonly submitLabel: string;
  readonly onSubmit: (role: { name: string; permissions: Permission[] }) => void;
  readonly onCancel: () => void;
}) {
  const { t } = useTranslation();
  const formId = useId();
  const [name, setName] = useState(initial.name);
  const [chosen, setChosen] = useState<ReadonlySet<Permission>>(
    new Set(initial.permissions.filter((permission) => areaOf(permission) !== null)),
  );
  const toggle = (permission: Permission, on: boolean) => {
    setChosen((current) => {
      const next = new Set(current);
      if (on) next.add(permission);
      else next.delete(permission);
      return next;
    });
  };

  return (
    <form
      onSubmit={(event: SyntheticEvent) => {
        event.preventDefault();
        onSubmit({ name: name.trim(), permissions: Permission.options.filter((p) => chosen.has(p)) });
      }}
      className="flex flex-col gap-3 rounded-md border border-border-subtle bg-surface-raised p-3"
    >
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t('admin.roleName')}
        <input
          required
          maxLength={80}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          className={`${INPUT} max-w-sm`}
        />
      </label>
      {AREAS.map((area) => (
        <fieldset key={area} className="flex flex-col gap-1 text-sm">
          <legend className="mb-1 font-medium">{t(`admin.area.${area}`)}</legend>
          {Permission.options
            .filter((permission) => areaOf(permission) === area)
            .map((permission) => {
              const id = `${formId}-${permission}`;
              return (
                <div key={permission} className="flex items-center gap-2">
                  <input
                    id={id}
                    type="checkbox"
                    checked={chosen.has(permission)}
                    onChange={(event) => {
                      toggle(permission, event.target.checked);
                    }}
                  />
                  <label htmlFor={id}>{permissionLabel(permission, t)}</label>
                </div>
              );
            })}
        </fieldset>
      ))}
      <div className="flex gap-1.5">
        <Button type="submit" disabled={chosen.size === 0 || name.trim() === ''}>
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('admin.cancel')}
        </Button>
      </div>
    </form>
  );
}

function RoleCard({
  role,
  assigned,
  actions,
  onCopy,
}: {
  readonly role: RoleContract;
  readonly assigned: number;
  readonly actions: Actions;
  readonly onCopy: (role: RoleContract) => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'view' | 'edit' | 'confirm-delete'>('view');
  const label = roleLabel(role, t);
  const path = `/access/roles/${encodeURIComponent(role.roleId)}`;
  const iconButton = (text: string, icon: ReactNode, onClick: () => void) => (
    <button
      type="button"
      aria-label={text}
      title={text}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-sm text-text-secondary hover:bg-neutral-100 hover:text-text-primary"
    >
      {icon}
    </button>
  );

  if (mode === 'edit') {
    return (
      <li>
        <RoleForm
          initial={{ name: label, permissions: role.permissions }}
          submitLabel={t('admin.saveRole')}
          onCancel={() => {
            setMode('view');
          }}
          onSubmit={(changed) => {
            setMode('view');
            actions.run(() => apiSend('PATCH', path, changed));
          }}
        />
      </li>
    );
  }
  return (
    <li className="flex flex-col gap-2 rounded-md border border-border-subtle bg-surface-raised p-3">
      <div className="flex items-center gap-1">
        <p className="flex-1 text-sm font-semibold">
          {label}
          {role.builtIn && <span className="ml-2 text-xs font-normal text-text-secondary">{t('admin.builtIn')}</span>}
        </p>
        {iconButton(t('admin.copyRole', { name: label }), <Copy aria-hidden="true" className="size-3.5" />, () => {
          onCopy(role);
        })}
        {!role.builtIn &&
          iconButton(t('admin.editRole', { name: label }), <Pencil aria-hidden="true" className="size-3.5" />, () => {
            setMode('edit');
          })}
        {!role.builtIn &&
          iconButton(t('admin.deleteRole', { name: label }), <Trash2 aria-hidden="true" className="size-3.5" />, () => {
            setMode('confirm-delete');
          })}
      </div>
      <p className="text-xs text-text-secondary">
        {t('admin.appliesTo', { places: role.places.map((place) => t(`admin.place.${place}`)).join(', ') })}
      </p>
      <ul aria-label={t('admin.permissionsOf', { name: label })} className="flex flex-wrap gap-1">
        {role.permissions.map((permission) => (
          <li key={permission} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">
            {permissionLabel(permission, t)}
          </li>
        ))}
      </ul>
      {mode === 'confirm-delete' && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md bg-ochre-100 px-3 py-2 text-sm">
          <span className="flex-1">{t('admin.confirmDeleteRole', { name: label, count: assigned })}</span>
          <Button
            variant="secondary"
            onClick={() => {
              setMode('view');
              actions.run(() => apiDelete(path));
            }}
          >
            {t('admin.deleteRoleConfirm')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setMode('view');
            }}
          >
            {t('admin.cancel')}
          </Button>
        </div>
      )}
    </li>
  );
}

function RolesTab({
  roles,
  assignments,
  actions,
}: {
  readonly roles: readonly RoleContract[];
  readonly assignments: readonly AssignmentContract[];
  readonly actions: Actions;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<{ name: string; permissions: readonly Permission[] } | null>(null);
  return (
    <>
      {draft ? (
        <RoleForm
          key={draft.name}
          initial={draft}
          submitLabel={t('admin.createRole')}
          onCancel={() => {
            setDraft(null);
          }}
          onSubmit={(role) => {
            setDraft(null);
            actions.run(() => apiSend('POST', '/access/roles', role));
          }}
        />
      ) : (
        <div>
          <Button
            variant="secondary"
            onClick={() => {
              setDraft({ name: '', permissions: [] });
            }}
          >
            {t('admin.newRole')}
          </Button>
        </div>
      )}
      <ul aria-label={t('admin.roles')} className="flex flex-col gap-2">
        {roles.map((role) => (
          <RoleCard
            key={role.roleId}
            role={role}
            assigned={assignments.filter((assignment) => assignment.roleId === role.roleId).length}
            actions={actions}
            onCopy={(original) => {
              setDraft({
                name: t('admin.copyOf', { name: roleLabel(original, t) }),
                permissions: original.permissions,
              });
            }}
          />
        ))}
      </ul>
    </>
  );
}

function AdminBody() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const overview = useAccessOverview(true);
  const me = useMyAccess();
  const places = usePlaces();
  const [tab, setTab] = useState<'people' | 'groups' | 'roles'>('people');
  const [error, setError] = useState<string | null>(null);
  const actions = useMemo<Actions>(
    () => ({
      run: (change) => {
        change().then(
          () => {
            setError(null);
            void queryClient.invalidateQueries({ queryKey: ['access'] });
            // What people may do in their channels can have changed, the own view included.
            void queryClient.invalidateQueries({ queryKey: ['channels'] });
          },
          (failure: unknown) => {
            setError(errorText(failure, t));
          },
        );
      },
    }),
    [queryClient, t],
  );
  const canManageOwners = me.data?.canManageOwners ?? false;
  const assignments = overview.data?.assignments ?? [];
  const roles = overview.data?.roles ?? [];

  const tabButton = (id: typeof tab, label: ReactNode) => (
    <button
      type="button"
      aria-pressed={tab === id}
      onClick={() => {
        setTab(id);
      }}
      className="rounded-sm px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-neutral-100 aria-pressed:bg-surface-raised aria-pressed:text-text-primary aria-pressed:shadow-raised"
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4">
      <nav aria-label={t('admin.sections')} className="flex gap-1">
        {tabButton('people', t('admin.people'))}
        {tabButton('groups', t('admin.groups'))}
        {tabButton('roles', t('admin.roles'))}
      </nav>
      {error && (
        <p role="alert" className="rounded-md bg-ochre-100 px-3 py-2 text-sm">
          {error}
        </p>
      )}
      {overview.isPending && <p className="text-sm text-text-secondary">{t('admin.loading')}</p>}
      {overview.isError && (
        <p role="alert" className="text-sm">
          {t('admin.loadError')}
        </p>
      )}
      {overview.isSuccess && tab === 'people' && (
        <PeopleTab
          assignments={assignments}
          roles={roles}
          places={places}
          canManageOwners={canManageOwners}
          actions={actions}
        />
      )}
      {overview.isSuccess && tab === 'groups' && (
        <GroupsTab
          groups={overview.data.groups}
          assignments={assignments}
          roles={roles}
          places={places}
          actions={actions}
        />
      )}
      {overview.isSuccess && tab === 'roles' && <RolesTab roles={roles} assignments={assignments} actions={actions} />}
    </div>
  );
}

/** The "Administration" entry of the top bar and the full-screen view it opens (ADR-0038). */
export function Administration() {
  const { t } = useTranslation();
  const me = useMyAccess();
  const open = useAdminStore((state) => state.open);
  const setOpen = useAdminStore((state) => state.setOpen);
  if (!me.data?.canManageRoles) return null;
  return (
    <>
      <Button
        variant="ghost"
        onClick={() => {
          setOpen(true);
        }}
      >
        <ShieldCheck aria-hidden="true" className="size-4" />
        {t('admin.title')}
      </Button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-surface-sunken"
          >
            <header className="flex items-center gap-3 border-b border-border-subtle bg-surface-raised px-4 py-3">
              <Dialog.Title className="flex-1 font-display text-lg font-semibold">{t('admin.title')}</Dialog.Title>
              <Dialog.Close asChild>
                <Button variant="ghost">{t('admin.backToOffice')}</Button>
              </Dialog.Close>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <AdminBody />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
