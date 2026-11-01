import { expect, test, type Page } from '@playwright/test';
import { signIn } from './support/session.ts';

/** Feature spec: docs/features/messaging-threads-mentions-reactions.md (M3b). */

const channels = (page: Page) => page.getByRole('region', { name: 'Channels' });
const chat = (page: Page) => page.getByRole('complementary', { name: 'Chat' });
const composer = (page: Page) => chat(page).getByRole('combobox', { name: /^Message to/ });
const messageWith = (page: Page, text: string) => chat(page).getByRole('article').filter({ hasText: text }).first();

test('people reply in threads, mention each other and react', async ({ browser }) => {
  const anna = (await signIn(browser, 'demo', 'demo')).page;
  const ben = (await signIn(browser, 'demo2', 'demo2')).page;
  const root = `Who joins for lunch? ${String(Date.now())}`;

  for (const page of [anna, ben]) {
    await channels(page)
      .getByRole('button', { name: /^#general/ })
      .click();
  }
  await composer(anna).fill(root);
  await composer(anna).press('Enter');

  // Ben answers in the thread, mentioning Anna with the @ list.
  const benRoot = messageWith(ben, root);
  await benRoot.hover();
  await benRoot.getByRole('button', { name: 'Reply in thread' }).click();
  const reply = chat(ben).getByRole('combobox', { name: 'Reply in thread' });
  await reply.pressSequentially('Count me in, @Demo');
  await expect(chat(ben).getByRole('option', { name: /Demo User/ })).toBeVisible();
  await reply.press('Enter');
  await reply.press('Enter');

  // Anna sees the reply count, a followed thread and the mention, but no new unread message in the channel.
  const summary = chat(anna)
    .getByRole('listitem')
    .filter({ hasText: root })
    .getByRole('button', { name: /^1 reply/ });
  await expect(summary).toBeVisible();
  await expect(anna.getByRole('button', { name: /^Threads/ })).toContainText('1');
  await summary.click();
  await expect(chat(anna).getByRole('region', { name: /^Thread on/ })).toContainText('Count me in, @Demo User');

  // Ben reacts on the root; Anna sees the chip with his name.
  await benRoot.hover();
  await benRoot.getByRole('button', { name: 'React with 🎉' }).click();
  await expect(messageWith(anna, root).getByRole('button', { name: /🎉 from Second Demo/ })).toBeVisible();
  await anna.screenshot({ path: 'test-results/chat-thread-and-reaction.png' });

  // The threads view lists the thread; reading it cleared the count.
  await anna.getByRole('button', { name: /^Threads/ }).click();
  await expect(chat(anna).getByRole('heading', { name: 'Threads' })).toBeVisible();
  await expect(chat(anna)).toContainText(root);
  await expect(anna.getByRole('button', { name: /^Threads/ })).not.toContainText(/unread/);

  await ben.context().close();
  await anna.context().close();
});
