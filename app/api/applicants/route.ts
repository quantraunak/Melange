import { createClient } from "@supabase/supabase-js";

import { parseFormResponse, secretsMatch } from "@/app/lib/applicantForm";

/**
 * POST /api/applicants — one Google Form response in, one applicant out.
 *
 * Called by the Apps Script on the response sheet (docs/MATCHING.md), never
 * by the app. Protected by APPLICANT_IMPORT_SECRET, sent as
 * `Authorization: Bearer <secret>`. Writes with the service role, which is why
 * this runs on the server only: applicants has RLS on and no policies, so no
 * client key can read or write it.
 *
 * Body: { "namedValues": { "<question title>": ["<answer>"], ... } }
 * Responses:
 *   200 { status: "saved" }      new applicant, or an update for an email
 *                                that already submitted
 *   200 { status: "skipped", reason }  no consent, or no usable email/name;
 *                                200 so the sheet doesn't retry forever
 *   401 wrong or missing secret
 */

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.APPLICANT_IMPORT_SECRET ?? "";
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || !secretsMatch(given, secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return Response.json({ error: "server is missing Supabase settings" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  const namedValues =
    body && typeof body === "object" && "namedValues" in body
      ? (body as { namedValues: unknown }).namedValues
      : null;
  if (!namedValues || typeof namedValues !== "object") {
    return Response.json({ error: "missing namedValues" }, { status: 400 });
  }

  const parsed = parseFormResponse(namedValues as Record<string, string[]>);
  if (!parsed.ok) {
    return Response.json({ status: "skipped", reason: parsed.reason });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Same email again: update their answers in place. status and created_at
  // are not sent, so a resubmission never undoes a match or a "waiting".
  const { error } = await admin
    .from("applicants")
    .upsert({ ...parsed.row, updated_at: new Date().toISOString() }, { onConflict: "email" });
  if (error) {
    console.error("applicants: upsert failed", error.message);
    return Response.json({ error: "could not save" }, { status: 500 });
  }
  return Response.json({ status: "saved" });
}
