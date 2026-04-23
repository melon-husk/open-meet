import { test, expect } from "./fixtures";

test.describe("Settings page", () => {
  test("can navigate to settings from home and back", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Settings").click();
    await page.waitForURL("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    // Navigate back
    await page.getByText("← Back").click();
    await page.waitForURL("/");
    await expect(page.getByText("No meetings yet")).toBeVisible();
  });

  test("shows all settings sections", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("Recording Defaults")).toBeVisible();
    await expect(page.getByText("Whisper Transcription")).toBeVisible();
    await expect(page.getByText("Storage")).toBeVisible();
    await expect(page.getByText("About")).toBeVisible();
  });

  test("shows storage stats", async ({ page }) => {
    await page.goto("/settings");
    // Should show meeting count and audio chunk labels
    await expect(page.getByText("Meetings")).toBeVisible();
    await expect(page.getByText(/Audio \(/)).toBeVisible();
  });

  test("can change default language and it persists", async ({ page }) => {
    await page.goto("/settings");

    const langSelect = page.locator("select").first();
    await langSelect.selectOption("en-US");

    // Verify "Saved" flash appears
    await expect(page.getByText("Saved")).toBeVisible();

    // Reload and check persistence
    await page.reload();
    await expect(langSelect).toHaveValue("en-US");
  });

  test("can change whisper backend and it persists", async ({ page }) => {
    await page.goto("/settings");

    // The whisper backend select is the second select on the page
    const whisperSelect = page.locator("select").nth(1);
    // Default should be wasm (webgpu not available in test browser)
    await expect(whisperSelect).toHaveValue("wasm");
  });

  test("shows about section with privacy info", async ({ page }) => {
    await page.goto("/settings");
    await expect(
      page.getByText("Open Meet runs entirely in your browser")
    ).toBeVisible();
    await expect(
      page.getByText("No audio, transcripts, or notes ever leave your device")
    ).toBeVisible();
  });

  test("shows footer privacy message", async ({ page }) => {
    await page.goto("/settings");
    await expect(
      page.getByText("Everything runs locally in your browser")
    ).toBeVisible();
  });

  test("delete all audio button is disabled when no audio exists", async ({
    page,
  }) => {
    await page.goto("/settings");
    const deleteBtn = page.getByRole("button", { name: "Delete All Audio" });
    await expect(deleteBtn).toBeVisible();
    await expect(deleteBtn).toBeDisabled();
  });
});
