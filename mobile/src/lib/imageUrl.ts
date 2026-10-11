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
 * Unsplash will crop and resample server-side to any aspect we ask for, at
 * full density, so we ask — in device pixels, not points.
 *
 * Only Unsplash URLs are rewritten. User uploads living in Supabase storage
 * have no such API and are returned untouched.
 */
export function sized(uri: string | undefined, widthPt: number, heightPt: number): string | undefined {
  if (!uri || !uri.includes("images.unsplash.com")) return uri;
  const scale = PixelRatio.get();
  const w = Math.min(MAX_EDGE, Math.round(widthPt * scale));
  const h = Math.min(MAX_EDGE, Math.round(heightPt * scale));
  if (w <= 0 || h <= 0) return uri;
  try {
    const u = new URL(uri);
    u.searchParams.set("w", String(w));
    u.searchParams.set("h", String(h));
    u.searchParams.set("fit", "crop");
    // Pick the crop by content, not by geometry. These are landscape frames
    // with shallow depth of field and the subject off to one side; a portrait
    // window taken from the middle lands squarely on the bokeh, which is why
    // the hero looked out of focus even at full density. Faces first, then
    // entropy, which is what actually finds the sharp region in a street
    // frame where no face is detected.
    u.searchParams.set("crop", "faces,entropy");
    u.searchParams.set("auto", "format");
    u.searchParams.set("q", "80");
    return u.toString();
  } catch {
    return uri;
  }
}
