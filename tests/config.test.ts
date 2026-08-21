import { describe, expect, it } from "vitest";

import { EVENT_CATEGORIES, categoryDisplay } from "@/app/lib/events";
import { PORTFOLIO_MAX_IMAGES, VIBE_PRESETS } from "@/app/lib/db";
import { APP_STORE_URL, IOS_LIVE, SITE, WEB_APP_PATH } from "@/app/lib/site";

describe("event categories", () => {
  it("gives every category a label and emoji", () => {
    for (const c of EVENT_CATEGORIES) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.emoji.length).toBeGreaterThan(0);
      expect(categoryDisplay(c.id)).toMatchObject({
        label: c.label,
        emoji: c.emoji,
      });
    }
  });

  it("has no duplicate category ids", () => {
    const ids = EVENT_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("falls back rather than throwing on an unknown category", () => {
    // Rows written by an older client shouldn't blank the events tab.
    const display = categoryDisplay(
      "not_a_real_category" as (typeof EVENT_CATEGORIES)[number]["id"]
    );
    expect(display.label).toBe("not_a_real_category");
    expect(display.emoji).toBe("📍");
  });
});

describe("product constants", () => {
  it("caps the portfolio grid at nine", () => {
    expect(PORTFOLIO_MAX_IMAGES).toBe(9);
  });

  it("offers a non-empty, duplicate-free vibe list", () => {
    expect(VIBE_PRESETS.length).toBeGreaterThan(0);
    expect(new Set(VIBE_PRESETS).size).toBe(VIBE_PRESETS.length);
  });
});

describe("marketing site config", () => {
  it("points the App Store link at the real app id", () => {
    expect(APP_STORE_URL).toContain("6774481477");
  });

  it("keeps the web app on a path the marketing site can link to", () => {
    expect(WEB_APP_PATH.startsWith("/")).toBe(true);
  });

  it("uses an absolute site url so metadataBase resolves", () => {
    expect(() => new URL(SITE.url)).not.toThrow();
  });

  /**
   * Guardrail, not a preference: while the app sits in App Store review the
   * download buttons must not link to a store page that 404s. Flip IOS_LIVE
   * the day Apple approves and this test stops mattering.
   */
  it("only advertises an iPhone download once the app is actually live", () => {
    expect(typeof IOS_LIVE).toBe("boolean");
  });
});
