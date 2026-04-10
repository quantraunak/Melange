import { supabase } from "./supabaseClient";

// Types
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
  name: string;
  role: string | null;
  avatar_url: string | null;
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
  created_at: string;
};

// Helpers

const UNKNOWN_CREATOR: CreatorInfo = { name: "Unknown", role: null, avatar_url: null };

async function fetchCreators(userIds: string[]): Promise<Map<string, CreatorInfo>> {
  const map = new Map<string, CreatorInfo>();
  if (userIds.length === 0) return map;

  const { data } = await supabase
    .from("profiles")
    .select("user_id, name, role, avatar_url")
    .in("user_id", userIds);

  for (const p of data || []) {
    map.set(p.user_id, { name: p.name, role: p.role, avatar_url: p.avatar_url });
  }
  return map;
}

// Database helpers

/**
 * Upload a file to Supabase Storage and return its public URL.
 * Bucket "media" must exist with public read access.
 */
export async function uploadFile(
  userId: string,
  folder: "avatars" | "posts",
  file: File
): Promise<{ url: string | null; error: string | null }> {
  try {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${folder}/${userId}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("media")
      .upload(path, file, { upsert: true });

    if (error) {
      return { url: null, error: error.message };
    }

    const { data: urlData } = supabase.storage
      .from("media")
      .getPublicUrl(path);

    return { url: urlData.publicUrl, error: null };
  } catch (err) {
    return {
      url: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Create a new collaboration post with all metadata fields.
 */
export async function createPost(
  userId: string,
  title: string,
  description: string,
  opts?: { looking_for?: string[]; location?: string; compensation?: string; media_urls?: string[] }
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

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as CollabPost, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Get all collab posts that the current user hasn't swiped on yet,
 * enriched with the creator's profile info.
 */
export async function getUnswipedPosts(userId: string): Promise<{
  data: PostWithCreator[] | null;
  error: string | null;
}> {
  try {
    const { data: posts, error: postsError } = await supabase
      .from("collab_posts")
      .select("*")
      .neq("owner_id", userId)
      .order("created_at", { ascending: false });

    if (postsError) {
      return { data: null, error: postsError.message };
    }

    const { data: swipes, error: swipesError } = await supabase
      .from("swipes")
      .select("post_id")
      .eq("swiper_id", userId);

    if (swipesError) {
      return { data: null, error: swipesError.message };
    }

    const swipedPostIds = new Set(swipes?.map((s) => s.post_id) || []);
    const unswipedPosts = (posts || []).filter((post) => !swipedPostIds.has(post.id));

    const ownerIds = [...new Set(unswipedPosts.map((p) => p.owner_id))];
    const creators = await fetchCreators(ownerIds);

    const enriched: PostWithCreator[] = unswipedPosts.map((post) => ({
      ...(post as CollabPost),
      creator: creators.get(post.owner_id) || UNKNOWN_CREATOR,
    }));

    return { data: enriched, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Record a swipe (left or right).
 */
export async function recordSwipe(
  swiperId: string,
  postId: string,
  direction: "left" | "right"
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from("swipes").insert({
      swiper_id: swiperId,
      post_id: postId,
      direction,
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Check if a right-swipe creates a mutual match, and create it if so.
 */
export async function checkAndCreateMatch(
  swiperId: string,
  postId: string
): Promise<{ match: Match | null; error: string | null }> {
  try {
    const { data: swipedPost, error: postError } = await supabase
      .from("collab_posts")
      .select("id, owner_id, title, description, looking_for, location, compensation, media_urls, is_active, created_at")
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

    if (swipeError) {
      return { match: null, error: swipeError.message };
    }

    if (!reciprocalSwipe) {
      return { match: null, error: null };
    }

    const user1Id = swiperId < postOwnerId ? swiperId : postOwnerId;
    const user2Id = swiperId < postOwnerId ? postOwnerId : swiperId;
    const post1Id = swiperId < postOwnerId ? postId : reciprocalSwipe.post_id;
    const post2Id = swiperId < postOwnerId ? reciprocalSwipe.post_id : postId;

    const { data: newMatch, error: insertError } = await supabase
      .from("matches")
      .insert({
        user1_id: user1Id,
        user2_id: user2Id,
        post1_id: post1Id,
        post2_id: post2Id,
      })
      .select()
      .single();

    if (newMatch && !insertError) {
      return { match: newMatch as Match, error: null };
    }

    if (insertError && (insertError.code === "23505" || insertError.message.includes("duplicate") || insertError.message.includes("unique"))) {
      const { data: existingMatch, error: fetchError } = await supabase
        .from("matches")
        .select("*")
        .eq("user1_id", user1Id)
        .eq("user2_id", user2Id)
        .single();

      if (fetchError) {
        return { match: null, error: fetchError.message };
      }

      return { match: existingMatch as Match, error: null };
    }

    return { match: null, error: insertError?.message || "Failed to create match" };
  } catch (err) {
    return {
      match: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Get all matches for the current user, enriched with the other user's post and profile.
 */
export async function getMatches(
  userId: string
): Promise<{ data: MatchWithPost[] | null; error: string | null }> {
  try {
    const { data: matches, error: matchesError } = await supabase
      .from("matches")
      .select("*")
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (matchesError) {
      return { data: null, error: matchesError.message };
    }

    if (!matches || matches.length === 0) {
      return { data: [], error: null };
    }

    const partials: { match: typeof matches[0]; otherUserId: string; otherPostId: string }[] = [];
    for (const match of matches) {
      partials.push({
        match,
        otherUserId: match.user1_id === userId ? match.user2_id : match.user1_id,
        otherPostId: match.user1_id === userId ? match.post2_id : match.post1_id,
      });
    }

    const postIds = partials.map((p) => p.otherPostId);
    const { data: postsData } = await supabase
      .from("collab_posts")
      .select("*")
      .in("id", postIds);
    const postsMap = new Map((postsData || []).map((p) => [p.id, p as CollabPost]));

    const creatorIds = [...new Set(partials.map((p) => p.otherUserId))];
    const creators = await fetchCreators(creatorIds);

    const enrichedMatches: MatchWithPost[] = [];
    for (const { match, otherUserId, otherPostId } of partials) {
      const otherPost = postsMap.get(otherPostId);
      if (!otherPost) continue;

      enrichedMatches.push({
        ...match,
        other_user_id: otherUserId,
        other_post: otherPost,
        other_creator: creators.get(otherUserId) || UNKNOWN_CREATOR,
        last_message: null,
      });
    }

    // Batch-fetch the latest message per match
    const matchIds = enrichedMatches.map((m) => m.id);
    if (matchIds.length > 0) {
      const { data: recentMsgs } = await supabase
        .from("messages")
        .select("*")
        .in("match_id", matchIds)
        .order("created_at", { ascending: false });

      const latestByMatch = new Map<string, Message>();
      for (const msg of (recentMsgs || []) as Message[]) {
        if (!latestByMatch.has(msg.match_id)) {
          latestByMatch.set(msg.match_id, msg);
        }
      }
      for (const m of enrichedMatches) {
        m.last_message = latestByMatch.get(m.id) || null;
      }
    }

    return { data: enrichedMatches, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Get messages for a match, ordered oldest-first.
 */
export async function getMessages(
  matchId: string
): Promise<{ data: Message[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: (data as Message[]) || [], error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Send a message in a match.
 */
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

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as Message, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Get the current user's profile.
 */
export async function getProfile(
  userId: string
): Promise<{ data: Profile | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as Profile, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Update the current user's profile.
 */
export async function updateProfile(
  userId: string,
  updates: { name?: string; role?: string; bio?: string; current_project?: string; skills?: string[]; avatar_url?: string }
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("user_id", userId);

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
