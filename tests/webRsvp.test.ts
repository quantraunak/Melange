import { beforeEach, describe, expect, it, vi } from "vitest";

import { nightHasEnded, rsvpByLink } from "@/app/lib/webRsvp";

const ID = "3f2b8a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
const rpc = vi.fn();
const client = { rpc } as unknown as Parameters<typeof rsvpByLink>[0];

describe("rsvpByLink", () => {
  beforeEach(() => rpc.mockReset());

  it("sends the trimmed full name and email to rsvp_by_link", async () => {
    rpc.mockResolvedValue({ data: { ok: true, has_account: false }, error: null });
    const res = await rsvpByLink(client, ID, "  Maya ", " Chen ", " maya@example.com ");
    expect(rpc).toHaveBeenCalledWith("rsvp_by_link", {
      p_event: ID,
      p_name: "Maya Chen",
      p_email: "maya@example.com",
    });
    expect(res).toEqual({ ok: true, hasAccount: false });
  });

  it("works without a last name and reports an existing account", async () => {
    rpc.mockResolvedValue({ data: { ok: true, has_account: true }, error: null });
    const res = await rsvpByLink(client, ID, "Leo", "", "leo@example.com");
    expect(rpc.mock.calls[0][1].p_name).toBe("Leo");
    expect(res).toEqual({ ok: true, hasAccount: true });
  });

  it("shows the server's message when the RPC raises", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "This night is full." } });
    expect(await rsvpByLink(client, ID, "Ana", "B", "ana@example.com")).toEqual({
      ok: false,
      error: "This night is full.",
    });
  });

  it("never reports success without ok: true", async () => {
    for (const data of [null, {}, { ok: false }, { ok: "true" }]) {
      rpc.mockResolvedValueOnce({ data, error: null });
      const res = await rsvpByLink(client, ID, "Ana", "", "ana@example.com");
      expect(res.ok).toBe(false);
    }
  });

  it("turns a network failure into a readable error", async () => {
    const offline = {
      rpc: async () => {
        throw new TypeError("fetch failed");
      },
    } as unknown as Parameters<typeof rsvpByLink>[0];
    const res = await rsvpByLink(offline, ID, "Ana", "", "ana@example.com");
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/connection/) });
  });

  it("catches a missing name or bad email before calling the server", async () => {
    expect(await rsvpByLink(client, ID, "  ", "Chen", "maya@example.com")).toEqual({
      ok: false,
      error: "Add your first name.",
    });
    expect(await rsvpByLink(client, ID, "Maya", "", "maya@example")).toEqual({
      ok: false,
      error: "That email doesn't look right.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("nightHasEnded", () => {
  const now = new Date("2026-10-25T07:00:00Z");

  it("uses end_at when there is one", () => {
    expect(nightHasEnded("2026-10-25T03:00:00Z", "2026-10-25T06:00:00Z", now)).toBe(true);
    expect(nightHasEnded("2026-10-25T03:00:00Z", "2026-10-25T08:00:00Z", now)).toBe(false);
  });

  it("falls back to six hours after the start, like the server", () => {
    expect(nightHasEnded("2026-10-25T03:00:00Z", null, now)).toBe(false);
    expect(nightHasEnded("2026-10-25T00:30:00Z", null, now)).toBe(true);
  });

  it("does not hide the form over a bad date", () => {
    expect(nightHasEnded("not a date", null, now)).toBe(false);
  });
});
