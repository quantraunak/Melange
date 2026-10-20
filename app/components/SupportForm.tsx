"use client";

import { useEffect, useState } from "react";

import { supabase } from "../lib/supabaseClient";

const TOPICS = [
  { value: "help", label: "Help with my account" },
  { value: "safety", label: "Safety or a report" },
  { value: "privacy", label: "Privacy or a data request" },
  { value: "bug", label: "Something is broken" },
  { value: "other", label: "Something else" },
] as const;

type Topic = (typeof TOPICS)[number]["value"];

/**
 * Writes to support_requests (21_trust_and_support.sql), which pushes to the
 * admins. This replaced a mailto: to support@melange.app, a parked domain we
 * do not own, so every email sent there was undeliverable.
 */
export default function SupportForm({ initialTopic = "help" }: { initialTopic?: Topic }) {
  const [topic, setTopic] = useState<Topic>(initialTopic);
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  // Signed in on this browser: attach the account and prefill the email.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      if (data.user.email) setContact((c) => c || data.user!.email!);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (contact.trim().length < 3) {
      setError("Add an email or phone number so we can write back.");
      return;
    }
    if (!message.trim()) {
      setError("Tell us what's going on.");
      return;
    }
    setState("sending");
    // No .select() here: the table has no SELECT policy on purpose, so asking
    // for the row back would fail. An INSERT that RLS rejects raises an error,
    // unlike a zero-row UPDATE, so checking the error is enough.
    const { error: insertError } = await supabase
      .from("support_requests")
      .insert({ user_id: userId, contact: contact.trim(), topic, message: message.trim() });
    if (insertError) {
      setState("idle");
      setError(insertError?.message ?? "That didn't go through. Please try again.");
      return;
    }
    setState("sent");
  }

  if (state === "sent") {
    return (
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-5 text-indigo-950">
        <p className="font-semibold">Got it. A person will read this.</p>
        <p className="mt-1 text-sm text-indigo-900/80">
          We&apos;ll reply to {contact.trim()}, usually within 2 business days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-gray-900">What is this about?</span>
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value as Topic)}
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
        >
          {TOPICS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium text-gray-900">Where should we reply?</span>
        <input
          type="text"
          inputMode="email"
          autoComplete="email"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="you@example.com"
          maxLength={200}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-gray-900">Message</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          maxLength={4000}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
        />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={state === "sending"}
        className="melange-btn-primary rounded-xl px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {state === "sending" ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
