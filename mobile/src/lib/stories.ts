import { supabase } from "./supabase";
import { uploadFile, type CreatorInfo } from "./db";

/**
 * Stories — the collaboration record.
 *
 * A project is work someone wants to make; a story is work they already made.
 * Stories need no match, which is the point: they are the one thing worth
 * posting on a day when the marketplace is empty, and they are what turns a
 * profile into a record of real work rather than a list of intentions.
 *
 * Everything here degrades when 09_stories.sql has not been applied: the
 * queries resolve to an empty list with `unavailable: true` rather than an
 * error, so the Stories tab can say "not live yet" instead of showing a
 * failure the reader cannot act on.
 */

export type StoryCredit = {
  name: string;
  role: string | null;
  /** Set when the collaborator is on Melange, so the story reaches their profile. */
  user_id: string | null;
};

export type CollabStory = {
  id: string;
  author_id: string;
  title: string;
  story: string | null;
  media_urls: string[];
  credits: StoryCredit[];
  contact_link: string | null;
  happened_on: string | null;
  match_id: string | null;
  is_public: boolean;
  /** Set when an editor featured it; Explore leads with these. */
  featured_at: string | null;
  /** The weekly theme it was posted for, if any (24_open_doors_and_posting.sql). */
  theme_id: string | null;
  created_at: string;
  updated_at: string;
};

export type StoryWithAuthor = CollabStory & { author: CreatorInfo };

export const STORY_MAX_IMAGES = 10;
export const STORY_MAX_CREDITS = 12;

const UNKNOWN_AUTHOR: CreatorInfo = {
  name: "Someone",
  role: null,
  avatar_url: null,
};

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Unknown error";
}

/**
 * True when the failure is "09_stories.sql was never applied" rather than a
 * real problem. PostgREST words this two ways depending on whether the schema
 * cache has been reloaded, so match both.
 */
export function isStoriesUnavailable(message: string | null | undefined): boolean {
  if (!message) return false;
  return (
    /collab_stories/i.test(message) &&
    /(does not exist|schema cache|not find the table|relation)/i.test(message)
  );
}

/**
 * A contact link is a PUBLIC page: a portfolio, an Instagram profile, a
 * website. Never an email address or a phone number — the whole premise of
 * the app is that a conversation opens on mutual consent, and a phone number
 * on a public card hands that away. Anything that is not an http(s) URL is
 * rejected here before it can reach the database.
 */
export function normalizeContactLink(raw: string): { url: string | null; error: string | null } {
  const s = raw.trim();
  if (!s) return { url: null, error: null };

  if (/^mailto:/i.test(s) || /[^\s@]+@[^\s@]+\.[^\s@]+/.test(s)) {
    return { url: null, error: "Use a link to a page, not an email address." };
  }
  if (/^tel:/i.test(s) || /^[+(]?[\d\s().-]{7,}$/.test(s)) {
    return { url: null, error: "Use a link to a page, not a phone number." };
  }

  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { url: null, error: "That does not look like a link." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { url: null, error: "Links must start with http or https." };
  }
  if (!parsed.hostname.includes(".")) {
    return { url: null, error: "That does not look like a link." };
  }
  return { url: parsed.toString(), error: null };
}

/** "Oct 2026", or null. Stories are about the past, so no day precision. */
export function storyDate(story: Pick<CollabStory, "happened_on" | "created_at">): string | null {
  const iso = story.happened_on;
  if (!iso) return null;
  return new Date(`${iso}T12:00:00`).toLocaleDateString([], { month: "short", year: "numeric" });
}

function parseCredits(raw: unknown): StoryCredit[] {
  if (!Array.isArray(raw)) return [];
  const out: StoryCredit[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const name = typeof rec.name === "string" ? rec.name.trim() : "";
    if (!name) continue;
    out.push({
      name,
      role: typeof rec.role === "string" && rec.role.trim() ? rec.role.trim() : null,
      user_id: typeof rec.user_id === "string" && rec.user_id ? rec.user_id : null,
    });
  }
  return out;
}

function toStory(row: Record<string, unknown>): CollabStory {
  return {
    id: row.id as string,
    author_id: row.author_id as string,
    title: row.title as string,
    story: (row.story as string | null) ?? null,
    media_urls: Array.isArray(row.media_urls) ? (row.media_urls as string[]) : [],
    credits: parseCredits(row.credits),
    contact_link: (row.contact_link as string | null) ?? null,
    happened_on: (row.happened_on as string | null) ?? null,
    match_id: (row.match_id as string | null) ?? null,
    is_public: row.is_public !== false,
    featured_at: (row.featured_at as string | null) ?? null,
    theme_id: (row.theme_id as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: (row.updated_at as string) ?? (row.created_at as string),
  };
}

/** Author profiles for a batch of stories. Never fails the caller. */
async function attachAuthors(stories: CollabStory[]): Promise<StoryWithAuthor[]> {
  const ids = [...new Set(stories.map((s) => s.author_id))];
  const map = new Map<string, CreatorInfo>();

  if (ids.length) {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, name, role, avatar_url, verification_status, founding")
      .in("user_id", ids);
    if (error) console.error("stories: author lookup failed", error.message);
    for (const p of data || []) {
      map.set(p.user_id as string, {
        user_id: p.user_id as string,
        name: (p.name as string) ?? "Someone",
        role: (p.role as string | null) ?? null,
        avatar_url: (p.avatar_url as string | null) ?? null,
        verification_status: (p.verification_status as CreatorInfo["verification_status"]) ?? "none",
        founding: p.founding === true,
      });
    }
  }

  return stories.map((s) => ({ ...s, author: map.get(s.author_id) ?? UNKNOWN_AUTHOR }));
}

const COLUMNS =
  "id,author_id,title,story,media_urls,credits,contact_link,happened_on,match_id,is_public,featured_at,theme_id,created_at,updated_at";

export type StoryResult<T> = {
  data: T;
  error: string | null;
  /** 09_stories.sql has not been applied; this is a missing feature, not a fault. */
  unavailable: boolean;
};

/** The Stories feed, newest first. */
export async function getStories(limit = 30): Promise<StoryResult<StoryWithAuthor[]>> {
  try {
    const { data, error } = await supabase
      .from("collab_stories")
      .select(COLUMNS)
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      if (isStoriesUnavailable(error.message)) return { data: [], error: null, unavailable: true };
      return { data: [], error: error.message, unavailable: false };
    }
    const stories = (data || []).map((r) => toStory(r as Record<string, unknown>));
    return { data: await attachAuthors(stories), error: null, unavailable: false };
  } catch (err) {
    return { data: [], error: errMsg(err), unavailable: false };
  }
}

/**
 * Explore: featured shoots first (newest feature first), then everything else
 * newest first. `scene` narrows to shoots whose author is in that scene; the
 * author's scene lives on profiles, so the filter is a list of authors.
 * `themeId` narrows to posts made for that week's theme.
 */
export async function getExploreStories(
  scene: string | null,
  limit = 60,
  themeId: string | null = null
): Promise<StoryResult<StoryWithAuthor[]>> {
  try {
    let authorIds: string[] | null = null;
    if (scene) {
      const { data: people, error: peopleErr } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("scene", scene)
        .limit(1000);
      if (peopleErr) return { data: [], error: peopleErr.message, unavailable: false };
      authorIds = (people ?? []).map((p) => p.user_id as string);
      if (!authorIds.length) return { data: [], error: null, unavailable: false };
    }

    let q = supabase.from("collab_stories").select(COLUMNS).eq("is_public", true);
    if (authorIds) q = q.in("author_id", authorIds);
    if (themeId) q = q.eq("theme_id", themeId);
    const { data, error } = await q
      .order("featured_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      if (isStoriesUnavailable(error.message)) return { data: [], error: null, unavailable: true };
      return { data: [], error: error.message, unavailable: false };
    }
    const stories = (data || []).map((r) => toStory(r as Record<string, unknown>));
    return { data: await attachAuthors(stories), error: null, unavailable: false };
  } catch (err) {
    return { data: [], error: errMsg(err), unavailable: false };
  }
}

/** Editors only; the server refuses anyone else with a message worth showing. */
export async function setFeatured(storyId: string, on: boolean): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.rpc("set_featured", { p_story: storyId, p_on: on });
    return { error: error?.message ?? null };
  } catch (err) {
    return { error: errMsg(err) };
  }
}

export async function getStory(id: string): Promise<StoryResult<StoryWithAuthor | null>> {
  try {
    const { data, error } = await supabase
      .from("collab_stories")
      .select(COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      if (isStoriesUnavailable(error.message)) return { data: null, error: null, unavailable: true };
      return { data: null, error: error.message, unavailable: false };
    }
    if (!data) return { data: null, error: null, unavailable: false };
    const [withAuthor] = await attachAuthors([toStory(data as Record<string, unknown>)]);
    return { data: withAuthor, error: null, unavailable: false };
  } catch (err) {
    return { data: null, error: errMsg(err), unavailable: false };
  }
}

/**
 * A person's work: stories they wrote, plus stories that credit them.
 *
 * The second half is a JSONB containment query, which the GIN index in
 * 09_stories.sql serves directly. Merged and de-duplicated, newest first, so
 * a profile reads as one body of work rather than two lists.
 */
export async function getStoriesForUser(userId: string): Promise<StoryResult<StoryWithAuthor[]>> {
  try {
    const mine = supabase
      .from("collab_stories")
      .select(COLUMNS)
      .eq("author_id", userId)
      .order("created_at", { ascending: false });

    const credited = supabase
      .from("collab_stories")
      .select(COLUMNS)
      .contains("credits", JSON.stringify([{ user_id: userId }]))
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    const [a, b] = await Promise.all([mine, credited]);

    const firstError = a.error || b.error;
    if (firstError) {
      if (isStoriesUnavailable(firstError.message)) {
        return { data: [], error: null, unavailable: true };
      }
      return { data: [], error: firstError.message, unavailable: false };
    }

    const byId = new Map<string, CollabStory>();
    for (const row of [...(a.data || []), ...(b.data || [])]) {
      const s = toStory(row as Record<string, unknown>);
      byId.set(s.id, s);
    }
    const merged = [...byId.values()].sort((x, y) => y.created_at.localeCompare(x.created_at));
    return { data: await attachAuthors(merged), error: null, unavailable: false };
  } catch (err) {
    return { data: [], error: errMsg(err), unavailable: false };
  }
}

export type NewStory = {
  title: string;
  story: string;
  mediaUrls: string[];
  credits: StoryCredit[];
  contactLink: string | null;
  happenedOn: string | null;
  matchId?: string | null;
  /** Posted for this week's theme. */
  themeId?: string | null;
};

export async function createStory(
  userId: string,
  values: NewStory
): Promise<StoryResult<CollabStory | null>> {
  try {
    const row: Record<string, unknown> = {
      author_id: userId,
      title: values.title.trim(),
      story: values.story.trim() || null,
      media_urls: values.mediaUrls,
      credits: values.credits.slice(0, STORY_MAX_CREDITS),
      contact_link: values.contactLink,
      happened_on: values.happenedOn,
      is_public: true,
    };
    if (values.matchId) row.match_id = values.matchId;
    if (values.themeId) row.theme_id = values.themeId;

    const { data, error } = await supabase.from("collab_stories").insert(row).select(COLUMNS).single();
    if (error) {
      if (isStoriesUnavailable(error.message)) return { data: null, error: null, unavailable: true };
      return { data: null, error: error.message, unavailable: false };
    }
    return { data: toStory(data as Record<string, unknown>), error: null, unavailable: false };
  } catch (err) {
    return { data: null, error: errMsg(err), unavailable: false };
  }
}

export async function deleteStory(id: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from("collab_stories").delete().eq("id", id);
    return { error: error ? error.message : null };
  } catch (err) {
    return { error: errMsg(err) };
  }
}

/**
 * The author's open projects, newest first.
 *
 * "Work with me" on a story has to land somewhere that respects mutual
 * consent, so it opens one of the author's own projects and lets the reader
 * like it like any other. There is deliberately no path from a story to a
 * direct message.
 */
export type OpenProject = {
  id: string;
  title: string;
  location: string | null;
  media_urls: string[] | null;
  project_start: string | null;
  project_end: string | null;
};

export async function getOpenProjectsBy(
  userId: string
): Promise<{
  data: OpenProject[];
  error: string | null;
}> {
  try {
    // `location` rides along because a profile has no city of its own: the one
    // on someone's most recent open project is the city they are working in.
    // `select("*")` because project_start/end only exist after 08_projects.sql.
    const { data, error } = await supabase
      .from("collab_posts")
      .select("*")
      .eq("owner_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) return { data: [], error: error.message };
    return {
      data: (data || []).map((p) => ({
        id: p.id as string,
        title: p.title as string,
        location: (p.location as string | null) ?? null,
        media_urls: (p.media_urls as string[] | null) ?? null,
        project_start: (p.project_start as string | null) ?? null,
        project_end: (p.project_end as string | null) ?? null,
      })),
      error: null,
    };
  } catch (err) {
    return { data: [], error: errMsg(err) };
  }
}

/** Name search for the credit picker. Profiles are readable to any signed-in user. */
export async function searchProfiles(
  query: string,
  excludeUserId?: string
): Promise<{ data: CreatorInfo[]; error: string | null }> {
  const q = query.trim();
  if (q.length < 2) return { data: [], error: null };
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, name, role, avatar_url, verification_status")
      .ilike("name", `%${q}%`)
      .limit(8);
    if (error) return { data: [], error: error.message };
    const rows = (data || [])
      .filter((p) => p.user_id !== excludeUserId)
      .map((p) => ({
        user_id: p.user_id as string,
        name: (p.name as string) ?? "Someone",
        role: (p.role as string | null) ?? null,
        avatar_url: (p.avatar_url as string | null) ?? null,
        verification_status: (p.verification_status as CreatorInfo["verification_status"]) ?? "none",
      }));
    return { data: rows, error: null };
  } catch (err) {
    return { data: [], error: errMsg(err) };
  }
}

/* ------------------------------------------------------------------ */
/* Weekly theme, tagging and uploads (24_open_doors_and_posting.sql)   */
/* ------------------------------------------------------------------ */

export type WeeklyTheme = {
  id: string;
  title: string;
  prompt: string | null;
  /** Public posts made for it so far. */
  posts: number;
};

/** This week's theme. `null` data with no error means no theme has started. */
export async function getCurrentTheme(): Promise<{ data: WeeklyTheme | null; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc("current_theme");
    if (error) return { data: null, error: error.message };
    const r = (data ?? null) as Record<string, unknown> | null;
    if (!r || typeof r.id !== "string") return { data: null, error: null };
    return {
      data: {
        id: r.id,
        title: typeof r.title === "string" ? r.title : "This week",
        prompt: typeof r.prompt === "string" && r.prompt.trim() ? r.prompt : null,
        posts: Number(r.posts ?? 0) || 0,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

export type TaggablePerson = {
  user_id: string;
  name: string;
  handle: string | null;
  avatar_url: string | null;
  role: string | null;
};

/**
 * Members to tag, by name or @handle. The server already leaves out me,
 * non-members and anyone blocked either way, which a plain profiles query
 * can't do (I can only read my own blocks).
 */
export async function searchPeople(
  query: string
): Promise<{ data: TaggablePerson[]; error: string | null }> {
  const q = query.trim();
  if (!q) return { data: [], error: null };
  try {
    const { data, error } = await supabase.rpc("search_people", { p_query: q, p_limit: 8 });
    if (error) return { data: [], error: error.message };
    return {
      data: ((data ?? []) as Record<string, unknown>[]).map((p) => ({
        user_id: p.user_id as string,
        name: (p.name as string) || "Someone",
        handle: (p.handle as string | null) ?? null,
        avatar_url: (p.avatar_url as string | null) ?? null,
        role: (p.role as string | null) ?? null,
      })),
      error: null,
    };
  } catch (err) {
    return { data: [], error: errMsg(err) };
  }
}

/** A photo on its way into a story: already uploaded, or still on the phone. */
export type StoryAsset =
  | { kind: "remote"; url: string }
  | { kind: "local"; uri: string; mimeType?: string; width?: number; height?: number };

export type StoryUploadProgress = { index: number; total: number; fraction: number; attempt: number };

/**
 * Uploads every local photo in order and returns all the URLs, in the same
 * order, or the first error. One implementation for the full story form and
 * the quick post, so a fix to retries or resizing lands in both. It stops at
 * the first failure: a story with a hole where its third photo should be is
 * worse than asking to retry.
 */
export async function uploadStoryAssets(
  userId: string,
  assets: StoryAsset[],
  onProgress?: (p: StoryUploadProgress) => void
): Promise<{ urls: string[] | null; error: string | null }> {
  const urls: string[] = [];
  const total = assets.filter((a) => a.kind === "local").length;
  let done = 0;
  for (const a of assets) {
    if (a.kind === "remote") {
      urls.push(a.url);
      continue;
    }
    const index = done + 1;
    onProgress?.({ index, total, fraction: 0, attempt: 1 });
    const { url, error } = await uploadFile(userId, "posts", a.uri, a.mimeType || "image/jpeg", {
      width: a.width,
      height: a.height,
      onProgress: (p) => onProgress?.({ index, total, fraction: p.fraction, attempt: p.attempt }),
    });
    if (error || !url) return { urls: null, error: error || "Photo upload failed." };
    done += 1;
    urls.push(url);
  }
  return { urls, error: null };
}
