import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GetTheAppCta, RemoteImg, SiteFooter, SiteHeader } from "../../components/SiteChrome";
import { getSharedStory } from "../../lib/publicData";

/** A shared shoot (collab_stories), readable signed out when it's public. */

type Props = { params: Promise<{ id: string }> };

/** happened_on is a DATE ("2026-10-04"); format it without a timezone shift. */
function formatDate(d: string | null): string | null {
  if (!d) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) return null;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const s = await getSharedStory(id);
  if (!s) return { title: "Not found" };
  const title = s.title || "A shoot on Melange";
  const by = s.author?.name ? `By ${s.author.name}` : "On Melange";
  const description = s.story?.slice(0, 160) || `${by}, with credits for everyone who made it.`;
  const image = s.media_urls?.[0];
  return {
    title,
    description,
    alternates: { canonical: `/s/${s.id}` },
    openGraph: {
      title,
      description,
      url: `/s/${s.id}`,
      type: "article",
      ...(image ? { images: [{ url: image, alt: title }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function SharedShootPage({ params }: Props) {
  const { id } = await params;
  const s = await getSharedStory(id);
  if (!s) notFound();

  const title = s.title || "Untitled shoot";
  const date = formatDate(s.happened_on);
  const photos = s.media_urls ?? [];

  return (
    <main className="min-h-screen overflow-x-hidden bg-white">
      <SiteHeader />

      <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <header>
          <h1 className="break-words text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            {title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-slate-600">
            {s.author?.name ? (
              <span className="inline-flex min-w-0 items-center gap-2">
                <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-indigo-50">
                  {s.author.avatar_url ? (
                    <RemoteImg
                      src={s.author.avatar_url}
                      alt={s.author.name}
                      eager
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </span>
                <span className="truncate font-medium text-slate-900">{s.author.name}</span>
                {s.author.role ? <span className="text-slate-500">· {s.author.role}</span> : null}
              </span>
            ) : null}
            {date ? <span className="text-slate-500">{date}</span> : null}
          </div>
        </header>

        {photos.length > 0 ? (
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {photos.map((url, i) => (
              <div
                key={url + i}
                className={`min-w-0 overflow-hidden rounded-2xl bg-slate-100 ${
                  i === 0 && photos.length % 2 === 1 ? "sm:col-span-2" : ""
                }`}
              >
                <RemoteImg
                  src={url}
                  alt={`${title}, photo ${i + 1}`}
                  eager={i === 0}
                  className="h-auto w-full"
                />
              </div>
            ))}
          </div>
        ) : null}

        {s.story ? (
          <p className="mt-8 max-w-2xl whitespace-pre-line break-words text-lg leading-relaxed text-slate-700">
            {s.story}
          </p>
        ) : null}

        {s.credits.length > 0 ? (
          <section className="mt-10">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Credits</h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {s.credits.map((c, i) => (
                <li
                  key={(c.user_id ?? c.name ?? "") + i}
                  className="melange-card flex min-w-0 items-center gap-3 rounded-xl p-3"
                >
                  <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-indigo-50">
                    {c.avatar_url ? (
                      <RemoteImg
                        src={c.avatar_url}
                        alt={c.name ?? ""}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900">
                      {c.name || "Someone"}
                      {c.confirmed ? (
                        <span
                          className="ml-1.5 text-indigo-700"
                          title="Confirmed by them on Melange"
                          aria-label="confirmed"
                        >
                          ✓
                        </span>
                      ) : null}
                    </span>
                    {c.role ? <span className="block truncate text-sm text-slate-500">{c.role}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">✓ means they confirmed the credit themselves.</p>
          </section>
        ) : null}

        <GetTheAppCta heading="Made by a crew on Melange" />
      </article>

      <SiteFooter />
    </main>
  );
}
