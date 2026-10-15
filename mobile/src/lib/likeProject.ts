import { getMySwipes, profileGate, recordSwipe, undoSwipe, type Profile } from "./db";

/**
 * One like path for all three surfaces that can like a project.
 *
 * There are three: the Discover deck, the Browse grid's heart, and the "Like
 * this project" button on post detail. They each used to call recordSwipe
 * directly and had drifted apart in two ways that users saw:
 *
 *   1. Only the deck called profileGate. Browse and post detail let someone
 *      below the photo/role floor like freely, and when the server-side floor
 *      was briefly live (11_profile_gate.sql) those two surfaces answered with
 *      a raw row-level-security string instead of the one line Discover shows.
 *   2. swipes has UNIQUE (swiper_id, post_id) and recordSwipe is a plain
 *      INSERT, so liking a project you had already passed raised 23505.
 *      post detail discarded exactly that error and then claimed "Liked";
 *      Browse put `duplicate key value violates unique constraint
 *      "swipes_swiper_id_post_id_key"` in the error banner.
 *
 * So the gate and the write live here, together, and the surfaces only decide
 * how to say the answer.
 *
 * Why the flip is a delete-then-insert and not an upsert: the obvious fix is
 * INSERT ... ON CONFLICT DO UPDATE, but public.swipes has no UPDATE policy —
 * only SELECT and INSERT — so an upsert from the client fails with 42501, and
 * a plain UPDATE matches zero rows and reports a success that changed nothing
 * (both verified against production). undo_swipe() is SECURITY DEFINER and
 * granted to authenticated, so deleting the pass through it and writing the
 * like afterwards is the only path a client actually has. It is not atomic: if
 * the insert fails after the delete the project simply has no swipe again and
 * returns to the deck, which is recoverable and honest, unlike a stuck pass.
 */

export type LikeOutcome =
  /** The swipe row now reads 'right'. Safe to look for a match. */
  | { status: "liked" }
  /** Below the profile floor. `line` is the sentence to show, as Discover does. */
  | { status: "blocked"; line: string }
  /** Nothing was written. `message` is already fit to show a person. */
  | { status: "failed"; message: string };

export async function likeProject(args: {
  userId: string;
  postId: string;
  /** Whatever the caller has loaded; null (or no profiles row) refuses. */
  profile: Pick<Profile, "role" | "portfolio_urls"> | null;
  /** True when this surface already shows the project as passed. */
  passed: boolean;
}): Promise<LikeOutcome> {
  const { userId, postId, profile, passed } = args;

  const gate = profileGate(profile, "like");
  if (!gate.ok) return { status: "blocked", line: gate.line };

  if (passed) {
    const flipped = await clearPass(postId);
    if (flipped) return flipped;
  }

  const { error } = await recordSwipe(userId, postId, "right");
  if (!error) return { status: "liked" };

  // A duplicate here means a swipe row exists that this screen did not know
  // about — it was written on another surface, or on another device, since
  // this screen loaded. Read the row rather than guessing: claiming "Liked"
  // over somebody's unchanged pass is the bug this function exists to kill.
  if (isDuplicate(error)) {
    const { data: swipes } = await getMySwipes(userId);
    const direction = swipes.get(postId);
    if (direction === "right") return { status: "liked" };
    if (direction === "left") {
      const flipped = await clearPass(postId);
      if (flipped) return flipped;
      const retry = await recordSwipe(userId, postId, "right");
      if (!retry.error) return { status: "liked" };
      return { status: "failed", message: plainMessage(retry.error) };
    }
  }

  return { status: "failed", message: plainMessage(error) };
}

/**
 * Delete this user's pass on the project so the like can be inserted.
 * Returns an outcome only when it went wrong — null means carry on.
 */
async function clearPass(postId: string): Promise<LikeOutcome | null> {
  const { error } = await undoSwipe(postId);
  if (!error) return null;
  // undo_swipe returns false when a match already involves this project, and
  // db.ts turns that into its own sentence; either way the pass is still there,
  // so inserting the like would only raise 23505 again.
  return {
    status: "failed",
    message: "That pass is still on file, so the like didn't go through. Reopen the project and try again.",
  };
}

function isDuplicate(message: string): boolean {
  return /duplicate key|23505|already exists/i.test(message);
}

/**
 * Postgres wording is not an error message. The two failures a person can
 * actually hit here are the unique index and the profile-floor policy, and
 * both have a plain sentence; anything else keeps its detail in the log and
 * says the one true thing on screen.
 */
function plainMessage(message: string): string {
  if (isDuplicate(message)) return "You've already swiped on this project.";
  if (/row-level security|42501|permission denied|violates row/i.test(message)) {
    return "Add three photos and a role first.";
  }
  console.warn("likeProject: unexpected failure", message);
  return "That didn't go through. Check your connection and try again.";
}
