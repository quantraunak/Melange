import { supabase } from "./supabaseClient";

// ============================================================
// Types
// ============================================================

export type EventCategory =
  | "photo_walk"
  | "open_call"
  | "gallery"
  | "meetup"
  | "workshop"
  | "exhibition"
  | "other";

export type MelangeEvent = {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  category: EventCategory;
  start_at: string;
  end_at: string | null;
  location_name: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  cover_url: string | null;
  capacity: number | null;
  is_canceled: boolean;
  created_at: string;
  updated_at: string;
};

export type AttendeeInfo = {
  user_id: string;
  name: string;
  role: string | null;
  avatar_url: string | null;
  state: "going" | "interested";
};

export type EventWithDetails = MelangeEvent & {
  host: { user_id: string; name: string; role: string | null; avatar_url: string | null };
  going_count: number;
  interested_count: number;
  my_rsvp: "going" | "interested" | null;
};

export const EVENT_CATEGORIES: { id: EventCategory; label: string; emoji: string }[] = [
  { id: "photo_walk", label: "Photo walk", emoji: "📸" },
  { id: "open_call", label: "Open call", emoji: "🎭" },
  { id: "gallery", label: "Gallery opening", emoji: "🖼️" },
  { id: "meetup", label: "Meetup", emoji: "👋" },
  { id: "workshop", label: "Workshop", emoji: "🎓" },
  { id: "exhibition", label: "Exhibition", emoji: "✨" },
  { id: "other", label: "Other", emoji: "📍" },
];

export function categoryDisplay(c: EventCategory): { label: string; emoji: string } {
  return EVENT_CATEGORIES.find((x) => x.id === c) ?? { label: c, emoji: "📍" };
}

// ============================================================
// Internal helpers
// ============================================================

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Unknown error";
}

async function fetchHosts(hostIds: string[]) {
  const map = new Map<
    string,
    { user_id: string; name: string; role: string | null; avatar_url: string | null }
  >();
  if (hostIds.length === 0) return map;
  const { data } = await supabase
    .from("profiles")
    .select("user_id, name, role, avatar_url")
    .in("user_id", hostIds);
  for (const p of data || []) {
    map.set(p.user_id, {
      user_id: p.user_id,
      name: p.name,
      role: p.role,
      avatar_url: p.avatar_url,
    });
  }
  return map;
}

// ============================================================
// Reads
// ============================================================

/**
 * Upcoming events, optionally filtered by city/location string.
 * Uses the `upcoming_events` RPC, which excludes canceled events
 * and anything that's already ended.
 */
export async function getUpcomingEvents(
  currentUserId: string,
  cityFilter?: string
): Promise<{ data: EventWithDetails[] | null; error: string | null }> {
  try {
    const { data: events, error } = await supabase.rpc("upcoming_events", {
      p_city: cityFilter ?? null,
    });
    if (error) return { data: null, error: error.message };

    const list = (events as MelangeEvent[]) || [];
    if (list.length === 0) return { data: [], error: null };

    const ids = list.map((e) => e.id);
    const hostIds = [...new Set(list.map((e) => e.host_id))];

    const [hosts, { data: counts }, { data: myRsvps }] = await Promise.all([
      fetchHosts(hostIds),
      supabase.rpc("event_attendee_counts", { p_event_ids: ids }),
      supabase
        .from("event_rsvps")
        .select("event_id,state")
        .eq("user_id", currentUserId)
        .in("event_id", ids),
    ]);

    const countMap = new Map<string, { going: number; interested: number }>();
    for (const c of (counts as { event_id: string; going_count: number; interested_count: number }[]) || []) {
      countMap.set(c.event_id, {
        going: Number(c.going_count ?? 0),
        interested: Number(c.interested_count ?? 0),
      });
    }
    const rsvpMap = new Map<string, "going" | "interested">();
    for (const r of (myRsvps as { event_id: string; state: "going" | "interested" }[]) || []) {
      rsvpMap.set(r.event_id, r.state);
    }

    const enriched: EventWithDetails[] = list.map((e) => {
      const c = countMap.get(e.id) ?? { going: 0, interested: 0 };
      return {
        ...e,
        host: hosts.get(e.host_id) ?? {
          user_id: e.host_id,
          name: "Unknown",
          role: null,
          avatar_url: null,
        },
        going_count: c.going,
        interested_count: c.interested,
        my_rsvp: rsvpMap.get(e.id) ?? null,
      };
    });

    return { data: enriched, error: null };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

export async function getEvent(
  eventId: string,
  currentUserId: string
): Promise<{ data: EventWithDetails | null; error: string | null }> {
  try {
    const { data: event, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();
    if (error) return { data: null, error: error.message };

    const hosts = await fetchHosts([event.host_id]);
    const { data: counts } = await supabase.rpc("event_attendee_counts", {
      p_event_ids: [event.id],
    });
    const c = (counts as { event_id: string; going_count: number; interested_count: number }[])?.[0];

    const { data: mine } = await supabase
      .from("event_rsvps")
      .select("state")
      .eq("event_id", eventId)
      .eq("user_id", currentUserId)
      .maybeSingle();

    return {
      data: {
        ...(event as MelangeEvent),
        host: hosts.get(event.host_id) ?? {
          user_id: event.host_id,
          name: "Unknown",
          role: null,
          avatar_url: null,
        },
        going_count: Number(c?.going_count ?? 0),
        interested_count: Number(c?.interested_count ?? 0),
        my_rsvp: (mine?.state as "going" | "interested" | undefined) ?? null,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

export async function getEventAttendees(
  eventId: string,
  state: "going" | "interested" = "going"
): Promise<{ data: AttendeeInfo[]; error: string | null }> {
  try {
    const { data: rsvps, error } = await supabase
      .from("event_rsvps")
      .select("user_id, state")
      .eq("event_id", eventId)
      .eq("state", state);
    if (error) return { data: [], error: error.message };
    const ids = (rsvps || []).map((r) => r.user_id as string);
    if (ids.length === 0) return { data: [], error: null };
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, name, role, avatar_url")
      .in("user_id", ids);
    const attendees: AttendeeInfo[] = (profs || []).map((p) => ({
      user_id: p.user_id,
      name: p.name,
      role: p.role,
      avatar_url: p.avatar_url,
      state,
    }));
    return { data: attendees, error: null };
  } catch (err) {
    return { data: [], error: errMsg(err) };
  }
}

// ============================================================
// Writes
// ============================================================

export async function createEvent(
  hostId: string,
  input: {
    title: string;
    description?: string;
    category: EventCategory;
    start_at: string;
    end_at?: string;
    location_name?: string;
    city?: string;
    cover_url?: string;
    capacity?: number;
  }
): Promise<{ data: MelangeEvent | null; error: string | null }> {
  try {
    const row: Record<string, unknown> = {
      host_id: hostId,
      title: input.title,
      category: input.category,
      start_at: input.start_at,
    };
    if (input.description) row.description = input.description;
    if (input.end_at) row.end_at = input.end_at;
    if (input.location_name) row.location_name = input.location_name;
    if (input.city) row.city = input.city.toLowerCase();
    if (input.cover_url) row.cover_url = input.cover_url;
    if (input.capacity) row.capacity = input.capacity;

    const { data, error } = await supabase.from("events").insert(row).select().single();
    if (error) return { data: null, error: error.message };
    return { data: data as MelangeEvent, error: null };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

export async function updateEvent(
  eventId: string,
  patch: Partial<Omit<MelangeEvent, "id" | "host_id" | "created_at" | "updated_at">>
): Promise<{ data: MelangeEvent | null; error: string | null }> {
  try {
    const row: Record<string, unknown> = { ...patch };
    if (typeof row.city === "string") row.city = row.city.toLowerCase();
    const { data, error } = await supabase
      .from("events")
      .update(row)
      .eq("id", eventId)
      .select()
      .single();
    if (error) return { data: null, error: error.message };
    return { data: data as MelangeEvent, error: null };
  } catch (err) {
    return { data: null, error: errMsg(err) };
  }
}

export async function cancelEvent(eventId: string): Promise<{ error: string | null }> {
  return await updateEvent(eventId, { is_canceled: true }).then((r) => ({ error: r.error }));
}

export async function rsvpToEvent(
  eventId: string,
  userId: string,
  state: "going" | "interested"
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from("event_rsvps")
      .upsert(
        { event_id: eventId, user_id: userId, state },
        { onConflict: "event_id,user_id" }
      );
    return { error: error?.message ?? null };
  } catch (err) {
    return { error: errMsg(err) };
  }
}

export async function cancelRsvp(
  eventId: string,
  userId: string
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from("event_rsvps")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", userId);
    return { error: error?.message ?? null };
  } catch (err) {
    return { error: errMsg(err) };
  }
}
