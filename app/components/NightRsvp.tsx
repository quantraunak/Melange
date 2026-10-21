"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "../lib/supabaseClient";
import { APP_STORE_URL, IOS_LIVE } from "../lib/site";
import { rsvpByLink } from "../lib/webRsvp";

/**
 * "I'm going" on a night's share page: name + email through rsvp_by_link,
 * no account needed. The guest list above is server-rendered, so a
 * successful RSVP refreshes the route to put their face on it.
 */
export default function NightRsvp({ eventId, ended }: { eventId: string; ended: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ hasAccount: boolean } | null>(null);

  const openInApp = `melange://event/${eventId}`;

  const secondary =
    "inline-flex w-full items-center justify-center rounded-lg border border-ink bg-white px-6 py-3 text-base font-semibold text-ink transition hover:bg-ink hover:text-paper sm:w-auto";
  const primary =
    "melange-btn-primary inline-flex w-full items-center justify-center rounded-lg px-6 py-3 text-base font-semibold text-white disabled:opacity-60 sm:w-auto";

  if (ended) {
    return (
      <div className="border-l-2 border-ink py-1 pl-5 text-muted-ink">
        <p className="font-display text-2xl font-semibold text-ink">This already happened</p>
        <p className="mt-1 text-sm">
          If you were there, the photos from it are in Melange.
        </p>
        <a href={openInApp} className={`${secondary} mt-4`}>
          Open Melange
        </a>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setError(null);
    setSending(true);
    const res = await rsvpByLink(supabase, eventId, first, last, email);
    setSending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDone({ hasAccount: res.hasAccount });
    router.refresh();
  }

  if (done) {
    return (
      <div className="border-l-2 border-ink py-1 pl-5 text-ink" role="status">
        <p className="font-display text-2xl font-semibold">You&apos;re going.</p>
        {done.hasAccount ? (
          <>
            <p className="mt-2 text-muted-ink">Open Melange; it&apos;s on your events already.</p>
            <a href={openInApp} className={`${primary} mt-4`}>
              Open Melange
            </a>
          </>
        ) : (
          <>
            <p className="mt-2 leading-relaxed text-muted-ink">
              Get Melange to see who&apos;s going, join the event chat, and get the photos after. Sign up
              with the same email and this event is already on your list.
            </p>
            {IOS_LIVE ? (
              <a href={APP_STORE_URL} className={`${primary} mt-4`}>
                Download on the App Store
              </a>
            ) : null}
          </>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={() => setOpen(true)} className={primary}>
          I&apos;m going
        </button>
        <a href={openInApp} className={secondary}>
          Already have it? Open the app
        </a>
      </div>
    );
  }

  const field =
    "mt-1 w-full min-w-0 rounded-md border border-rule bg-white px-3 py-2.5 text-ink placeholder:text-stone-400 focus:border-ink focus:outline-none";

  return (
    <form
      onSubmit={submit}
      noValidate
      className="grid grid-cols-1 gap-4 border-y border-rule py-6 sm:grid-cols-2"
    >
      <p className="text-sm text-muted-ink sm:col-span-2">
        No app needed. The guest list shows your first name.
      </p>
      <label className="block">
        <span className="text-sm font-medium text-ink">First name</span>
        <input
          type="text"
          autoComplete="given-name"
          required
          autoFocus
          value={first}
          onChange={(e) => setFirst(e.target.value)}
          maxLength={30}
          className={field}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-ink">Last name</span>
        <input
          type="text"
          autoComplete="family-name"
          value={last}
          onChange={(e) => setLast(e.target.value)}
          maxLength={29}
          className={field}
        />
      </label>
      <label className="block sm:col-span-2">
        <span className="text-sm font-medium text-ink">Email</span>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          maxLength={200}
          className={field}
        />
      </label>
      {error ? (
        <p className="text-sm text-red-700 sm:col-span-2" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row">
        <button type="submit" disabled={sending} className={primary}>
          {sending ? "Saving your spot…" : "Save my spot"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="inline-flex w-full items-center justify-center rounded-lg px-6 py-3 text-base font-medium text-muted-ink hover:text-ink sm:w-auto"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
