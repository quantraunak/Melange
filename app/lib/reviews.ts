import { supabase } from "./supabaseClient";

export const REVIEW_TAGS = [
  "Professional",
  "On time",
  "Great comms",
  "Creative",
  "Would collab again",
] as const;

export type ReviewTag = (typeof REVIEW_TAGS)[number];

export type CollabReview = {
  id: string;
  match_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  tags: string[];
  body: string | null;
  created_at: string;
};

/**
 * One review as a public profile shows it. match_id and reviewee_id are
 * deliberately absent: public_reviews() does not return them, and nothing on
 * the profile needs them.
 */
export type ReviewWithReviewer = Omit<CollabReview, "match_id" | "reviewee_id"> & {
  reviewer_name: string;
  reviewer_avatar_url: string | null;
};

export type Reputation = {
  avg_rating: number;
  review_count: number;
};

/** Production: 14. Beta: 3 so reviewers and early users can test trust loop faster. */
export const REVIEW_ELIGIBILITY_DAYS = 3;

/** Wait period after match before leaving a collab review (anti-spam). */
export function isReviewEligible(matchCreatedAt: string): boolean {
  const days =
    (Date.now() - new Date(matchCreatedAt).getTime()) / (1000 * 60 * 60 * 24);
  return days >= REVIEW_ELIGIBILITY_DAYS;
}

export function daysUntilReviewEligible(matchCreatedAt: string): number {
  const days =
    (Date.now() - new Date(matchCreatedAt).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(REVIEW_ELIGIBILITY_DAYS - days));
}

export async function getReputationForUsers(
  userIds: string[]
): Promise<Map<string, Reputation>> {
  const map = new Map<string, Reputation>();
  if (userIds.length === 0) return map;
  try {
    const { data, error } = await supabase.rpc("creator_reputation", {
      p_user_ids: userIds,
    });
    if (error) return map;
    for (const row of data || []) {
      map.set(row.user_id as string, {
        avg_rating: Number(row.avg_rating) || 0,
        review_count: Number(row.review_count) || 0,
      });
    }
  } catch {
    // RPC may not exist until v4 migration
  }
  return map;
}

/**
 * The reviews on someone's public profile.
 *
 * This used to read collab_reviews directly and apply the mutual-reveal rule in
 * JavaScript, and the filter could never match. The list was fetched with
 * `.eq("reviewee_id", X)`, so every row in it has reviewee_id = X; the filter
 * then looked within that same list for a row whose reviewee_id equals the
 * first row's REVIEWER — which is never X unless someone reviewed themselves,
 * and the insert policy forbids that. So the function returned an empty array
 * for every user, always, and every profile on the web read "No public reviews
 * yet" no matter how many mutually revealed reviews existed. Confirmed against
 * production: with two reciprocal reviews inserted in a rolled-back
 * transaction, the client filter yielded 0 rows and the mutual-reveal rule
 * yielded 1.
 *
 * public_reviews() (13_reach_out.sql) applies the rule in the database, which
 * is what the iPhone app uses, so the two clients now agree.
 */
export async function getVisibleReviewsForUser(
  revieweeId: string
): Promise<{ data: ReviewWithReviewer[]; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc("public_reviews", {
      p_user_id: revieweeId,
      p_limit: 20,
    });

    if (error) return { data: [], error: error.message };

    const visible = (data || []) as {
      id: string;
      reviewer_id: string;
      rating: number;
      tags: string[] | null;
      body: string | null;
      created_at: string;
    }[];
    if (visible.length === 0) return { data: [], error: null };

    const reviewerIds = [...new Set(visible.map((r) => r.reviewer_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, avatar_url")
      .in("user_id", reviewerIds);

    const names = new Map(
      (profiles || []).map((p) => [
        p.user_id as string,
        { name: p.name as string, avatar: p.avatar_url as string | null },
      ])
    );

    return {
      data: visible.map((r) => ({
        id: r.id,
        reviewer_id: r.reviewer_id,
        rating: r.rating,
        tags: r.tags ?? [],
        body: r.body,
        created_at: r.created_at,
        reviewer_name: names.get(r.reviewer_id)?.name ?? "Collaborator",
        reviewer_avatar_url: names.get(r.reviewer_id)?.avatar ?? null,
      })),
      error: null,
    };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function getMyReviewForMatch(
  matchId: string,
  userId: string
): Promise<{ data: CollabReview | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("collab_reviews")
      .select("*")
      .eq("match_id", matchId)
      .eq("reviewer_id", userId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    return { data: (data as CollabReview) || null, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function submitCollabReview(
  matchId: string,
  reviewerId: string,
  revieweeId: string,
  rating: number,
  tags: string[],
  body?: string
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from("collab_reviews").insert({
      match_id: matchId,
      reviewer_id: reviewerId,
      reviewee_id: revieweeId,
      rating,
      tags: tags.slice(0, 3),
      body: body?.trim() || null,
    });
    if (!error) {
      await supabase.rpc("refresh_profile_verification", { p_user_id: revieweeId });
    }
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export function normalizeSocialUrl(
  kind: "instagram" | "linkedin",
  raw: string
): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  const handle = v.replace(/^@/, "");
  if (kind === "instagram") {
    return handle.includes(".")
      ? `https://${handle}`
      : `https://instagram.com/${handle}`;
  }
  return handle.includes("linkedin.com")
    ? `https://${handle}`
    : `https://linkedin.com/in/${handle}`;
}
