import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  GetTheAppCta,
  RemoteImg,
  SiteFooter,
  SiteHeader,
} from "../../components/SiteChrome";
import { getSharedProject, type SharedProject } from "../../lib/publicData";

/**
 * A project shared by link (collab_posts), readable signed out while it's
 * active. Crew calls already travel through group chats, Instagram stories
 * and r/USC; this is what lands there.
 */

type Props = { params: Promise<{ id: string }> };

const PAY: Record<string, string> = {
  paid: "Paid",
  tfp: "Trade",
  credit: "Credit",
};

function payLabel(p: SharedProject): string | null {
  const keys = p.pay_types.length
    ? p.pay_types
    : p.pay_type
      ? [p.pay_type]
      : [];
  const labels = keys.map((k) => PAY[k]).filter(Boolean);
  if (labels.length) return labels.join(" + ");
  return p.compensation || null;
}

/** project_start/end are DATEs; format without a timezone shift. */
function fmt(d: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) return null;
  return new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])),
  ).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function dates(p: SharedProject): string | null {
  if (!p.project_start) return null;
  const start = fmt(p.project_start);
  if (!start) return null;
  if (!p.project_end || p.project_end === p.project_start) return start;
  const end = fmt(p.project_end);
  return end ? `${start} to ${end}` : start;
}

function place(p: SharedProject): string | null {
  const loc = p.location?.trim() || null;
  if (p.is_remote) return loc ? `${loc} · or remote` : "Remote";
  return loc;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = await getSharedProject(id);
  if (!p) return { title: "Not found" };
  const needs = p.roles.length
    ? `Looking for: ${p.roles.join(", ")}`
    : "Looking for collaborators";
  const description = [needs, p.description]
    .filter(Boolean)
    .join(". ")
    .slice(0, 160);
  const image = p.media_urls[0];
  return {
    title: p.title,
    description,
    alternates: { canonical: `/p/${p.id}` },
    openGraph: {
      title: p.title,
      description,
      url: `/p/${p.id}`,
      type: "article",
      ...(image ? { images: [{ url: image, alt: p.title }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: p.title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function SharedProjectPage({ params }: Props) {
  const { id } = await params;
  const p = await getSharedProject(id);
  if (!p) notFound();

  const facts = [
    { label: "When", value: dates(p) },
    { label: "Where", value: place(p) },
    { label: "Pay", value: payLabel(p) },
  ].filter((f): f is { label: string; value: string } => !!f.value);
  const first = (p.owner.name || "").split(" ")[0];

  return (
    <main className="min-h-screen overflow-x-hidden bg-paper text-ink">
      <SiteHeader />

      <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <header>
          <p className="melange-label mb-3">A project on Melange</p>
          <h1 className="break-words font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            {p.title}
          </h1>
          {p.owner.name ? (
            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-muted-ink">
              <span className="inline-flex min-w-0 items-center gap-2">
                <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-stone-200">
                  {p.owner.avatar_url ? (
                    <RemoteImg
                      src={p.owner.avatar_url}
                      alt={p.owner.name}
                      eager
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </span>
                {p.owner.handle ? (
                  <Link
                    href={`/@${p.owner.handle}`}
                    className="truncate font-medium text-ink underline-offset-4 hover:underline"
                  >
                    {p.owner.name}
                  </Link>
                ) : (
                  <span className="truncate font-medium text-ink">
                    {p.owner.name}
                  </span>
                )}
                {p.owner.role && p.owner.role !== "other" ? (
                  <span>· {p.owner.role}</span>
                ) : null}
              </span>
            </div>
          ) : null}
        </header>

        {p.roles.length > 0 ? (
          <section className="mt-8">
            <h2 className="melange-label mb-2">Looking for</h2>
            <ul className="flex flex-wrap gap-2">
              {p.roles.map((r) => (
                <li
                  key={r}
                  className="rounded-full border border-rule px-3 py-1 text-sm font-medium text-ink"
                >
                  {r}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {p.description ? (
          <p className="mt-8 max-w-2xl whitespace-pre-line break-words text-lg leading-relaxed text-ink">
            {p.description}
          </p>
        ) : null}

        {facts.length > 0 ? (
          <dl className="mt-8 grid max-w-2xl grid-cols-1 border-t border-rule sm:grid-cols-3">
            {facts.map((f) => (
              <div
                key={f.label}
                className="min-w-0 border-b border-rule py-3 sm:pr-4"
              >
                <dt className="text-sm text-muted-ink">{f.label}</dt>
                <dd className="break-words font-medium text-ink">{f.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {p.media_urls.length > 0 ? (
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {p.media_urls.map((url, i) => (
              <div
                key={url + i}
                className={`min-w-0 overflow-hidden rounded-sm bg-stone-200 ${
                  i === 0 && p.media_urls.length % 2 === 1
                    ? "sm:col-span-2"
                    : ""
                }`}
              >
                <RemoteImg
                  src={url}
                  alt={`${p.title}, photo ${i + 1}`}
                  eager={i === 0}
                  className="h-auto w-full"
                />
              </div>
            ))}
          </div>
        ) : null}

        <GetTheAppCta
          heading={
            first
              ? `Want in? Like it on Melange and ${first} can say yes`
              : "Want in? Like it on Melange"
          }
        />
      </article>

      <SiteFooter />
    </main>
  );
}
