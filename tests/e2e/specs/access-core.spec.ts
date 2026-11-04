import { expect, test, type Page } from '@playwright/test';
import { signIn } from './support/session.ts';

/** Feature spec: docs/features/access-core.md (M4a). */

const channels = (page: Page) => page.getByRole('region', { name: 'Channels' });
const chat = (page: Page) => page.getByRole('complementary', { name: 'Chat' });
const log = (page: Page) => chat(page).getByRole('log');
const composer = (page: Page) => chat(page).getByRole('combobox', { name: /^Message to/ });
const palette = (page: Page) => page.getByRole('dialog', { name: 'Search and go to' });

test('a channel creator moderates: others see no such actions, and their messages can be removed', async ({
  browser,
}) => {
  const anna = (await signIn(browser, 'demo', 'demo')).page;
  const ben = (await signIn(browser, 'demo2', 'demo2')).page;
  const name = `moderiert-${String(Date.now())}`;

  await channels(anna).getByRole('button', { name: 'New channel' }).click();
  const dialog = anna.getByRole('dialog', { name: 'New channel' });
  await dialog.getByRole('textbox').fill(name);
  await dialog.getByRole('radio', { name: /^Public/ }).check();
  await dialog.getByRole('button', { name: 'Create channel' }).click();
  await expect(chat(anna).getByRole('button', { name: 'Archive' })).toBeVisible();

  // Ben joins: he writes, but only moderates his own message.
  await ben.keyboard.press('Control+k');
  await palette(ben).getByRole('combobox').fill(name);
  await palette(ben)
    .getByRole('option', { name: new RegExp(name) })
    .click();
  await chat(ben).getByRole('button', { name: 'Join' }).click();
  await composer(ben).fill('Off topic');
  await composer(ben).press('Enter');
  await expect(chat(ben).getByRole('button', { name: 'Archive' })).toBeHidden();

  // Anna removes it; Ben sees that live.
  const message = log(anna).getByRole('article').filter({ hasText: 'Off topic' });
  await message.hover();
  await expect(message.getByRole('button', { name: 'Edit' })).toBeHidden();
  await message.getByRole('button', { name: 'Delete' }).click();
  await expect(log(ben)).toContainText('Message deleted');

  await ben.context().close();
  await anna.context().close();
});
