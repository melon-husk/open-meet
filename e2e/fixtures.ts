import { test as base, expect } from "@playwright/test";
import path from "path";

/**
 * Extended test fixture that injects browser mocks before every page load.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript({
      path: path.resolve(__dirname, "browser-mocks.js"),
    });
    await use(page);
  },
});

export { expect };

/** Helper to emit a speech segment from the test side. */
export async function emitSegment(
  page: import("@playwright/test").Page,
  text: string,
  isFinal = true
) {
  // Wait until a SpeechRecognition instance exists and has onresult wired up
  await page.waitForFunction(
    () => {
      const m = (window as any).__mocks;
      const inst = m?.speechInstances?.[m.speechInstances.length - 1];
      return inst && inst.onresult && inst._running;
    },
    { timeout: 5000 }
  );
  await page.evaluate(
    ({ t, f }) => (window as any).__mocks.emitSegment(t, f),
    { t: text, f: isFinal }
  );
}
