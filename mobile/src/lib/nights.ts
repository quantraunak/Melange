import { supabase } from "./supabase";
import { withDetails, type EventWithDetails, type MelangeEvent } from "./events";

/**
 * Nights: events seen as the place a scene meets (23_scenes_invites_nights.sql).
 *
 * Before a night: who's going, and one group chat for the host and everyone
 * going. After it starts, for three days past its end: Afterglow, where you
 * can quietly heart people from the night. Only a mutual heart is revealed.
 */

export type Face = { user_id: string; name: string; avatar_url: string | null };

export type NightPerson = {
  user_id: string;
  name: string;
  avatar_url: string | null;
  role: string | null;
  handle: string | null;
  is_host: boolean;
  i_hearted: boolean;
};

export type NightMessage = {
  id: string;
  event_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export type NightMutual = {
  user_id: string;
  name: string;
  avatar_url: string | null;
  match_id: string | null;
};

export type NightWithFaces = EventWithDetails & { faces: Face[] };

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** toggle_event_heart's rule: an open-ended night is six hours long. */
function nightEnd(e: Pick<MelangeEvent, "start_at" | "end_at">): number {
  return e.end_at ? Date.parse(e.end_at) : Date.parse(e.start_at) + 6 * HOUR;
}

/**
 * Whether the night is over, by upcoming_events' rule (an open-ended night is
 * four hours long there), so RSVP disappears exactly when the list drops it.
 */
export function nightEnded(e: Pick<MelangeEvent, "start_at" | "end_at">, now = Date.now()): boolean {
  const end = e.end_at ? Date.parse(e.end_at) : Date.parse(e.start_at) + 4 * HOUR;
  return end <= now;
}

/** Whether hearts are open: from the start of the night to three days after it ends. */
export function afterglowOpen(e: Pick<MelangeEvent, "start_at" | "end_at">, now = Date.now()): boolean {
  return now >= Date.parse(e.start_at) && now <= nightEnd(e) + 3 * DAY;
}

/** Whether the night has started. The night roll opens then, and stays. */
export function nightStarted(e: Pick<MelangeEvent, "start_at">, now = Date.now()): boolean {
  return now >= Date.parse(e.start_at);
}

/** Host, or RSVP'd going: the same rule as is_event_member(). */
export function isNightMember(
  e: Pick<EventWithDetails, "host_id" | "my_rsvp">,
  userId: string | null
): boolean {
  return !!userId && (e.host_id === userId || e.my_rsvp === "going");
}

/**
 * Up to `per` faces of people going to each night, for the avatar stack on a
 * card. event_people() is members-only, and a card is shown to everyone, so
 * this reads RSVPs, which any member can see, as the old Going list did.
 */
async function getGoingFaces(eventIds: string[], per = 5): Promise<Map<string, Face[]>> {
  const out = new Map<string, Face[]>();
  if (!eventIds.length) return out;
  const { data: rsvps, error } = await supabase
    .from("event_rsvps")
    .select("event_id,user_id")
    .eq("state", "going")
    .in("event_id", eventIds);
  if (error || !rsvps?.length) return out;
  const ids = [...new Set(rsvps.map((r) => r.user_id as string))];
  const { data: profs } = await supabase
    .from("profiles")
    .select("user_id,name,avatar_url")
    .in("user_id", ids);
  const byId = new Map((profs ?? []).map((p) => [p.user_id as string, p as Face]));
  for (const r of rsvps) {
    const face = byId.get(r.user_id as string);
    if (!face) continue;
    const list = out.get(r.event_id as string) ?? [];
    if (list.length < per) list.push(face);
    out.set(r.event_id as string, list);
  }
  return out;
}

/** Upcoming nights, soonest first; in one scene, or everywhere when `scene` is null. */
export async function getNights(
  userId: string,
  scene: string | null
): Promise<{ data: NightWithFaces[]; error: string | null }> {
  try {
    let q = supabase.rpc("upcoming_events", { p_city: null });
    if (scene) q = q.eq("scene", scene);
    const { data, error } = await q;
    if (error) return { data: [], error: error.message };
    const list = await withDetails((data as MelangeEvent[]) || [], userId);
    const faces = await getGoingFaces(list.map((e) => e.id));
    return { data: list.map((e) => ({ ...e, faces: faces.get(e.id) ?? [] })), error: null };
  } catch (err) {
    return { data: [], error: errMsg(err) };
  }
}

/**
 * Nights I was part of that have ended but whose Afterglow is still open.
 * upcoming_events drops a night the moment it ends, which is exactly when
 * people want to find it again, so the Nights tab lists these on their own.
 */
export async function getAfterglowNights(
  userId: string
): Promise<{ data: EventWithDetails[]; error: string | null }> {
  try {
    const since = new Date(Date.now() - 5 * DAY).toISOString();
    const [going, hosted] = await Promise.all([
      supabase.from("event_rsvps").select("event_id").eq("user_id", userId).eq("state", "going"),
      supabase.from("events").select("id").eq("host_id", userId).gte("start_at", since),
    ]);
    const firstErr = going.error || hosted.error;
    if (firstErr) return { data: [], error: firstErr.message };
    const ids = [
      ...new Set([
        ...(going.data ?? []).map((r) => r.event_id as string),
        ...(hosted.data ?? []).map((r) => r.id as string),
      ]),
    ];
    if (!ids.length) return { data: [], error: null };
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .in("id", ids)
      .eq("is_canceled", false)
      .gte("start_at", since)
      .order("start_at", { ascending: false });
    if (error) return { data: [], error: error.message };
    const now = Date.now();
    // nightEnded, not nightEnd: the moment the Nights list drops a night is
    // the moment it has to appear here, or it vanishes for two hours.
    const ended = ((data as MelangeEvent[]) || []).filter((e) => nightEnded(e, now) && afterglowOpen(e, now));
    return { data: await withDetails(ended, userId), error: null };
  } catch (err) {
    return { data: [], error: errMsg(err) };
  }
}

/** Everyone in the night, host first. Empty unless I'm a member of it. */
export async function getNightPeople(
  eventId: string
): Promise<{ data: NightPerson[]; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc("event_people", { p_event: eventId });
    if (error) return { data: [], error: error.message };
    const rows = ((data ?? []) as NightPerson[]).map((p) => ({
      ...p,
      is_host: p.is_host === true,
      i_hearted: p.i_hearted === true,
    }));
    rows.sort((a, b) => Number(b.is_host) - Number(a.is_host) || a.name.localeCompare(b.name));
    return { data: rows, error: null };
  } catch (err) {
    return { data: [], error: errMsg(err) };
  }
}

export async function getNightMessages(
  eventId: string
): Promise<{ data: NightMessage[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("event_messages")
      .select("id,event_id,sender_id,content,created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) return { data: [], error: error.message };
    return { data: (data ?? []) as NightMessage[], error: null };
  } catch (err) {
    return { data: [], error: errMsg(err) };
  }
}

export async function sendNightMessage(
  eventId: string,
  senderId: string,
  content: string
): Promise<{ data: NightMessage | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("event_messages")
      .insert({ event_id: eventId, sender_id: senderId, content })
      .select("id,event_id,sender_id,content,created_at")
      .single();
    if (error) return { data: null, error: error.message };
    return { data: data as NightMessage, error: null };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

/**
 * Delete one of my own messages. RLS lets only the sender delete, and a
 * blocked delete matches zero rows without an error, so count what went.
 */
export async function deleteNightMessage(id: string): Promise<{ error: string | null }> {
  try {
    const { data, error } = await supabase.from("event_messages").delete().eq("id", id).select("id");
    if (error) return { error: error.message };
    if (!data?.length) return { error: "Only the person who sent it can delete it." };
    return { error: null };
  } catch (err) {
    return { error: errMsg(err) };
  }
}

export type HeartOutcome = { hearted: boolean; mutual: boolean; matchId: string | null };

export async function toggleNightHeart(
  eventId: string,
  otherId: string
): Promise<{ data: HeartOutcome | null; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc("toggle_event_heart", {
      p_event: eventId,
      p_user: otherId,
    });
    if (error) return { data: null, error: error.message };
    const r = (data ?? {}) as Record<string, unknown>;
    if (typeof r.hearted !== "boolean") return { data: null, error: "That heart didn't save. Try again." };
    return {
      data: {
        hearted: r.hearted,
        mutual: r.mutual === true,
        matchId: typeof r.match_id === "string" ? r.match_id : null,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

export async function getNightMutuals(
  eventId: string
): Promise<{ data: NightMutual[]; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc("my_event_mutuals", { p_event: eventId });
    if (error) return { data: [], error: error.message };
    return { data: (data ?? []) as NightMutual[], error: null };
  } catch (err) {
    return { data: [], error: errMsg(err) };
  }
}

/*
 * Tables (26_room_composer.sql). The host seats the room through the
 * compose-tables Edge Function; each person then sees their own table.
 * Half the room is seated by the composer and half at random, and nothing
 * here ever says which half anyone is in: my_table() doesn't return the
 * arm, and the host's read below never selects it.
 */

export type TableMate = { user_id: string; name: string; avatar_url: string | null; role: string | null };

/** One table at a night. */
export type SeatedTable = { table_no: number; people: TableMate[] };

/** My table at a night, me first. Null when the room hasn't been seated. */
export async function getMyTable(
  eventId: string
): Promise<{ data: SeatedTable | null; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc("my_table", { p_event: eventId });
    if (error) return { data: null, error: error.message };
    const rows = (data ?? []) as (TableMate & { table_no: number })[];
    if (!rows.length) return { data: null, error: null };
    return {
      data: {
        table_no: rows[0].table_no,
        people: rows.map(({ user_id, name, avatar_url, role }) => ({ user_id, name, avatar_url, role })),
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

/**
 * Every table at a night, for its host (RLS lets only the host read these
 * rows). Names and faces come from event_people, which is block-aware.
 */
export async function getNightTables(
  eventId: string,
  people: NightPerson[]
): Promise<{ data: SeatedTable[]; error: string | null }> {
  try {
    // Only these two columns: the arm stays in the database.
    const { data, error } = await supabase
      .from("night_seating")
      .select("user_id,table_no")
      .eq("event_id", eventId);
    if (error) return { data: [], error: error.message };
    const byId = new Map(people.map((p) => [p.user_id, p]));
    const tables = new Map<number, TableMate[]>();
    for (const r of (data ?? []) as { user_id: string; table_no: number }[]) {
      const p = byId.get(r.user_id);
      // Someone blocked, or who's since dropped their RSVP: not shown.
      if (!p) continue;
      const list = tables.get(r.table_no) ?? [];
      list.push({ user_id: p.user_id, name: p.name, avatar_url: p.avatar_url, role: p.role });
      tables.set(r.table_no, list);
    }
    return {
      data: [...tables.entries()]
        .sort(([a], [b]) => a - b)
        .map(([table_no, list]) => ({ table_no, people: list.sort((a, b) => a.name.localeCompare(b.name)) })),
      error: null,
    };
  } catch (err) {
    return { data: [], error: errMsg(err) };
  }
}

/**
 * Seat the room. supabase-js forwards the host's session, and the function
 * makes its database calls as the caller, so only the host gets through.
 * A non-2xx reply carries `{ error }` in its body; show that rather than the
 * client's generic "non-2xx status code".
 */
export async function seatTheRoom(
  eventId: string
): Promise<{ data: { people: number; tables: number } | null; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke("compose-tables", { body: { event_id: eventId } });
    if (error) {
      let msg: string = error.message;
      const ctx = (error as { context?: unknown }).context;
      if (ctx instanceof Response) {
        try {
          const body = await ctx.json();
          if (body && typeof body.error === "string") msg = body.error;
        } catch {
          // Not JSON; keep the client's message.
        }
      }
      return { data: null, error: msg };
    }
    const r = (data ?? {}) as Record<string, unknown>;
    if (typeof r.error === "string") return { data: null, error: r.error };
    if (typeof r.people !== "number" || typeof r.tables !== "number") {
      return { data: null, error: "The tables didn't come back. Try again." };
    }
    return { data: { people: r.people, tables: r.tables }, error: null };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}
