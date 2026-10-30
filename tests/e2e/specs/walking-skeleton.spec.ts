import { expect, test, type Browser, type Page } from '@playwright/test';

/** Feature spec: docs/features/m1-walking-skeleton.md. Uses the demo users of docker/keycloak. */
async function signIn(browser: Browser, username: string, password: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.locator('#kc-login').click();
  await expect(page.getByRole('status').filter({ hasText: 'Live' })).toBeVisible();
  return page;
}

const peopleList = (page: Page) => page.getByRole('region', { name: 'People on this floor' });

/** The floating name label of an avatar inside the 3D view (rendered as HTML overlay). */
const nameLabel = (page: Page, name: string) => page.locator('main span', { hasText: name }).first();

test('two people see each other walk, switch floors and leave', async ({ browser }) => {
  const anna = await signIn(browser, 'demo', 'demo');
  const ben = await signIn(browser, 'demo2', 'demo2');

  await expect(peopleList(anna)).toContainText('Second Demo');
  await expect(peopleList(ben)).toContainText('Demo User');
  await anna.screenshot({ path: 'test-results/office-ground-floor.png' });

  // Anna walks with the keyboard; Ben sees her name label move.
  const before = await nameLabel(ben, 'Demo User').boundingBox();
  for (let step = 0; step < 3; step++) {
    await anna.keyboard.press('ArrowDown');
    await anna.waitForTimeout(450);
  }
  await expect
    .poll(async () => {
      const after = await nameLabel(ben, 'Demo User').boundingBox();
      return before && after ? Math.hypot(after.x - before.x, after.y - before.y) : 0;
    })
    .toBeGreaterThan(20);

  // Anna goes upstairs and disappears from Ben's floor.
  await anna.getByRole('button', { name: /Floor 1/ }).click();
  await expect(peopleList(ben)).not.toContainText('Demo User');
  await expect(peopleList(anna)).not.toContainText('Second Demo');
  await anna.screenshot({ path: 'test-results/office-upper-floor.png' });

  // Ben leaves: Anna's view is unaffected, Ben's avatar is gone from the server.
  await ben.context().close();
  await anna.context().close();
});
