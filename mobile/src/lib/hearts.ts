import { supabase } from "./supabase";

/**
 * Hearts on profiles and on work (stories), 18_hearts.sql. A heart on a
 * project is the existing project like (a right swipe), so my_likes() lists
 * those too. Whoever gets a heart sees who sent it and on what, and either
 * side can message the other.
 */
export type HeartKind = "profile" | "story";

export type LikeRow = {
  direction: "received" | "sent";
  other_user: string;
  kind: HeartKind | "project";
  target_id: string;
  title: string | null;
  created_at: string;
};

export const HEARTS_NOT_SET_UP = "Hearts need the latest database update (18_hearts.sql).";

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Unknown error";
}

function isMissing(message: string): boolean {
  return /(hearts|toggle_heart|my_likes)/i.test(message) &&
    /(does not exist|schema cache|could not find)/i.test(message);
}

/** Heart it, or take the heart back. Resolves to whether it is hearted now. */
export async function toggleHeart(
  kind: HeartKind,
  targetId: string
): Promise<{ hearted: boolean | null; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc("toggle_heart", { p_kind: kind, p_target: targetId });
    if (error) return { hearted: null, error: isMissing(error.message) ? HEARTS_NOT_SET_UP : error.message };
    return { hearted: data === true, error: null };
  } catch (err) {
    return { hearted: null, error: errMsg(err) };
  }
}

/**
 * Whether I have hearted this target. `null` means we could not find out.
 *
 * This used to collapse every failure into `false`, which the button then
 * rendered as an un-hearted pill. So on a slow or failed read of a profile you
 * HAD hearted, the first tap ran toggle_heart and DELETED the heart, reported
 * nothing, and left the pill looking exactly as it had. The distinction
 * between "not hearted" and "do not know yet" is the whole safety of a toggle.
 *
 * A database without 18_hearts.sql is the one failure that really does mean
 * "no heart", so that one still answers false.
 */
export async function isHearted(
  userId: string,
  kind: HeartKind,
  targetId: string
): Promise<boolean | null> {
  try {
    const { data, error } = await supabase
      .from("hearts")
      .select("id")
      .eq("from_user", userId)
      .eq("kind", kind)
      .eq("target_id", targetId)
      .maybeSingle();
    if (error) return isMissing(error.message) ? false : null;
    return !!data;
  } catch {
    return null;
  }
}

/** Every heart you got and gave, newest first. Empty without 18_hearts.sql. */
export async function getMyLikes(): Promise<{ data: LikeRow[]; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc("my_likes", { p_limit: 100 });
    if (error) {
      if (isMissing(error.message)) return { data: [], error: null };
      return { data: [], error: error.message };
    }
    return { data: (data || []) as LikeRow[], error: null };
  } catch (err) {
    return { data: [], error: errMsg(err) };
  }
}

/** "your profile", "your project "Rooftop"", for a row about a heart. */
export function likeTarget(row: Pick<LikeRow, "kind" | "title" | "direction">): string {
  const whose = row.direction === "received" ? "your" : "their";
  if (row.kind === "profile") return `${whose} profile`;
  const noun = row.kind === "project" ? "project" : "work";
  return row.title ? `${whose} ${noun} "${row.title}"` : `${whose} ${noun}`;
}
