import { supabase } from "./supabase";
import { uploadImageTo, type UploadProgress } from "./db";

/**
 * The night roll: photos from one night, private to its members
 * (25_web_rsvp_and_night_photos.sql).
 *
 * Objects live in the private `night-photos` bucket at
 * <event_id>/<uploader_id>/<file>. Storage RLS reads the first folder to
 * decide who can see a photo and the second to decide who can add or delete
 * it, and event_photos has a CHECK that its path agrees, so the path is not a
 * detail: get it wrong and both the upload and the row are refused.
 *
 * There are no public URLs here. Every image is a signed URL, made in one
 * batch per load, that expires after an hour.
 */

const BUCKET = "night-photos";
/** How long a signed URL lives. */
const SIGN_SECONDS = 3600;
/**
 * Reuse a signed URL while it has at least this long left. The night page
 * reloads on every focus, and a fresh URL each time would refetch every
 * image; ten minutes is longer than anyone keeps the viewer open.
 */
const REUSE_MARGIN_MS = 10 * 60_000;

export type TaggedPerson = { user_id: string; name: string };

export type NightPhoto = {
  id: string;
  path: string;
  caption: string | null;
  uploader_id: string;
  uploader_name: string | null;
  created_at: string;
  tagged: TaggedPerson[];
  includes_me: boolean;
  /** Signed URL, or null if signing failed for this one. */
  url: string | null;
};

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

const signed = new Map<string, { url: string; expires: number }>();

/**
 * Signed URLs for these paths, in one request for whatever isn't cached.
 * A path that fails to sign maps to nothing; the tile shows empty rather
 * than the whole roll failing.
 */
async function signPaths(paths: string[]): Promise<{ urls: Map<string, string>; error: string | null }> {
  const now = Date.now();
  const urls = new Map<string, string>();
  const need: string[] = [];
  for (const p of paths) {
    const hit = signed.get(p);
    if (hit && hit.expires - now > REUSE_MARGIN_MS) urls.set(p, hit.url);
    else need.push(p);
  }
  if (!need.length) return { urls, error: null };
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(need, SIGN_SECONDS);
  if (error) return { urls, error: error.message };
  const expires = now + SIGN_SECONDS * 1000;
  for (const row of data ?? []) {
    if (row.error || !row.signedUrl || !row.path) continue;
    signed.set(row.path, { url: row.signedUrl, expires });
    urls.set(row.path, row.signedUrl);
  }
  return { urls, error: null };
}

/** The roll, newest first, with signed URLs. Empty unless I'm a member. */
export async function getNightRoll(eventId: string): Promise<{ data: NightPhoto[]; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc("night_roll", { p_event: eventId });
    if (error) return { data: [], error: error.message };
    const rows = (data ?? []) as Omit<NightPhoto, "url">[];
    if (!rows.length) return { data: [], error: null };
    const { urls, error: signErr } = await signPaths(rows.map((r) => r.path));
    return {
      data: rows.map((r) => ({
        ...r,
        tagged: Array.isArray(r.tagged) ? r.tagged : [],
        includes_me: r.includes_me === true,
        url: urls.get(r.path) ?? null,
      })),
      error: signErr,
    };
  } catch (err) {
    return { data: [], error: errMsg(err) };
  }
}

/**
 * A random v4-shaped id for an object name. Hermes has no crypto.randomUUID,
 * and this only has to not collide within one person's folder for one
 * night; event_photos.path is UNIQUE, so a collision would fail loudly
 * rather than overwrite (uploads here never upsert).
 */
function objectId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export type PickedPhoto = { uri: string; width?: number; height?: number };

export type AddProgress = {
  /** 1-based photo in flight. */
  index: number;
  total: number;
  /** 0 to 1 for that photo. */
  fraction: number;
};

/**
 * Upload each photo to <event>/<me>/<id>.jpg, then add its row to the roll.
 *
 * One at a time, and a failure doesn't stop the rest: someone adding twelve
 * photos from a night shouldn't lose eleven to one bad connection moment.
 * Returns which ones failed (1-based, in the order picked) and why.
 */
export async function addNightPhotos(
  eventId: string,
  userId: string,
  photos: PickedPhoto[],
  onProgress?: (p: AddProgress) => void
): Promise<{ added: number; failed: { index: number; error: string }[] }> {
  const failed: { index: number; error: string }[] = [];
  let added = 0;
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const index = i + 1;
    const total = photos.length;
    onProgress?.({ index, total, fraction: 0 });
    const path = `${eventId}/${userId}/${objectId()}.jpg`;
    const up = await uploadImageTo(BUCKET, path, photo.uri, {
      width: photo.width,
      height: photo.height,
      upsert: false,
      onProgress: (p: UploadProgress) => onProgress?.({ index, total, fraction: p.fraction }),
    });
    if (up.error) {
      failed.push({ index, error: up.error });
      continue;
    }
    try {
      const { error } = await supabase
        .from("event_photos")
        .insert({ event_id: eventId, uploader_id: userId, path });
      if (error) {
        failed.push({ index, error: error.message });
        // The object is unreachable without a row (night_roll lists rows),
        // so take it back out rather than leave it taking up space.
        const { error: rmErr } = await supabase.storage.from(BUCKET).remove([path]);
        if (rmErr) console.warn("night photo cleanup failed", path, rmErr.message);
        continue;
      }
    } catch (err) {
      failed.push({ index, error: errMsg(err) });
      continue;
    }
    added += 1;
  }
  return { added, failed };
}

/** Tag someone from the night. The server checks both of you were there. */
export async function tagNightPhoto(photoId: string, userId: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.rpc("tag_night_photo", { p_photo: photoId, p_user: userId });
    return { error: error ? error.message : null };
  } catch (err) {
    return { error: errMsg(err) };
  }
}

/**
 * Take my own tag off a photo. RLS allows it; a delete RLS stops matches
 * zero rows without an error, so count what went.
 */
export async function removeMyTag(photoId: string, userId: string): Promise<{ error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("event_photo_tags")
      .delete()
      .eq("photo_id", photoId)
      .eq("user_id", userId)
      .select("photo_id");
    if (error) return { error: error.message };
    if (!data?.length) return { error: "That tag was already gone." };
    return { error: null };
  } catch (err) {
    return { error: errMsg(err) };
  }
}

/**
 * Delete one of my photos: the row first, so it leaves the roll for
 * everyone even if the file delete then fails; then the file. A file left
 * behind is unreachable (nothing lists it), so that failure is logged, not
 * shown.
 */
export async function deleteNightPhoto(photo: Pick<NightPhoto, "id" | "path">): Promise<{ error: string | null }> {
  try {
    const { data, error } = await supabase.from("event_photos").delete().eq("id", photo.id).select("id");
    if (error) return { error: error.message };
    if (!data?.length) return { error: "Only the person who added it can delete it." };
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove([photo.path]);
    if (rmErr) console.warn("night photo file delete failed", photo.path, rmErr.message);
    signed.delete(photo.path);
    return { error: null };
  } catch (err) {
    return { error: errMsg(err) };
  }
}
