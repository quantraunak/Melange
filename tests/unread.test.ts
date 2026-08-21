import { describe, expect, it } from "vitest";

import { isMatchUnread, type MatchWithPost, type Message } from "@/app/lib/db";

/**
 * Unread state has been a recurring source of bugs (badge counts drifting
 * between web and iOS, chats showing unread after you'd just read them).
 * It is pure, so it is cheap to pin down.
 */

const ME = "user-me";
const THEM = "user-them";

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    match_id: "match-1",
    sender_id: THEM,
    content: "hey",
    created_at: "2026-08-01T12:00:00.000Z",
    ...overrides,
  };
}

function match(overrides: Partial<MatchWithPost> = {}): MatchWithPost {
  return {
    last_message: message(),
    last_read_at: null,
    ...overrides,
  } as MatchWithPost;
}

describe("isMatchUnread", () => {
  it("is not unread when the conversation is empty", () => {
    expect(isMatchUnread(match({ last_message: null }), ME)).toBe(false);
  });

  it("is not unread when the last message is your own", () => {
    const m = match({ last_message: message({ sender_id: ME }) });
    expect(isMatchUnread(m, ME)).toBe(false);
  });

  it("is unread when they messaged and you have never opened the chat", () => {
    expect(isMatchUnread(match({ last_read_at: null }), ME)).toBe(true);
  });

  it("is unread when their message is newer than your last read", () => {
    const m = match({
      last_message: message({ created_at: "2026-08-01T12:00:00.000Z" }),
      last_read_at: "2026-08-01T11:59:59.000Z",
    });
    expect(isMatchUnread(m, ME)).toBe(true);
  });

  it("is read when you opened the chat after their message", () => {
    const m = match({
      last_message: message({ created_at: "2026-08-01T12:00:00.000Z" }),
      last_read_at: "2026-08-01T12:00:01.000Z",
    });
    expect(isMatchUnread(m, ME)).toBe(false);
  });

  it("treats an exactly-equal read timestamp as read, not unread", () => {
    const at = "2026-08-01T12:00:00.000Z";
    const m = match({
      last_message: message({ created_at: at }),
      last_read_at: at,
    });
    expect(isMatchUnread(m, ME)).toBe(false);
  });

  it("is evaluated from the viewer's perspective, not the sender's", () => {
    const m = match({ last_message: message({ sender_id: ME }) });
    // Same match object, other participant: it *is* unread for them.
    expect(isMatchUnread(m, THEM)).toBe(true);
  });
});
