import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FoundingMark, RemoteImg, SiteFooter, SiteHeader } from "../../components/SiteChrome";
import { getPublicProfile } from "../../lib/publicData";
import { sceneLabel } from "../../lib/scenes";

/**
 * Public profile. Reached as /@handle through the rewrite in next.config.ts
 * (/@:handle → /u/:handle); the link that goes in an Instagram bio.
 */

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const p = await getPublicProfile(handle);
  if (!p) return { title: "Not found" };
  const name = p.name || `@${p.handle}`;
  const scene = sceneLabel(p.scene);
  const description =
    p.bio?.slice(0, 160) ||
    [p.role, scene ? `${scene} scene` : null, "on Melange"].filter(Boolean).join(" · ");
  const image = p.avatar_url || p.portfolio_urls[0];
  return {
    title: `${name} (@${p.handle})`,
    description,
    alternates: { canonical: `/@${p.handle}` },
    openGraph: {
      title: `${name} on Melange`,
      description,
      url: `/@${p.handle}`,
      type: "profile",
      ...(image ? { images: [{ url: image, alt: name }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: `${name} on Melange`,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { handle } = await params;
  const p = await getPublicProfile(handle);
  if (!p) notFound();

  const name = p.name || `@${p.handle}`;
  const scene = sceneLabel(p.scene);

  return (
    <main className="min-h-screen overflow-x-hidden bg-white">
      <SiteHeader />

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        {/* Header */}
        <section className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:gap-8 sm:text-left">
          <div className="h-28 w-28 shrink-0 overflow-hidden rounded-full border border-indigo-100 bg-indigo-50">
            {p.avatar_url ? (
              <RemoteImg src={p.avatar_url} alt={name} eager className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-4xl font-bold text-indigo-300">
                {name.replace(/^@/, "").charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="mt-5 min-w-0 sm:mt-0">
            <h1 className="break-words text-4xl font-bold tracking-tight text-slate-900">{name}</h1>
            <p className="mt-1 text-slate-500">@{p.handle}</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {p.founding ? <FoundingMark /> : null}
              {p.role ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                  {p.role}
                </span>
              ) : null}
              {scene ? (
                <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
                  {scene}
                </span>
              ) : null}
              {p.confirmed_credits > 0 ? (
                <span className="text-xs font-medium text-slate-600">
                  ✓ {p.confirmed_credits} confirmed credit{p.confirmed_credits === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
            {p.bio ? (
              <p className="mt-4 max-w-xl whitespace-pre-line break-words leading-relaxed text-slate-700">
                {p.bio}
              </p>
            ) : null}
            {p.instagram_url && /^https?:\/\//i.test(p.instagram_url) ? (
              <a
                href={p.instagram_url}
                rel="noopener noreferrer nofollow"
                target="_blank"
                className="mt-3 inline-block text-sm font-medium text-indigo-700 underline underline-offset-4"
              >
                Instagram
              </a>
            ) : null}
          </div>
        </section>

        {/* Photos */}
        {p.portfolio_urls.length > 0 ? (
          <section className="mt-12">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Photos</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {p.portfolio_urls.map((url, i) => (
                <div key={url + i} className="aspect-[4/5] min-w-0 overflow-hidden rounded-xl bg-slate-100">
                  <RemoteImg
                    src={url}
                    alt={`${name}, photo ${i + 1}`}
                    eager={i < 3}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Shoots */}
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Shoots</h2>
          {p.shoots.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:grid-cols-3">
              {p.shoots.map((s) => (
                <Link
                  key={s.id}
                  href={`/s/${s.id}`}
                  className="melange-card group block min-w-0 overflow-hidden rounded-2xl"
                >
                  <div className="aspect-[4/5] overflow-hidden bg-slate-100">
                    {s.cover_url ? (
                      <RemoteImg
                        src={s.cover_url}
                        alt={s.title || "Shoot"}
                        className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                      />
                    ) : null}
                  </div>
                  <p className="truncate px-4 py-3 font-medium text-slate-900">
                    {s.title || "Untitled shoot"}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-slate-500">No public shoots yet.</p>
          )}
        </section>

        {/* CTA */}
        <section className="melange-bg mt-16 rounded-3xl px-6 py-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Melange is invite-only — join the waitlist
          </h2>
          <p className="mx-auto mt-3 max-w-md text-slate-600">
            Where young creatives find their crew — the people, the nights, the ideas.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/join"
              className="melange-btn-primary inline-flex w-full items-center justify-center rounded-xl px-7 py-3.5 text-base font-semibold text-white sm:w-auto"
            >
              Join the waitlist
            </Link>
            <Link
              href="/join"
              className="text-sm font-medium text-indigo-700 underline underline-offset-4"
            >
              I have a code
            </Link>
          </div>
        </section>
      </div>

      <SiteFooter />
    </main>
  );
}
