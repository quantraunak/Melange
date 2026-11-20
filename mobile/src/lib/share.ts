import { Share } from "react-native";

/** The public website; /u/<handle> is a profile anyone can open. */
export const SITE_URL = "https://melange-psi.vercel.app";

/**
 * Share a profile by text, the way events are shared: the system sheet, with
 * a link that opens on the web for people without the app.
 */
export async function shareProfile(
  p: { name: string; handle?: string | null },
  isMine: boolean
): Promise<string | null> {
  const url = p.handle ? `${SITE_URL}/u/${p.handle}` : SITE_URL;
  const first = p.name.split(" ")[0] || "them";
  const message = isMine
    ? `My Melange profile ✨ ${url}`
    : `Check out ${first} on Melange ✨ ${url}`;
  try {
    await Share.share({ message });
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Couldn't open sharing.";
  }
}

/**
 * Share a project: the system sheet with its public page, which shows the
 * project and who it needs to anyone, with or without the app.
 */
export async function shareProject(
  post: { id: string; title: string },
  ownerName: string | null,
  isMine: boolean
): Promise<string | null> {
  const url = `${SITE_URL}/p/${post.id}`;
  const first = (ownerName || "").split(" ")[0];
  const message = isMine
    ? `I'm looking for people for "${post.title}" on Melange ✨ ${url}`
    : `${first ? `${first} is` : "Someone's"} looking for people for "${post.title}" on Melange ✨ ${url}`;
  try {
    await Share.share({ message });
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Couldn't open sharing.";
  }
}
