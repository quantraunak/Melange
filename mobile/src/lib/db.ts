import { supabase } from "./supabase";
import { getReputationForUsers } from "./reviews";

// ============================================================
// Types
// ============================================================

export type CollabPost = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  looking_for: string[] | null;
  location: string | null;
  compensation: string | null;
  media_urls: string[] | null;
  is_active: boolean;
  created_at: string;
};

export type CreatorInfo = {
  user_id?: string;
  name: string;
  role: string | null;
  avatar_url: string | null;
  portfolio_urls?: string[];
  instagram_url?: string | null;
  linkedin_url?: string | null;
  avg_rating?: number;
  review_count?: number;
};

export type PostWithCreator = CollabPost & {
  creator: CreatorInfo;
};

export type Swipe = {
  id: string;
  swiper_id: string;
  post_id: string;
  direction: "left" | "right";
  created_at: string;
};

export type Match = {
  id: string;
  user1_id: string;
  user2_id: string;
  post1_id: string;
  post2_id: string;
  created_at: string;
};

export type MatchWithPost = Match & {
  other_user_id: string;
  other_post: CollabPost;
  other_creator: CreatorInfo;
  last_message: Message | null;
  last_read_at: string | null;
};

export type Message = {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export type Profile = {
  id: string;
  user_id: string;
  name: string;
  role: string | null;
  bio: string | null;
  current_project: string | null;
  skills: string[] | null;
  avatar_url: string | null;
  portfolio_urls: string[] | null;
  vibes: string[] | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  created_at: string;
};

export const VIBE_PRESETS = [
  "Editorial",
  "Street",
  "Portrait",
  "Fashion",
  "Film",
  "Beauty",
  "Events",
  "Travel",
] as const;

export const PORTFOLIO_MAX_IMAGES = 9;

export type ReportReason =
  | "spam"
  | "harassment"
  | "inappropriate"
  | "fake"
  | "underage"
  | "other";

// ============================================================
// Helpers
// ============================================================

const UNKNOWN_CREATOR: CreatorInfo = { name: "Unknown", role: null, avatar_url: null };

async function fetchCreators(userIds: string[]): Promise<Map<string, CreatorInfo>> {
  const map = new Map<string, CreatorInfo>();
  if (userIds.length === 0) return map;

  const { data } = await supabase
    .from("profiles")
    .select("user_id, name, role, avatar_url, portfolio_urls, instagram_url, linkedin_url")
    .in("user_id", userIds);

  const rep = await getReputationForUsers(userIds);

  for (const p of data || []) {
    const uid = p.user_id as string;
    const r = rep.get(uid);
    map.set(uid, {
      user_id: uid,
      name: p.name,
      role: p.role,
      avatar_url: p.avatar_url,
      portfolio_urls: (p.portfolio_urls as string[] | null) ?? [],
      instagram_url: (p.instagram_url as string | null) ?? null,
      linkedin_url: (p.linkedin_url as string | null) ?? null,
      avg_rating: r?.avg_rating,
      review_count: r?.review_count,
    });
  }
  return map;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Unknown error";
}

// ============================================================
// Storage
// ============================================================

/**
 * Upload a local file URI or Blob to Supabase Storage.
 * Returns the public URL on success.
 */
export async function uploadFile(
  userId: string,
  folder: "avatars" | "posts",
  fileUri: string,
  contentType: string = "image/jpeg"
): Promise<{ url: string | null; error: string | null }> {
  try {
    // On React Native, fetch(fileUri).blob() works for both file:// and assets.
    const res = await fetch(fileUri);
    const blob = await res.blob();

    const ext = (() => {
      const m = fileUri.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
      if (m) return m[1].toLowerCase();
      if (contentType.includes("png")) return "png";
      return "jpg";
    })();

    const path = `${folder}/${userId}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("media")
      .upload(path, blob, { upsert: true, contentType });

    if (error) return { url: null, error: error.message };

    const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
    return { url: urlData.publicUrl, error: null };
  } catch (err) {
    return { url: null, error: errMsg(err) };
  }
}

// ============================================================
// Posts
// ============================================================

export async function createPost(
  userId: string,
  title: string,
  description: string,
  opts?: {
    looking_for?: string[];
    location?: string;
    compensation?: string;
    media_urls?: string[];
  }
): Promise<{ data: CollabPost | null; error: string | null }> {
  try {
    const row: Record<string, unknown> = { owner_id: userId, title, description };
    if (opts?.looking_for?.length) row.looking_for = opts.looking_for;
    if (opts?.location) row.location = opts.location;
    if (opts?.compensation) row.compensation = opts.compensation;
    if (opts?.media_urls?.length) row.media_urls = opts.media_urls;

    const { data, error } = await supabase
      .from("collab_posts")
      .insert(row)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as CollabPost, error: null };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

export async function updatePost(
  postId: string,
  patch: Partial<Omit<CollabPost, "id" | "owner_id" | "created_at">>
): Promise<{ data: CollabPost | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("collab_posts")
      .update(patch)
      .eq("id", postId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as CollabPost, error: null };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

export async function deletePost(postId: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from("collab_posts").delete().eq("id", postId);
    return { error: error?.message ?? null };
  } catch (err) {
    return { error: errMsg(err) };
  }
}

export async function getMyPosts(
  userId: string
): Promise<{ data: CollabPost[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("collab_posts")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: (data as CollabPost[]) ?? [], error: null };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

/**
 * Swipe feed — uses the `feed_posts` RPC which already excludes:
 *   - your own posts
 *   - inactive posts
 *   - posts by blocked users (either direction)
 *   - posts you've already swiped on
 */
export async function getFeedPosts(
  userId: string
): Promise<{ data: PostWithCreator[] | null; error: string | null }> {
  try {
    let res = await supabase.rpc("ranked_feed_posts", { p_user_id: userId });
    if (res.error) {
      res = await supabase.rpc("feed_posts", { p_user_id: userId });
    }
    const { data: posts, error } = res;

    if (error) return { data: null, error: error.message };

    const list = (posts as CollabPost[]) || [];
    const ownerIds = [...new Set(list.map((p) => p.owner_id))];
    const creators = await fetchCreators(ownerIds);

    const enriched: PostWithCreator[] = list.map((post) => ({
      ...post,
      creator: creators.get(post.owner_id) || UNKNOWN_CREATOR,
    }));

    return { data: enriched, error: null };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

// ============================================================
// Swipes & Matches
// ============================================================

export async function recordSwipe(
  swiperId: string,
  postId: string,
  direction: "left" | "right"
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from("swipes")
      .insert({ swiper_id: swiperId, post_id: postId, direction });

    return { error: error?.message ?? null };
  } catch (err) {
    return { error: errMsg(err) };
  }
}

export async function checkAndCreateMatch(
  swiperId: string,
  postId: string
): Promise<{ match: Match | null; error: string | null }> {
  try {
    const { data: swipedPost, error: postError } = await supabase
      .from("collab_posts")
      .select("id, owner_id")
      .eq("id", postId)
      .single();

    if (postError || !swipedPost) {
      return { match: null, error: postError?.message || "Post not found" };
    }

    const postOwnerId = swipedPost.owner_id;

    const { data: swiperPosts, error: swiperPostsError } = await supabase
      .from("collab_posts")
      .select("id")
      .eq("owner_id", swiperId);

    if (swiperPostsError || !swiperPosts?.length) {
      return { match: null, error: null };
    }

    const swiperPostIds = swiperPosts.map((p) => p.id);

    const { data: reciprocalSwipe, error: swipeError } = await supabase
      .from("swipes")
      .select("*")
      .eq("swiper_id", postOwnerId)
      .eq("direction", "right")
      .in("post_id", swiperPostIds)
      .limit(1)
      .maybeSingle();

    if (swipeError) return { match: null, error: swipeError.message };
    if (!reciprocalSwipe) return { match: null, error: null };

    const user1Id = swiperId < postOwnerId ? swiperId : postOwnerId;
    const user2Id = swiperId < postOwnerId ? postOwnerId : swiperId;
    const post1Id = swiperId < postOwnerId ? postId : reciprocalSwipe.post_id;
    const post2Id = swiperId < postOwnerId ? reciprocalSwipe.post_id : postId;

    const { data: newMatch, error: insertError } = await supabase
      .from("matches")
      .insert({ user1_id: user1Id, user2_id: user2Id, post1_id: post1Id, post2_id: post2Id })
      .select()
      .single();

    if (newMatch && !insertError) return { match: newMatch as Match, error: null };

    if (
      insertError &&
      (insertError.code === "23505" ||
        insertError.message.includes("duplicate") ||
        insertError.message.includes("unique"))
    ) {
      const { data: existingMatch, error: fetchError } = await supabase
        .from("matches")
        .select("*")
        .eq("user1_id", user1Id)
        .eq("user2_id", user2Id)
        .single();

      if (fetchError) return { match: null, error: fetchError.message };
      return { match: existingMatch as Match, error: null };
    }

    return { match: null, error: insertError?.message || "Failed to create match" };
  } catch (err) {
    return { match: null, error: errMsg(err) };
  }
}

export async function getMatches(
  userId: string
): Promise<{ data: MatchWithPost[] | null; error: string | null }> {
  try {
    const { data: matches, error: matchesError } = await supabase
      .from("matches")
      .select("*")
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (matchesError) return { data: null, error: matchesError.message };
    if (!matches?.length) return { data: [], error: null };

    const partials: { match: typeof matches[0]; otherUserId: string; otherPostId: string }[] = [];
    for (const m of matches) {
      partials.push({
        match: m,
        otherUserId: m.user1_id === userId ? m.user2_id : m.user1_id,
        otherPostId: m.user1_id === userId ? m.post2_id : m.post1_id,
      });
    }

    const postIds = partials.map((p) => p.otherPostId);
    const { data: postsData } = await supabase
      .from("collab_posts")
      .select("*")
      .in("id", postIds);
    const postsMap = new Map<string, CollabPost>((postsData || []).map((p) => [p.id, p as CollabPost]));

    const creatorIds = [...new Set(partials.map((p) => p.otherUserId))];
    const creators = await fetchCreators(creatorIds);

    const matchIds = matches.map((m) => m.id);

    const [{ data: recentMsgs }, { data: reads }] = await Promise.all([
      supabase
        .from("messages")
        .select("*")
        .in("match_id", matchIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("match_reads")
        .select("match_id,last_read_at")
        .eq("user_id", userId)
        .in("match_id", matchIds),
    ]);

    const latestByMatch = new Map<string, Message>();
    for (const msg of (recentMsgs || []) as Message[]) {
      if (!latestByMatch.has(msg.match_id)) latestByMatch.set(msg.match_id, msg);
    }
    const readsByMatch = new Map<string, string>();
    for (const r of (reads || []) as { match_id: string; last_read_at: string }[]) {
      readsByMatch.set(r.match_id, r.last_read_at);
    }

    const enriched: MatchWithPost[] = [];
    for (const { match, otherUserId, otherPostId } of partials) {
      const otherPost = postsMap.get(otherPostId);
      if (!otherPost) continue;
      enriched.push({
        ...match,
        other_user_id: otherUserId,
        other_post: otherPost,
        other_creator: creators.get(otherUserId) || UNKNOWN_CREATOR,
        last_message: latestByMatch.get(match.id) || null,
        last_read_at: readsByMatch.get(match.id) || null,
      });
    }

    return { data: enriched, error: null };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

export function isMatchUnread(match: MatchWithPost, userId: string): boolean {
  if (!match.last_message) return false;
  if (match.last_message.sender_id === userId) return false;
  if (!match.last_read_at) return true;
  return match.last_message.created_at > match.last_read_at;
}

// ============================================================
// Messages
// ============================================================

export async function getMessages(
  matchId: string
): Promise<{ data: Message[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });

    if (error) return { data: null, error: error.message };
    return { data: (data as Message[]) ?? [], error: null };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

export async function sendMessage(
  matchId: string,
  senderId: string,
  content: string
): Promise<{ data: Message | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("messages")
      .insert({ match_id: matchId, sender_id: senderId, content })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Message, error: null };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

export async function markMatchRead(matchId: string, userId: string): Promise<void> {
  try {
    await supabase.from("match_reads").upsert(
      { match_id: matchId, user_id: userId, last_read_at: new Date().toISOString() },
      { onConflict: "match_id,user_id" }
    );
  } catch {
    // best-effort
  }
}

// ============================================================
// Profile
// ============================================================

export async function getProfile(
  userId: string
): Promise<{ data: Profile | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Profile, error: null };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

export async function updateProfile(
  userId: string,
  updates: {
    name?: string;
    role?: string;
    bio?: string;
    current_project?: string;
    skills?: string[];
    avatar_url?: string;
    portfolio_urls?: string[];
    vibes?: string[];
    instagram_url?: string | null;
    linkedin_url?: string | null;
  }
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from("profiles").update(updates).eq("user_id", userId);
    return { error: error?.message ?? null };
  } catch (err) {
    return { error: errMsg(err) };
  }
}

export async function updatePortfolio(
  userId: string,
  portfolioUrls: string[]
): Promise<{ error: string | null }> {
  return updateProfile(userId, { portfolio_urls: portfolioUrls });
}

// ============================================================
// Blocks & Reports
// ============================================================

export async function blockUser(
  blockerId: string,
  blockedId: string
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from("blocks")
      .insert({ blocker_id: blockerId, blocked_id: blockedId });
    if (error && error.code !== "23505") return { error: error.message };
    return { error: null };
  } catch (err) {
    return { error: errMsg(err) };
  }
}

export async function unblockUser(
  blockerId: string,
  blockedId: string
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from("blocks")
      .delete()
      .eq("blocker_id", blockerId)
      .eq("blocked_id", blockedId);
    return { error: error?.message ?? null };
  } catch (err) {
    return { error: errMsg(err) };
  }
}

export async function getBlockedUsers(
  blockerId: string
): Promise<{ data: CreatorInfo[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("blocks")
      .select("blocked_id")
      .eq("blocker_id", blockerId);
    if (error) return { data: [], error: error.message };

    const ids = (data || []).map((r) => r.blocked_id as string);
    if (ids.length === 0) return { data: [], error: null };

    const creators = await fetchCreators(ids);
    return { data: Array.from(creators.values()), error: null };
  } catch (err) {
    return { data: [], error: errMsg(err) };
  }
}

export async function submitReport(
  reporterId: string,
  targetKind: "user" | "post" | "message",
  targetId: string,
  reason: ReportReason,
  details?: string
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from("reports").insert({
      reporter_id: reporterId,
      target_kind: targetKind,
      target_id: targetId,
      reason,
      details: details || null,
    });
    return { error: error?.message ?? null };
  } catch (err) {
    return { error: errMsg(err) };
  }
}

// ============================================================
// Push tokens
// ============================================================

export async function registerPushToken(
  userId: string,
  token: string,
  platform: "ios" | "android" = "ios"
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from("push_tokens")
      .upsert(
        { user_id: userId, token, platform, updated_at: new Date().toISOString() },
        { onConflict: "token" }
      );
    return { error: error?.message ?? null };
  } catch (err) {
    return { error: errMsg(err) };
  }
}

export async function removePushToken(token: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from("push_tokens").delete().eq("token", token);
    return { error: error?.message ?? null };
  } catch (err) {
    return { error: errMsg(err) };
  }
}

// ============================================================
// Account deletion (App Store requirement)
// ============================================================

export async function deleteAccount(): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.rpc("delete_account");
    if (error) return { error: error.message };
    await supabase.auth.signOut();
    return { error: null };
  } catch (err) {
    return { error: errMsg(err) };
  }
}
