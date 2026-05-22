"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  Camera,
  Check,
  Clock,
  ImagePlus,
  Loader2,
  MapPin,
  Plus,
  Search,
  Star,
  Users,
  X,
} from "lucide-react";
import {
  cancelRsvp,
  categoryDisplay,
  createEvent,
  EVENT_CATEGORIES,
  getEventAttendees,
  getUpcomingEvents,
  rsvpToEvent,
  type EventCategory,
  type EventWithDetails,
  type AttendeeInfo,
} from "../lib/events";
import { uploadFile } from "../lib/db";

// ============================================================
// Date helpers
// ============================================================

function formatEventDateTime(iso: string): { day: string; time: string; relative: string } {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const dayDiff = Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - startOfToday) / dayMs);

  let relative = "";
  if (dayDiff === 0) relative = "Today";
  else if (dayDiff === 1) relative = "Tomorrow";
  else if (dayDiff > 1 && dayDiff < 7) relative = d.toLocaleDateString(undefined, { weekday: "long" });
  else relative = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  const day = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return { day, time, relative };
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nowPlusHoursLocal(hours: number): string {
  const d = new Date(Date.now() + hours * 3600_000);
  return toLocalInputValue(d.toISOString());
}

function localInputToISO(localValue: string): string {
  if (!localValue) return "";
  return new Date(localValue).toISOString();
}

// ============================================================
// Avatar (re-used here to avoid prop-drilling from MelangeApp)
// ============================================================
function Avatar({
  name,
  url,
  size = "md",
}: {
  name: string;
  url: string | null;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const dims =
    size === "xs"
      ? "w-6 h-6 text-[10px]"
      : size === "sm"
      ? "w-8 h-8 text-xs"
      : size === "lg"
      ? "w-14 h-14 text-lg"
      : "w-10 h-10 text-sm";
  if (url) {
    return <img src={url} alt={name} className={`${dims} rounded-full object-cover flex-shrink-0 border border-white`} />;
  }
  return (
    <div className={`${dims} rounded-full bg-blue-100 text-blue-600 font-semibold flex items-center justify-center flex-shrink-0 border border-white`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ============================================================
// Main component
// ============================================================

export default function EventsView({ userId }: { userId: string }) {
  const [events, setEvents] = useState<EventWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [activeEvent, setActiveEvent] = useState<EventWithDetails | null>(null);
  const [busyEventId, setBusyEventId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: err } = await getUpcomingEvents(userId, cityFilter.trim() || undefined);
    if (err) setError(err);
    setEvents(data || []);
    setLoading(false);
  }, [userId, cityFilter]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const handleRsvp = async (event: EventWithDetails, next: "going" | "interested" | null) => {
    setBusyEventId(event.id);
    if (next === null) {
      await cancelRsvp(event.id, userId);
    } else {
      await rsvpToEvent(event.id, userId, next);
    }

    // Optimistic counter update
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== event.id) return e;
        let going = e.going_count;
        let interested = e.interested_count;
        if (e.my_rsvp === "going") going -= 1;
        if (e.my_rsvp === "interested") interested -= 1;
        if (next === "going") going += 1;
        if (next === "interested") interested += 1;
        return { ...e, my_rsvp: next, going_count: Math.max(0, going), interested_count: Math.max(0, interested) };
      })
    );
    setActiveEvent((prev) => {
      if (!prev || prev.id !== event.id) return prev;
      let going = prev.going_count;
      let interested = prev.interested_count;
      if (prev.my_rsvp === "going") going -= 1;
      if (prev.my_rsvp === "interested") interested -= 1;
      if (next === "going") going += 1;
      if (next === "interested") interested += 1;
      return { ...prev, my_rsvp: next, going_count: Math.max(0, going), interested_count: Math.max(0, interested) };
    });
    setBusyEventId(null);
  };

  // Group by relative day for nicer scanability
  const grouped = (() => {
    const map = new Map<string, EventWithDetails[]>();
    for (const e of events) {
      const key = formatEventDateTime(e.start_at).relative;
      const arr = map.get(key) || [];
      arr.push(e);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  })();

  return (
    <div className="pt-3">
      {/* Header search + create */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            placeholder="Filter by city or location..."
            className="w-full pl-8 pr-8 py-2 text-xs bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
          />
          {cityFilter && (
            <button onClick={() => setCityFilter("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors flex-shrink-0"
        >
          <Plus className="h-3.5 w-3.5" /> Host
        </button>
      </div>

      {/* Pitch */}
      {!loading && events.length === 0 && !error ? (
        <div className="text-center py-12 px-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-3">
            <Calendar className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            {cityFilter ? "No events in that city yet" : "No upcoming events yet"}
          </h3>
          <p className="text-xs text-gray-500 max-w-[280px] mx-auto leading-snug mb-4">
            {cityFilter
              ? "Be the first to host something here — photo walks, open calls, gallery nights."
              : "This is where photo walks, open calls, and gallery openings show up. Host one and bring the community together."}
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="text-xs font-medium px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700"
          >
            Host an event
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="mb-3 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">{error}</div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading events…
        </div>
      ) : (
        grouped.map(([day, dayEvents]) => (
          <div key={day} className="mb-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2 px-1">{day}</h2>
            <div className="space-y-3">
              {dayEvents.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  busy={busyEventId === e.id}
                  onOpen={() => setActiveEvent(e)}
                  onRsvp={(next) => handleRsvp(e, next)}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {/* Detail modal */}
      <EventDetailDialog
        userId={userId}
        event={activeEvent}
        onClose={() => setActiveEvent(null)}
        busy={busyEventId === activeEvent?.id}
        onRsvp={(next) => activeEvent && handleRsvp(activeEvent, next)}
      />

      {/* Create modal */}
      <CreateEventDialog
        userId={userId}
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); load(); }}
      />
    </div>
  );
}

// ============================================================
// Event card
// ============================================================
function EventCard({
  event,
  busy,
  onOpen,
  onRsvp,
}: {
  event: EventWithDetails;
  busy: boolean;
  onOpen: () => void;
  onRsvp: (next: "going" | "interested" | null) => void;
}) {
  const cat = categoryDisplay(event.category);
  const { time } = formatEventDateTime(event.start_at);
  const going = event.my_rsvp === "going";
  const interested = event.my_rsvp === "interested";

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <button onClick={onOpen} className="block w-full text-left">
        <div className="relative h-32 bg-gradient-to-br from-blue-100 via-purple-50 to-pink-50">
          {event.cover_url ? (
            <img src={event.cover_url} alt={event.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl opacity-30">{cat.emoji}</div>
          )}
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-white/90 backdrop-blur rounded-full text-[10px] font-semibold text-gray-700">
            <span>{cat.emoji}</span>
            <span>{cat.label}</span>
          </div>
          <div className="absolute top-2 right-2 px-2 py-1 bg-blue-900/90 backdrop-blur text-white text-[10px] font-semibold rounded-full flex items-center gap-1">
            <Clock className="h-3 w-3" /> {time}
          </div>
        </div>

        <div className="p-3">
          <h3 className="font-semibold text-gray-900 text-sm leading-tight">{event.title}</h3>
          {event.location_name ? (
            <p className="flex items-center gap-1 text-[11px] text-gray-500 mt-1">
              <MapPin className="h-3 w-3" /> {event.location_name}
            </p>
          ) : null}

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5">
              <Avatar name={event.host.name} url={event.host.avatar_url} size="xs" />
              <span className="text-[11px] text-gray-500 truncate max-w-[120px]">Hosted by {event.host.name}</span>
            </div>
            {event.going_count > 0 ? (
              <span className="flex items-center gap-1 text-[11px] text-gray-500">
                <Users className="h-3 w-3" /> {event.going_count}
              </span>
            ) : null}
          </div>
        </div>
      </button>

      <div className="flex border-t border-gray-100">
        <button
          onClick={() => onRsvp(interested ? null : "interested")}
          disabled={busy}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
            interested ? "bg-yellow-50 text-yellow-700" : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          <Star className={`h-3.5 w-3.5 ${interested ? "fill-yellow-500 text-yellow-500" : ""}`} />
          {interested ? "Interested" : "Interested"}
        </button>
        <div className="w-px bg-gray-100" />
        <button
          onClick={() => onRsvp(going ? null : "going")}
          disabled={busy}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
            going ? "bg-green-50 text-green-700" : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          <Check className={`h-3.5 w-3.5 ${going ? "text-green-700" : ""}`} />
          {going ? "Going" : "I'm going"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Event detail dialog
// ============================================================
function EventDetailDialog({
  userId,
  event,
  onClose,
  busy,
  onRsvp,
}: {
  userId: string;
  event: EventWithDetails | null;
  onClose: () => void;
  busy: boolean;
  onRsvp: (next: "going" | "interested" | null) => void;
}) {
  return (
    <Dialog open={!!event} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[480px] max-h-[90vh] overflow-y-auto p-0 rounded-2xl">
        {event ? (
          <EventDetailInner
            key={event.id}
            event={event}
            userId={userId}
            busy={busy}
            onClose={onClose}
            onRsvp={onRsvp}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EventDetailInner({
  event,
  busy,
  onClose,
  onRsvp,
}: {
  event: EventWithDetails;
  userId: string;
  busy: boolean;
  onClose: () => void;
  onRsvp: (next: "going" | "interested" | null) => void;
}) {
  const cat = categoryDisplay(event.category);
  const start = new Date(event.start_at);
  const end = event.end_at ? new Date(event.end_at) : null;
  const dateLabel = start.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const timeLabel = `${start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}${end ? ` – ${end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}`;
  const going = event.my_rsvp === "going";
  const interested = event.my_rsvp === "interested";

  const [attendees, setAttendees] = useState<AttendeeInfo[]>([]);
  const [attendeesLoading, setAttendeesLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await getEventAttendees(event.id, "going");
      setAttendees(data);
      setAttendeesLoading(false);
    })();
  }, [event.id]);

  return (
    <>
      <div className="relative h-40 bg-gradient-to-br from-blue-100 via-purple-50 to-pink-50">
        {event.cover_url ? (
          <img src={event.cover_url} alt={event.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl opacity-30">{cat.emoji}</div>
        )}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center text-gray-700 shadow"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 bg-white/90 backdrop-blur rounded-full text-[11px] font-semibold text-gray-700">
          <span>{cat.emoji}</span>
          <span>{cat.label}</span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <DialogTitle className="text-lg font-semibold text-gray-900 leading-tight">
          {event.title}
        </DialogTitle>
        <DialogDescription className="sr-only">Event details</DialogDescription>

        <div className="flex flex-wrap gap-2 text-xs text-gray-600">
          <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full">
            <Calendar className="h-3 w-3" /> {dateLabel}
          </div>
          <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full">
            <Clock className="h-3 w-3" /> {timeLabel}
          </div>
          {event.location_name ? (
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full">
              <MapPin className="h-3 w-3" /> {event.location_name}
            </div>
          ) : null}
          {event.capacity ? (
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full">
              <Users className="h-3 w-3" /> {event.going_count}/{event.capacity}
            </div>
          ) : null}
        </div>

        {event.description ? (
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{event.description}</p>
        ) : null}

        <div className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-xl">
          <Avatar name={event.host.name} url={event.host.avatar_url} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400">Hosted by</p>
            <p className="text-sm font-semibold text-gray-900 truncate">{event.host.name}</p>
            {event.host.role ? <p className="text-[11px] text-gray-500 truncate">{event.host.role}</p> : null}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Going ({event.going_count})
            </h3>
            {event.interested_count > 0 ? (
              <span className="text-[11px] text-gray-400">{event.interested_count} interested</span>
            ) : null}
          </div>
          {attendeesLoading ? (
            <p className="text-xs text-gray-400">Loading…</p>
          ) : attendees.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Be the first to RSVP.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {attendees.slice(0, 8).map((a) => (
                <div key={a.user_id} className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-full">
                  <Avatar name={a.name} url={a.avatar_url} size="xs" />
                  <span className="text-[11px] font-medium text-gray-700 truncate max-w-[100px]">{a.name}</span>
                </div>
              ))}
              {attendees.length > 8 ? (
                <div className="px-2 py-1 bg-gray-50 rounded-full text-[11px] text-gray-500">
                  +{attendees.length - 8} more
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={() => onRsvp(interested ? null : "interested")}
            disabled={busy}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
              interested ? "bg-yellow-50 border-yellow-300 text-yellow-700" : "border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Star className={`h-4 w-4 ${interested ? "fill-yellow-500 text-yellow-500" : ""}`} />
            {interested ? "Interested" : "Interested"}
          </button>
          <button
            onClick={() => onRsvp(going ? null : "going")}
            disabled={busy}
            className={`flex-[2] flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              going ? "bg-green-500 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            <Check className="h-4 w-4" />
            {going ? "You're going" : "I'm going"}
          </button>
        </div>
      </div>
    </>
  );
}

// ============================================================
// Create event dialog
// ============================================================
function CreateEventDialog({
  userId,
  open,
  onClose,
  onCreated,
}: {
  userId: string;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[480px] max-h-[90vh] overflow-y-auto p-0 rounded-2xl">
        {open ? <CreateEventInner userId={userId} onClose={onClose} onCreated={onCreated} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function CreateEventInner({
  userId,
  onClose,
  onCreated,
}: {
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<EventCategory>("photo_walk");
  const [startLocal, setStartLocal] = useState(nowPlusHoursLocal(48));
  const [endLocal, setEndLocal] = useState("");
  const [locationName, setLocationName] = useState("");
  const [city, setCity] = useState("");
  const [capacity, setCapacity] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
  };

  const removeCover = () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!startLocal) {
      setError("Start date is required.");
      return;
    }
    const startISO = localInputToISO(startLocal);
    const endISO = endLocal ? localInputToISO(endLocal) : undefined;
    if (endISO && new Date(endISO) <= new Date(startISO)) {
      setError("End time must be after start time.");
      return;
    }

    setBusy(true);
    setError("");

    let coverUrl: string | undefined;
    if (coverFile) {
      const { url, error: upErr } = await uploadFile(userId, "posts", coverFile);
      if (upErr || !url) {
        setBusy(false);
        setError(upErr || "Cover image upload failed.");
        return;
      }
      coverUrl = url;
    }

    const { error: createErr } = await createEvent(userId, {
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      start_at: startISO,
      end_at: endISO,
      location_name: locationName.trim() || undefined,
      city: city.trim() || undefined,
      capacity: capacity ? Number(capacity) : undefined,
      cover_url: coverUrl,
    });

    setBusy(false);
    if (createErr) {
      setError(createErr);
      return;
    }
    onCreated();
  };

  return (
    <>
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <DialogTitle className="text-base font-semibold text-gray-900">Host an event</DialogTitle>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <DialogDescription className="sr-only">Create a new event</DialogDescription>

      <form onSubmit={submit} className="p-4 space-y-3">
        <div>
          <Label className="text-xs text-gray-500 mb-1">Cover photo (optional)</Label>
          {coverPreview ? (
            <div className="relative w-full h-32 rounded-xl overflow-hidden border border-gray-200 group">
              <img src={coverPreview} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={removeCover}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/55 text-white flex items-center justify-center"
                aria-label="Remove cover"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full h-24 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
            >
              <ImagePlus className="h-4 w-4" />
              <span className="text-[11px] font-medium">Add cover photo</span>
            </button>
          )}
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />
        </div>

        <div>
          <Label className="text-xs text-gray-500 mb-1">Category</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {EVENT_CATEGORIES.map((c) => {
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`flex flex-col items-center gap-0.5 py-2 rounded-xl border text-[11px] transition-colors ${
                    active ? "bg-blue-50 border-blue-300 text-blue-700 font-semibold" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-base">{c.emoji}</span>
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label className="text-xs text-gray-500 mb-1">Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Golden hour photo walk in Brooklyn"
            className="rounded-xl"
            required
          />
        </div>

        <div>
          <Label className="text-xs text-gray-500 mb-1">Description (optional)</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Who is this for? What should people bring? Meeting point?"
            className="rounded-xl"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-gray-500 mb-1">Starts</Label>
            <input
              type="datetime-local"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
              className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
              required
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1">Ends (optional)</Label>
            <input
              type="datetime-local"
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
              className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs text-gray-500 mb-1">Where</Label>
          <Input
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="e.g., Washington Square Park"
            className="rounded-xl"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-gray-500 mb-1">City</Label>
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g., New York"
              className="rounded-xl"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1">Capacity (optional)</Label>
            <Input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="Unlimited"
              className="rounded-xl"
            />
          </div>
        </div>

        {error ? (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-2">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {busy ? "Creating…" : "Create event"}
        </button>
      </form>
    </>
  );
}

// Tiny shim so unused-Camera-import doesn't lint-fail.
// (Camera is intentionally kept in scope for future image-camera capture.)
void Camera;
