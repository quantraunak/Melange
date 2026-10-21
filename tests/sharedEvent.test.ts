import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));

import {
  formatNightWhen,
  getSharedEvent,
  normalizeSharedEvent,
  sharedEventSummary,
  type SharedEvent,
} from "@/app/lib/publicData";

const ID = "3f2b8a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b";

function event(over: Partial<SharedEvent> = {}): SharedEvent {
  return {
    id: ID,
    title: "Darkroom night",
    description: "Bring a roll.",
    // 03:00 UTC on Oct 25 is 8:00 PM Saturday Oct 24 in Los Angeles (PDT).
    start_at: "2026-10-25T03:00:00+00:00",
    end_at: "2026-10-25T06:00:00+00:00",
    location_name: "The Lot, Silver Lake",
    cover_url: null,
    scene: "la",
    capacity: 40,
    host: { name: "Maya", avatar_url: null },
    going_count: 3,
    going: [
      { name: "Maya", avatar_url: null },
      { name: "Leo", avatar_url: "https://x/leo.jpg" },
      { name: "Ana", avatar_url: null },
    ],
    ...over,
  };
}

describe("shared night page data", () => {
  beforeEach(() => {
    rpc.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  });

  it("shows the time in Los Angeles, not the server's zone", () => {
    expect(formatNightWhen("2026-10-25T03:00:00+00:00")).toBe("Sat, Oct 24 · 8:00 PM");
    expect(formatNightWhen("2026-10-25T03:00:00+00:00", "2026-10-25T06:00:00+00:00")).toBe(
      "Sat, Oct 24 · 8:00 PM – 11:00 PM",
    );
    // Ends after midnight: don't print a range that reads backwards.
    expect(formatNightWhen("2026-10-25T03:00:00+00:00", "2026-10-25T09:00:00+00:00")).toBe(
      "Sat, Oct 24 · 8:00 PM",
    );
    expect(formatNightWhen("not a date")).toBeNull();
  });

  it("builds the link-preview line", () => {
    expect(sharedEventSummary(event())).toBe("3 going · Sat, Oct 24 · The Lot, Silver Lake");
    expect(sharedEventSummary(event({ location_name: null, going_count: 0, going: [] }))).toBe(
      "0 going · Sat, Oct 24",
    );
  });

  it("caps faces at 12 and never shows fewer going than faces", () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ name: `P${i}`, avatar_url: null }));
    const e = normalizeSharedEvent(event({ going: many, going_count: 2 }));
    expect(e.going).toHaveLength(12);
    expect(e.going_count).toBe(12);
    const n = normalizeSharedEvent(event({ host: { name: "", avatar_url: null }, title: "" }));
    expect(n.host).toBeNull();
    expect(n.title).toBe("An event on Melange");
  });

  it("returns null for a non-UUID without calling the database", async () => {
    expect(await getSharedEvent("not-a-uuid")).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns null when the RPC returns null (unknown or canceled night)", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await getSharedEvent(ID)).toBeNull();
    expect(rpc).toHaveBeenCalledWith("get_shared_event", { p_event: ID });
  });

  it("throws on a real error instead of pretending the night isn't there", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(getSharedEvent(ID)).rejects.toThrow("get_shared_event failed: boom");
  });

  it("returns the normalized night", async () => {
    rpc.mockResolvedValue({ data: event({ going_count: "3" as unknown as number }), error: null });
    const e = await getSharedEvent(ID);
    expect(e?.going_count).toBe(3);
    expect(e?.going.map((p) => p.name)).toEqual(["Maya", "Leo", "Ana"]);
  });
});
