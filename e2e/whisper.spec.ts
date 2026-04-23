import { test, expect } from './fixtures';

test('has transcription engine selector', async ({ page }) => {
  await page.goto('/');
  await page.getByRole("button", { name: "New Meeting" }).click();
  // Wait for the UI to be ready
  await expect(page.getByRole("button", { name: "Start Recording" })).toBeVisible();
});
