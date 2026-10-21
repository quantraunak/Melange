"use client";

import { useState } from "react";

import { supabase } from "../lib/supabaseClient";
import { SCENES, type WaitlistScene } from "../lib/scenes";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Writes to `waitlist` (23_scenes_invites_nights.sql): insert-only for
 * anon, unique on lower(email), capped at 200 an hour by a trigger.
 * Shared by the landing page and /join without a code. Since 1.9 the app
 * is open to anyone, so this is "the list for the next night", not a gate.
 */
export default function WaitlistForm({ defaultScene = "" }: { defaultScene?: WaitlistScene | "" }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [scene, setScene] = useState<WaitlistScene | "">(defaultScene);
  const [instagram, setInstagram] = useState("");
  const [makes, setMakes] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "already">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanEmail = email.trim();
    if (!EMAIL_RE.test(cleanEmail)) {
      setError("That email doesn't look right.");
      return;
    }
    if (!scene) {
      setError("Pick the scene you're closest to (or Somewhere else).");
      return;
    }
    setState("sending");
    // No .select(): anon has no SELECT policy on waitlist, so asking for the
    // row back would fail. A rejected INSERT returns an error, so checking
    // it is enough to know the row landed.
    const ig = instagram.trim().replace(/^@+/, "");
    const { error: insertError } = await supabase.from("waitlist").insert({
      email: cleanEmail,
      name: name.trim() || null,
      scene,
      instagram: ig ? `@${ig}` : null,
      what_you_make: makes.trim() || null,
    });
    if (insertError) {
      // 23505 = unique_violation on lower(email): they're already in.
      if (insertError.code === "23505") {
        setState("already");
        return;
      }
      setState("idle");
      setError(insertError.message || "That didn't go through. Please try again.");
      return;
    }
    setState("sent");
  }

  if (state === "sent" || state === "already") {
    return (
      <div className="border-l-2 border-ink py-1 pl-5 text-ink" role="status">
        <p className="font-display text-2xl font-semibold">
          {state === "sent" ? "You're on the list." : "You're already on the list."}
        </p>
        <p className="mt-2 leading-relaxed text-muted-ink">
          {state === "sent"
            ? "We'll tell you when Melange opens near you. Meanwhile, the app is open: download it and say hi."
            : "No need to sign up twice. We'll tell you when Melange opens near you."}
        </p>
      </div>
    );
  }

  const field =
    "mt-1 w-full min-w-0 rounded-md border border-rule bg-white px-3 py-2.5 text-ink placeholder:text-stone-400 focus:border-ink focus:outline-none";

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
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
      <label className="block">
        <span className="text-sm font-medium text-ink">Name</span>
        <input
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          className={field}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-ink">Scene</span>
        <select
          value={scene}
          onChange={(e) => setScene(e.target.value as WaitlistScene | "")}
          className={field}
        >
          <option value="" disabled>
            Choose one
          </option>
          {SCENES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
              {s.live ? "" : " (soon)"}
            </option>
          ))}
          <option value="other">Somewhere else</option>
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium text-ink">Instagram</span>
        <input
          type="text"
          autoCapitalize="none"
          autoCorrect="off"
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          placeholder="@yourhandle"
          maxLength={60}
          className={field}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-ink">What you make</span>
        <input
          type="text"
          value={makes}
          onChange={(e) => setMakes(e.target.value)}
          placeholder="film photos, sets, zines, music…"
          maxLength={300}
          className={field}
        />
      </label>
      {error ? <p className="text-sm text-red-700 sm:col-span-2">{error}</p> : null}
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={state === "sending"}
          className="w-full rounded-lg border border-ink bg-white px-6 py-3 text-base font-semibold text-ink transition hover:bg-ink hover:text-paper disabled:opacity-60 sm:w-auto"
        >
          {state === "sending" ? "Adding you…" : "Get on the list"}
        </button>
      </div>
    </form>
  );
}
