"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { LOOKING_FOR } from "@/app/lib/applicantForm";
import { supabase } from "@/app/lib/supabaseClient";
import {
  applicantsCsv,
  contactLines,
  firstName,
  introText,
  listMakes,
  lookingForLabels,
  MAKES_LABEL,
  type Applicant,
  type IntroSide,
} from "@/app/lib/introAdmin";

/**
 * /internal/matches — hand-picked matching, for admins only.
 *
 * Sign in with your normal Melange account. Anyone not in app_admins sees
 * "Not available", and every call this page makes goes through an admin_*
 * database function that refuses non-admins anyway (29_intro_matches.sql),
 * so hiding the page is a courtesy, not the protection.
 */

type Stats = {
  applicants: number;
  drafts: number;
  approved: number;
  sent: number;
  waiting: number;
  signed_up: number;
};

type Intro = {
  id: string;
  status: "draft" | "approved" | "sent";
  note: string;
  created_at: string;
  approved_at: string | null;
  sent_at: string | null;
  a: IntroSide;
  b: IntroSide;
};

type Person = { kind: "applicant" | "user"; id: string; name: string; detail: string };

type Tab = "applicants" | "review" | "ready" | "sent";

export default function MatchesAdminPage() {
  const [state, setState] = useState<"loading" | "signed_out" | "denied" | "ok">("loading");

  const check = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return setState("signed_out");
    const { data: admin } = await supabase.rpc("is_admin");
    setState(admin === true ? "ok" : "denied");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load once on open
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => sub.subscription.unsubscribe();
  }, [check]);

  if (state === "loading") return <Shell><p className="text-sm text-gray-500">Loading…</p></Shell>;
  if (state === "signed_out") return <SignIn />;
  if (state === "denied") {
    return (
      <Shell>
        <p className="text-sm text-gray-700">Not available.</p>
        <button className="mt-3 text-sm underline" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </Shell>
    );
  }
  return <Admin />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#FAFAF7] p-8 max-w-md mx-auto">{children}</div>;
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Shell>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          const { error: err } = await supabase.auth.signInWithPassword({ email, password });
          if (err) setError(err.message);
        }}
      >
        <h1 className="text-lg font-semibold text-gray-900">Matching admin</h1>
        <p className="text-sm text-gray-600">Sign in with your Melange account.</p>
        <input className={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={input} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button className={primary} type="submit">Sign in</button>
      </form>
    </Shell>
  );
}

// ------------------------------------------------------------
// The signed-in admin
// ------------------------------------------------------------

function Admin() {
  const [tab, setTab] = useState<Tab>("applicants");
  const [stats, setStats] = useState<Stats | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [intros, setIntros] = useState<Intro[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [s, a, i] = await Promise.all([
      supabase.rpc("admin_intro_stats"),
      supabase.rpc("admin_list_applicants"),
      supabase.rpc("admin_list_intros"),
    ]);
    const err = s.error ?? a.error ?? i.error;
    setError(err ? err.message : null);
    if (s.data) setStats(s.data as Stats);
    setApplicants((a.data as Applicant[]) ?? []);
    setIntros((i.data as Intro[]) ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load once on open
    reload();
  }, [reload]);

  /** Run an admin call, show its error if any, then reload everything. */
  const run = useCallback(
    async (fn: string, args: Record<string, unknown>): Promise<boolean> => {
      const { error: err } = await supabase.rpc(fn, args);
      if (err) {
        setError(err.message);
        return false;
      }
      setError(null);
      await reload();
      return true;
    },
    [reload]
  );

  const drafts = intros.filter((i) => i.status === "draft");
  const ready = intros.filter((i) => i.status === "approved");
  const sent = intros.filter((i) => i.status === "sent");

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-gray-900">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <header className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">Matching</h1>
          <button className="text-sm underline text-gray-600" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </header>

        {stats ? (
          <dl className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-gray-200 border border-gray-200">
            {(
              [
                ["Applicants", stats.applicants],
                ["Draft matches", stats.drafts],
                ["Approved", stats.approved],
                ["Sent", stats.sent],
                ["Waiting", stats.waiting],
                ["Matched & signed up", stats.signed_up],
              ] as const
            ).map(([label, n]) => (
              <div key={label} className="bg-white p-3">
                <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
                <dd className="text-2xl font-semibold">{n}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {error ? <p className="border border-red-300 bg-red-50 text-red-800 text-sm p-3">{error}</p> : null}

        <nav className="flex gap-6 border-b border-gray-200 text-sm">
          {(
            [
              ["applicants", `Applicants (${applicants.length})`],
              ["review", `Review drafts (${drafts.length})`],
              ["ready", `Ready to send (${ready.length})`],
              ["sent", `Sent (${sent.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`pb-2 -mb-px border-b-2 ${tab === key ? "border-indigo-700 text-gray-900" : "border-transparent text-gray-500"}`}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === "applicants" ? <ApplicantsTab applicants={applicants} run={run} /> : null}
        {tab === "review" ? <ReviewTab intros={drafts} applicants={applicants} run={run} /> : null}
        {tab === "ready" ? <ReadyTab intros={ready} run={run} /> : null}
        {tab === "sent" ? <SentTab intros={sent} run={run} /> : null}
      </div>
    </div>
  );
}

type Run = (fn: string, args: Record<string, unknown>) => Promise<boolean>;

// ------------------------------------------------------------
// Applicants: filter, pair, wait, export, delete
// ------------------------------------------------------------

function ApplicantsTab({ applicants, run }: { applicants: Applicant[]; run: Run }) {
  const [school, setSchool] = useState("");
  const [make, setMake] = useState("");
  const [wants, setWants] = useState("");
  const [status, setStatus] = useState("");
  const [a, setA] = useState<Person | null>(null);
  const [b, setB] = useState<Person | null>(null);
  const [note, setNote] = useState("");

  const schools = useMemo(
    () => [...new Set(applicants.map((x) => x.school).filter((s): s is string => !!s))].sort(),
    [applicants]
  );

  const shown = applicants.filter(
    (x) =>
      (!school || x.school === school) &&
      (!make || x.makes.includes(make)) &&
      (!wants || x.looking_for.includes(wants)) &&
      (!status || x.status === status)
  );

  const total = (x: Applicant) => x.drafts + x.approved + x.sent;
  const pick = (x: Applicant) => {
    const p: Person = { kind: "applicant", id: x.id, name: x.name, detail: x.school ?? "" };
    if (!a || (a.kind === "applicant" && a.id === x.id)) setA(p);
    else setB(p);
  };

  const exportCsv = () => {
    const blob = new Blob([applicantsCsv(applicants)], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `melange-applicants-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <section className="space-y-6">
      {/* Make a match */}
      <div className="bg-white border border-gray-200 p-4 space-y-3">
        <h2 className="font-semibold">New match</h2>
        <p className="text-sm text-gray-600">
          Click &ldquo;Pick&rdquo; on two applicants below, or search for an existing Melange user. It starts as a draft.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <PersonSlot label="Person 1" person={a} onClear={() => setA(null)} onPick={setA} applicants={applicants} />
          <PersonSlot label="Person 2" person={b} onClear={() => setB(null)} onPick={setB} applicants={applicants} />
        </div>
        <textarea
          className={`${input} h-20`}
          placeholder="Why you two (shown to both of them once sent)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
        />
        <button
          className={primary}
          disabled={!a || !b}
          onClick={async () => {
            if (!a || !b) return;
            const ok = await run("admin_create_intro", {
              p_a_kind: a.kind, p_a_id: a.id, p_b_kind: b.kind, p_b_id: b.id, p_note: note,
            });
            if (ok) {
              setA(null);
              setB(null);
              setNote("");
            }
          }}
        >
          Create draft match
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <Select label="School" value={school} onChange={setSchool} options={schools} />
        <Select label="Makes" value={make} onChange={setMake} options={Object.keys(MAKES_LABEL)} />
        <label className="text-sm">
          <span className="block text-xs text-gray-500">Looking for</span>
          <select className={input} value={wants} onChange={(e) => setWants(e.target.value)}>
            <option value="">All</option>
            {LOOKING_FOR.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </label>
        <Select label="Status" value={status} onChange={setStatus} options={["new", "matched", "waiting"]} />
        <button className={secondary} onClick={exportCsv}>Export CSV</button>
      </div>

      <div className="overflow-x-auto bg-white border border-gray-200">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
            <tr>
              <th className="p-2">Name</th>
              <th className="p-2">School</th>
              <th className="p-2">Makes</th>
              <th className="p-2">Looking for</th>
              <th className="p-2">Idea / join</th>
              <th className="p-2">Time</th>
              <th className="p-2">Status</th>
              <th className="p-2">Matches</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((x) => (
              <tr key={x.id} className="border-b border-gray-100 align-top">
                <td className="p-2">
                  <div className="font-medium">{x.name}</div>
                  <div className="text-xs text-gray-500">{x.email}</div>
                  {x.user_id ? <div className="text-xs text-green-700">Has an account</div> : null}
                </td>
                <td className="p-2">{x.school}</td>
                <td className="p-2">{listMakes(x.makes)}</td>
                <td className="p-2 max-w-xs">
                  <div>{lookingForLabels(x.looking_for)}</div>
                  {x.looking_for_note ? <div className="text-xs text-gray-500">{x.looking_for_note}</div> : null}
                </td>
                <td className="p-2 max-w-xs">
                  <div className="text-xs text-gray-500">{x.intent}</div>
                  <div>{x.idea}</div>
                </td>
                <td className="p-2">{x.time_available}</td>
                <td className="p-2">{x.status}</td>
                <td className="p-2 whitespace-nowrap">
                  <span className={total(x) >= 3 ? "font-semibold text-red-700" : ""}>{total(x)}/3</span>
                  <div className="text-xs text-gray-500">
                    {x.drafts} draft · {x.approved} approved · {x.sent} sent
                  </div>
                </td>
                <td className="p-2 whitespace-nowrap space-x-2">
                  <button className="underline" onClick={() => pick(x)}>Pick</button>
                  {x.status === "waiting" ? (
                    <button className="underline" onClick={() => run("admin_set_applicant_status", { p_id: x.id, p_status: "new" })}>
                      Not waiting
                    </button>
                  ) : x.status === "new" ? (
                    <button className="underline" onClick={() => run("admin_set_applicant_status", { p_id: x.id, p_status: "waiting" })}>
                      Waiting
                    </button>
                  ) : null}
                  <button
                    className="underline text-red-700"
                    onClick={() => {
                      if (confirm(`Delete ${x.name} and all their matches for good? This can't be undone.`)) {
                        run("admin_delete_applicant", { p_id: x.id });
                      }
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length ? <p className="p-4 text-sm text-gray-500">No applicants match.</p> : null}
      </div>
    </section>
  );
}

/** One side of a new match: chosen from the table, or searched for. */
function PersonSlot({
  label,
  person,
  onClear,
  onPick,
  applicants,
}: {
  label: string;
  person: Person | null;
  onClear: () => void;
  onPick: (p: Person) => void;
  applicants: Applicant[];
}) {
  return (
    <div className="border border-gray-200 p-3 space-y-2">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      {person ? (
        <div className="flex items-baseline justify-between">
          <div>
            <span className="font-medium">{person.name}</span>{" "}
            <span className="text-xs text-gray-500">{person.kind === "user" ? "Melange user" : person.detail}</span>
          </div>
          <button className="text-sm underline" onClick={onClear}>Change</button>
        </div>
      ) : (
        <PersonSearch onPick={onPick} applicants={applicants} />
      )}
    </div>
  );
}

/** Search applicants (already loaded) and existing Melange users. */
function PersonSearch({ onPick, applicants }: { onPick: (p: Person) => void; applicants: Applicant[] }) {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<{ user_id: string; name: string; role: string | null; email: string; intros: number }[]>([]);

  const searching = q.trim().length >= 2;
  useEffect(() => {
    if (!searching) return;
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("admin_search_users", { p_query: q });
      setUsers((data as typeof users) ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [q, searching]);

  const apps = !searching
    ? []
    : applicants.filter((x) => `${x.name} ${x.email} ${x.school ?? ""}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8);

  return (
    <div className="space-y-1">
      <input className={input} placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
      {apps.map((x) => (
        <button
          key={x.id}
          className="block w-full text-left text-sm hover:bg-gray-50 px-1"
          onClick={() => onPick({ kind: "applicant", id: x.id, name: x.name, detail: x.school ?? "" })}
        >
          {x.name} <span className="text-xs text-gray-500">applicant · {x.school} · {x.drafts + x.approved + x.sent}/3</span>
        </button>
      ))}
      {(searching ? users : []).map((u) => (
        <button
          key={u.user_id}
          className="block w-full text-left text-sm hover:bg-gray-50 px-1"
          onClick={() => onPick({ kind: "user", id: u.user_id, name: u.name, detail: u.role ?? "" })}
        >
          {u.name} <span className="text-xs text-gray-500">Melange user · {u.role} · {u.email} · {u.intros}/3</span>
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------
// Review drafts: side by side, edit, swap, delete, approve
// ------------------------------------------------------------

function ReviewTab({ intros, applicants, run }: { intros: Intro[]; applicants: Applicant[]; run: Run }) {
  if (!intros.length) return <p className="text-sm text-gray-500">No drafts. Create one from Applicants.</p>;
  return (
    <section className="space-y-6">
      {intros.map((i) => (
        <DraftCard key={i.id} intro={i} applicants={applicants} run={run} />
      ))}
    </section>
  );
}

function DraftCard({ intro, applicants, run }: { intro: Intro; applicants: Applicant[]; run: Run }) {
  const [note, setNote] = useState(intro.note);
  const [swapping, setSwapping] = useState<"a" | "b" | null>(null);

  return (
    <article className="bg-white border border-gray-200 p-4 space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <SideAnswers side={intro.a} onSwap={() => setSwapping("a")} />
        <SideAnswers side={intro.b} onSwap={() => setSwapping("b")} />
      </div>
      {swapping ? (
        <div className="border border-indigo-200 p-3 space-y-2">
          <div className="text-sm">
            Replace {swapping === "a" ? intro.a.name : intro.b.name} with:
            <button className="ml-3 underline" onClick={() => setSwapping(null)}>Cancel</button>
          </div>
          <PersonSearch
            applicants={applicants}
            onPick={async (p) => {
              const ok = await run("admin_update_intro", {
                p_id: intro.id, p_note: note, p_side: swapping, p_kind: p.kind, p_person: p.id,
              });
              if (ok) setSwapping(null);
            }}
          />
        </div>
      ) : null}
      <label className="block text-sm">
        <span className="block text-xs uppercase tracking-wide text-gray-500">Why you two</span>
        <textarea className={`${input} h-20`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      </label>
      <div className="flex flex-wrap gap-4 items-center">
        <button className={secondary} disabled={note === intro.note} onClick={() => run("admin_update_intro", { p_id: intro.id, p_note: note })}>
          Save note
        </button>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            onChange={async (e) => {
              if (!e.target.checked) return;
              if (note !== intro.note) await run("admin_update_intro", { p_id: intro.id, p_note: note });
              await run("admin_set_intro_status", { p_id: intro.id, p_status: "approved" });
            }}
          />
          Approve
        </label>
        <button
          className="text-sm underline text-red-700"
          onClick={() => {
            if (confirm("Delete this draft match?")) run("admin_delete_intro", { p_id: intro.id });
          }}
        >
          Delete
        </button>
      </div>
    </article>
  );
}

function SideAnswers({ side, onSwap }: { side: IntroSide; onSwap?: () => void }) {
  const rows: [string, string | null][] = [
    ["School", side.school],
    ["Makes", side.makes.length ? listMakes(side.makes) : side.role ?? null],
    ["Looking for", side.looking_for?.length ? lookingForLabels(side.looking_for) : null],
    ["More", side.looking_for_note],
    ["Idea / join", side.intent],
    ["Idea", side.idea],
    ["Time", side.time_available],
    ["Work", side.work_link],
  ];
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold">
          {side.name}{" "}
          <span className="text-xs font-normal text-gray-500">
            {side.kind === "user" ? "Melange user" : "applicant"}
            {side.user_id ? " · has an account" : " · no account yet"}
          </span>
        </h3>
        {onSwap ? <button className="text-sm underline" onClick={onSwap}>Swap</button> : null}
      </div>
      <dl className="text-sm grid grid-cols-[6rem_1fr] gap-x-2">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-gray-500">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ------------------------------------------------------------
// Ready to send: the texts to copy, contact info, mark as sent
// ------------------------------------------------------------

function ReadyTab({ intros, run }: { intros: Intro[]; run: Run }) {
  if (!intros.length) return <p className="text-sm text-gray-500">Nothing approved yet.</p>;
  return (
    <section className="space-y-6">
      {intros.map((i) => (
        <article key={i.id} className="bg-white border border-gray-200 p-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <IntroToSend to={i.a} other={i.b} note={i.note} />
            <IntroToSend to={i.b} other={i.a} note={i.note} />
          </div>
          <div className="flex flex-wrap gap-4 items-center">
            <button
              className={primary}
              onClick={() => {
                if (confirm(`Mark as sent? ${i.a.name} and ${i.b.name} will see this match in the app.`)) {
                  run("admin_set_intro_status", { p_id: i.id, p_status: "sent" });
                }
              }}
            >
              Mark as sent
            </button>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked onChange={() => run("admin_set_intro_status", { p_id: i.id, p_status: "draft" })} />
              Approved (untick to send back to drafts)
            </label>
            <button
              className="text-sm underline text-red-700"
              onClick={() => {
                if (confirm("Delete this match?")) run("admin_delete_intro", { p_id: i.id });
              }}
            >
              Delete
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}

function IntroToSend({ to, other, note }: { to: IntroSide; other: IntroSide; note: string }) {
  const text = introText(to, other, note);
  const [copied, setCopied] = useState(false);
  const contact = contactLines(to);
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">To {firstName(to.name)}</h3>
      <pre className="whitespace-pre-wrap text-sm bg-gray-50 border border-gray-200 p-3 font-sans">{text}</pre>
      <button
        className={secondary}
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied" : "Copy text"}
      </button>
      {contact.length ? (
        <ul className="text-sm text-gray-700">
          {contact.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No contact info shared.</p>
      )}
    </div>
  );
}

function SentTab({ intros, run }: { intros: Intro[]; run: Run }) {
  if (!intros.length) return <p className="text-sm text-gray-500">Nothing sent yet.</p>;
  return (
    <div className="bg-white border border-gray-200">
      {intros.map((i) => (
        <div key={i.id} className="flex items-baseline justify-between gap-4 p-3 border-b border-gray-100 text-sm">
          <div>
            <span className="font-medium">{i.a.name}</span> + <span className="font-medium">{i.b.name}</span>
            <span className="text-gray-500"> · sent {i.sent_at ? new Date(i.sent_at).toLocaleDateString() : ""}</span>
            <div className="text-gray-600">{i.note}</div>
          </div>
          <button
            className="underline text-red-700 whitespace-nowrap"
            onClick={() => {
              if (confirm("Delete this sent match? It disappears from both people's app.")) {
                run("admin_delete_intro", { p_id: i.id });
              }
            }}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="text-sm">
      <span className="block text-xs text-gray-500">{label}</span>
      <select className={input} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

const input = "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm";
const primary = "rounded-md bg-indigo-800 text-white text-sm font-medium px-4 py-2 disabled:opacity-40";
const secondary = "rounded-md border border-gray-300 bg-white text-sm px-3 py-2 disabled:opacity-40";
