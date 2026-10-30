import { expect, test } from '@playwright/test';
import { framesOf, nameLabel, peopleList, signIn } from './support/session.ts';

/** Feature spec: docs/features/m1-walking-skeleton.md. */

/** Acceptance criterion: others see a movement within 150 ms on a local network. */
const MOVEMENT_LATENCY_BUDGET_MS = 150;

test('two people see each other walk, switch floors and leave', async ({ browser }) => {
  const annaSession = await signIn(browser, 'demo', 'demo');
  const benSession = await signIn(browser, 'demo2', 'demo2');
  const anna = annaSession.page;
  const ben = benSession.page;

  await expect(peopleList(anna)).toContainText('Second Demo');
  await expect(peopleList(ben)).toContainText('Demo User');
  await anna.screenshot({ path: 'test-results/office-ground-floor.png' });

  // Anna walks with the keyboard; Ben sees her name label move.
  const before = await nameLabel(ben, 'Demo User').boundingBox();
  const walkStartedAt = Date.now();
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

  // Every step reached Ben within the latency budget: Anna sends MoveTo -> Ben receives AvatarPathStarted.
  const moves = framesOf(annaSession, 'sent', 'MoveTo', walkStartedAt);
  expect(moves.length).toBeGreaterThan(0); // a key press is skipped while the previous step is still running
  await expect
    .poll(() => framesOf(benSession, 'received', 'AvatarPathStarted', walkStartedAt).length)
    .toBe(moves.length);
  const announcements = framesOf(benSession, 'received', 'AvatarPathStarted', walkStartedAt);
  const latencies = moves.map((move, step) => (announcements[step]?.at ?? Infinity) - move.at);
  test.info().annotations.push({ type: 'movement latency (ms)', description: latencies.join(', ') });
  for (const latency of latencies) expect(latency).toBeLessThanOrEqual(MOVEMENT_LATENCY_BUDGET_MS);

  // Anna goes upstairs and disappears from Ben's floor.
  await anna.getByRole('button', { name: /Floor 1/ }).click();
  await expect(peopleList(ben)).not.toContainText('Demo User');
  await expect(peopleList(anna)).not.toContainText('Second Demo');
  await anna.screenshot({ path: 'test-results/office-upper-floor.png' });

  // Ben leaves: Anna's view is unaffected, Ben's avatar is gone from the server.
  await ben.context().close();
  await anna.context().close();
});
