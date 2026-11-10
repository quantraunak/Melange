/**
 * Pure helpers for the matching admin page (/internal/matches): the intro text
 * the admin copies into a text or email, and the applicants CSV export.
 * Kept out of the page so they can be tested.
 */
import { LOOKING_FOR } from "./applicantForm";
import { APP_STORE_URL } from "./site";

/** One side of an intro, as admin_list_intros returns it. */
export type IntroSide = {
  kind: "applicant" | "user";
  id: string;
  name: string;
  school: string | null;
  email: string | null;
  phone: string | null;
  contact_pref: "email" | "text" | "instagram" | null;
  instagram: string | null;
  makes: string[];
  role?: string | null;
  looking_for: string[];
  looking_for_note: string | null;
  intent: "idea" | "join" | "both" | null;
  idea: string | null;
  time_available: "weekend" | "few_weeks" | "ongoing" | null;
  work_link: string | null;
  consent: boolean;
  user_id: string | null;
};

export type Applicant = {
  id: string;
  email: string;
  name: string;
  school: string | null;
  phone: string | null;
  contact_pref: string | null;
  instagram: string | null;
  makes: string[];
  looking_for: string[];
  looking_for_note: string | null;
  intent: string | null;
  idea: string | null;
  time_available: string | null;
  work_link: string | null;
  consent: boolean;
  submitted_at: string;
  status: "new" | "matched" | "waiting";
  drafts: number;
  approved: number;
  sent: number;
  user_id: string | null;
};

/** The "What do you make?" choices, as stored. */
export const MAKES_LABEL: Record<string, string> = {
  film: "Film", photo: "Photo", writing: "Writing", music: "Music",
  art: "Art", design: "Design", other: "Other",
};

/** ["model","writer_poet"] -> "Model, Writer or poet". */
export function lookingForLabels(codes: string[]): string {
  return codes
    .map((c) => LOOKING_FOR.find((l) => l.code === c)?.label ?? c)
    .join(", ");
}

export const firstName = (name: string): string => name.trim().split(/\s+/)[0] || name;

/** "film and photo", "music, art and design". */
export function listMakes(makes: string[]): string {
  const m = makes.filter(Boolean);
  if (m.length <= 1) return m.join("");
  return `${m.slice(0, -1).join(", ")} and ${m[m.length - 1]}`;
}

function whatTheyMake(side: IntroSide): string {
  if (side.makes.length) return listMakes(side.makes);
  return side.role?.trim() ? side.role.trim().toLowerCase() : "creative work";
}

/**
 * The message the admin sends `to`, introducing `other`. Says how to see it
 * in the app: sign up (or sign in) with the same email they used on the form.
 */
export function introText(to: IntroSide, other: IntroSide, note: string): string {
  const why = note.trim() ? `\n\n${note.trim()}` : "";
  const signIn =
    to.kind === "applicant"
      ? `Download Melange and sign up with ${to.email} (the email you used on the form) to see your match and message them:`
      : "Open Melange to see your match and message them:";
  return (
    `Hi ${firstName(to.name)}! We matched you with ${other.name}, who makes ${whatTheyMake(other)}.` +
    why +
    `\n\n${signIn} ${APP_STORE_URL}`
  );
}

/** How to reach them, for the admin only. Never shown in the app. */
export function contactLines(side: IntroSide): string[] {
  if (!side.consent) return [];
  const prefer = side.contact_pref ? ` (prefers ${side.contact_pref})` : "";
  const out: string[] = [];
  if (side.email) out.push(`Email: ${side.email}`);
  if (side.phone) out.push(`Phone: ${side.phone}`);
  if (side.instagram) out.push(`Instagram: @${side.instagram.replace(/^@/, "")}`);
  if (out.length && prefer) out[0] += prefer;
  return out;
}

function csvCell(v: unknown): string {
  const s = Array.isArray(v) ? v.join("; ") : v == null ? "" : String(v);
  // Quote everything; neutralise formula injection in spreadsheet apps.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export const CSV_COLUMNS: (keyof Applicant)[] = [
  "name", "email", "school", "phone", "contact_pref", "instagram", "makes",
  "looking_for", "looking_for_note", "intent", "idea", "time_available", "work_link", "consent",
  "submitted_at", "status", "drafts", "approved", "sent",
];

export function applicantsCsv(rows: Applicant[]): string {
  const head = CSV_COLUMNS.map(csvCell).join(",");
  const body = rows.map((r) => CSV_COLUMNS.map((c) => csvCell(r[c])).join(","));
  return [head, ...body].join("\n");
}
