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

export type ReviewWithReviewer = CollabReview & {
  reviewer_name: string;
  reviewer_avatar_url: string | null;
};

export type Reputation = {
  avg_rating: number;
  review_count: number;
};

export const REVIEW_ELIGIBILITY_DAYS = 14;

/** Both parties wait 14 days after match before reviewing (anti-spam, per ROADMAP). */
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

export async function getVisibleReviewsForUser(
  revieweeId: string
): Promise<{ data: ReviewWithReviewer[]; error: string | null }> {
  try {
    const { data: reviews, error } = await supabase
      .from("collab_reviews")
      .select("*")
      .eq("reviewee_id", revieweeId)
      .order("created_at", { ascending: false });

    if (error) return { data: [], error: error.message };

    const list = (reviews as CollabReview[]) || [];
    const visible = list.filter((r) =>
      list.some(
        (other) =>
          other.match_id === r.match_id &&
          other.reviewer_id === r.reviewee_id &&
          other.reviewee_id === r.reviewer_id
      )
    );

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
        ...r,
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
