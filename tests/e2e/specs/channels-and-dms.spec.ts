import { expect, test, type Page } from '@playwright/test';
import { signIn } from './support/session.ts';

/** Feature spec: docs/features/messaging-channels-and-dms.md (M3a). */

const channels = (page: Page) => page.getByRole('region', { name: 'Channels' });
const directMessages = (page: Page) => page.getByRole('region', { name: 'Direct messages' });
const chat = (page: Page) => page.getByRole('complementary', { name: 'Chat' });
const composer = (page: Page) => chat(page).getByRole('textbox', { name: /^Message to/ });

test('people write in #general and in a DM, live and with unread counts', async ({ browser }) => {
  const anna = (await signIn(browser, 'demo', 'demo')).page;
  const ben = (await signIn(browser, 'demo2', 'demo2')).page;
  const text = `Moin from the test ${String(Date.now())}`;

  // Everyone is in #general; Anna writes there in the Markdown subset.
  await channels(anna)
    .getByRole('button', { name: /^#general/ })
    .click();
  await composer(anna).fill(`**${text}**`);
  await composer(anna).press('Enter');
  await expect(chat(anna).getByRole('log').locator('strong', { hasText: text })).toBeVisible();

  // Ben sees it as unread until he opens the channel.
  const benGeneral = channels(ben).getByRole('button', { name: /^#general/ });
  await expect(benGeneral).toContainText(/unread message/);
  await benGeneral.click();
  await expect(chat(ben).getByRole('log')).toContainText(text);
  await expect(benGeneral).not.toContainText(/unread message/);

  // Ben answers Anna directly; she sees the DM appear and the message live.
  await directMessages(ben).getByRole('button', { name: 'New message' }).click();
  const picker = ben.getByRole('dialog', { name: 'New message' });
  await picker.getByRole('searchbox').fill('Demo User');
  await picker.getByText('Demo User', { exact: true }).click();
  await picker.getByRole('button', { name: 'Open conversation' }).click();
  await composer(ben).fill(`Reply ${text}`);
  await composer(ben).press('Enter');

  const annaDm = directMessages(anna).getByRole('button', { name: /^Second Demo/ });
  await expect(annaDm).toContainText(/unread message/);
  await annaDm.click();
  await expect(chat(anna).getByRole('log')).toContainText(`Reply ${text}`);
  await anna.screenshot({ path: 'test-results/chat-direct-message.png' });

  // The panel closes with Escape; the office is still there.
  await composer(anna).press('Escape');
  await expect(chat(anna)).toBeHidden();

  await ben.context().close();
  await anna.context().close();
});
