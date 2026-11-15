import { supabase } from "./supabase";

/**
 * Hearts on chat messages (29_projects_and_regions.sql, message_hearts).
 * Either person in a chat can heart a message once; both of them see it.
 */
export type MessageHeart = { message_id: string; user_id: string };

/** The blue of a message heart. Hearts on people and work stay the brand red. */
export const MESSAGE_HEART_BLUE = "#2F6FED";

function isMissing(message: string): boolean {
  return /message_hearts/i.test(message) && /(does not exist|schema cache|could not find)/i.test(message);
}

export async function getMessageHearts(matchId: string): Promise<MessageHeart[]> {
  try {
    const { data, error } = await supabase
      .from("message_hearts")
      .select("message_id, user_id")
      .eq("match_id", matchId);
    if (error) {
      if (!isMissing(error.message)) console.warn("getMessageHearts", error.message);
      return [];
    }
    return (data || []) as MessageHeart[];
  } catch {
    return [];
  }
}

/** Heart it, or take it back. Resolves to an error line, or null. */
export async function setMessageHeart(
  matchId: string,
  messageId: string,
  userId: string,
  on: boolean
): Promise<string | null> {
  try {
    const { error } = on
      ? await supabase
          .from("message_hearts")
          .upsert({ message_id: messageId, user_id: userId, match_id: matchId }, { onConflict: "message_id,user_id", ignoreDuplicates: true })
      : await supabase.from("message_hearts").delete().eq("message_id", messageId).eq("user_id", userId);
    if (!error) return null;
    return isMissing(error.message)
      ? "Hearts on messages need the latest database update (29_projects_and_regions.sql)."
      : error.message;
  } catch (err) {
    return err instanceof Error ? err.message : "Couldn't save that heart.";
  }
}

/** When the other person last opened this chat, or null. */
export async function getPeerReadAt(userId: string, matchId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("match_peer_reads", { p_user_id: userId });
    if (error) return null;
    const row = ((data || []) as { match_id: string; peer_last_read_at: string | null }[]).find(
      (r) => r.match_id === matchId
    );
    return row?.peer_last_read_at ?? null;
  } catch {
    return null;
  }
}
