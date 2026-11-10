import { supabase } from "./supabase";

/**
 * Hand-picked matches ("intros"), 29_intro_matches.sql.
 *
 * An admin pairs people from a school's Google Form and only marks a match
 * sent after telling both people. my_intros() returns your own SENT ones and
 * nothing else: never drafts, never anyone else's, never a phone number or
 * email. It finds yours by your account, or by your confirmed sign-up email
 * matching the email you used on the form.
 */
export type Intro = {
  intro_id: string;
  sent_at: string | null;
  note: string;
  /** Null until they have a (confirmed) Melange account. */
  other_user_id: string | null;
  other_name: string;
  other_makes: string[];
  other_role: string | null;
  other_idea: string | null;
  other_avatar: string | null;
  /** Codes from "Who are you looking for?" on the form. */
  other_looking_for: string[];
  other_looking_for_note: string | null;
};

/** Same labels as the form's tick boxes (app/lib/applicantForm.ts). */
const LOOKING_FOR_LABEL: Record<string, string> = {
  model: "Model",
  photographer: "Photographer",
  videographer_editor: "Videographer or editor",
  illustrator_artist: "Illustrator or artist",
  writer_poet: "Writer or poet",
  musician_producer: "Musician or producer",
  actor_performer: "Actor or performer",
  designer: "Designer",
  other: "Other",
};

export function lookingForText(codes: string[] | null | undefined): string | null {
  const labels = (codes ?? []).map((c) => LOOKING_FOR_LABEL[c] ?? c);
  return labels.length ? labels.join(", ") : null;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Unknown error";
}

/** Before 29_intro_matches.sql: nobody has matches yet, which is not an error. */
function isMissing(message: string): boolean {
  return /(my_intros|claim_intro_nudge)/i.test(message) &&
    /(does not exist|schema cache|could not find)/i.test(message);
}

export async function getMyIntros(): Promise<{ data: Intro[]; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc("my_intros");
    if (error) return { data: [], error: isMissing(error.message) ? null : error.message };
    return { data: (data || []) as Intro[], error: null };
  } catch (err) {
    return { data: [], error: errMsg(err) };
  }
}

/** True exactly once per person: the first time they open a match. */
export async function claimIntroNudge(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("claim_intro_nudge");
    return !error && data === true;
  } catch {
    return false;
  }
}

/** "film, photo and music", or their role for an existing Melange user. */
export function introMakes(intro: Pick<Intro, "other_makes" | "other_role">): string | null {
  const m = intro.other_makes.filter(Boolean);
  if (m.length === 1) return m[0];
  if (m.length > 1) return `${m.slice(0, -1).join(", ")} and ${m[m.length - 1]}`;
  return intro.other_role?.trim() || null;
}

// ============================================================
// Your own form answers, to start your profile and first post
// ============================================================

export type MyApplicant = {
  name: string;
  school: string | null;
  instagram: string | null;
  makes: string[];
  looking_for: string[];
  looking_for_note: string | null;
  intent: "idea" | "join" | "both" | null;
  idea: string | null;
  time_available: "weekend" | "few_weeks" | "ongoing" | null;
  work_link: string | null;
  setup_done: boolean;
};

/**
 * Your form answers, if your confirmed sign-up email matches a form response
 * (29_intro_matches.sql, my_applicant). Null when there's no form, or before
 * that database change is applied.
 */
export async function getMyApplicant(): Promise<MyApplicant | null> {
  try {
    const { data, error } = await supabase.rpc("my_applicant");
    if (error) return null;
    const rows = (data || []) as MyApplicant[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function finishApplicantSetup(): Promise<void> {
  try {
    await supabase.rpc("finish_applicant_setup");
  } catch {
    // Worst case the offer shows again next launch.
  }
}

/** The form's "What do you make?" -> the app's role vocabulary (ROLES in db.ts). */
const MAKE_TO_ROLE: Record<string, string> = {
  film: "Videographer",
  photo: "Photographer",
  writing: "Writer",
  music: "Musician",
  art: "Illustrator",
  design: "Designer",
};

/** The form's "Who are you looking for?" -> project roles. */
const LOOKING_TO_ROLES: Record<string, string[]> = {
  model: ["Model"],
  photographer: ["Photographer"],
  videographer_editor: ["Videographer", "Editor"],
  illustrator_artist: ["Illustrator"],
  writer_poet: ["Writer"],
  musician_producer: ["Musician", "Producer"],
  actor_performer: ["Actor"],
  designer: ["Designer"],
  other: ["Other"],
};

/** Starting values for the profile. Nothing is saved until they tap Save. */
export function profileFromForm(a: MyApplicant) {
  const role = a.makes.map((m) => MAKE_TO_ROLE[m]).find(Boolean) ?? "";
  const wants = [lookingForText(a.looking_for), a.looking_for_note?.trim()].filter(Boolean).join(". ");
  return {
    name: a.name,
    role,
    lookingFor: wants,
    instagram: a.instagram ?? "",
    link: a.work_link ?? "",
  };
}

/** Starting values for their first post. Nothing is posted until they confirm. */
export function postFromForm(a: MyApplicant): { title: string; description: string; roles: string[] } {
  const roles = [...new Set(a.looking_for.flatMap((c) => LOOKING_TO_ROLES[c] ?? []))];
  const idea = a.idea?.trim() ?? "";
  // The first sentence of their idea, or something honest if they want to join.
  // (No lookbehind: not every JS engine the app runs on supports it.)
  const firstLine = idea.split(/[.!?]\s+|\n/)[0]?.trim() ?? "";
  const title =
    firstLine && firstLine.length <= 70
      ? firstLine.replace(/[.!]$/, "")
      : firstLine
        ? `${firstLine.slice(0, 67).trimEnd()}…`
        : a.intent === "join"
          ? "Looking to join a project"
          : "New project";
  const description = [idea, a.looking_for_note?.trim()].filter(Boolean).join("\n\n");
  return { title, description, roles };
}
