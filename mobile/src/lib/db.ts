import { Image as RNImage } from "react-native";
import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase";
import { getReputationForUsers } from "./reviews";

// ============================================================
// Types
// ============================================================

export type PayType = "paid" | "tfp" | "credit";

/**
 * A project (collab post). The table is still called collab_posts and the old
 * free-text columns stay for rows written before 08_projects.sql; the new UI
 * reads `roles`, `project_start`, `project_end` and `pay_type` first and falls
 * back to `looking_for` and `compensation`.
 */
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
  project_start?: string | null;
  project_end?: string | null;
  roles?: string[] | null;
  pay_type?: PayType | null;
};

/** Open roles vocabulary. Order is display order in the picker. */
export const ROLES = [
  "Photographer",
  "Model",
  "Stylist",
  "MUA",
  "Hair",
  "Videographer",
  "Director",
  "DP",
  "Editor",
  "Actor",
  "Musician",
  "Producer",
  "Dancer",
  "Designer",
  "Illustrator",
  "Writer",
  "Other",
] as const;

export const PAY_TYPES: { key: PayType; label: string; hint: string }[] = [
  { key: "paid", label: "Paid", hint: "Day rate or flat fee" },
  { key: "tfp", label: "Trade (TFP)", hint: "Time for photos, footage or prints" },
  { key: "credit", label: "Credit", hint: "Credit, a tag, a copy of the work" },
];

/** Roles on a project, reading the structured column first. */
export function projectRoles(post: Pick<CollabPost, "roles" | "looking_for">): string[] {
  if (post.roles?.length) return post.roles;
  return post.looking_for ?? [];
}

/** "Oct 12" or "Oct 12 to 14" or null when no dates were set. */
export function projectDates(post: Pick<CollabPost, "project_start" | "project_end">): string | null {
  if (!post.project_start) return null;
  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" });
  const start = fmt(post.project_start);
  if (!post.project_end || post.project_end === post.project_start) return start;
  return `${start} to ${fmt(post.project_end)}`;
}

export function payLabel(post: Pick<CollabPost, "pay_type" | "compensation">): string | null {
  const t = PAY_TYPES.find((x) => x.key === post.pay_type);
  if (t) return t.label;
  return post.compensation || null;
}

export type Credit = {
  match_id: string;
  /** The project the credit is on. Always someone else's — never your own post. */
  post_id: string | null;
  title: string;
  image: string | null;
  with_name: string;
  date: string;
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
  verification_status?: "none" | "pending" | "verified";
  /** Founding members carry the founding mark wherever their name appears. */
  founding?: boolean;
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

/**
 * Where a conversation started. "swipe" is a mutual match; the rest are
 * someone reaching out from that surface (13_reach_out.sql).
 */
export type ConversationOrigin = "swipe" | "project" | "profile" | "event" | "story";

/**
 * A conversation. The table is still called matches: a swipe match has a post
 * on both sides, a conversation someone started by reaching out may have none.
 *
 * The slots are not "user1's post" and "user2's post": create_match fills them
 * crosswise. Find a thread's projects by owner_id, never by position.
 */
export type Match = {
  id: string;
  user1_id: string;
  user2_id: string;
  post1_id: string | null;
  post2_id: string | null;
  created_at: string;
  /** Absent on a database without 13_reach_out.sql; treat as "swipe". */
  origin?: ConversationOrigin;
  origin_id?: string | null;
  started_by?: string | null;
};

export type MatchWithPost = Match & {
  other_user_id: string;
  /** Their project the conversation is about, when there is one. */
  other_post: CollabPost | null;
  /** One line saying what the conversation is about, for list rows and headers. */
  context: string;
  other_creator: CreatorInfo;
  last_message: Message | null;
  last_read_at: string | null;
  /**
   * When the OTHER person last opened this thread, for the "Seen" marker on
   * messages you sent. Null when they've never opened it — and also null on a
   * database that hasn't had 06_messaging.sql applied yet, which is why the
   * UI treats it as "no receipt to show" rather than "not seen".
   */
  peer_last_read_at: string | null;
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
  /** See 19_looking_for_consent.sql. Until true, current_project stays private. */
  looking_for_is_public?: boolean;
  skills: string[] | null;
  avatar_url: string | null;
  portfolio_urls: string[] | null;
  vibes: string[] | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  reel_url?: string | null;
  verification_status: "none" | "pending" | "verified";
  verified_at: string | null;
  created_at: string;
  /** 23_scenes_invites_nights.sql. founding and member_since are server-set. */
  scene?: string | null;
  handle?: string | null;
  founding?: boolean;
  member_since?: string | null;
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

/**
 * The floor sits on asking for attention, never on looking.
 *
 * Anyone may browse. To post a project or like someone you need three
 * photographs and a role, because those are what the person on the other side
 * uses to decide whether you are worth their Saturday. A gate at signup would
 * cost more than it is worth at this size; a gate here costs nothing until
 * someone wants something from somebody else.
 */
export const PROFILE_MIN_IMAGES = 3;

export type Gate = { ok: true; line: null } | { ok: false; line: string };

/**
 * One line, no meter. A progress ring telling someone they are 66% of a person
 * is the kind of hand-holding this product does not do: say the one thing that
 * is missing and open the screen that fixes it.
 */
/**
 * Off while Melange is getting its first people on. With the floor on, nobody
 * below three photos and a role could post a project or like one, and most of
 * the people being invited were below it — so their projects never appeared.
 * Turn back on (true) once there are enough posts that quality matters more
 * than getting anything up. The server-side policies were already lifted by
 * 14_ungate_until_1_4.sql, so this is the only switch.
 */
export const PROFILE_FLOOR_ON = false;

export function profileGate(
  profile: Pick<Profile, "role" | "portfolio_urls"> | null,
  verb: "post" | "like" | "message"
): Gate {
  if (!PROFILE_FLOOR_ON) return { ok: true, line: null };
  const photos = profile?.portfolio_urls?.length ?? 0;
  const needsPhotos = photos < PROFILE_MIN_IMAGES;
  const needsRole = !profile?.role?.trim();
  if (!needsPhotos && !needsRole) return { ok: true, line: null };

  const tail = verb === "post" ? "to post." : "first.";
  const what = needsPhotos && needsRole
    ? "Add three photos and a role"
    : needsPhotos
      ? "Add three photos"
      : "Pick a role";
  return { ok: false, line: `${what} ${tail}` };
}

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

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, name, role, avatar_url, portfolio_urls, instagram_url, linkedin_url, verification_status, founding")
    .in("user_id", userIds);

  if (error) {
    // Don't fail the caller (posts/matches should still render), but don't
    // swallow this silently either — a real failure here means every post
    // falls back to UNKNOWN_CREATOR with no visible explanation.
    console.error("fetchCreators: failed to load profiles", error.message);
  }

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
      verification_status: (p.verification_status as CreatorInfo["verification_status"]) ?? "none",
      founding: p.founding === true,
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

/** Longest edge, in pixels, that an uploaded image is reduced to. */
const MAX_IMAGE_EDGE = 1600;
/** How long one image gets before the upload is cancelled and reported. */
const UPLOAD_TIMEOUT_MS = 45_000;
/** Attempts per image, including the first. */
const UPLOAD_ATTEMPTS = 3;

export type UploadProgress = {
  /** 0 to 1 for the current image. */
  fraction: number;
  /** Which attempt is in flight, 1-based. */
  attempt: number;
};

/** Read an image's pixel dimensions from its header. Null if that fails. */
async function imageSize(uri: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    RNImage.getSize(
      uri,
      (w, h) => resolve({ w, h }),
      () => resolve(null)
    );
  });
}

/**
 * Downscale and re-encode an image before it goes over the network.
 *
 * A photo straight out of an iPhone is about 4032x3024 and three to five
 * megabytes. Melange never displays one larger than a phone screen, so sending
 * the original wastes the user's upload bandwidth by roughly a factor of ten.
 * Re-encoding also normalises HEIC to JPEG, which the previous code assumed had
 * already happened.
 *
 * Falls back to the original file if the resize fails for any reason: a smaller
 * image is an optimisation, not a requirement.
 */
async function prepareImage(
  fileUri: string,
  hint?: { width?: number; height?: number }
): Promise<{ uri: string; contentType: string }> {
  try {
    const dims =
      hint?.width && hint?.height
        ? { w: hint.width, h: hint.height }
        : await imageSize(fileUri);

    const actions: ImageManipulator.Action[] = [];
    if (dims && Math.max(dims.w, dims.h) > MAX_IMAGE_EDGE) {
      // Constrain the LONGER edge, so a portrait photo is not left tall.
      actions.push(
        dims.w >= dims.h
          ? { resize: { width: MAX_IMAGE_EDGE } }
          : { resize: { height: MAX_IMAGE_EDGE } }
      );
    }

    const out = await ImageManipulator.manipulateAsync(fileUri, actions, {
      compress: 0.8,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return { uri: out.uri, contentType: "image/jpeg" };
  } catch {
    return { uri: fileUri, contentType: "image/jpeg" };
  }
}

/** A status that another attempt might clear. 4xx other than 429 will not. */
function isRetryable(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Upload a local image to Supabase Storage. Returns the public URL on success.
 *
 * This deliberately does not use supabase-js's storage client. That path read
 * the file with `FileSystem.readAsStringAsync` as base64 and decoded it to an
 * ArrayBuffer, so a five megabyte photo became a seven megabyte JS string plus
 * a five megabyte buffer, allocated on the JS thread, five times over for a
 * five-photo post. It also had no timeout, so a weak connection left the form
 * spinning with no way out, and no retry, so one dropped packet discarded four
 * screens of typing.
 *
 * `createUploadTask` streams the file from native code, reports progress, and
 * can be cancelled, which is what makes the timeout and the retry possible.
 */
export async function uploadFile(
  userId: string,
  folder: "avatars" | "posts",
  fileUri: string,
  contentType: string = "image/jpeg",
  opts?: {
    width?: number;
    height?: number;
    onProgress?: (p: UploadProgress) => void;
  }
): Promise<{ url: string | null; error: string | null }> {
  const path = `${folder}/${userId}/${Date.now()}.jpg`;
  const { error } = await uploadImageTo("media", path, fileUri, opts);
  if (error) return { url: null, error };
  const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
  return { url: urlData.publicUrl, error: null };
}

/**
 * The upload itself, for any bucket and object path: resize, stream, time
 * out, retry. uploadFile wraps it for the public media bucket; night photos
 * use it directly, because their bucket is private and their path
 * (<event>/<uploader>/<file>) is what storage RLS checks, so the caller has to
 * choose it. The image is always re-encoded to JPEG, so `path` should end in
 * .jpg; if the resize fails the original bytes go up under that name anyway.
 */
export async function uploadImageTo(
  bucket: string,
  path: string,
  fileUri: string,
  opts?: {
    width?: number;
    height?: number;
    onProgress?: (p: UploadProgress) => void;
    /**
     * Overwrite an object already at `path`. Storage treats an upsert as an
     * update too, so a bucket with no UPDATE policy (night-photos) refuses
     * it outright; pass false there, with a path that is new every time.
     */
    upsert?: boolean;
  }
): Promise<{ error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    return { error: "You are signed out. Sign in again and retry." };
  }

  let prepared: { uri: string; contentType: string };
  try {
    prepared = await prepareImage(fileUri, opts);
  } catch (err) {
    return { error: errMsg(err) };
  }

  const endpoint = `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;

  let lastError = "Upload failed.";

  for (let attempt = 1; attempt <= UPLOAD_ATTEMPTS; attempt++) {
    opts?.onProgress?.({ fraction: 0, attempt });

    const task = FileSystem.createUploadTask(
      endpoint,
      prepared.uri,
      {
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": prepared.contentType,
          "x-upsert": opts?.upsert === false ? "false" : "true",
        },
      },
      (p) => {
        const total = p.totalBytesExpectedToSend || 0;
        if (total > 0) {
          opts?.onProgress?.({
            fraction: Math.min(1, p.totalBytesSent / total),
            attempt,
          });
        }
      }
    );

    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;

    try {
      const res = await Promise.race([
        task.uploadAsync(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            timedOut = true;
            task.cancelAsync().catch(() => {});
            reject(new Error("timeout"));
          }, UPLOAD_TIMEOUT_MS);
        }),
      ]);

      if (!res) {
        lastError = "Upload was cancelled.";
      } else if (res.status >= 200 && res.status < 300) {
        opts?.onProgress?.({ fraction: 1, attempt });
        return { error: null };
      } else if (res.status === 401 || res.status === 403) {
        // Permission, not connectivity. Another attempt cannot help.
        return { error: "That upload was refused. Sign out and back in, then retry." };
      } else {
        lastError = `Upload failed (${res.status}).`;
        if (!isRetryable(res.status)) return { error: lastError };
      }
    } catch (err) {
      lastError = timedOut
        ? "That image is taking too long on this connection."
        : errMsg(err);
    } finally {
      if (timer) clearTimeout(timer);
    }

    if (attempt < UPLOAD_ATTEMPTS) await sleep(attempt * 1500);
  }

  return { error: `${lastError} Check your connection and retry.` };
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
    roles?: string[];
    project_start?: string;
    project_end?: string;
    pay_type?: PayType;
  }
): Promise<{ data: CollabPost | null; error: string | null }> {
  try {
    const row: Record<string, unknown> = { owner_id: userId, title, description };
    if (opts?.looking_for?.length) row.looking_for = opts.looking_for;
    if (opts?.location) row.location = opts.location;
    if (opts?.compensation) row.compensation = opts.compensation;
    if (opts?.media_urls?.length) row.media_urls = opts.media_urls;
    if (opts?.roles?.length) row.roles = opts.roles;
    if (opts?.project_start) row.project_start = opts.project_start;
    if (opts?.project_end) row.project_end = opts.project_end;
    if (opts?.pay_type) row.pay_type = opts.pay_type;

    let res = await supabase.from("collab_posts").insert(row).select().single();
    if (res.error && isMissingProjectColumns(res.error.message)) {
      // Database without 08_projects.sql: keep the project readable through the
      // legacy columns rather than failing the post.
      const legacy = { ...row };
      delete legacy.roles;
      delete legacy.project_start;
      delete legacy.project_end;
      delete legacy.pay_type;
      if (opts?.roles?.length && !legacy.looking_for) legacy.looking_for = opts.roles;
      if (opts?.pay_type && !legacy.compensation) legacy.compensation = opts.pay_type.toUpperCase();
      res = await supabase.from("collab_posts").insert(legacy).select().single();
    }
    const { data, error } = res;

    if (error) return { data: null, error: error.message };
    return { data: data as CollabPost, error: null };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

/** PostgREST's wording when a column from 08_projects.sql is not there yet. */
function isMissingProjectColumns(message: string): boolean {
  const names = /(roles|project_start|project_end|pay_type|reel_url)/i;
  return names.test(message) && /(column|schema cache)/i.test(message);
}

export async function updatePost(
  postId: string,
  patch: Partial<Omit<CollabPost, "id" | "owner_id" | "created_at">>
): Promise<{ data: CollabPost | null; error: string | null }> {
  try {
    let res = await supabase.from("collab_posts").update(patch).eq("id", postId).select().single();
    if (res.error && isMissingProjectColumns(res.error.message)) {
      const legacy: Record<string, unknown> = { ...patch };
      delete legacy.roles;
      delete legacy.project_start;
      delete legacy.project_end;
      delete legacy.pay_type;
      if (patch.roles?.length) legacy.looking_for = patch.roles;
      if (patch.pay_type && !patch.compensation) legacy.compensation = patch.pay_type.toUpperCase();
      res = await supabase.from("collab_posts").update(legacy).eq("id", postId).select().single();
    }
    const { data, error } = res;

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
      console.warn("[getFeedPosts] ranked_feed_posts failed, falling back to feed_posts:", res.error.message);
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

export async function getExplorePosts(
  userId: string,
  limit = 40
): Promise<{ data: PostWithCreator[] | null; error: string | null }> {
  try {
    const rpc = await supabase.rpc("explore_posts", { p_user_id: userId, p_limit: limit });
    if (!rpc.error && rpc.data) {
      const list = (rpc.data as CollabPost[]) || [];
      const ownerIds = [...new Set(list.map((p) => p.owner_id))];
      const creators = await fetchCreators(ownerIds);
      return {
        data: list.map((post) => ({
          ...post,
          creator: creators.get(post.owner_id) || UNKNOWN_CREATOR,
        })),
        error: null,
      };
    }

    const { data: posts, error } = await supabase
      .from("collab_posts")
      .select("*")
      .eq("is_active", true)
      .neq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { data: null, error: error.message };

    const list = (posts as CollabPost[]) || [];
    const ownerIds = [...new Set(list.map((p) => p.owner_id))];
    const creators = await fetchCreators(ownerIds);
    return {
      data: list.map((post) => ({
        ...post,
        creator: creators.get(post.owner_id) || UNKNOWN_CREATOR,
      })),
      error: null,
    };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

// ============================================================
// Swipes & Matches
// ============================================================

/**
 * Post ids this user has already swiped on, and which way.
 *
 * The swipe deck filters these out server-side; Explore deliberately keeps
 * them so it can work as a browsable catalogue rather than a second deck. It
 * needs to label them, though — an unmarked grid of posts you already passed
 * on is exactly the "this is just the feed again" problem.
 */
export async function getMySwipes(
  userId: string
): Promise<{ data: Map<string, "left" | "right">; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("swipes")
      .select("post_id,direction")
      .eq("swiper_id", userId);
    if (error) return { data: new Map(), error: error.message };
    const map = new Map<string, "left" | "right">();
    for (const row of (data || []) as { post_id: string; direction: "left" | "right" }[]) {
      map.set(row.post_id, row.direction);
    }
    return { data: map, error: null };
  } catch (err) {
    return { data: new Map(), error: errMsg(err) };
  }
}

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

/**
 * Take back the last swipe so the post returns to the deck.
 *
 * Returns an error string rather than throwing when the swipe already turned
 * into a match — the other person has seen and reciprocated it by then, and
 * quietly deleting their match is not undo, it's a deletion.
 */
export async function undoSwipe(postId: string): Promise<{ error: string | null }> {
  try {
    const { data, error } = await supabase.rpc("undo_swipe", { p_post_id: postId });
    if (error) return { error: error.message };
    if (data === false) return { error: "That one already turned into a match — it can't be undone." };
    return { error: null };
  } catch (err) {
    return { error: errMsg(err) };
  }
}

/**
 * Match creation goes through the database function create_match
 * (supabase/schema/07_matching.sql, SECURITY DEFINER). It verifies that the
 * caller right-swiped this post and that the post's owner right-swiped one of
 * the caller's posts, then inserts the match in canonical order. The client
 * cannot insert into matches directly, so a match exists only when both people
 * said yes, whatever any client sends. `swiperId` is kept for the call site;
 * the function uses auth.uid().
 */
export async function checkAndCreateMatch(
  _swiperId: string,
  postId: string
): Promise<{ match: Match | null; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc("create_match", { p_post_id: postId });
    if (error) return { match: null, error: error.message };
    const rows = (Array.isArray(data) ? data : data ? [data] : []) as Match[];
    return { match: rows[0] ?? null, error: null };
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

    const partials: { match: Match; otherUserId: string }[] = (matches as Match[]).map((m) => ({
      match: m,
      otherUserId: m.user1_id === userId ? m.user2_id : m.user1_id,
    }));

    // Both slots, resolved by owner below. Reading them by position handed
    // back your own project as "theirs", because create_match fills the slots
    // crosswise. A reach-out thread can have no post at all.
    const postIds = [
      ...new Set(
        partials.flatMap(({ match: m }) => [m.post1_id, m.post2_id]).filter((id): id is string => !!id)
      ),
    ];
    const { data: postsData, error: postsError } = postIds.length
      ? await supabase.from("collab_posts").select("*").in("id", postIds)
      : { data: [], error: null };
    // Surface this rather than logging it. Swallowing it meant one failed
    // query — offline, an RLS change, a PostgREST hiccup — left postsMap empty,
    // and the placeholder branch below then relabelled EVERY conversation
    // "This listing was removed", with no error banner. Users concluded that
    // all of their collaborators had deleted their projects.
    if (postsError) {
      return { data: null, error: postsError.message };
    }
    const postsMap = new Map<string, CollabPost>((postsData || []).map((p) => [p.id, p as CollabPost]));

    const creatorIds = [...new Set(partials.map((p) => p.otherUserId))];
    const creators = await fetchCreators(creatorIds);

    const matchIds = matches.map((m) => m.id);

    const [
      { data: recentMsgs, error: recentMsgsError },
      { data: reads, error: readsError },
      peerReads,
    ] = await Promise.all([
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
      // The other side's read times come from an RPC because match_reads is
      // locked to your own rows. Older databases don't have it — resolve to
      // an empty map rather than failing the whole list.
      supabase.rpc("match_peer_reads", { p_user_id: userId }),
    ]);
    if (recentMsgsError) {
      console.error("getMatches: failed to load recent messages", recentMsgsError.message);
    }
    if (readsError) {
      console.error("getMatches: failed to load read receipts", readsError.message);
    }

    const latestByMatch = new Map<string, Message>();
    for (const msg of (recentMsgs || []) as Message[]) {
      if (!latestByMatch.has(msg.match_id)) latestByMatch.set(msg.match_id, msg);
    }
    const readsByMatch = new Map<string, string>();
    for (const r of (reads || []) as { match_id: string; last_read_at: string }[]) {
      readsByMatch.set(r.match_id, r.last_read_at);
    }

    const peerReadsByMatch = new Map<string, string>();
    if (peerReads.error) {
      // Expected on a database without 06_messaging.sql; "Seen" simply
      // doesn't render. Not worth an error banner.
      console.warn("getMatches: match_peer_reads unavailable", peerReads.error.message);
    } else {
      for (const r of (peerReads.data || []) as {
        match_id: string;
        peer_last_read_at: string;
      }[]) {
        peerReadsByMatch.set(r.match_id, r.peer_last_read_at);
      }
    }

    const enriched: MatchWithPost[] = [];
    for (const { match, otherUserId } of partials) {
      const slots = [match.post1_id, match.post2_id].filter((id): id is string => !!id);
      const posts = slots.map((id) => postsMap.get(id)).filter((p): p is CollabPost => !!p);
      let otherPost: CollabPost | null = posts.find((p) => p.owner_id === otherUserId) ?? null;
      const myPost = posts.find((p) => p.owner_id === userId) ?? null;
      // A swipe match always had a project of theirs; if it can't be found it
      // was deleted. Keep the thread, labelled as such.
      const otherPostId =
        (match.origin ?? "swipe") === "swipe" ? slots.find((id) => !postsMap.has(id)) : undefined;
      if (!otherPost && otherPostId) {
        // The counterpart post is gone (owner deleted it) but the match itself
        // is still valid — don't drop it from the list. Dropping it here used
        // to make previously-open chats vanish entirely (and spin forever if
        // the user was already viewing them). Show a "removed" placeholder
        // instead so chat/messages screens still have a post to render.
        console.warn(
          `getMatches: post ${otherPostId} for match ${match.id} not found (likely deleted); using placeholder`
        );
        otherPost = {
          id: otherPostId,
          owner_id: otherUserId,
          title: "This listing was removed",
          description: null,
          looking_for: null,
          location: null,
          compensation: null,
          media_urls: null,
          is_active: false,
          created_at: match.created_at,
        };
      }
      enriched.push({
        ...match,
        other_user_id: otherUserId,
        other_post: otherPost,
        context: conversationContext(match, otherPost, myPost),
        other_creator: creators.get(otherUserId) || UNKNOWN_CREATOR,
        last_message: latestByMatch.get(match.id) || null,
        last_read_at: readsByMatch.get(match.id) || null,
        peer_last_read_at: peerReadsByMatch.get(match.id) || null,
      });
    }

    return { data: enriched, error: null };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

function conversationContext(
  match: Match,
  theirPost: CollabPost | null,
  myPost: CollabPost | null
): string {
  switch (match.origin ?? "swipe") {
    case "swipe":
      return theirPost?.title ?? myPost?.title ?? "Matched";
    case "project":
      return theirPost?.title ?? myPost?.title ?? "About a project";
    // These used to return one constant per origin, and the Messages screen
    // groups by exactly this string, so every profile reach-out collapsed
    // under a single header reading "Direct message" with a count. Three
    // unrelated one-to-one threads were presented as three threads about one
    // project, which is the precise confusion the grouping exists to prevent.
    // A per-thread subject keeps each one its own row.
    case "event":
      return theirPost?.title ?? "An event";
    case "story":
      return theirPost?.title ?? "Their work";
    default:
      return "";
  }
}

export function isMatchUnread(match: MatchWithPost, userId: string): boolean {
  if (!match.last_message) return false;
  if (match.last_message.sender_id === userId) return false;
  if (!match.last_read_at) return true;
  return match.last_message.created_at > match.last_read_at;
}

/**
 * True when the last message is one you sent AND the other person has opened
 * the thread since. False covers both "sent, not read yet" and "we can't tell"
 * (no receipt data), so callers should render this as a positive "Seen" only.
 */
export function isLastMessageSeen(match: MatchWithPost, userId: string): boolean {
  if (!match.last_message) return false;
  if (match.last_message.sender_id !== userId) return false;
  if (!match.peer_last_read_at) return false;
  return match.peer_last_read_at >= match.last_message.created_at;
}

export async function unmatch(matchId: string): Promise<{ error: string | null }> {
  try {
    const { data, error } = await supabase.rpc("unmatch", { p_match_id: matchId });
    if (error) return { error: error.message };
    if (data === false) return { error: "That match no longer exists." };
    return { error: null };
  } catch (err) {
    return { error: errMsg(err) };
  }
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
    // Use the mark_match_read RPC so last_read_at is stamped by the DB
    // server clock (now()), matching how messages.created_at is stamped.
    // A client-supplied timestamp here would be compared against a
    // server-supplied one in isMatchUnread, which can misreport read
    // state under client/server clock skew.
    const { error } = await supabase.rpc("mark_match_read", { p_match_id: matchId });
    if (error) {
      // Fall back to the client-timestamped upsert so read state still
      // updates (best-effort) if the RPC is unavailable for any reason.
      console.error("markMatchRead: RPC failed, falling back to client timestamp", error.message);
      await supabase.from("match_reads").upsert(
        { match_id: matchId, user_id: userId, last_read_at: new Date().toISOString() },
        { onConflict: "match_id,user_id" }
      );
    }
  } catch (err) {
    console.error("markMatchRead: failed", errMsg(err));
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
    looking_for_is_public?: boolean;
    skills?: string[];
    avatar_url?: string;
    portfolio_urls?: string[];
    vibes?: string[];
    instagram_url?: string | null;
    linkedin_url?: string | null;
    reel_url?: string | null;
  }
): Promise<{ error: string | null }> {
  try {
    let { error } = await supabase.from("profiles").update(updates).eq("user_id", userId);
    if (error && "reel_url" in updates && isMissingProjectColumns(error.message)) {
      const { reel_url: _dropped, ...rest } = updates;
      ({ error } = await supabase.from("profiles").update(rest).eq("user_id", userId));
      if (!error) return { error: "Saved. Reel links need the latest database update (08_projects.sql)." };
    }
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

export type ReportKind = "user" | "post" | "message" | "event_message";

export async function submitReport(
  reporterId: string,
  targetKind: ReportKind,
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
    // storage.objects is not part of the auth.users FK graph, so the
    // delete_account RPC's cascading delete never touches uploaded media —
    // it would otherwise stay in the (public) bucket and remain publicly
    // downloadable forever after "deletion". Remove it here, while the
    // session is still authenticated and RLS still permits it ("Users can
    // delete their own media" requires auth.uid() = folder[2]), via the
    // Storage API — this is the only path that actually purges the
    // underlying blob (a raw SQL DELETE on storage.objects only removes
    // the metadata row and is blocked outright on this project by
    // storage.protect_delete()). Best-effort: log loudly on failure
    // instead of silently leaving media orphaned, but don't block the
    // account deletion itself on a storage hiccup.
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (userId) {
      for (const folder of ["avatars", "posts"] as const) {
        const { data: files, error: listError } = await supabase.storage
          .from("media")
          .list(`${folder}/${userId}`, { limit: 1000 });
        if (listError) {
          console.error(`deleteAccount: failed to list ${folder}/${userId}`, listError.message);
          continue;
        }
        if (!files?.length) continue;
        const paths = files.map((f) => `${folder}/${userId}/${f.name}`);
        const { error: removeError } = await supabase.storage.from("media").remove(paths);
        if (removeError) {
          console.error(`deleteAccount: failed to remove ${folder}/${userId} media`, removeError.message);
        }
      }
    }

    const { error } = await supabase.rpc("delete_account");
    if (error) return { error: error.message };
    await supabase.auth.signOut();
    return { error: null };
  } catch (err) {
    return { error: errMsg(err) };
  }
}

// ============================================================
// Credits
// ============================================================

/**
 * Work this person has delivered with someone, through Melange.
 *
 * A credit needs a review on the match: that is the schema's only "we actually
 * worked together" signal (08_projects.sql). Matching is not working together,
 * so a match nobody has reviewed is not a credit — it is a conversation, and it
 * is already on Matches. Inventing credits from bare matches is what put an
 * open call into Work and left the same project listed twice on the profile.
 *
 * The project is resolved by owner, not by position: `create_match` stores
 * post1_id/post2_id ordered by user id, so matches.postN_id belongs to the
 * OTHER user, and reading them positionally hands you your own post back. A
 * credit is on the project of whoever credited you, which is never your own.
 */
export async function getCredits(
  userId: string
): Promise<{ data: Credit[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("credits")
      .select("match_id,post_id,title,credited_by,created_at,project_start")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) return { data: [], error: error.message };

    const rows = (data || []) as {
      match_id: string;
      post_id: string | null;
      title: string;
      credited_by: string;
      created_at: string;
      project_start: string | null;
    }[];
    if (!rows.length) return { data: [], error: null };

    const [names, projects] = await Promise.all([
      fetchCreators([...new Set(rows.map((r) => r.credited_by))]),
      creditProjects(rows.map((r) => r.match_id)),
    ]);

    const out = rows.flatMap((r) => {
      const project = projects.get(r.match_id)?.get(r.credited_by);
      /* No fallback to the view's own post_id/title: those are your post, so
         falling back is how the duplicate comes back. An unresolved project
         is not work you can show. */
      if (!project) return [];
      return [
        {
          match_id: r.match_id,
          post_id: project.id,
          title: project.title,
          image: project.media_urls?.[0] ?? null,
          with_name: names.get(r.credited_by)?.name ?? "Someone",
          date: project.project_start ?? r.project_start ?? r.created_at,
        },
      ];
    });
    return { data: out, error: null };
  } catch (err) {
    return { data: [], error: errMsg(err) };
  }
}

/**
 * For each match, its posts keyed by owner — so a credit can ask for the
 * project belonging to the person who credited you. Selects media, which is
 * why a credit row can show its photograph instead of a placeholder glyph.
 */
async function creditProjects(
  matchIds: string[]
): Promise<Map<string, Map<string, CollabPost>>> {
  const out = new Map<string, Map<string, CollabPost>>();
  if (!matchIds.length) return out;

  const { data: matches, error } = await supabase
    .from("matches")
    .select("id,post1_id,post2_id")
    .in("id", [...new Set(matchIds)]);
  if (error || !matches?.length) {
    if (error) console.error("getCredits: match lookup failed", error.message);
    return out;
  }

  const rows = matches as { id: string; post1_id: string | null; post2_id: string | null }[];
  const postIds = [
    ...new Set(rows.flatMap((m) => [m.post1_id, m.post2_id]).filter((id): id is string => !!id)),
  ];
  const { data: posts, error: postsError } = await supabase
    .from("collab_posts")
    .select("*")
    .in("id", postIds);
  if (postsError) {
    console.error("getCredits: project lookup failed", postsError.message);
    return out;
  }

  const byId = new Map<string, CollabPost>(
    ((posts || []) as CollabPost[]).map((p) => [p.id, p])
  );
  for (const m of rows) {
    const byOwner = new Map<string, CollabPost>();
    for (const id of [m.post1_id, m.post2_id]) {
      const post = id ? byId.get(id) : undefined;
      if (post) byOwner.set(post.owner_id, post);
    }
    out.set(m.id, byOwner);
  }
  return out;
}

// ============================================================
// Reaching out
// ============================================================

/** PostgREST's wording when an RPC from a newer schema file isn't applied yet. */
function isMissingFunction(message: string): boolean {
  return /could not find the function|function .* does not exist|schema cache/i.test(message);
}

/**
 * Message someone without a mutual match: from their project, profile, an
 * event or their work. Opens the thread (or reuses the one you already have)
 * and sends `message` as its first line, in one database call — see
 * start_conversation in supabase/schema/13_reach_out.sql.
 */
export async function startConversation(
  otherUserId: string,
  message: string,
  origin: Exclude<ConversationOrigin, "swipe">,
  originId?: string | null
): Promise<{ matchId: string | null; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc("start_conversation", {
      p_other: otherUserId,
      p_message: message,
      p_origin: origin,
      p_origin_id: originId ?? null,
    });
    if (error) {
      if (isMissingFunction(error.message)) {
        return {
          matchId: null,
          error: "Messaging people directly needs the latest database update (13_reach_out.sql).",
        };
      }
      return { matchId: null, error: error.message };
    }
    return { matchId: (data as string) ?? null, error: null };
  } catch (err) {
    return { matchId: null, error: errMsg(err) };
  }
}

// ============================================================
// Trust on a public profile: rating, reviews, past collabs
// ============================================================

export type PublicReview = {
  id: string;
  rating: number;
  tags: string[];
  body: string | null;
  created_at: string;
  reviewer: CreatorInfo;
};

export type PastCollab = {
  match_id: string;
  with: CreatorInfo;
  title: string | null;
  rating: number;
  date: string;
};

export type ProfileTrust = {
  avg_rating: number | null;
  review_count: number;
  reviews: PublicReview[];
  past_collabs: PastCollab[];
};

/**
 * Reviews for a public profile.
 *
 * These do NOT come straight from collab_reviews. That table's SELECT policy
 * is `reviewer_id = auth.uid() OR reviewee_id = auth.uid() OR
 * review_has_reciprocal(...)`, so the first branch hands you back anything you
 * wrote yourself, reciprocated or not. Trusting RLS here meant that if you
 * reviewed someone who never reviewed you back, you saw your own review
 * sitting on their public profile, under a header showing no stars at all,
 * because the averages come from creator_reputation which does require a
 * reciprocal row. Every reader concluded their review had been published when
 * only they could see it.
 *
 * public_reviews() applies the mutual-reveal rule itself, so what is listed
 * always matches the rating above it. Past collabs come from public_credits
 * (13_reach_out.sql); both are empty on a database without that migration.
 */
export async function getProfileTrust(
  userId: string
): Promise<{ data: ProfileTrust; error: string | null }> {
  const empty: ProfileTrust = { avg_rating: null, review_count: 0, reviews: [], past_collabs: [] };
  try {
    const [reviewsRes, creditsRes, rep] = await Promise.all([
      supabase.rpc("public_reviews", { p_user_id: userId, p_limit: 20 }),
      supabase.rpc("public_credits", { p_user_id: userId }),
      getReputationForUsers([userId]),
    ]);
    if (creditsRes.error && !isMissingFunction(creditsRes.error.message)) {
      console.warn("getProfileTrust: public_credits failed", creditsRes.error.message);
    }

    const reviewRows = (reviewsRes.data || []) as {
      id: string;
      reviewer_id: string;
      rating: number;
      tags: string[] | null;
      body: string | null;
      created_at: string;
    }[];
    const creditRows = (creditsRes.error ? [] : creditsRes.data || []) as {
      match_id: string;
      with_user_id: string;
      title: string | null;
      rating: number;
      happened_on: string;
    }[];

    const people = await fetchCreators([
      ...new Set([...reviewRows.map((r) => r.reviewer_id), ...creditRows.map((c) => c.with_user_id)]),
    ]);
    const someone = (id: string): CreatorInfo => people.get(id) ?? { ...UNKNOWN_CREATOR, user_id: id };
    const r = rep.get(userId);

    return {
      data: {
        avg_rating: r?.avg_rating ?? null,
        review_count: r?.review_count ?? 0,
        // Only the mutually revealed ones carry a rating anyone may see; the
        // RLS policy also lets you read reviews written about you, which the
        // owner never sees here (their own id opens the Profile tab).
        reviews: reviewRows.map((row) => ({
          id: row.id,
          rating: row.rating,
          tags: row.tags ?? [],
          body: row.body,
          created_at: row.created_at,
          reviewer: someone(row.reviewer_id),
        })),
        past_collabs: creditRows.map((c) => ({
          match_id: c.match_id,
          with: someone(c.with_user_id),
          title: c.title,
          rating: c.rating,
          date: c.happened_on,
        })),
      },
      error: reviewsRes.error?.message ?? null,
    };
  } catch (err) {
    return { data: empty, error: errMsg(err) };
  }
}
