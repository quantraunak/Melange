import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin } from "lucide-react";

import { RemoteImg, SiteFooter, SiteHeader } from "../../components/SiteChrome";
import { formatNightWhen, getSharedEvent, sharedEventSummary } from "../../lib/publicData";
import { nightHasEnded } from "../../lib/webRsvp";
import NightRsvp from "../../components/NightRsvp";

/**
 * A night's invite link (Invite friends in the app shares /n/<event_id>).
 * Readable signed out through get_shared_event, which only exposes first
 * names and photos of the people going. "I'm going" works without the app
 * (rsvp_by_link: name + email); the app is the next step, not the gate.
 * Canceled nights come back null from get_shared_event, so they 404.
 */

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const e = await getSharedEvent(id);
  if (!e) return { title: "Not found" };
  const description = sharedEventSummary(e);
  const image = e.cover_url;
  return {
    title: e.title,
    description,
    alternates: { canonical: `/n/${e.id}` },
    // The link travels by hand; a night's guest list shouldn't be searchable.
    robots: { index: false, follow: true },
    openGraph: {
      title: e.title,
      description,
      url: `/n/${e.id}`,
      type: "website",
      ...(image ? { images: [{ url: image, alt: e.title }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: e.title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

/** A photo, or for people without one (everyone who said yes on the web) their first initial. */
function Face({ name, src }: { name: string | null; src: string | null }) {
  const initial = Array.from((name ?? "").trim())[0]?.toUpperCase() || "✦";
  return (
    <span
      aria-hidden={src ? undefined : true}
      className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-50 to-violet-100 text-lg font-semibold text-indigo-700 ring-2 ring-white"
    >
      {src ? <RemoteImg src={src} alt={name ?? ""} className="h-full w-full object-cover" /> : initial}
    </span>
  );
}

export default async function SharedNightPage({ params }: Props) {
  const { id } = await params;
  const e = await getSharedEvent(id);
  if (!e) notFound();

  const when = formatNightWhen(e.start_at, e.end_at);

  return (
    <main className="min-h-screen overflow-x-hidden bg-white">
      <SiteHeader />

      <article className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-200 via-violet-100 to-rose-100 sm:aspect-[16/9]">
          {e.cover_url ? (
            <RemoteImg src={e.cover_url} alt={e.title} eager className="h-full w-full object-cover" />
          ) : (
            <span
              aria-hidden
              className="melange-wordmark absolute inset-0 flex items-center justify-center text-6xl font-bold"
            >
              ✦
            </span>
          )}
        </div>

        <header className="mt-6">
          <p className="text-sm font-medium text-indigo-700">You&apos;re invited to a night</p>
          <h1 className="mt-1 break-words text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {e.title}
          </h1>
          <ul className="mt-4 space-y-2 text-slate-700">
            {when ? (
              <li className="flex items-start gap-2">
                <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" aria-hidden />
                <span className="min-w-0">{when}</span>
              </li>
            ) : null}
            {e.location_name ? (
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" aria-hidden />
                <span className="min-w-0 break-words">{e.location_name}</span>
              </li>
            ) : null}
          </ul>
          {e.host?.name ? (
            <p className="mt-4 flex items-center gap-2 text-slate-600">
              <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-indigo-50">
                {e.host.avatar_url ? (
                  <RemoteImg src={e.host.avatar_url} alt={e.host.name} className="h-full w-full object-cover" />
                ) : null}
              </span>
              <span className="min-w-0 truncate">
                Hosted by <span className="font-medium text-slate-900">{e.host.name}</span>
              </span>
            </p>
          ) : null}
        </header>

        <div className="mt-8">
          <NightRsvp eventId={e.id} ended={nightHasEnded(e.start_at, e.end_at)} />
        </div>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-slate-900">
            {e.going_count} going
          </h2>
          {e.going.length > 0 ? (
            // 64px cells + 8px gaps: four a row at 320px (288px of content).
            <ul className="mt-4 flex flex-wrap gap-x-2 gap-y-4">
              {e.going.map((p, i) => (
                <li key={i} className="flex w-16 min-w-0 flex-col items-center gap-1.5">
                  <Face name={p.name} src={p.avatar_url} />
                  <span className="w-full truncate text-center text-xs text-slate-600">
                    {p.name || "Someone"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-slate-600">Be the first to say you&apos;re going.</p>
          )}
          {e.going_count > e.going.length ? (
            <p className="mt-3 text-sm text-slate-500">
              and {e.going_count - e.going.length} more
            </p>
          ) : null}
        </section>

        {e.description ? (
          <section className="mt-10">
            <h2 className="text-xl font-semibold text-slate-900">About the night</h2>
            <p className="mt-3 whitespace-pre-line break-words leading-relaxed text-slate-700">
              {e.description}
            </p>
          </section>
        ) : null}

        <p className="mt-12 text-center text-sm text-slate-500">
          Melange is free on iPhone. Nights are invite-only — a friend sent you this one.
        </p>
      </article>

      <SiteFooter />
    </main>
  );
}
