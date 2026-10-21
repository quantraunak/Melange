import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FoundingMark, GetTheAppCta, RemoteImg, SiteFooter, SiteHeader } from "../../components/SiteChrome";
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
    <main className="min-h-screen overflow-x-hidden bg-paper text-ink">
      <SiteHeader />

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        {/* Header */}
        <section className="flex flex-col items-start sm:flex-row sm:items-center sm:gap-8">
          <div className="h-28 w-28 shrink-0 overflow-hidden rounded-full border border-rule bg-stone-200">
            {p.avatar_url ? (
              <RemoteImg src={p.avatar_url} alt={name} eager className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-display text-4xl font-semibold text-muted-ink">
                {name.replace(/^@/, "").charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="mt-5 min-w-0 sm:mt-0">
            <h1 className="break-words font-display text-5xl font-semibold leading-[1.05] tracking-tight">{name}</h1>
            <p className="mt-1 text-muted-ink">@{p.handle}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {p.founding ? <FoundingMark /> : null}
              {p.role ? (
                <span className="rounded-md border border-rule px-2 py-0.5 text-xs font-medium text-ink">
                  {p.role}
                </span>
              ) : null}
              {scene ? (
                <span className="rounded-md border border-rule px-2 py-0.5 text-xs font-medium text-ink">
                  {scene}
                </span>
              ) : null}
              {p.confirmed_credits > 0 ? (
                <span className="text-xs font-medium text-muted-ink">
                  ✓ {p.confirmed_credits} confirmed credit{p.confirmed_credits === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
            {p.bio ? (
              <p className="mt-4 max-w-xl whitespace-pre-line break-words leading-relaxed text-ink">
                {p.bio}
              </p>
            ) : null}
            {p.instagram_url && /^https?:\/\//i.test(p.instagram_url) ? (
              <a
                href={p.instagram_url}
                rel="noopener noreferrer nofollow"
                target="_blank"
                className="mt-3 inline-block text-sm font-medium text-action underline underline-offset-4"
              >
                Instagram
              </a>
            ) : null}
          </div>
        </section>

        {/* Photos */}
        {p.portfolio_urls.length > 0 ? (
          <section className="mt-12">
            <h2 className="melange-label mb-4">Photos</h2>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {p.portfolio_urls.map((url, i) => (
                <div key={url + i} className="aspect-[4/5] min-w-0 overflow-hidden rounded-sm bg-stone-200">
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
          <h2 className="melange-label mb-4">Shoots</h2>
          {p.shoots.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 min-[420px]:grid-cols-2 sm:grid-cols-3">
              {p.shoots.map((s) => (
                <Link
                  key={s.id}
                  href={`/s/${s.id}`}
                  className="group block min-w-0"
                >
                  <div className="aspect-[4/5] overflow-hidden rounded-sm bg-stone-200">
                    {s.cover_url ? (
                      <RemoteImg
                        src={s.cover_url}
                        alt={s.title || "Shoot"}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <p className="mt-2 truncate font-display text-lg font-semibold text-ink group-hover:underline">
                    {s.title || "Untitled shoot"}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted-ink">No public shoots yet.</p>
          )}
        </section>

        {/* CTA */}
        <GetTheAppCta heading={`Find ${name} on Melange`} />
      </div>

      <SiteFooter />
    </main>
  );
}
