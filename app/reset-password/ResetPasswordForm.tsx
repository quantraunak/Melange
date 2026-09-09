"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Where a recovery email lands.
 *
 * The link Supabase mails out redirects here with the recovery token in the URL
 * fragment; the browser client picks that up on load (detectSessionInUrl) and
 * fires PASSWORD_RECOVERY, which leaves us holding a short-lived session that
 * is good for exactly one thing — updateUser({ password }).
 *
 * The iPhone app sends people here too, rather than to a melange:// deep link:
 * recovery mail often gets opened on a laptop, where a deep link is a dead end.
 */

type Status = "checking" | "ready" | "invalid" | "done";

const MIN_PASSWORD = 8;

export default function ResetPasswordForm() {
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setStatus("ready");
    });

    (async () => {
      // Supabase reports a dead or already-used link in the fragment, not as a
      // thrown error — read it before anything else so we can say so plainly.
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const described = hash.get("error_description");
      if (described) {
        if (!cancelled) {
          setLinkError(described.replace(/\+/g, " "));
          setStatus("invalid");
        }
        return;
      }

      // PKCE-style links arrive as ?code= instead of a fragment. Harmless to
      // try; it no-ops on the implicit flow this project uses today.
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError && !cancelled) {
          setLinkError(exchangeError.message);
          setStatus("invalid");
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setStatus(data.session ? "ready" : "invalid");
    })();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }

    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    // Don't leave them signed in on this device off the back of an emailed
    // link — make them use the new password once, here or in the app.
    await supabase.auth.signOut();
    setStatus("done");
  };

  if (status === "checking") {
    return <p className="text-sm text-gray-500">Checking your link…</p>;
  }

  if (status === "invalid") {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-gray-900">This link has expired</h1>
        <p className="text-gray-600 text-sm leading-relaxed">
          {linkError
            ? `${linkError}.`
            : "Reset links are good for one use and expire after an hour."}{" "}
          Request a new one and it will land in your inbox in a moment.
        </p>
        <Link
          href="/"
          className="inline-block mt-2 text-sm font-semibold text-blue-700 hover:underline"
        >
          Back to sign in →
        </Link>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-gray-900">Password updated</h1>
        <p className="text-gray-600 text-sm leading-relaxed">
          You can sign in with your new password now — on the website, or in the Melange app on your
          phone.
        </p>
        <Link
          href="/"
          className="inline-block mt-2 text-sm font-semibold text-blue-700 hover:underline"
        >
          Go to sign in →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold text-gray-900">Set a new password</h1>
        <p className="text-sm text-gray-500">
          Pick something you don&apos;t use anywhere else. At least {MIN_PASSWORD} characters.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={busy}
          className="melange-btn-primary w-full border-0 font-semibold"
        >
          {busy ? "Updating…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
