import { expect, test, type Page } from '@playwright/test';
import { signIn } from './support/session.ts';

/** Feature spec: docs/features/access-administration.md (M4b-1). */

const view = (page: Page) => page.getByRole('dialog', { name: 'Administration' });
const entry = (page: Page) => page.getByRole('button', { name: 'Administration' });

/** Whoever signed in first is the Owner; which demo user that is depends on the database. */
async function ownerAndMember(pages: readonly [Page, Page]): Promise<[Page, Page]> {
  const [first, second] = pages;
  await Promise.any([expect(entry(first)).toBeVisible(), expect(entry(second)).toBeVisible()]);
  return (await entry(first).isVisible()) ? [first, second] : [second, first];
}

test('an Owner assigns roles and manages groups; members see none of it', async ({ browser }) => {
  const anna = (await signIn(browser, 'demo', 'demo')).page;
  const ben = (await signIn(browser, 'demo2', 'demo2')).page;
  const [owner, member] = await ownerAndMember([anna, ben]);
  await expect(entry(member)).toBeHidden();

  await entry(owner).click();
  const person = (name: string) => view(owner).getByRole('listitem').filter({ hasText: name }).first();
  const memberName = member === ben ? 'Second Demo' : 'Demo User';
  await view(owner).getByRole('searchbox').fill(memberName);
  await owner.screenshot({ path: 'test-results/administration.png' });

  // A role reaches the person; taking it back removes it again.
  await person(memberName)
    .getByRole('combobox', { name: `Role for ${memberName}` })
    .selectOption({ label: 'Editor' });
  await person(memberName).getByRole('button', { name: 'Assign' }).click();
  const takeBack = person(memberName).getByRole('button', { name: /^Take Editor \(Whole town\) back/ });
  await expect(takeBack).toBeVisible();
  await takeBack.click();
  await expect(takeBack).toBeHidden();

  // Groups take people, and deleting one leaves nothing behind.
  await view(owner).getByRole('button', { name: 'Groups' }).click();
  const group = `Team ${String(Date.now())}`;
  await view(owner).getByRole('textbox', { name: 'Group name' }).fill(group);
  await view(owner).getByRole('button', { name: 'Create group' }).click();
  const card = view(owner).getByRole('listitem').filter({ hasText: group }).first();
  await card.getByRole('combobox', { name: `Add a person to ${group}` }).selectOption({ label: memberName });
  await card.getByRole('button', { name: 'Add' }).click();
  await expect(card.getByRole('list', { name: `Members of ${group}` })).toContainText(memberName);
  await card.getByRole('button', { name: `Delete group ${group}` }).click();
  await expect(view(owner).getByRole('list', { name: 'Groups' })).not.toContainText(group);

  // Back to the office, which stayed connected.
  await view(owner).getByRole('button', { name: 'Back to the office' }).click();
  await expect(view(owner)).toBeHidden();
  await expect(owner.getByText('Live')).toBeVisible();

  await ben.context().close();
  await anna.context().close();
});

test('an Owner copies a built-in role, gives it and deletes it with a warning (M4b-2)', async ({ browser }) => {
  const anna = (await signIn(browser, 'demo', 'demo')).page;
  const ben = (await signIn(browser, 'demo2', 'demo2')).page;
  const [owner, member] = await ownerAndMember([anna, ben]);
  const memberName = member === ben ? 'Second Demo' : 'Demo User';
  const role = `Team Lead ${String(Date.now())}`;

  await entry(owner).click();
  await view(owner).getByRole('button', { name: 'Roles' }).click();
  await view(owner).getByRole('button', { name: 'Copy Room Host as a new role' }).click();
  await view(owner).getByRole('textbox', { name: 'Name' }).fill(role);
  await view(owner).getByRole('checkbox', { name: 'Pin messages' }).check();
  await view(owner).getByRole('button', { name: 'Create role' }).click();
  const card = view(owner).getByRole('listitem').filter({ hasText: role }).first();
  // Room and channel permissions together apply to the whole town only (P-37).
  await expect(card).toContainText('Can be given for: whole town');
  await owner.screenshot({ path: 'test-results/administration-roles.png' });

  await view(owner).getByRole('button', { name: 'People' }).click();
  await view(owner).getByRole('searchbox').fill(memberName);
  const person = view(owner).getByRole('listitem').filter({ hasText: memberName }).first();
  await person.getByRole('combobox', { name: `Role for ${memberName}` }).selectOption({ label: role });
  await expect(person.getByRole('combobox', { name: `Where it applies for ${memberName}` })).toHaveValue('town');
  await person.getByRole('button', { name: 'Assign' }).click();
  await expect(person).toContainText(role);

  await view(owner).getByRole('button', { name: 'Roles' }).click();
  await card.getByRole('button', { name: `Delete ${role}` }).click();
  await expect(card.getByRole('alert')).toContainText('The 1 person or group holding it loses it at once.');
  await card.getByRole('button', { name: 'Delete role' }).click();
  await expect(view(owner).getByRole('list', { name: 'Roles' })).not.toContainText(role);
  await view(owner).getByRole('button', { name: 'People' }).click();
  await expect(person).not.toContainText(role);

  await ben.context().close();
  await anna.context().close();
});
