import { supabase } from "./supabase";

/**
 * Scenes, invites, handles and the waitlist (23_scenes_invites_nights.sql).
 *
 * Melange is invite-only and starts in scenes. Every call here awaits the
 * request and returns its error: an RPC builder that is never awaited never
 * sends, and a screen that reports success off one is the defect this app
 * keeps shipping.
 */

export type Scene = "usc" | "ucsd" | "la" | "nyc";

export const SCENES: { id: Scene; label: string }[] = [
  { id: "usc", label: "USC" },
  { id: "ucsd", label: "UCSD" },
  { id: "la", label: "LA" },
  { id: "nyc", label: "NYC" },
];

export function sceneLabel(scene: string | null | undefined): string | null {
  if (!scene) return null;
  return SCENES.find((s) => s.id === scene)?.label ?? null;
}

export function isScene(v: unknown): v is Scene {
  return typeof v === "string" && SCENES.some((s) => s.id === v);
}

export const JOIN_URL = "https://melange-psi.vercel.app/join";

/** The one line people paste into a group chat. Wording is the spec's. */
export function inviteShareMessage(code: string): string {
  return `Come join me on Melange — invite code ${code} ${JOIN_URL}?code=${encodeURIComponent(code)}`;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

/** Whether I'm in. `null` means we couldn't find out, which is not "no". */
export async function isMember(): Promise<{ member: boolean | null; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc("is_member");
    if (error) return { member: null, error: error.message };
    return { member: data === true, error: null };
  } catch (err) {
    return { member: null, error: errMsg(err) };
  }
}

export type RedeemResult = {
  ok: boolean;
  scene: Scene | null;
  founding: boolean;
  alreadyMember: boolean;
};

export async function redeemInvite(
  code: string
): Promise<{ data: RedeemResult | null; error: string | null }> {
  const c = code.trim();
  if (!c) return { data: null, error: "Enter the code your friend sent." };
  try {
    const { data, error } = await supabase.rpc("redeem_invite", { p_code: c });
    if (error) return { data: null, error: error.message };
    const r = (data ?? {}) as Record<string, unknown>;
    // A reply without ok:true is not a success, however it got here.
    if (r.ok !== true) return { data: null, error: "That code didn't go through. Try again." };
    return {
      data: {
        ok: true,
        scene: isScene(r.scene) ? r.scene : null,
        founding: r.founding === true,
        alreadyMember: r.already_member === true,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

export async function setScene(scene: Scene | null): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.rpc("set_scene", { p_scene: scene });
    return { error: error?.message ?? null };
  } catch (err) {
    return { error: errMsg(err) };
  }
}

/** Claim, change or (with "") clear the handle. Resolves to what the server stored. */
export async function setHandle(
  handle: string
): Promise<{ handle: string | null; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc("set_handle", { p_handle: handle });
    if (error) return { handle: null, error: error.message };
    return { handle: (data as string | null) ?? null, error: null };
  } catch (err) {
    return { handle: null, error: errMsg(err) };
  }
}

export type InviteCode = { code: string; used: boolean };

export async function getMyInviteCodes(): Promise<{ data: InviteCode[]; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc("my_invite_codes");
    if (error) return { data: [], error: error.message };
    return {
      data: ((data ?? []) as { code: string; used: boolean }[]).map((r) => ({
        code: r.code,
        used: r.used === true,
      })),
      error: null,
    };
  } catch (err) {
    return { data: [], error: errMsg(err) };
  }
}

export type WaitlistEntry = {
  email: string;
  name?: string | null;
  scene: Scene | "other" | null;
  instagram?: string | null;
  whatYouMake?: string | null;
};

/**
 * Join the waitlist. Already being on it counts as success: the unique index
 * on lower(email) is the server saying "we have you", not a failure to show.
 */
export async function joinWaitlist(entry: WaitlistEntry): Promise<{ error: string | null }> {
  const email = entry.email.trim();
  if (!email) return { error: "Your account has no email on it, so we can't add you." };
  try {
    const { error } = await supabase.from("waitlist").insert({
      email,
      name: entry.name?.trim() || null,
      scene: entry.scene,
      instagram: entry.instagram?.trim() || null,
      what_you_make: entry.whatYouMake?.trim() || null,
    });
    if (error && error.code !== "23505") return { error: error.message };
    return { error: null };
  } catch (err) {
    return { error: errMsg(err) };
  }
}

/** Editors see Feature on a shoot. Any failure means "not an editor". */
export async function isAdmin(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("is_admin");
    return !error && data === true;
  } catch {
    return false;
  }
}

export type ScenePerson = {
  user_id: string;
  name: string;
  role: string | null;
  bio: string | null;
  avatar_url: string | null;
  portfolio_urls: string[];
  founding: boolean;
  scene: string | null;
  handle: string | null;
};

/**
 * People for Discover once the projects run out: members of my scene (or of
 * every scene, if I haven't picked one) with at least one photo, whom I
 * haven't hearted and who aren't blocked either way.
 *
 * I can only read blocks I made, so the other direction is asked of
 * is_blocked_pair() per candidate. The list is capped so that stays cheap.
 */
export async function getDiscoverPeople(
  userId: string,
  scene: string | null,
  limit = 30
): Promise<{ data: ScenePerson[]; error: string | null }> {
  try {
    const [hearted, blocked] = await Promise.all([
      supabase.from("hearts").select("target_id").eq("from_user", userId).eq("kind", "profile"),
      supabase.from("blocks").select("blocked_id").eq("blocker_id", userId),
    ]);
    // Without the block list we can't promise not to show someone you
    // blocked, so stop. Without the heart list we'd re-show people you
    // hearted, and a tap on them would take the heart back; stop too.
    const firstErr = blocked.error || hearted.error;
    if (firstErr) return { data: [], error: firstErr.message };
    const skip = new Set<string>([
      userId,
      ...(hearted.data ?? []).map((h) => h.target_id as string),
      ...(blocked.data ?? []).map((b) => b.blocked_id as string),
    ]);

    let q = supabase
      .from("profiles")
      .select("user_id,name,role,bio,avatar_url,portfolio_urls,founding,scene,handle")
      .not("member_since", "is", null)
      .not("portfolio_urls", "is", null)
      .neq("portfolio_urls", "{}")
      .neq("user_id", userId);
    if (scene) q = q.eq("scene", scene);
    const { data, error } = await q
      .order("member_since", { ascending: false })
      .limit(limit + skip.size);
    if (error) return { data: [], error: error.message };

    const candidates = ((data ?? []) as Record<string, unknown>[])
      .map((p) => ({
        user_id: p.user_id as string,
        name: (p.name as string) || "Someone",
        role: (p.role as string | null) ?? null,
        bio: (p.bio as string | null) ?? null,
        avatar_url: (p.avatar_url as string | null) ?? null,
        portfolio_urls: Array.isArray(p.portfolio_urls) ? (p.portfolio_urls as string[]) : [],
        founding: p.founding === true,
        scene: (p.scene as string | null) ?? null,
        handle: (p.handle as string | null) ?? null,
      }))
      .filter((p) => !skip.has(p.user_id) && p.portfolio_urls.length > 0)
      .slice(0, limit);

    const checks = await Promise.all(
      candidates.map(async (p) => {
        const { data: b, error: e } = await supabase.rpc("is_blocked_pair", { a: userId, b: p.user_id });
        // Unknown counts as blocked: showing someone who blocked you is the
        // failure that matters here, and missing one card is not.
        return !e && b === false;
      })
    );
    return { data: candidates.filter((_, i) => checks[i]), error: null };
  } catch (err) {
    return { data: [], error: errMsg(err) };
  }
}
