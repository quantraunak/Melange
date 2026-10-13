// Supabase Edge Function: send-push
// Deploy with: supabase functions deploy send-push --no-verify-jwt
// The callers are defined in supabase/schema/12_push_webhooks.sql as ordinary
// Postgres triggers, NOT as Dashboard webhooks:
//   - swipes   INSERT (right) -> POST { type: "like",    record }
//   - matches  INSERT         -> POST { type: "match",   record }
//   - messages INSERT         -> POST { type: "message", record }
// They were Dashboard webhooks originally, which is why push silently never
// worked: the only record of the step was this comment telling a human to go
// click through a settings page, and nobody did. Set the caller's
// "Authorization" header to `Bearer <PUSH_WEBHOOK_SECRET>` — a dedicated
// secret set via `supabase secrets set PUSH_WEBHOOK_SECRET=...`, NOT the
// service_role key, so a leaked webhook header can't grant DB admin access.
//
// Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the function env
// so it can look up recipient push tokens and the sender's display name.

// @ts-expect-error Deno provides this URL import at runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Deno globals exist at runtime in Supabase Edge Functions.
declare const Deno: { env: { get(name: string): string | undefined }; serve: (h: (req: Request) => Response | Promise<Response>) => void };

const supabaseUrl  = Deno.env.get("SUPABASE_URL")!;
const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const webhookSecret = Deno.env.get("PUSH_WEBHOOK_SECRET")!;

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Constant-time string compare (equal-length fast path fails closed). */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type Payload =
  | {
      type: "message";
      record: { id: string; match_id: string; sender_id: string; content: string };
    }
  | {
      type: "match";
      record: { id: string; user1_id: string; user2_id: string; origin?: string | null };
    }
  | {
      type: "like";
      record: { id: string; swiper_id: string; post_id: string; direction: string };
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

  // Deployed with --no-verify-jwt (webhooks don't carry a user JWT), so this
  // function is the only auth boundary. Database Webhooks are configured to
  // send `Authorization: Bearer <PUSH_WEBHOOK_SECRET>` — a narrowly-scoped
  // secret dedicated to this check (NOT the service_role key, so a leaked
  // header only grants push-sending capability, not full DB admin access).
  // Compared in constant time to avoid leaking the secret via timing.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!timingSafeEqual(authHeader, `Bearer ${webhookSecret}`)) {
    return new Response("Unauthorized", { status: 401 });
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
    const { id, user1_id, user2_id, origin } = payload.record;
    // A conversation someone started by reaching out (13_reach_out.sql) is not
    // a mutual match. Its first message arrives in the same transaction and
    // sends its own push, so a "match" push here would be wrong and doubled.
    if (origin && origin !== "swipe") return new Response("ok");

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
  } else if (payload.type === "like") {
    // A one-way like, and it NAMES the person.
    //
    // This first shipped as an anonymous tease, copied from Tinder, which was
    // wrong: on Tinder you are the scarce side being evaluated as a person, so
    // withholding the name protects egos and creates something to sell. Here
    // the roles are reversed. You posted a project and you need crew, so a like
    // is an applicant raising their hand, and hiding your own applicants from
    // you is just a broken funnel.
    //
    // Nothing about safety is given up. The liker volunteered; naming them to
    // the owner exposes nobody to unwanted contact. The protection that matters
    // runs the other way, and still holds: the liker cannot message the owner
    // until the owner accepts.
    const { swiper_id, post_id } = payload.record;

    const { data: post } = await admin
      .from("collab_posts")
      .select("owner_id,title")
      .eq("id", post_id)
      .maybeSingle();
    if (!post || post.owner_id === swiper_id) return new Response("ok");

    const [tokens, liker] = await Promise.all([
      tokensFor(post.owner_id),
      nameFor(swiper_id),
    ]);
    const title = (post.title ?? "").trim();

    await sendExpo(tokens.map((to) => ({
      to,
      // No pronoun: the name is the one thing known for certain.
      title: `${liker} is interested`,
      sound: "default",
      body: title
        ? `Liked your project "${title.slice(0, 60)}".`
        : "Liked one of your projects.",
      data: { kind: "like", postId: post_id, userId: swiper_id },
    })));
  }

  return new Response("ok");
});
