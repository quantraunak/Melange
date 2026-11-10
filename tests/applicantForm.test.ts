import { describe, expect, it } from "vitest";

import { parseFormResponse, secretsMatch } from "@/app/lib/applicantForm";
import { applicantsCsv, contactLines, introText, listMakes, type Applicant, type IntroSide } from "@/app/lib/introAdmin";

const NOW = new Date("2026-11-10T12:00:00Z");

/** A full response, as the Apps Script sends it (e.namedValues: arrays of strings). */
function response(over: Record<string, string[]> = {}): Record<string, string[]> {
  return {
    Timestamp: ["11/09/2026 14:05:33"],
    Name: ["  Ana Rivera "],
    School: ["Chapman"],
    Email: ["Ana.Rivera@Chapman.EDU "],
    Phone: ["555-0101"],
    "Best way to reach you": ["Text"],
    Instagram: ["@ana.shoots"],
    "What do you make?": ["Film, Photography, Zines"],
    "Who are you looking for?": ["Model, Writer or poet, Videographer or editor"],
    "Tell us more about who you're looking for": ["Someone to shoot portraits with"],
    "Do you have an idea or want to join someone else's?": ["I have an idea"],
    "Your idea, or what you'd love to work on": ["A short film about bikes"],
    "How much time do you have?": ["A few weeks"],
    "Link to your work": [""],
    "Can we share your answers with your matches?": ["Yes"],
    ...over,
  };
}

describe("parseFormResponse", () => {
  it("reads a full response", () => {
    const r = parseFormResponse(response(), NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.row).toMatchObject({
      email: "ana.rivera@chapman.edu",
      name: "Ana Rivera",
      school: "Chapman",
      phone: "555-0101",
      contact_pref: "text",
      instagram: "ana.shoots",
      makes: ["film", "photo", "other"],
      looking_for: ["model", "videographer_editor", "writer_poet"],
      looking_for_note: "Someone to shoot portraits with",
      intent: "idea",
      idea: "A short film about bikes",
      time_available: "few_weeks",
      work_link: null,
      consent: true,
    });
    expect(r.row.submitted_at).toBe(new Date("11/09/2026 14:05:33").toISOString());
  });

  it("refuses anyone who did not consent", () => {
    expect(parseFormResponse(response({ "Can we share your answers with your matches?": ["No"] }))).toEqual({
      ok: false,
      reason: "no_consent",
    });
    const missing = response();
    delete (missing as Record<string, unknown>)["Can we share your answers with your matches?"];
    expect(parseFormResponse(missing)).toEqual({ ok: false, reason: "no_consent" });
  });

  it("needs an email and a name", () => {
    expect(parseFormResponse(response({ Email: [""] }))).toEqual({ ok: false, reason: "no_email" });
    expect(parseFormResponse(response({ Email: ["not an email"] }))).toEqual({ ok: false, reason: "bad_email" });
    expect(parseFormResponse(response({ Name: [" "] }))).toEqual({ ok: false, reason: "no_name" });
  });

  it("uses Google's collected email when there is no Email question", () => {
    const r = response({ Email: [""], "Email Address": ["SOMEONE@School.org"] });
    const out = parseFormResponse(r);
    expect(out.ok && out.row.email).toBe("someone@school.org");
  });

  it("tolerates small changes to question titles", () => {
    const r = parseFormResponse({
      name: ["Cy"],
      EMAIL: ["cy@x.org"],
      "what do you make": ["Music"],
      "Can we share your answers with your matches": ["Yes, I agree"],
    });
    expect(r.ok && r.row).toMatchObject({ name: "Cy", email: "cy@x.org", makes: ["music"] });
  });

  it("maps every choice", () => {
    const pick = (q: string, a: string) => {
      const out = parseFormResponse(response({ [q]: [a] }));
      return out.ok ? out.row : null;
    };
    expect(pick("Best way to reach you", "Email")?.contact_pref).toBe("email");
    expect(pick("Best way to reach you", "Instagram DM")?.contact_pref).toBe("instagram");
    expect(pick("Do you have an idea or want to join someone else's?", "Both")?.intent).toBe("both");
    expect(pick("Do you have an idea or want to join someone else's?", "I want to join someone's")?.intent).toBe("join");
    expect(pick("How much time do you have?", "A weekend")?.time_available).toBe("weekend");
    expect(pick("How much time do you have?", "Ongoing")?.time_available).toBe("ongoing");
    expect(pick("What do you make?", "Art, Design, Writing")?.makes).toEqual(["art", "design", "writing"]);
  });

  it("reads every looking-for choice, and keeps a write-in as other", () => {
    const all = "Model, Photographer, Videographer or editor, Illustrator or artist, Writer or poet, Musician or producer, Actor or performer, Designer, Other";
    const out = parseFormResponse(response({ "Who are you looking for?": [all] }));
    expect(out.ok && out.row.looking_for.length).toBe(9);
    const w = parseFormResponse(response({ "Who are you looking for?": ["Model, a tattoo artist"] }));
    expect(w.ok && w.row.looking_for).toEqual(["model", "other"]);
  });

  it("still reads the old free-text skill question", () => {
    const r = response({ "What skill do you need from someone else?": ["sound design"] });
    delete (r as Record<string, unknown>)["Who are you looking for?"];
    delete (r as Record<string, unknown>)["Tell us more about who you're looking for"];
    const out = parseFormResponse(r);
    expect(out.ok && out.row.looking_for).toEqual(["other"]);
    expect(out.ok && out.row.looking_for_note).toBe("sound design");
  });

  it("falls back to now for an unreadable timestamp", () => {
    const out = parseFormResponse(response({ Timestamp: ["garbage"] }), NOW);
    expect(out.ok && out.row.submitted_at).toBe(NOW.toISOString());
  });
});

describe("secretsMatch", () => {
  it("compares exactly", () => {
    expect(secretsMatch("abc123", "abc123")).toBe(true);
    expect(secretsMatch("abc124", "abc123")).toBe(false);
    expect(secretsMatch("", "")).toBe(false);
    expect(secretsMatch("abc", "abc123")).toBe(false);
  });
});


const side = (over: Partial<IntroSide> = {}): IntroSide => ({
  kind: "applicant",
  id: "1",
  name: "Ana Rivera",
  school: "Chapman",
  email: "ana@x.org",
  phone: "555-0101",
  contact_pref: "text",
  instagram: "ana.shoots",
  makes: ["film", "photo"],
  looking_for: [],
  looking_for_note: null,
  intent: "idea",
  idea: "bikes",
  time_available: "weekend",
  work_link: null,
  consent: true,
  user_id: null,
  ...over,
});

describe("intro admin helpers", () => {
  it("writes the intro text with first name, match, what they make and the note", () => {
    const t = introText(side(), side({ name: "Cy Lee", makes: ["music"] }), "You both love bikes.");
    expect(t).toContain("Hi Ana! We matched you with Cy Lee, who makes music.");
    expect(t).toContain("You both love bikes.");
    expect(t).toContain("sign up with ana@x.org");
  });

  it("describes an existing user by role", () => {
    const t = introText(side(), side({ kind: "user", name: "Ben", makes: [], role: "Director" }), "");
    expect(t).toContain("who makes director");
  });

  it("lists makes naturally", () => {
    expect(listMakes(["film"])).toBe("film");
    expect(listMakes(["film", "photo", "art"])).toBe("film, photo and art");
  });

  it("shows contact info only with consent", () => {
    expect(contactLines(side())).toEqual([
      "Email: ana@x.org (prefers text)",
      "Phone: 555-0101",
      "Instagram: @ana.shoots",
    ]);
    expect(contactLines(side({ consent: false }))).toEqual([]);
  });

  it("exports CSV safely", () => {
    const row = { name: '=HACK"()', email: "a@b.c", makes: ["film", "art"] } as unknown as Applicant;
    const csv = applicantsCsv([row]).split("\n");
    expect(csv[0]).toContain('"name","email"');
    expect(csv[1]).toContain(`"'=HACK""()"`);
    expect(csv[1]).toContain('"film; art"');
  });
});
