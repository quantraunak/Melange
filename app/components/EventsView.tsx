"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calendar,
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
// Local atoms (themed against Melange tokens)
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
    return (
      <img
        src={url}
        alt={name}
        className={`${dims} rounded-full object-cover flex-shrink-0 ring-1 ring-[var(--line)]`}
      />
    );
  }
  return (
    <div
      className={`${dims} rounded-full bg-[var(--secondary)] text-[var(--ink)] font-display font-medium flex items-center justify-center flex-shrink-0 ring-1 ring-[var(--line)]`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-3)] font-medium">
      {children}
    </p>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)] mb-1.5"
    >
      {children}
    </label>
  );
}

function MInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`melange-input w-full ${props.className ?? ""}`} />;
}

function MTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props} className={`melange-input w-full resize-none ${props.className ?? ""}`} />
  );
}

function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] text-[var(--destructive)] bg-[color-mix(in_oklab,var(--destructive)_8%,var(--surface))] border border-[color-mix(in_oklab,var(--destructive)_25%,var(--line))] rounded-[var(--radius-md)] p-2.5">
      {children}
    </p>
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
    <div>
      <div className="flex items-end justify-between mb-5">
        <div>
          <SectionLabel>Out there now</SectionLabel>
          <h1 className="font-display text-[28px] sm:text-[32px] tracking-tight text-[var(--ink)] mt-0.5">
            Events near you.
          </h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="hidden sm:inline-flex items-center gap-1.5 h-11 px-4 bg-[var(--ink)] text-[var(--bg)] rounded-[var(--radius-lg)] text-[14px] font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" /> Host event
        </button>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ink-3)]" />
        <input
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          placeholder="Filter by city or location…"
          className="w-full pl-10 pr-10 h-11 text-[14px] bg-[var(--surface)] border border-[var(--line)] rounded-full focus:outline-none focus:border-[var(--ink)] transition-colors"
        />
        {cityFilter && (
          <button
            onClick={() => setCityFilter("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)] hover:text-[var(--ink)] h-7 w-7 rounded-full flex items-center justify-center"
            aria-label="Clear"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="sm:hidden mb-5">
        <button
          onClick={() => setShowCreate(true)}
          className="w-full h-11 inline-flex items-center justify-center gap-2 bg-[var(--ink)] text-[var(--bg)] rounded-[var(--radius-lg)] text-[14px] font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" /> Host an event
        </button>
      </div>

      {error ? (
        <div className="mb-4">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[var(--ink-3)] text-[14px]">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading events…
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 px-4">
          <h3 className="font-display text-[24px] tracking-tight text-[var(--ink)]">
            {cityFilter ? "No events here yet." : "Quiet week."}
          </h3>
          <p className="text-[14px] text-[var(--ink-2)] mt-2 max-w-[40ch] mx-auto">
            {cityFilter
              ? "Be the first to host something — photo walks, open calls, gallery nights."
              : "When local hosts post photo walks, open calls, and gallery openings, they'll appear here."}
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-5 inline-flex items-center gap-1.5 h-10 px-4 bg-[var(--ink)] text-[var(--bg)] rounded-[var(--radius-lg)] text-[13px] font-medium hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Host the first one
          </button>
        </div>
      ) : (
        grouped.map(([day, dayEvents]) => (
          <section key={day} className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-[11px] uppercase tracking-[0.16em] text-[var(--ink-3)] font-medium">
                {day}
              </h2>
              <div className="h-px flex-1 bg-[var(--line)]" />
            </div>
            <div className="grid grid-cols-1 gap-3">
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
          </section>
        ))
      )}

      <EventDetailDialog
        userId={userId}
        event={activeEvent}
        onClose={() => setActiveEvent(null)}
        busy={busyEventId === activeEvent?.id}
        onRsvp={(next) => activeEvent && handleRsvp(activeEvent, next)}
      />

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
// Event card — image-led, editorial typography
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
    <article className="melange-card overflow-hidden">
      <button onClick={onOpen} className="block w-full text-left">
        <div className="relative aspect-[16/10] bg-[var(--secondary)]">
          {event.cover_url ? (
            <img src={event.cover_url} alt={event.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="font-display italic text-[var(--ink-3)] text-sm tracking-tight">
                {cat.label.toLowerCase()}
              </span>
            </div>
          )}
          <div className="absolute top-3 left-3 inline-flex items-center px-2.5 py-1 rounded-full bg-white/85 backdrop-blur text-[10px] uppercase tracking-[0.14em] font-medium text-[var(--ink)]">
            {cat.label}
          </div>
          <div className="absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--ink)]/85 backdrop-blur text-white text-[11px] font-medium">
            <Clock className="h-3 w-3" /> {time}
          </div>
        </div>

        <div className="p-4 pb-3">
          <h3 className="font-display text-[19px] tracking-tight leading-tight text-[var(--ink)]">
            {event.title}
          </h3>
          {event.location_name ? (
            <p className="flex items-center gap-1.5 text-[12px] text-[var(--ink-2)] mt-1.5">
              <MapPin className="h-3 w-3 text-[var(--ink-3)]" /> {event.location_name}
            </p>
          ) : null}

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <Avatar name={event.host.name} url={event.host.avatar_url} size="xs" />
              <span className="text-[12px] text-[var(--ink-2)] truncate max-w-[160px]">
                <span className="text-[var(--ink-3)]">by</span> {event.host.name}
              </span>
            </div>
            {event.going_count > 0 ? (
              <span className="flex items-center gap-1 text-[11px] text-[var(--ink-3)]">
                <Users className="h-3 w-3" /> {event.going_count} going
              </span>
            ) : null}
          </div>
        </div>
      </button>

      <div className="flex border-t border-[var(--line)]">
        <button
          onClick={() => onRsvp(interested ? null : "interested")}
          disabled={busy}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[13px] font-medium transition-colors ${
            interested
              ? "text-[var(--ink)] bg-[var(--secondary)]"
              : "text-[var(--ink-2)] hover:bg-[var(--secondary)]/50"
          }`}
        >
          <Star className={`h-3.5 w-3.5 ${interested ? "fill-[var(--ink)] text-[var(--ink)]" : ""}`} />
          Interested
        </button>
        <div className="w-px bg-[var(--line)]" />
        <button
          onClick={() => onRsvp(going ? null : "going")}
          disabled={busy}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[13px] font-semibold transition-colors ${
            going
              ? "bg-[var(--accent)] text-white"
              : "text-[var(--ink)] hover:bg-[var(--secondary)]/50"
          }`}
        >
          <Check className="h-3.5 w-3.5" />
          {going ? "Going" : "I'm going"}
        </button>
      </div>
    </article>
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
      <DialogContent className="max-w-[520px] max-h-[90vh] overflow-y-auto p-0 rounded-[var(--radius-xl)] border-[var(--line)] bg-[var(--surface)]">
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
      <div className="relative aspect-[16/10] bg-[var(--secondary)]">
        {event.cover_url ? (
          <img src={event.cover_url} alt={event.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="font-display italic text-[var(--ink-3)] tracking-tight">
              {cat.label.toLowerCase()}
            </span>
          </div>
        )}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/85 backdrop-blur flex items-center justify-center text-[var(--ink)] hover:bg-white shadow-sm"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="absolute bottom-3 left-3 inline-flex items-center px-2.5 py-1 rounded-full bg-white/85 backdrop-blur text-[10px] uppercase tracking-[0.14em] font-medium text-[var(--ink)]">
          {cat.label}
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div>
          <DialogTitle className="font-display text-[26px] tracking-tight leading-tight text-[var(--ink)]">
            {event.title}
          </DialogTitle>
          <DialogDescription className="sr-only">Event details</DialogDescription>
        </div>

        <div className="grid grid-cols-2 gap-y-3 gap-x-4">
          <div>
            <SectionLabel>Date</SectionLabel>
            <p className="text-[13px] text-[var(--ink)] mt-1 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[var(--ink-3)]" />
              {dateLabel}
            </p>
          </div>
          <div>
            <SectionLabel>Time</SectionLabel>
            <p className="text-[13px] text-[var(--ink)] mt-1 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[var(--ink-3)]" />
              {timeLabel}
            </p>
          </div>
          {event.location_name ? (
            <div className="col-span-2">
              <SectionLabel>Where</SectionLabel>
              <p className="text-[13px] text-[var(--ink)] mt-1 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-[var(--ink-3)]" />
                {event.location_name}
                {event.city ? <span className="text-[var(--ink-3)]">, {event.city}</span> : null}
              </p>
            </div>
          ) : null}
          {event.capacity ? (
            <div>
              <SectionLabel>Capacity</SectionLabel>
              <p className="text-[13px] text-[var(--ink)] mt-1 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-[var(--ink-3)]" />
                {event.going_count}/{event.capacity}
              </p>
            </div>
          ) : null}
        </div>

        {event.description ? (
          <div>
            <SectionLabel>Details</SectionLabel>
            <p className="text-[14px] text-[var(--ink-2)] leading-relaxed mt-2 whitespace-pre-wrap">
              {event.description}
            </p>
          </div>
        ) : null}

        <div className="flex items-center gap-3 p-3 rounded-[var(--radius-lg)] bg-[var(--secondary)]/60">
          <Avatar name={event.host.name} url={event.host.avatar_url} size="md" />
          <div className="flex-1 min-w-0">
            <SectionLabel>Hosted by</SectionLabel>
            <p className="font-display text-[16px] tracking-tight text-[var(--ink)] truncate mt-0.5">
              {event.host.name}
            </p>
            {event.host.role ? <p className="text-[12px] text-[var(--ink-2)] truncate">{event.host.role}</p> : null}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-3">
            <SectionLabel>Going · {event.going_count}</SectionLabel>
            {event.interested_count > 0 ? (
              <span className="text-[11px] text-[var(--ink-3)]">{event.interested_count} interested</span>
            ) : null}
          </div>
          {attendeesLoading ? (
            <p className="text-[12px] text-[var(--ink-3)]">Loading…</p>
          ) : attendees.length === 0 ? (
            <p className="text-[12px] text-[var(--ink-3)] italic">Be the first to RSVP.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {attendees.slice(0, 8).map((a) => (
                <div key={a.user_id} className="flex items-center gap-1.5 px-2 py-1 bg-[var(--secondary)] rounded-full">
                  <Avatar name={a.name} url={a.avatar_url} size="xs" />
                  <span className="text-[12px] text-[var(--ink-2)] truncate max-w-[100px]">{a.name}</span>
                </div>
              ))}
              {attendees.length > 8 ? (
                <div className="px-2.5 py-1 bg-[var(--secondary)] rounded-full text-[12px] text-[var(--ink-3)]">
                  +{attendees.length - 8} more
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2 sticky bottom-0 bg-[var(--surface)] pb-1">
          <button
            onClick={() => onRsvp(interested ? null : "interested")}
            disabled={busy}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 h-11 rounded-[var(--radius-lg)] text-[14px] font-medium border transition-colors ${
              interested
                ? "bg-[var(--secondary)] border-[var(--ink)] text-[var(--ink)]"
                : "border-[var(--line)] text-[var(--ink)] hover:bg-[var(--secondary)]"
            }`}
          >
            <Star className={`h-4 w-4 ${interested ? "fill-[var(--ink)]" : ""}`} />
            Interested
          </button>
          <button
            onClick={() => onRsvp(going ? null : "going")}
            disabled={busy}
            className={`flex-[1.4] inline-flex items-center justify-center gap-1.5 h-11 rounded-[var(--radius-lg)] text-[14px] font-semibold transition-colors ${
              going
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--ink)] text-[var(--bg)] hover:opacity-90"
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
      <DialogContent className="max-w-[520px] max-h-[90vh] overflow-y-auto p-0 rounded-[var(--radius-xl)] border-[var(--line)] bg-[var(--surface)]">
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
      <div className="px-5 py-4 border-b border-[var(--line)] flex items-start justify-between sticky top-0 bg-[var(--surface)] z-10">
        <div>
          <SectionLabel>Host an event</SectionLabel>
          <DialogTitle className="font-display text-[22px] tracking-tight text-[var(--ink)] mt-0.5">
            Bring people together.
          </DialogTitle>
        </div>
        <button
          onClick={onClose}
          className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--ink-3)] hover:bg-[var(--secondary)]"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <DialogDescription className="sr-only">Create a new event</DialogDescription>

      <form onSubmit={submit} className="p-5 space-y-4">
        <div>
          <FieldLabel>Cover photo</FieldLabel>
          {coverPreview ? (
            <div className="relative w-full aspect-[16/10] rounded-[var(--radius-lg)] overflow-hidden ring-1 ring-[var(--line)]">
              <img src={coverPreview} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={removeCover}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/65 backdrop-blur text-white flex items-center justify-center"
                aria-label="Remove cover"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full aspect-[16/10] border border-dashed border-[var(--line)] rounded-[var(--radius-lg)] flex flex-col items-center justify-center gap-1.5 text-[var(--ink-3)] hover:border-[var(--ink-3)] hover:text-[var(--ink-2)] transition-colors"
            >
              <ImagePlus className="h-5 w-5" />
              <span className="text-[12px] font-medium uppercase tracking-wider">Add cover</span>
            </button>
          )}
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />
        </div>

        <div>
          <FieldLabel>Category</FieldLabel>
          <div className="grid grid-cols-3 gap-2">
            {EVENT_CATEGORIES.map((c) => {
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`py-2.5 px-2 rounded-[var(--radius-md)] border text-[12px] transition-colors ${
                    active
                      ? "bg-[var(--ink)] border-[var(--ink)] text-[var(--bg)] font-medium"
                      : "border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--secondary)]"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="ce-title">Title</FieldLabel>
          <MInput
            id="ce-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Golden hour photo walk in Brooklyn"
            required
          />
        </div>

        <div>
          <FieldLabel htmlFor="ce-desc">Description</FieldLabel>
          <MTextarea
            id="ce-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Who is this for? What to bring? Meeting point?"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="ce-start">Starts</FieldLabel>
            <input
              id="ce-start"
              type="datetime-local"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
              className="melange-input w-full"
              required
            />
          </div>
          <div>
            <FieldLabel htmlFor="ce-end">Ends (optional)</FieldLabel>
            <input
              id="ce-end"
              type="datetime-local"
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
              className="melange-input w-full"
            />
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="ce-loc">Where</FieldLabel>
          <MInput
            id="ce-loc"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="Washington Square Park"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="ce-city">City</FieldLabel>
            <MInput
              id="ce-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="New York"
            />
          </div>
          <div>
            <FieldLabel htmlFor="ce-cap">Capacity (optional)</FieldLabel>
            <MInput
              id="ce-cap"
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="Unlimited"
            />
          </div>
        </div>

        {error ? <ErrorMessage>{error}</ErrorMessage> : null}

        <button
          type="submit"
          disabled={busy}
          className="w-full h-11 inline-flex items-center justify-center gap-2 bg-[var(--ink)] text-[var(--bg)] rounded-[var(--radius-lg)] text-[14px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {busy ? "Creating…" : "Publish event"}
        </button>
      </form>
    </>
  );
}
