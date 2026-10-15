import { PixelRatio } from "react-native";

/** Unsplash stops serving above this; asking for more just wastes the request. */
const MAX_EDGE = 4000;

/**
 * True for a Supabase Storage public-object URL, which we cannot resize.
 *
 * Supabase does publish a transform endpoint that would be exactly what this
 * module wants:
 *
 *   /storage/v1/render/image/public/<bucket>/<path>?width=&height=&resize=cover&quality=
 *
 * It is not available on this project. Measured 2026-10-14 against production
 * (project thkwuhxsattnmsdfozzq), on both an avatar and a post photo:
 *
 *   GET /storage/v1/object/public/media/avatars/<id>/1787710410177.jpg
 *     -> 200, image/jpeg, 3,894,468 bytes
 *   GET /storage/v1/render/image/public/media/avatars/<id>/1787710410177.jpg
 *       ?width=256&height=256&resize=cover&quality=80
 *     -> 403 {"error":"FeatureNotEnabled",
 *             "message":"feature not enabled for this tenant"}
 *
 * Image Transformations are a paid Storage add-on and this tenant does not
 * have it. Rewriting these URLs would turn every working 200 into a hard 403,
 * i.e. trade a slow avatar for no avatar at all, so we return the original.
 *
 * What that costs today, measured over every storage object currently
 * referenced in production (4 avatars, 5 post photos): avatars 0.81-3.71 MB
 * each, post photos 0.11-2.24 MB each. The 3.71 MB avatar is a straight
 * 4032x3024 camera frame — 12.2 MP downloaded and decoded to paint a 44x44pt
 * row thumb, i.e. 132x132px at 3x, about 700x the pixels we draw.
 *
 * Two ways out, neither of which lives in this file:
 *   1. Buy the Storage transformation add-on. Then delete this function and
 *      rewrite these URLs through /render/image/public with the same
 *      PixelRatio maths the Unsplash branch already uses.
 *   2. Write a second, smaller object at upload time (uploadFile in
 *      src/lib/db.ts — e.g. `<ts>_sm.jpg` at 512px next to the original) and
 *      have sized() swap in the `_sm` suffix when the requested edge is
 *      small. No add-on, but it only helps images uploaded after the change.
 */
function storageIsUntransformable(uri: string): boolean {
  return uri.includes("/storage/v1/object/public/");
}

/**
 * Ask the image host for the pixels we are actually going to draw.
 *
 * The seeded photographs are landscape — 1200x796 is typical — and the
 * Discover poster is a full-screen portrait frame. `contentFit: "cover"`
 * therefore scales to match the *height*, which on a Pro Max is a 3.6x
 * upscale of a 796px source. That is why the hero read as mush while the same
 * photograph looked sharp in the story gallery, where the frame is 400pt tall
 * and the scale factor is about 1.1.
 *
 * No amount of layout tuning fixes a 3.6x upscale; the pixels are not there.
 * Unsplash will crop and resample server-side at full density, so we ask.
 *
 * What we must NOT do is pick the crop window ourselves. A stored URL that
 * already carries `crop=` with explicit `w`/`h` has been composed deliberately
 * — the seed data serves 3:4 framed on the subject. Overwriting those with the
 * card's own aspect re-crops from the landscape master at whatever shape the
 * frame happens to be: on a Pro Max poster that is 0.54, a slice so tall and
 * narrow that imgix's entropy fallback locks onto the busiest region rather
 * than the subject. The photographer ended up at the right edge, half out of
 * frame, behind an in-focus market stall.
 *
 * So: when a URL is already composed, keep its aspect and raise only the
 * density, enough to cover the frame. The final trim to the frame's shape is
 * `contentFit: "cover"`'s job, and a centre trim of a subject-centred 3:4 is
 * safe. Uncomposed URLs keep the old behaviour and are cropped by content.
 *
 * Only Unsplash URLs are rewritten. Supabase-hosted uploads are returned
 * untouched on purpose — see storageIsUntransformable() above.
 */
export function sized(uri: string | undefined, widthPt: number, heightPt: number): string | undefined {
  if (!uri) return uri;
  // Supabase storage: deliberately a no-op, not an oversight. Checked first so
  // the reason is attached to the URLs it applies to rather than buried in a
  // catch-all `!includes("unsplash")` early return.
  if (storageIsUntransformable(uri)) return uri;
  if (!uri.includes("images.unsplash.com")) return uri;
  const scale = PixelRatio.get();
  const frameW = Math.round(widthPt * scale);
  const frameH = Math.round(heightPt * scale);
  if (frameW <= 0 || frameH <= 0) return uri;

  try {
    const u = new URL(uri);
    const storedW = Number(u.searchParams.get("w"));
    const storedH = Number(u.searchParams.get("h"));
    const composed = u.searchParams.has("crop") && storedW > 0 && storedH > 0;

    let w: number;
    let h: number;

    if (composed) {
      // Keep the composition, cover the frame: scale on whichever axis is
      // short, so neither dimension lands under the frame and nothing is
      // upscaled by the device.
      const aspect = storedW / storedH;
      h = Math.max(frameH, Math.round(frameW / aspect));
      w = Math.round(h * aspect);
    } else {
      // Nothing composed this one, so the frame's shape is as good a guess as
      // any. Pick the window by content: these are shallow-depth-of-field
      // frames with the subject off to one side, and a geometric centre crop
      // lands on the bokeh. Faces first, then entropy for frames with none.
      w = frameW;
      h = frameH;
      u.searchParams.set("crop", "faces,entropy");
    }

    // Clamp on the long edge, preserving aspect — clamping axes independently
    // would silently change the shape we just worked to keep.
    const over = Math.max(w / MAX_EDGE, h / MAX_EDGE, 1);
    w = Math.round(w / over);
    h = Math.round(h / over);

    u.searchParams.set("w", String(w));
    u.searchParams.set("h", String(h));
    u.searchParams.set("fit", "crop");
    u.searchParams.set("auto", "format");
    u.searchParams.set("q", "80");
    return u.toString();
  } catch {
    return uri;
  }
}
