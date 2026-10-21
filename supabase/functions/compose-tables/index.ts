// Supabase Edge Function: compose-tables
// Deploy with: supabase functions deploy compose-tables
//
// POST { event_id } with the host's session token. Reads the night's people,
// taste vectors and the current pair model through composer_inputs (which
// refuses anyone but the host or an admin), seats the room with compose.ts,
// and saves it through save_seating. Both database calls run as the caller,
// so the database's own checks decide who may do this, not this function.

// @ts-expect-error Deno provides this URL import at runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// @ts-expect-error Deno needs the .ts extension; the Node typecheck forbids it.
import { seatNight, type Model, type Person } from "./compose.ts";

declare const Deno: { env: { get(name: string): string | undefined }; serve: (h: (req: Request) => Response | Promise<Response>) => void };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Sign in first." }, 401);

  let eventId: string | undefined;
  try {
    eventId = (await req.json())?.event_id;
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  if (!eventId) return json({ error: "event_id is required" }, 400);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: inputs, error: inErr } = await supabase.rpc("composer_inputs", { p_event: eventId });
  if (inErr) return json({ error: inErr.message }, 403);

  const people = (inputs.people ?? []) as Person[];
  if (people.length < 2) return json({ error: "Not enough people going to seat the room yet." }, 400);
  const model = inputs.model as Model & { id: string };
  const blocked = (inputs.blocked_pairs ?? []) as Array<[string, string]>;

  // A fresh seed per run; it's not stored because the seating itself is.
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const { seats, experiment } = seatNight(people, model, blocked, { seed });

  const { data: runId, error: saveErr } = await supabase.rpc("save_seating", {
    p_event: eventId,
    p_model: model.id,
    p_rows: seats,
    p_experiment: experiment,
  });
  if (saveErr) return json({ error: saveErr.message }, 500);

  const tables = new Set(seats.map((s) => s.table_no)).size;
  return json({ run_id: runId, people: seats.length, tables, experiment });
});
