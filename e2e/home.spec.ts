import { test, expect } from "./fixtures";

test.describe("Home page", () => {
  test("shows empty state when no meetings exist", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("No meetings yet")).toBeVisible();
    await expect(
      page.getByText("Start a new recording to capture your first meeting")
    ).toBeVisible();
  });

  test("can navigate to new meeting view and back", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "New Meeting" }).click();
    await expect(page.getByPlaceholder("Meeting title (optional)")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Start Recording" })
    ).toBeVisible();

    // Navigate back
    await page.getByText("← Meetings").click();
    await expect(page.getByText("No meetings yet")).toBeVisible();
  });

  test("footer shows privacy message", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByText("Everything runs locally in your browser")
    ).toBeVisible();
  });
});
