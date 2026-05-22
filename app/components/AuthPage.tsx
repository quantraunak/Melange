"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

import MelangeApp from "./MelangeApp";

/**
 * AuthPage — editorial split-screen landing + auth.
 *
 * Left rail: serif headline, value prop, social proof.
 * Right rail: a single quiet card that toggles between sign-in and sign-up.
 * On mobile, the left rail collapses to a slim hero above the card.
 */
export default function AuthPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });

  const [signupForm, setSignupForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "",
    skills: "",
    bio: "",
    currentProject: "",
  });

  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginForm.email,
      password: loginForm.password,
    });
    if (error) setLoginError(error.message);
    setSubmitting(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);

    if (signupForm.password !== signupForm.confirmPassword) {
      setSignupError("Passwords do not match.");
      return;
    }
    if (!acceptedTerms) {
      setSignupError("Please accept the Terms and Privacy Policy to continue.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: signupForm.email,
        password: signupForm.password,
      });

      if (error) {
        setSignupError(error.message);
        setSubmitting(false);
        return;
      }

      const userId = data.user?.id;
      if (!userId) {
        setSignupError(
          "Signup succeeded — check your email for a confirmation link before logging in."
        );
        setSubmitting(false);
        return;
      }

      const skillsArray = signupForm.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const { error: profileErr } = await supabase.from("profiles").insert({
        user_id: userId,
        name: signupForm.name,
        role: signupForm.role || null,
        bio: signupForm.bio || null,
        current_project: signupForm.currentProject || null,
        skills: skillsArray.length ? skillsArray : null,
        avatar_url: null,
      });

      if (profileErr) {
        setSignupError(`Profile setup failed: ${profileErr.message}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setSignupError(`Unexpected error: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  if (loading) return null;
  if (session) return <MelangeApp onSignOut={handleSignOut} />;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col">
      {/* ======================== Top brand bar ======================== */}
      <header className="px-6 lg:px-10 py-5 flex items-center justify-between">
        <Wordmark />
        <div className="hidden sm:flex items-center gap-6 text-[13px] text-[var(--ink-2)]">
          <Link href="#how" className="hover:text-[var(--ink)] transition-colors">
            How it works
          </Link>
          <Link href="/terms" className="hover:text-[var(--ink)] transition-colors">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-[var(--ink)] transition-colors">
            Privacy
          </Link>
        </div>
      </header>

      {/* ======================== Hero + Auth split ======================== */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 px-6 lg:px-16 pb-16 pt-4 lg:pt-12 max-w-[1280px] mx-auto w-full">
        {/* Left — editorial copy */}
        <section className="flex flex-col justify-center">
          <p className="text-[11px] tracking-[0.18em] uppercase text-[var(--ink-3)] mb-5">
            For creatives, by creatives
          </p>
          <h1 className="font-display text-[clamp(2.5rem,5vw,4.5rem)] leading-[1.02] tracking-[-0.02em] text-[var(--ink)]">
            Find the people you{" "}
            <em className="font-display italic text-[var(--accent)]">actually</em>{" "}
            want to make work with.
          </h1>
          <p className="mt-6 text-[17px] leading-relaxed text-[var(--ink-2)] max-w-[52ch]">
            Melange is a swipe-and-match app for photographers, models, MUAs,
            stylists, and designers — plus a feed of local events, open calls,
            and photo walks so collaborations turn into actual shoots.
          </p>

          <div className="mt-10 flex items-center gap-8 text-[13px] text-[var(--ink-2)]">
            <Stat number="1×" label="Card. One creator at a time." />
            <span className="h-6 w-px bg-[var(--line)]" />
            <Stat number="2×" label="Way match — both swipe right." />
            <span className="h-6 w-px bg-[var(--line)]" />
            <Stat number="0" label="Boosts. No pay-to-play." />
          </div>

          <div id="how" className="mt-12 hidden lg:grid grid-cols-3 gap-5 max-w-[640px]">
            <HowStep n="01" title="Post your idea" body="A shoot concept, an open call, a vibe. With reference images." />
            <HowStep n="02" title="Swipe on others" body="See people in your city who want to make the same kind of work." />
            <HowStep n="03" title="Match & chat" body="Mutual right-swipes unlock DMs. RSVP to events. Make the thing." />
          </div>
        </section>

        {/* Right — auth card */}
        <section className="flex items-start lg:items-center justify-center">
          <div className="w-full max-w-[440px] melange-card p-7 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-2xl tracking-tight">
                {mode === "login" ? "Welcome back." : "Make a Melange account."}
              </h2>
            </div>

            <div
              role="tablist"
              aria-label="Authentication"
              className="flex items-center gap-6 border-b border-[var(--line)] mb-6"
            >
              <TabButton active={mode === "login"} onClick={() => setMode("login")}>
                Sign in
              </TabButton>
              <TabButton active={mode === "signup"} onClick={() => setMode("signup")}>
                Create account
              </TabButton>
            </div>

            {mode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4" key="login-form">
                <Field
                  label="Email"
                  type="email"
                  value={loginForm.email}
                  onChange={(v) => setLoginForm({ ...loginForm, email: v })}
                  autoComplete="email"
                  required
                />
                <Field
                  label="Password"
                  type="password"
                  value={loginForm.password}
                  onChange={(v) => setLoginForm({ ...loginForm, password: v })}
                  autoComplete="current-password"
                  required
                />
                {loginError ? <ErrorBox>{loginError}</ErrorBox> : null}
                <PrimaryButton type="submit" loading={submitting}>
                  Sign in
                </PrimaryButton>
                <p className="text-[12px] text-center text-[var(--ink-3)]">
                  New here?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className="text-[var(--ink)] underline underline-offset-2 hover:text-[var(--accent)]"
                  >
                    Make an account
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4" key="signup-form">
                <Field
                  label="Name"
                  value={signupForm.name}
                  onChange={(v) => setSignupForm({ ...signupForm, name: v })}
                  autoComplete="name"
                  required
                />
                <Field
                  label="Email"
                  type="email"
                  value={signupForm.email}
                  onChange={(v) => setSignupForm({ ...signupForm, email: v })}
                  autoComplete="email"
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Password"
                    type="password"
                    value={signupForm.password}
                    onChange={(v) => setSignupForm({ ...signupForm, password: v })}
                    autoComplete="new-password"
                    required
                  />
                  <Field
                    label="Confirm"
                    type="password"
                    value={signupForm.confirmPassword}
                    onChange={(v) => setSignupForm({ ...signupForm, confirmPassword: v })}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="signup-role">What you do</FieldLabel>
                  <select
                    id="signup-role"
                    value={signupForm.role}
                    onChange={(e) => setSignupForm({ ...signupForm, role: e.target.value })}
                    className="melange-input w-full appearance-none bg-[var(--surface)]"
                  >
                    <option value="">Pick one…</option>
                    <option value="photographer">Photographer</option>
                    <option value="model">Model</option>
                    <option value="makeup-artist">Makeup artist</option>
                    <option value="stylist">Stylist</option>
                    <option value="designer">Designer</option>
                    <option value="other">Something else</option>
                  </select>
                </div>

                <Field
                  label="Skills (comma-separated)"
                  value={signupForm.skills}
                  onChange={(v) => setSignupForm({ ...signupForm, skills: v })}
                  placeholder="Portrait, 35mm film, editorial lighting"
                />

                <Field
                  label="What are you making right now?"
                  value={signupForm.currentProject}
                  onChange={(v) => setSignupForm({ ...signupForm, currentProject: v })}
                  placeholder="An archival zine, weekly portrait series, etc."
                />

                <div>
                  <FieldLabel htmlFor="signup-bio">Bio</FieldLabel>
                  <textarea
                    id="signup-bio"
                    rows={3}
                    value={signupForm.bio}
                    onChange={(e) => setSignupForm({ ...signupForm, bio: e.target.value })}
                    placeholder="Tell us about your taste and what you want to make."
                    className="melange-input w-full resize-none"
                  />
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <button
                    type="button"
                    onClick={() => setAcceptedTerms((v) => !v)}
                    className={`mt-0.5 w-[18px] h-[18px] rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                      acceptedTerms
                        ? "bg-[var(--ink)] border-[var(--ink)]"
                        : "bg-[var(--surface)] border-[var(--line)] hover:border-[var(--ink-3)]"
                    }`}
                    aria-checked={acceptedTerms}
                    role="checkbox"
                  >
                    {acceptedTerms ? <Check className="h-3 w-3 text-white" /> : null}
                  </button>
                  <span className="text-[12px] text-[var(--ink-2)] leading-snug">
                    I&apos;m at least 18 and I agree to the{" "}
                    <Link href="/terms" target="_blank" className="text-[var(--ink)] underline underline-offset-2">
                      Terms
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" target="_blank" className="text-[var(--ink)] underline underline-offset-2">
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>

                {signupError ? <ErrorBox>{signupError}</ErrorBox> : null}

                <PrimaryButton type="submit" loading={submitting}>
                  Create account
                </PrimaryButton>

                <p className="text-[11px] text-center text-[var(--ink-3)]">
                  By signing up, you also agree to follow the Melange community rules.
                </p>
              </form>
            )}
          </div>
        </section>
      </main>

      {/* ======================== Footer ======================== */}
      <footer className="px-6 lg:px-10 py-6 border-t border-[var(--line)] text-[12px] text-[var(--ink-3)] flex flex-col sm:flex-row items-center justify-between gap-3">
        <p>© {new Date().getFullYear()} Melange. Made for creatives.</p>
        <div className="flex items-center gap-5">
          <Link href="/terms" className="hover:text-[var(--ink)] transition-colors">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-[var(--ink)] transition-colors">
            Privacy
          </Link>
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// Local atoms
// ============================================================

function Wordmark() {
  return (
    <Link href="/" className="font-display text-[26px] tracking-tight text-[var(--ink)] leading-none">
      melange<span className="text-[var(--accent)]">.</span>
    </Link>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-display text-2xl text-[var(--ink)]">{number}</span>
      <span className="text-[12px] text-[var(--ink-2)] max-w-[16ch] leading-snug">{label}</span>
    </div>
  );
}

function HowStep({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="border-t border-[var(--line)] pt-4">
      <span className="text-[11px] tracking-[0.18em] uppercase text-[var(--ink-3)]">{n}</span>
      <h3 className="font-display text-[18px] mt-1 mb-1.5 text-[var(--ink)]">{title}</h3>
      <p className="text-[13px] text-[var(--ink-2)] leading-snug">{body}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`relative pb-3 text-[14px] font-medium transition-colors ${
        active ? "text-[var(--ink)]" : "text-[var(--ink-3)] hover:text-[var(--ink-2)]"
      }`}
    >
      {children}
      {active ? (
        <span className="absolute -bottom-px left-0 right-0 h-[2px] bg-[var(--ink)]" />
      ) : null}
    </button>
  );
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)] mb-1.5"
    >
      {children}
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className="melange-input w-full"
      />
    </div>
  );
}

function PrimaryButton({
  type = "button",
  loading,
  children,
  onClick,
}: {
  type?: "button" | "submit";
  loading?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading}
      className="w-full h-11 inline-flex items-center justify-center gap-2 bg-[var(--ink)] text-[var(--bg)] rounded-[var(--radius-lg)] text-[14px] font-medium tracking-tight hover:opacity-90 disabled:opacity-50 transition-opacity"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] text-[var(--destructive)] bg-[color-mix(in_oklab,var(--destructive)_10%,var(--surface))] border border-[color-mix(in_oklab,var(--destructive)_30%,var(--line))] rounded-[var(--radius-md)] p-2.5">
      {children}
    </p>
  );
}
