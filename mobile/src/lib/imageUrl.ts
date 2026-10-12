import { PixelRatio } from "react-native";

/** Unsplash stops serving above this; asking for more just wastes the request. */
const MAX_EDGE = 4000;

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
 * Only Unsplash URLs are rewritten. User uploads living in Supabase storage
 * have no such API and are returned untouched.
 */
export function sized(uri: string | undefined, widthPt: number, heightPt: number): string | undefined {
  if (!uri || !uri.includes("images.unsplash.com")) return uri;
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
