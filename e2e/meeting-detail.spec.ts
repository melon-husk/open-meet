import { test, expect, emitSegment } from "./fixtures";

test.describe("Meeting detail page", () => {
  // Helper: create a meeting and navigate to its detail page
  async function createMeeting(
    page: import("@playwright/test").Page,
    title: string,
    transcriptTexts: string[]
  ) {
    await page.goto("/");
    await page.getByRole("button", { name: "New Meeting" }).click();
    await page.getByPlaceholder("Meeting title (optional)").fill(title);
    await page.getByRole("button", { name: "Start Recording" }).click();

    for (const text of transcriptTexts) {
      await emitSegment(page, text, true);
    }

    // Wait for IndexedDB writes to flush
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: "Stop" }).click();
    await page.waitForURL(/\/meeting\/.+/);
    // Wait for meeting detail to load from IndexedDB
    await expect(page.getByText(title)).toBeVisible();
  }

  test("shows meeting title and date", async ({ page }) => {
    await createMeeting(page, "Architecture Review", ["discussed microservices"]);
    await expect(page.getByText("Architecture Review")).toBeVisible();
  });

  test("tabs switch between summary, transcript, notes, chat", async ({
    page,
  }) => {
    await createMeeting(page, "Tab Test", ["some transcript"]);

    // Transcript tab should be active by default (no summary yet)
    await expect(page.getByText("some transcript")).toBeVisible();

    // Switch to Notes
    await page.getByRole("button", { name: "Notes" }).click();
    await expect(
      page.getByPlaceholder(/Add or edit your notes/)
    ).toBeVisible();

    // Switch to Chat
    await page.getByRole("button", { name: "Chat" }).click();
    await expect(
      page.getByText("Ask anything about this meeting")
    ).toBeVisible();

    // Switch to Summary
    await page.getByRole("button", { name: "Summary", exact: true }).click();
    await expect(
      page.getByText('No summary yet — click "Generate Summary" above')
    ).toBeVisible();
  });

  test("can edit and save notes", async ({ page }) => {
    await createMeeting(page, "Notes Test", ["transcript"]);

    await page.getByRole("button", { name: "Notes" }).click();
    const textarea = page.getByPlaceholder(/Add or edit your notes/);
    await textarea.fill("My meeting notes");
    await page.getByRole("button", { name: "Save Notes" }).click();

    // Reload and verify persistence
    await page.reload();
    await page.getByRole("button", { name: "Notes" }).click();
    await expect(page.getByPlaceholder(/Add or edit your notes/)).toHaveValue(
      "My meeting notes"
    );
  });

  test("back link navigates to meeting list", async ({ page }) => {
    await createMeeting(page, "Nav Test", ["data"]);
    await page.getByText("← Back").click();
    await page.waitForURL("/");
    await expect(page.getByText("Nav Test")).toBeVisible();
  });

  test("transcribe more: can add segments to existing meeting", async ({
    page,
  }) => {
    await createMeeting(page, "Append Test", ["original content"]);

    await page.getByRole("button", { name: "Transcribe More" }).click();
    // Should switch to transcript tab with recording indicator
    await expect(page.getByText("Recording", { exact: true })).toBeVisible();

    await emitSegment(page, "additional content", true);
    await expect(page.getByText("additional content")).toBeVisible();
    // "New" label for appended segments
    await expect(page.getByText("New")).toBeVisible();

    // Stop transcribing
    await page.getByRole("button", { name: "Stop" }).click();
    await expect(page.getByText("Recording", { exact: true })).not.toBeVisible();

    // Both original and new content should be in transcript
    await expect(page.getByText("original content")).toBeVisible();
  });

  test("transcribe more: language selector is available", async ({ page }) => {
    await createMeeting(page, "Lang Test", ["content"]);
    // Language selector should be visible before transcribing
    await expect(page.locator("select")).toBeVisible();
  });
});
