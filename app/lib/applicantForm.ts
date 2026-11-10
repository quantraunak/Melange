/**
 * Reading one Google Form response into an applicant row.
 *
 * The Apps Script on the response sheet (docs/MATCHING.md) posts each new
 * response as `e.namedValues`: question title -> answers. This file is the
 * one place that knows the question titles, so the form and the code can't
 * quietly disagree. Titles are matched case-insensitively and ignore a
 * trailing "?" or ":" so small edits to the form don't break the import.
 *
 * Pure: no database, no network. app/api/applicants/route.ts does the write.
 */

/** The exact question titles the form should use. Shown in docs/MATCHING.md. */
export const FORM_QUESTIONS = {
  name: "Name",
  school: "School",
  email: "Email",
  phone: "Phone",
  contactPref: "Best way to reach you",
  instagram: "Instagram",
  makes: "What do you make?",
  lookingFor: "Who are you looking for?",
  lookingForNote: "Tell us more about who you're looking for",
  intent: "Do you have an idea or want to join someone else's?",
  idea: "Your idea, or what you'd love to work on",
  time: "How much time do you have?",
  workLink: "Link to your work",
  consent: "Can we share your answers with your matches?",
  timestamp: "Timestamp",
} as const;

/** Google's own column when the form collects emails itself. */
const GOOGLE_EMAIL = "Email Address";

export const MAKES = ["film", "photo", "writing", "music", "art", "design", "other"] as const;
export type Make = (typeof MAKES)[number];

/**
 * "Who are you looking for?" — the stored code and the exact tick-box label.
 * Labels must match the form's options; anything else counts as "other".
 */
export const LOOKING_FOR = [
  { code: "model", label: "Model" },
  { code: "photographer", label: "Photographer" },
  { code: "videographer_editor", label: "Videographer or editor" },
  { code: "illustrator_artist", label: "Illustrator or artist" },
  { code: "writer_poet", label: "Writer or poet" },
  { code: "musician_producer", label: "Musician or producer" },
  { code: "actor_performer", label: "Actor or performer" },
  { code: "designer", label: "Designer" },
  { code: "other", label: "Other" },
] as const;
export type LookingFor = (typeof LOOKING_FOR)[number]["code"];

/** Older form wording, still read so early responses aren't lost. */
const OLD_SKILL_QUESTION = "What skill do you need from someone else?";

export type ApplicantRow = {
  email: string;
  name: string;
  school: string | null;
  phone: string | null;
  contact_pref: "email" | "text" | "instagram" | null;
  instagram: string | null;
  makes: Make[];
  looking_for: LookingFor[];
  looking_for_note: string | null;
  intent: "idea" | "join" | "both" | null;
  idea: string | null;
  time_available: "weekend" | "few_weeks" | "ongoing" | null;
  work_link: string | null;
  consent: true;
  submitted_at: string;
};

export type ParseResult =
  | { ok: true; row: ApplicantRow }
  | { ok: false; reason: "no_consent" | "no_email" | "bad_email" | "no_name" };

type Answers = Record<string, string | string[] | null | undefined>;

function key(title: string): string {
  return title.toLowerCase().replace(/[’']/g, "'").replace(/[?:]\s*$/, "").trim();
}

/** The answer to a question, as one trimmed string ("" if missing). */
function pick(answers: Answers, title: string): string {
  const want = key(title);
  for (const [k, v] of Object.entries(answers)) {
    if (key(k) !== want) continue;
    const parts = Array.isArray(v) ? v : [v ?? ""];
    const joined = parts.map((p) => String(p ?? "").trim()).filter(Boolean).join(", ");
    if (joined) return joined;
  }
  return "";
}

const nullIfEmpty = (s: string): string | null => (s ? s : null);

function yes(s: string): boolean {
  return /^(yes|y|true|i agree|agree)\b/i.test(s.trim());
}

function contactPref(s: string): ApplicantRow["contact_pref"] {
  const v = s.toLowerCase();
  if (v.includes("text") || v.includes("sms") || v.includes("phone")) return "text";
  if (v.includes("insta")) return "instagram";
  if (v.includes("email") || v.includes("e-mail")) return "email";
  return null;
}

/** "Film, Photo" (Google joins checkbox answers with ", ") -> ["film","photo"]. */
function makes(s: string): Make[] {
  const out = new Set<Make>();
  for (const part of s.split(/[,;\n]/)) {
    const v = part.trim().toLowerCase();
    if (!v) continue;
    const hit = MAKES.find((m) => v === m || v.startsWith(m));
    // "Photography" -> photo; anything unrecognised (an "Other:" write-in) -> other.
    out.add(hit ?? (v.startsWith("photograph") ? "photo" : "other"));
  }
  return [...out];
}

/**
 * "Model, Writer or poet" -> ["model","writer_poet"]. Google joins tick-box
 * answers with ", ", and some labels contain " or ", so match whole labels
 * first rather than splitting blindly.
 */
function lookingFor(s: string): LookingFor[] {
  const out = new Set<LookingFor>();
  let rest = s.toLowerCase();
  for (const { code, label } of LOOKING_FOR) {
    const l = label.toLowerCase();
    if (rest.includes(l)) {
      out.add(code);
      rest = rest.split(l).join(",");
    }
  }
  // Whatever is left (an "Other:" write-in, or an old free-text answer).
  if (rest.split(/[,;\n]/).some((p) => p.replace(/^\s*other\s*:?/, "").trim())) out.add("other");
  return [...out];
}

function intent(s: string): ApplicantRow["intent"] {
  const v = s.toLowerCase();
  if (!v) return null;
  if (v.includes("both")) return "both";
  if (v.includes("join")) return "join";
  if (v.includes("idea")) return "idea";
  return null;
}

function time(s: string): ApplicantRow["time_available"] {
  const v = s.toLowerCase();
  if (!v) return null;
  if (v.includes("weekend")) return "weekend";
  if (v.includes("few week") || v.includes("weeks")) return "few_weeks";
  if (v.includes("ongoing")) return "ongoing";
  return null;
}

/**
 * Google writes the timestamp as "11/10/2026 14:05:33" in the sheet's locale.
 * Anything unreadable falls back to now: the order of submissions matters
 * far less than not losing one.
 */
function timestamp(s: string, now: Date): string {
  if (s) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return now.toISOString();
}

export function parseFormResponse(answers: Answers, now: Date = new Date()): ParseResult {
  if (!yes(pick(answers, FORM_QUESTIONS.consent))) return { ok: false, reason: "no_consent" };

  const email = (pick(answers, FORM_QUESTIONS.email) || pick(answers, GOOGLE_EMAIL)).toLowerCase();
  if (!email) return { ok: false, reason: "no_email" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, reason: "bad_email" };

  const name = pick(answers, FORM_QUESTIONS.name);
  if (!name) return { ok: false, reason: "no_name" };

  return {
    ok: true,
    row: {
      email,
      name: name.slice(0, 120),
      school: nullIfEmpty(pick(answers, FORM_QUESTIONS.school)),
      phone: nullIfEmpty(pick(answers, FORM_QUESTIONS.phone)),
      contact_pref: contactPref(pick(answers, FORM_QUESTIONS.contactPref)),
      instagram: nullIfEmpty(pick(answers, FORM_QUESTIONS.instagram).replace(/^@/, "")),
      makes: makes(pick(answers, FORM_QUESTIONS.makes)),
      looking_for: lookingFor(
        pick(answers, FORM_QUESTIONS.lookingFor) || pick(answers, OLD_SKILL_QUESTION)
      ),
      // An old free-text "skill" answer is kept as the note, so it isn't lost.
      looking_for_note: nullIfEmpty(
        (pick(answers, FORM_QUESTIONS.lookingForNote) ||
          (pick(answers, FORM_QUESTIONS.lookingFor) ? "" : pick(answers, OLD_SKILL_QUESTION))
        ).slice(0, 1000)
      ),
      intent: intent(pick(answers, FORM_QUESTIONS.intent)),
      idea: nullIfEmpty(pick(answers, FORM_QUESTIONS.idea).slice(0, 2000)),
      time_available: time(pick(answers, FORM_QUESTIONS.time)),
      work_link: nullIfEmpty(pick(answers, FORM_QUESTIONS.workLink)),
      consent: true,
      submitted_at: timestamp(pick(answers, FORM_QUESTIONS.timestamp), now),
    },
  };
}

/** Constant-time compare for the shared secret. */
export function secretsMatch(given: string, expected: string): boolean {
  if (!given || !expected || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
