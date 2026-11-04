import { expect, test, type Page } from '@playwright/test';
import { signIn } from './support/session.ts';

/** Feature spec: docs/features/messaging-search.md (M3e). */

const channels = (page: Page) => page.getByRole('region', { name: 'Channels' });
const chat = (page: Page) => page.getByRole('complementary', { name: 'Chat' });
const log = (page: Page) => chat(page).getByRole('log');
const composer = (page: Page) => chat(page).getByRole('combobox', { name: /^Message to/ });
const palette = (page: Page) => page.getByRole('dialog', { name: 'Search and go to' });
const field = (page: Page) => palette(page).getByRole('combobox');
const option = (page: Page, name: RegExp | string) => palette(page).getByRole('option', { name });

async function say(page: Page, text: string): Promise<void> {
  await composer(page).fill(text);
  await composer(page).press('Enter');
  await expect(log(page)).toContainText(text);
}

test('the palette finds messages by inflected words, by keyboard, and returns the focus', async ({ browser }) => {
  const anna = (await signIn(browser, 'demo', 'demo')).page;
  const stamp = String(Date.now());
  await channels(anna)
    .getByRole('button', { name: /^#general/ })
    .click();
  const word = `Rechnungen${stamp}`;
  await say(anna, `Die ${word} sind da`);
  await say(anna, 'Something newer to scroll past');

  // Opens while typing in the composer; Escape returns there.
  await composer(anna).focus();
  await anna.keyboard.press('Control+k');
  await expect(field(anna)).toBeFocused();
  await anna.keyboard.press('Escape');
  await expect(palette(anna)).toBeHidden();
  await expect(composer(anna)).toBeFocused();

  // The start of a word is enough while typing; the first entry is run with Enter.
  await anna.keyboard.press('Control+k');
  await field(anna).fill(word.slice(0, -2));
  await expect(option(anna, new RegExp(word))).toBeVisible();
  await expect(palette(anna).getByRole('status')).toHaveText('1 message found');
  await anna.screenshot({ path: 'test-results/command-palette.png' });
  await anna.keyboard.press('ArrowDown');
  await anna.keyboard.press('Enter');
  await expect(palette(anna)).toBeHidden();
  await expect(log(anna).getByRole('article').filter({ hasText: word })).toBeFocused();

  // "Only in" narrows to the open conversation.
  await anna.keyboard.press('Control+k');
  await palette(anna).getByRole('checkbox', { name: 'Only in #general' }).check();
  await field(anna).fill('nothing-here-at-all');
  await expect(palette(anna).getByRole('status')).toHaveText('No messages with “nothing-here-at-all”.');

  await anna.context().close();
});

test('results lead into a public channel one has not joined, and private ones stay private', async ({ browser }) => {
  const anna = (await signIn(browser, 'demo', 'demo')).page;
  const ben = (await signIn(browser, 'demo2', 'demo2')).page;
  const stamp = String(Date.now());

  // Anna posts in a new public channel, and in a new private one.
  for (const [kind, name] of [
    ['Public', `offen-${stamp}`],
    ['Private', `geheim-${stamp}`],
  ] as const) {
    await channels(anna).getByRole('button', { name: 'New channel' }).click();
    const dialog = anna.getByRole('dialog', { name: 'New channel' });
    await dialog.getByRole('textbox').fill(name);
    await dialog.getByRole('radio', { name: new RegExp(`^${kind}`) }).check();
    await dialog.getByRole('button', { name: 'Create channel' }).click();
    await say(anna, `Treffer${stamp} in ${name}`);
  }

  // Ben finds only the public one, and reads it before joining.
  await ben.getByRole('button', { name: /^Search/ }).click();
  await field(ben).fill(`Treffer${stamp}`);
  await expect(palette(ben).getByRole('status')).toHaveText('1 message found');
  await option(ben, new RegExp(`offen-${stamp}`))
    .filter({ hasText: 'Treffer' })
    .click();
  await expect(log(ben)).toContainText(`in offen-${stamp}`);
  await chat(ben).getByRole('button', { name: 'Join' }).click();
  await expect(composer(ben)).toBeVisible();

  // The palette finds channels and people, too.
  await ben.keyboard.press('Control+k');
  await field(ben).fill('Demo User');
  await option(ben, 'Demo User').click();
  await expect(composer(ben)).toHaveAccessibleName('Message to Demo User');

  await ben.context().close();
  await anna.context().close();
});
