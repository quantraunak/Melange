import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  REVIEW_ELIGIBILITY_DAYS,
  daysUntilReviewEligible,
  isReviewEligible,
  normalizeSocialUrl,
} from "@/app/lib/reviews";

const NOW = new Date("2026-08-15T12:00:00.000Z");

/** ISO string for `days` before NOW. */
function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe("review eligibility", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("blocks a review immediately after matching", () => {
    expect(isReviewEligible(daysAgo(0))).toBe(false);
  });

  it("blocks a review one day short of the window", () => {
    expect(isReviewEligible(daysAgo(REVIEW_ELIGIBILITY_DAYS - 1))).toBe(false);
  });

  it("allows a review exactly on the boundary", () => {
    expect(isReviewEligible(daysAgo(REVIEW_ELIGIBILITY_DAYS))).toBe(true);
  });

  it("allows a review well past the window", () => {
    expect(isReviewEligible(daysAgo(90))).toBe(true);
  });

  it("counts down whole days remaining", () => {
    expect(daysUntilReviewEligible(daysAgo(0))).toBe(REVIEW_ELIGIBILITY_DAYS);
    expect(daysUntilReviewEligible(daysAgo(1))).toBe(
      REVIEW_ELIGIBILITY_DAYS - 1
    );
  });

  it("never counts down below zero once eligible", () => {
    expect(daysUntilReviewEligible(daysAgo(90))).toBe(0);
  });

  it("agrees with isReviewEligible at the boundary", () => {
    const at = daysAgo(REVIEW_ELIGIBILITY_DAYS);
    expect(daysUntilReviewEligible(at)).toBe(0);
    expect(isReviewEligible(at)).toBe(true);
  });
});

describe("normalizeSocialUrl", () => {
  it("returns null for blank input", () => {
    expect(normalizeSocialUrl("instagram", "")).toBeNull();
    expect(normalizeSocialUrl("instagram", "   ")).toBeNull();
  });

  it("expands a bare instagram handle", () => {
    expect(normalizeSocialUrl("instagram", "maya.shoots")).toBe(
      "https://maya.shoots"
    );
    expect(normalizeSocialUrl("instagram", "mayashoots")).toBe(
      "https://instagram.com/mayashoots"
    );
  });

  it("strips a leading @ before expanding", () => {
    expect(normalizeSocialUrl("instagram", "@mayashoots")).toBe(
      "https://instagram.com/mayashoots"
    );
  });

  it("expands a bare linkedin handle", () => {
    expect(normalizeSocialUrl("linkedin", "jordan-reyes")).toBe(
      "https://linkedin.com/in/jordan-reyes"
    );
  });

  it("passes through an existing linkedin.com url", () => {
    expect(normalizeSocialUrl("linkedin", "linkedin.com/in/jordan")).toBe(
      "https://linkedin.com/in/jordan"
    );
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeSocialUrl("instagram", "  @mayashoots  ")).toBe(
      "https://instagram.com/mayashoots"
    );
  });

  /**
   * Documents current behaviour, which is NOT what you'd want long term:
   * a handle containing a dot is treated as a full domain, so any host can be
   * injected as someone's "Instagram". Since the Verified badge leans on these
   * links, this is worth tightening to an instagram.com/linkedin.com allowlist.
   * Pinned here so the change is deliberate rather than accidental.
   */
  it("currently trusts arbitrary hosts (known weakness)", () => {
    expect(normalizeSocialUrl("instagram", "evil.example.com/maya")).toBe(
      "https://evil.example.com/maya"
    );
    expect(normalizeSocialUrl("instagram", "http://evil.example.com")).toBe(
      "http://evil.example.com"
    );
  });
});
