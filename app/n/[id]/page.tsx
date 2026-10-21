import type { Metadata } from "next";
import { notFound } from "next/navigation";

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
  const initial = Array.from((name ?? "").trim())[0]?.toUpperCase() || "?";
  return (
    <span
      aria-hidden={src ? undefined : true}
      className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-200 font-display text-lg font-semibold text-ink"
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
    <main className="min-h-screen overflow-x-hidden bg-paper text-ink">
      <SiteHeader />

      <article className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
        {e.cover_url ? (
          <div className="aspect-[4/3] w-full overflow-hidden rounded-sm bg-stone-200 sm:aspect-[16/9]">
            <RemoteImg src={e.cover_url} alt={e.title} eager className="h-full w-full object-cover" />
          </div>
        ) : null}

        {/* No cover photo: the header is the flyer, type on paper. */}
        <header className={e.cover_url ? "mt-6" : "border-y-2 border-ink py-8 sm:py-10"}>
          <p className="melange-label">You&apos;re invited to a night</p>
          <h1
            className={`mt-3 break-words font-display font-semibold leading-[1.05] tracking-tight ${
              e.cover_url ? "text-4xl sm:text-5xl" : "text-5xl sm:text-7xl"
            }`}
          >
            {e.title}
          </h1>
          <dl className="mt-6 grid grid-cols-[4rem_1fr] gap-x-3 gap-y-2">
            {when ? (
              <>
                <dt className="melange-label pt-0.5">When</dt>
                <dd className="min-w-0">{when}</dd>
              </>
            ) : null}
            {e.location_name ? (
              <>
                <dt className="melange-label pt-0.5">Where</dt>
                <dd className="min-w-0 break-words">{e.location_name}</dd>
              </>
            ) : null}
            {e.host?.name ? (
              <>
                <dt className="melange-label pt-0.5">Host</dt>
                <dd className="flex min-w-0 items-center gap-2">
                  {e.host.avatar_url ? (
                    <span className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-stone-200">
                      <RemoteImg src={e.host.avatar_url} alt={e.host.name} className="h-full w-full object-cover" />
                    </span>
                  ) : null}
                  <span className="min-w-0 truncate">{e.host.name}</span>
                </dd>
              </>
            ) : null}
          </dl>
        </header>

        <div className="mt-8">
          <NightRsvp eventId={e.id} ended={nightHasEnded(e.start_at, e.end_at)} />
        </div>

        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold">{e.going_count} going</h2>
          {e.going.length > 0 ? (
            // 64px cells + 8px gaps: four a row at 320px (288px of content).
            <ul className="mt-4 flex flex-wrap gap-x-2 gap-y-4">
              {e.going.map((p, i) => (
                <li key={i} className="flex w-16 min-w-0 flex-col items-center gap-1.5">
                  <Face name={p.name} src={p.avatar_url} />
                  <span className="w-full truncate text-center text-xs text-muted-ink">
                    {p.name || "Someone"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-muted-ink">Be the first to say you&apos;re going.</p>
          )}
          {e.going_count > e.going.length ? (
            <p className="mt-3 text-sm text-muted-ink">
              and {e.going_count - e.going.length} more
            </p>
          ) : null}
        </section>

        {e.description ? (
          <section className="mt-10">
            <h2 className="font-display text-2xl font-semibold">About the night</h2>
            <p className="mt-3 whitespace-pre-line break-words leading-relaxed text-ink">
              {e.description}
            </p>
          </section>
        ) : null}

        <p className="mt-12 border-t border-rule pt-6 text-sm text-muted-ink">
          Melange is free on iPhone. Nights are invite-only; a friend sent you this one.
        </p>
      </article>

      <SiteFooter />
    </main>
  );
}
