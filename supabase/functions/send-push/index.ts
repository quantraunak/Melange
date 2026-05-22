// Supabase Edge Function: send-push
// Deploy with: supabase functions deploy send-push --no-verify-jwt
// Then wire up Database Webhooks:
//   - messages INSERT  -> POST { type: "message", record }
//   - matches  INSERT  -> POST { type: "match",   record }
// (Settings > Webhooks in the Supabase Dashboard.)
//
// Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the function env
// so it can look up recipient push tokens and the sender's display name.

// @ts-expect-error Deno provides this URL import at runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Deno globals exist at runtime in Supabase Edge Functions.
declare const Deno: { env: { get(name: string): string | undefined }; serve: (h: (req: Request) => Response | Promise<Response>) => void };

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type Payload =
  | {
      type: "message";
      record: { id: string; match_id: string; sender_id: string; content: string };
    }
  | {
      type: "match";
      record: { id: string; user1_id: string; user2_id: string };
    };

async function tokensFor(userId: string): Promise<string[]> {
  const { data } = await admin
    .from("push_tokens")
    .select("token")
    .eq("user_id", userId);
  return (data ?? []).map((r: { token: string }) => r.token);
}

async function nameFor(userId: string): Promise<string> {
  const { data } = await admin
    .from("profiles")
    .select("name")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.name ?? "Someone";
}

async function sendExpo(messages: Array<Record<string, unknown>>): Promise<void> {
  if (messages.length === 0) return;
  await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "accept": "application/json" },
    body: JSON.stringify(messages),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  if (payload.type === "message") {
    const { match_id, sender_id, content } = payload.record;
    const { data: match } = await admin
      .from("matches")
      .select("user1_id,user2_id")
      .eq("id", match_id)
      .maybeSingle();
    if (!match) return new Response("ok");

    const recipient = match.user1_id === sender_id ? match.user2_id : match.user1_id;
    const [tokens, name] = await Promise.all([tokensFor(recipient), nameFor(sender_id)]);

    await sendExpo(tokens.map((to) => ({
      to,
      sound: "default",
      title: name,
      body: content.slice(0, 140),
      data: { kind: "message", matchId: match_id },
    })));
  } else if (payload.type === "match") {
    const { id, user1_id, user2_id } = payload.record;

    for (const recipient of [user1_id, user2_id]) {
      const other = recipient === user1_id ? user2_id : user1_id;
      const [tokens, name] = await Promise.all([tokensFor(recipient), nameFor(other)]);

      await sendExpo(tokens.map((to) => ({
        to,
        sound: "default",
        title: "It's a match!",
        body: `You and ${name} liked each other's posts.`,
        data: { kind: "match", matchId: id },
      })));
    }
  }

  return new Response("ok");
});
