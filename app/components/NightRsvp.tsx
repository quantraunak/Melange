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
    "inline-flex w-full items-center justify-center rounded-xl border border-indigo-200 bg-white px-7 py-3.5 text-base font-semibold text-indigo-900 transition hover:bg-indigo-50 sm:w-auto";
  const primary =
    "melange-btn-primary inline-flex w-full items-center justify-center rounded-xl px-7 py-3.5 text-base font-semibold text-white disabled:opacity-60 sm:w-auto";

  if (ended) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-700">
        <p className="font-semibold text-slate-900">This night already happened</p>
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
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 text-indigo-950 sm:p-6" role="status">
        <p className="text-lg font-semibold">You&apos;re on the list ✦</p>
        {done.hasAccount ? (
          <>
            <p className="mt-1.5 text-indigo-900/80">Open Melange — it&apos;s on your nights already.</p>
            <a href={openInApp} className={`${primary} mt-4`}>
              Open Melange
            </a>
          </>
        ) : (
          <>
            <p className="mt-1.5 text-indigo-900/80">
              Get Melange to see who&apos;s going, chat with the night, and get the photos after. Sign up
              with the same email and this night is already on your list.
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
    "mt-1 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

  return (
    <form
      onSubmit={submit}
      noValidate
      className="grid grid-cols-1 gap-4 rounded-2xl border border-indigo-100 bg-white p-5 sm:grid-cols-2 sm:p-6"
    >
      <p className="text-sm text-slate-600 sm:col-span-2">
        No app needed. The guest list shows your first name.
      </p>
      <label className="block">
        <span className="text-sm font-medium text-slate-900">First name</span>
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
        <span className="text-sm font-medium text-slate-900">Last name</span>
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
        <span className="text-sm font-medium text-slate-900">Email</span>
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
          className="inline-flex w-full items-center justify-center rounded-xl px-7 py-3.5 text-base font-medium text-slate-600 hover:text-slate-900 sm:w-auto"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
