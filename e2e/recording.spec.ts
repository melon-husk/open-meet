import { test, expect, emitSegment } from "./fixtures";

test.describe("Recording flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "New Meeting" }).click();
  });

  test("shows microphone and language selectors in idle state", async ({
    page,
  }) => {
    // Language selector should be visible
    await expect(page.locator("select").first()).toBeVisible();
    // Start recording button
    await expect(
      page.getByRole("button", { name: "Start Recording" })
    ).toBeVisible();
  });

  test("can set a custom meeting title", async ({ page }) => {
    const titleInput = page.getByPlaceholder("Meeting title (optional)");
    await titleInput.fill("Team Standup");
    await page.getByRole("button", { name: "Start Recording" }).click();
    await expect(page.getByText("Team Standup")).toBeVisible();
  });

  test("transitions through recording states", async ({ page }) => {
    await page.getByRole("button", { name: "Start Recording" }).click();

    // Should show recording indicator
    await expect(page.getByText("Recording", { exact: true })).toBeVisible();
    await expect(page.getByText("Listening…")).toBeVisible();

    // Pause
    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByText("Paused", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Finish" })).toBeVisible();

    // Resume
    await page.getByRole("button", { name: "Resume" }).click();
    await expect(page.getByText("Recording", { exact: true })).toBeVisible();
  });

  test("displays transcript from speech segments", async ({ page }) => {
    await page.getByRole("button", { name: "Start Recording" }).click();

    // Emit an interim segment
    await emitSegment(page, "hello world", false);
    await expect(page.getByText("hello world")).toBeVisible();

    // Emit a final segment
    await emitSegment(page, "Hello World", true);
    await expect(page.getByText("Hello World")).toBeVisible();
  });

  test("can type notes while recording", async ({ page }) => {
    await page.getByRole("button", { name: "Start Recording" }).click();
    const notesArea = page.getByPlaceholder(
      "Type your notes here… These will enhance the summary."
    );
    await expect(notesArea).toBeVisible();
    await notesArea.fill("Important action item: follow up with team");
    await expect(notesArea).toHaveValue(
      "Important action item: follow up with team"
    );
  });

  test("stop recording navigates to meeting detail", async ({ page }) => {
    await page.getByRole("button", { name: "Start Recording" }).click();
    await emitSegment(page, "Test transcript segment", true);

    await page.getByRole("button", { name: "Stop" }).click();
    // Should navigate to /meeting/<id>
    await page.waitForURL(/\/meeting\/.+/);
    await expect(page.getByText("← Back")).toBeVisible();
    await expect(page.getByText("Test transcript segment")).toBeVisible();
  });

  test("finish from paused state navigates to meeting detail", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Start Recording" }).click();
    await emitSegment(page, "Paused meeting content", true);
    await page.getByRole("button", { name: "Pause" }).click();
    await page.getByRole("button", { name: "Finish" }).click();

    await page.waitForURL(/\/meeting\/.+/);
    await expect(page.getByText("Paused meeting content")).toBeVisible();
  });
});
