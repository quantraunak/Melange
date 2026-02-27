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
};

// Database helpers

/**
 * Get all collab posts that the current user hasn't swiped on yet
 */
export async function getUnswipedPosts(userId: string): Promise<{
  data: CollabPost[] | null;
  error: string | null;
}> {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ec9eebc2-ca68-40df-aa35-444f92e47d89',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/lib/db.ts:getUnswipedPosts:enter',message:'enter',data:{userId},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    console.log("[getUnswipedPosts] Fetching posts for user", { userId });
    
    // First, check if we can query posts at all (test RLS)
    const { data: allPosts, error: allPostsError } = await supabase
      .from("collab_posts")
      .select("*");
    
    console.log("[getUnswipedPosts] All posts in DB (RLS test)", { count: allPosts?.length || 0, error: allPostsError });
    
    // Get all posts excluding the user's own posts
    const { data: posts, error: postsError } = await supabase
      .from("collab_posts")
      .select("*")
      .neq("owner_id", userId)
      .order("created_at", { ascending: false });

    if (postsError) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/ec9eebc2-ca68-40df-aa35-444f92e47d89',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/lib/db.ts:getUnswipedPosts:postsError',message:'postsError',data:{message:postsError.message,code:postsError.code,details:postsError.details},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      console.error("[getUnswipedPosts] Error fetching posts", { postsError, code: postsError.code, message: postsError.message, details: postsError.details, hint: postsError.hint });
      return { data: null, error: postsError.message };
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ec9eebc2-ca68-40df-aa35-444f92e47d89',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/lib/db.ts:getUnswipedPosts:postsFetched',message:'postsFetched',data:{count:posts?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    console.log("[getUnswipedPosts] Found posts (excluding own)", { count: posts?.length || 0, posts: posts?.map(p => ({ id: p.id, title: p.title, owner_id: p.owner_id })) });

    // Get all swipes by this user
    const { data: swipes, error: swipesError } = await supabase
      .from("swipes")
      .select("post_id")
      .eq("swiper_id", userId);

    if (swipesError) {
      console.error("[getUnswipedPosts] Error fetching swipes", { swipesError });
      return { data: null, error: swipesError.message };
    }

    const swipedPostIds = new Set(swipes?.map((s) => s.post_id) || []);
    console.log("[getUnswipedPosts] User has swiped on", { count: swipedPostIds.size, postIds: Array.from(swipedPostIds) });

    // Filter out posts that have been swiped
    const unswipedPosts = (posts || []).filter(
      (post) => !swipedPostIds.has(post.id)
    );

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ec9eebc2-ca68-40df-aa35-444f92e47d89',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/lib/db.ts:getUnswipedPosts:return',message:'return',data:{unswipedCount:unswipedPosts.length,swipedCount:swipedPostIds.size},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    console.log("[getUnswipedPosts] Returning unswiped posts", { count: unswipedPosts.length, posts: unswipedPosts });
    return { data: unswipedPosts, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Record a swipe (left or right)
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
 * Check if a swipe right creates a match and create it if so
 */
export async function checkAndCreateMatch(
  swiperId: string,
  postId: string
): Promise<{ match: Match | null; error: string | null }> {
  try {
    console.log("[checkAndCreateMatch] Starting match check", { swiperId, postId });
    
    // Get the post that was swiped on
    const { data: swipedPost, error: postError } = await supabase
      .from("collab_posts")
      .select("id, owner_id, title, description, looking_for, location, compensation, media_urls, is_active, created_at")
      .eq("id", postId)
      .single();

    if (postError || !swipedPost) {
      console.error("[checkAndCreateMatch] Post not found", { postError, postId });
      return { match: null, error: postError?.message || "Post not found" };
    }

    const postOwnerId = swipedPost.owner_id;
    console.log("[checkAndCreateMatch] Post found", { postOwnerId, swiperId, postTitle: swipedPost.title });

    // Check if the post owner has swiped right on any of the swiper's posts
    const { data: swiperPosts, error: swiperPostsError } = await supabase
      .from("collab_posts")
      .select("id")
      .eq("owner_id", swiperId);

    if (swiperPostsError || !swiperPosts?.length) {
      return { match: null, error: null }; // No match, but not an error
    }

    const swiperPostIds = swiperPosts.map((p) => p.id);

    // Check if post owner has swiped right on any of swiper's posts
    const { data: reciprocalSwipe, error: swipeError } = await supabase
      .from("swipes")
      .select("*")
      .eq("swiper_id", postOwnerId)
      .eq("direction", "right")
      .in("post_id", swiperPostIds)
      .limit(1)
      .maybeSingle();

    if (swipeError) {
      console.error("[checkAndCreateMatch] Error checking reciprocal swipe", { swipeError });
      return { match: null, error: swipeError.message };
    }

    if (!reciprocalSwipe) {
      console.log("[checkAndCreateMatch] No reciprocal swipe found yet", { postOwnerId, swiperPostIds });
      return { match: null, error: null }; // No match yet
    }

    console.log("[checkAndCreateMatch] Reciprocal swipe found! Creating match", { reciprocalSwipe });

    // Match found! Create match record with canonical ordering
    // user1_id = LEAST(swiperId, postOwnerId), user2_id = GREATEST(...)
    // Same ordering for posts to maintain consistency
    const user1Id = swiperId < postOwnerId ? swiperId : postOwnerId;
    const user2Id = swiperId < postOwnerId ? postOwnerId : swiperId;
    const post1Id = swiperId < postOwnerId ? postId : reciprocalSwipe.post_id;
    const post2Id = swiperId < postOwnerId ? reciprocalSwipe.post_id : postId;

    // Try to insert the match. If it already exists (unique constraint violation),
    // fetch the existing match. This provides idempotent behavior equivalent to
    // ON CONFLICT DO NOTHING.
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

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ec9eebc2-ca68-40df-aa35-444f92e47d89',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/lib/db.ts:checkAndCreateMatch:insertResult',message:'insertResult',data:{hasMatch:!!newMatch,insertError:insertError?.message||null,code:insertError?.code||null},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion

    // If insert succeeded, return the new match
    if (newMatch && !insertError) {
      console.log("[checkAndCreateMatch] Match created successfully!", { match: newMatch });
      return { match: newMatch as Match, error: null };
    }

    // If insert failed due to unique constraint (match already exists), fetch it
    // Check if error is a unique constraint violation (code 23505 or contains "duplicate")
    if (insertError && (insertError.code === "23505" || insertError.message.includes("duplicate") || insertError.message.includes("unique"))) {
      console.log("[checkAndCreateMatch] Match already exists, fetching existing match", { user1Id, user2Id });
      const { data: existingMatch, error: fetchError } = await supabase
        .from("matches")
        .select("*")
        .eq("user1_id", user1Id)
        .eq("user2_id", user2Id)
        .single();

      if (fetchError) {
        console.error("[checkAndCreateMatch] Error fetching existing match", { fetchError });
        return { match: null, error: fetchError.message };
      }

      console.log("[checkAndCreateMatch] Existing match found", { match: existingMatch });
      return { match: existingMatch as Match, error: null };
    }

    // Some other error occurred
    console.error("[checkAndCreateMatch] Error creating match", { insertError });
    return { match: null, error: insertError?.message || "Failed to create match" };
  } catch (err) {
    return {
      match: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Get all matches for the current user
 */
export async function getMatches(
  userId: string
): Promise<{ data: MatchWithPost[] | null; error: string | null }> {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ec9eebc2-ca68-40df-aa35-444f92e47d89',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/lib/db.ts:getMatches:enter',message:'enter',data:{userId},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    console.log("[getMatches] Fetching matches for user", { userId });
    
    const { data: matches, error: matchesError } = await supabase
      .from("matches")
      .select("*")
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (matchesError) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/ec9eebc2-ca68-40df-aa35-444f92e47d89',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/lib/db.ts:getMatches:matchesError',message:'matchesError',data:{message:matchesError.message,code:matchesError.code,details:matchesError.details},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      console.error("[getMatches] Error fetching matches", { matchesError });
      return { data: null, error: matchesError.message };
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ec9eebc2-ca68-40df-aa35-444f92e47d89',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/lib/db.ts:getMatches:matchesFetched',message:'matchesFetched',data:{count:matches?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    console.log("[getMatches] Found matches", { count: matches?.length || 0, matches });

    if (!matches || matches.length === 0) {
      return { data: [], error: null };
    }

    // Enrich matches with the other user's post
    const enrichedMatches: MatchWithPost[] = [];

    for (const match of matches) {
      const otherUserId =
        match.user1_id === userId ? match.user2_id : match.user1_id;
      const otherPostId =
        match.user1_id === userId ? match.post2_id : match.post1_id;

      console.log("[getMatches] Fetching post for match", { matchId: match.id, otherPostId, otherUserId });

      const { data: otherPost, error: postError } = await supabase
        .from("collab_posts")
        .select("*")
        .eq("id", otherPostId)
        .single();

      if (postError || !otherPost) {
        console.error("[getMatches] Error fetching post for match:", { postError, otherPostId, matchId: match.id });
        continue;
      }

      console.log("[getMatches] Successfully enriched match", { matchId: match.id, postTitle: otherPost.title });

      enrichedMatches.push({
        ...match,
        other_user_id: otherUserId,
        other_post: otherPost as CollabPost,
      });
    }

    console.log("[getMatches] Returning enriched matches", { count: enrichedMatches.length });
    return { data: enrichedMatches, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

