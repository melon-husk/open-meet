import { test, expect, emitSegment } from "./fixtures";

test.describe("Meeting list", () => {
  async function createAndFinishMeeting(
    page: import("@playwright/test").Page,
    title: string
  ) {
    await page.goto("/");
    await page.getByRole("button", { name: "New Meeting" }).click();
    await page.getByPlaceholder("Meeting title (optional)").fill(title);
    await page.getByRole("button", { name: "Start Recording" }).click();
    await emitSegment(page, "segment", true);
    await page.getByRole("button", { name: "Stop" }).click();
    await page.waitForURL(/\/meeting\/.+/);
  }

  test("completed meeting appears in list with Recorded badge", async ({
    page,
  }) => {
    await createAndFinishMeeting(page, "Standup Call");
    await page.goto("/");

    await expect(page.getByText("Standup Call")).toBeVisible();
    await expect(page.getByText("Recorded")).toBeVisible();
  });

  test("multiple meetings are listed", async ({ page }) => {
    await createAndFinishMeeting(page, "Meeting Alpha");
    await createAndFinishMeeting(page, "Meeting Beta");
    await page.goto("/");

    await expect(page.getByText("Meeting Alpha")).toBeVisible();
    await expect(page.getByText("Meeting Beta")).toBeVisible();
  });

  test("can delete a meeting from the list", async ({ page }) => {
    await createAndFinishMeeting(page, "To Delete");
    await page.goto("/");

    await expect(page.getByText("To Delete")).toBeVisible();

    // Hover to reveal delete button and click it
    const listItem = page.locator("li").filter({ hasText: "To Delete" });
    await listItem.hover();
    await listItem.getByLabel("Delete meeting").click();

    await expect(page.getByText("To Delete")).not.toBeVisible();
    await expect(page.getByText("No meetings yet")).toBeVisible();
  });

  test("clicking a meeting navigates to detail", async ({ page }) => {
    await createAndFinishMeeting(page, "Clickable Meeting");
    await page.goto("/");
    await page.getByText("Clickable Meeting").click();
    await page.waitForURL(/\/meeting\/.+/);
    await expect(page.getByText("Clickable Meeting")).toBeVisible();
  });
});
