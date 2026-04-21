import { test, expect, emitSegment } from "./fixtures";

test.describe("Crash recovery", () => {
  test("shows recovery banner for meetings stuck in recording status", async ({
    page,
  }) => {
    // Create a meeting and start recording, but don't stop — simulates crash
    await page.goto("/");
    await page.getByRole("button", { name: "New Meeting" }).click();
    await page
      .getByPlaceholder("Meeting title (optional)")
      .fill("Crashed Meeting");
    await page.getByRole("button", { name: "Start Recording" }).click();
    await emitSegment(page, "before crash", true);

    // Simulate crash by navigating away hard (the meeting is stuck as "recording" in IDB)
    await page.goto("/");

    // Navigate to new meeting — should see recovery banner
    await page.getByRole("button", { name: "New Meeting" }).click();
    await expect(page.getByText("Unsaved recording found")).toBeVisible();
    await expect(page.getByText("Crashed Meeting")).toBeVisible();
  });

  test("can dismiss recovery banner", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "New Meeting" }).click();
    await page
      .getByPlaceholder("Meeting title (optional)")
      .fill("Dismiss Test");
    await page.getByRole("button", { name: "Start Recording" }).click();
    await emitSegment(page, "some data", true);

    await page.goto("/");
    await page.getByRole("button", { name: "New Meeting" }).click();
    await expect(page.getByText("Unsaved recording found")).toBeVisible();

    await page.getByRole("button", { name: "Dismiss" }).click();
    await expect(page.getByText("Unsaved recording found")).not.toBeVisible();
  });

  test("can resume a crashed meeting", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "New Meeting" }).click();
    await page
      .getByPlaceholder("Meeting title (optional)")
      .fill("Resume Test");
    await page.getByRole("button", { name: "Start Recording" }).click();
    await emitSegment(page, "recovered segment", true);

    // Wait for IndexedDB write to complete
    await page.waitForTimeout(500);

    await page.goto("/");
    await page.getByRole("button", { name: "New Meeting" }).click();
    await expect(page.getByText("Unsaved recording found")).toBeVisible();

    await page.getByRole("button", { name: "Resume" }).click();
    // Should be in paused state with the recovered transcript
    await expect(page.getByText("Paused", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("recovered segment")).toBeVisible();
  });
});

test.describe("Segment persistence", () => {
  test("segments survive page reload during recording", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "New Meeting" }).click();
    await page.getByRole("button", { name: "Start Recording" }).click();

    await emitSegment(page, "persisted segment one", true);
    await emitSegment(page, "persisted segment two", true);

    // Wait a beat for IndexedDB writes
    await page.waitForTimeout(500);

    // Hard reload simulating crash
    await page.goto("/");
    await page.getByRole("button", { name: "New Meeting" }).click();

    // Recovery banner should show with segments count
    await expect(page.getByText("Unsaved recording found")).toBeVisible();
    await expect(page.getByText("2 segments recovered")).toBeVisible();
  });
});
