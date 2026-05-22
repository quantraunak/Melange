"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ShieldOff,
  Trash2,
  X,
} from "lucide-react";
import {
  deleteAccount,
  getBlockedUsers,
  unblockUser,
  type CreatorInfo,
} from "../lib/db";

type View = "menu" | "blocked" | "delete";
const CONFIRM_WORD = "DELETE";

export default function AccountSafetyDialog({
  userId,
  open,
  onClose,
  onAccountDeleted,
}: {
  userId: string;
  open: boolean;
  onClose: () => void;
  onAccountDeleted: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[480px] max-h-[88vh] overflow-y-auto p-0 rounded-[var(--radius-xl)] border-[var(--line)] bg-[var(--surface)]">
        {open ? (
          <SafetyInner
            userId={userId}
            onClose={onClose}
            onAccountDeleted={onAccountDeleted}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SafetyInner({
  userId,
  onClose,
  onAccountDeleted,
}: {
  userId: string;
  onClose: () => void;
  onAccountDeleted: () => void;
}) {
  const [view, setView] = useState<View>("menu");

  const headerTitle = view === "menu" ? "Account & safety" : view === "blocked" ? "Blocked users" : "Delete account";
  const headerKicker = view === "menu" ? "Settings" : view === "blocked" ? "Manage" : "Permanent";

  return (
    <>
      <div className="px-5 py-4 border-b border-[var(--line)] flex items-center gap-3 sticky top-0 bg-[var(--surface)] z-10">
        {view !== "menu" ? (
          <button
            onClick={() => setView("menu")}
            className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--ink-2)] hover:bg-[var(--secondary)]"
            aria-label="Back"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : null}
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-3)] font-medium">{headerKicker}</p>
          <DialogTitle className="font-display text-[20px] tracking-tight text-[var(--ink)] mt-0.5">
            {headerTitle}
          </DialogTitle>
        </div>
        <button
          onClick={onClose}
          className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--ink-3)] hover:bg-[var(--secondary)]"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <DialogDescription className="sr-only">Account safety settings</DialogDescription>

      {view === "menu" ? (
        <Menu onPick={(v) => setView(v)} />
      ) : view === "blocked" ? (
        <BlockedList userId={userId} />
      ) : (
        <DeleteAccount onSuccess={onAccountDeleted} />
      )}
    </>
  );
}

function Menu({ onPick }: { onPick: (v: View) => void }) {
  return (
    <div className="p-5 space-y-2">
      <MenuRow
        icon={<ShieldOff className="h-4 w-4" />}
        label="Blocked users"
        sublabel="Review and unblock people you've blocked."
        onClick={() => onPick("blocked")}
      />
      <MenuRow
        icon={<Trash2 className="h-4 w-4" />}
        label="Delete account"
        sublabel="Permanently remove your profile, posts, and messages."
        onClick={() => onPick("delete")}
        danger
      />
    </div>
  );
}

function MenuRow({
  icon,
  label,
  sublabel,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 p-4 rounded-[var(--radius-lg)] border transition-colors ${
        danger
          ? "border-[var(--line)] hover:bg-[color-mix(in_oklab,var(--destructive)_6%,var(--surface))]"
          : "border-[var(--line)] hover:bg-[var(--secondary)]"
      }`}
    >
      <span
        className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
          danger
            ? "bg-[color-mix(in_oklab,var(--destructive)_10%,var(--surface))] text-[var(--destructive)]"
            : "bg-[var(--secondary)] text-[var(--ink-2)]"
        }`}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block font-display text-[15px] tracking-tight ${danger ? "text-[var(--destructive)]" : "text-[var(--ink)]"}`}>
          {label}
        </span>
        <span className="block text-[12px] text-[var(--ink-3)] mt-0.5">{sublabel}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-[var(--ink-3)]" />
    </button>
  );
}

function BlockedList({ userId }: { userId: string }) {
  const [list, setList] = useState<CreatorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await getBlockedUsers(userId);
    if (err) setError(err);
    setList(data);
    setLoading(false);
  }, [userId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const unblock = async (target: CreatorInfo) => {
    if (!target.user_id) return;
    setBusyId(target.user_id);
    const { error: err } = await unblockUser(userId, target.user_id);
    if (err) setError(err);
    await load();
    setBusyId(null);
  };

  if (loading) {
    return (
      <div className="p-12 flex items-center justify-center text-[var(--ink-3)] text-[13px]">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  return (
    <div className="p-5 space-y-3">
      {error ? (
        <p className="text-[12px] text-[var(--destructive)] bg-[color-mix(in_oklab,var(--destructive)_8%,var(--surface))] border border-[color-mix(in_oklab,var(--destructive)_25%,var(--line))] rounded-[var(--radius-md)] p-2.5">
          {error}
        </p>
      ) : null}

      {list.length === 0 ? (
        <div className="py-12 text-center">
          <p className="font-display text-[18px] tracking-tight text-[var(--ink)]">No one blocked.</p>
          <p className="text-[13px] text-[var(--ink-3)] mt-1">You haven&apos;t blocked anyone.</p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {list.map((u) => (
            <li key={u.user_id} className="flex items-center gap-3 py-3">
              {u.avatar_url ? (
                <img
                  src={u.avatar_url}
                  alt={u.name}
                  className="w-12 h-12 rounded-full object-cover ring-1 ring-[var(--line)]"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[var(--secondary)] text-[var(--ink)] font-display font-medium flex items-center justify-center ring-1 ring-[var(--line)]">
                  {u.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-display text-[15px] tracking-tight text-[var(--ink)] truncate">{u.name}</p>
                {u.role ? <p className="text-[12px] text-[var(--ink-3)] truncate">{u.role}</p> : null}
              </div>
              <button
                onClick={() => unblock(u)}
                disabled={busyId === u.user_id}
                className="h-9 px-3 border border-[var(--line)] rounded-full text-[12px] font-medium text-[var(--ink)] hover:bg-[var(--secondary)] disabled:opacity-50 transition-colors"
              >
                {busyId === u.user_id ? "…" : "Unblock"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DeleteAccount({ onSuccess }: { onSuccess: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (text.trim() !== CONFIRM_WORD) {
      setError(`Type ${CONFIRM_WORD} to confirm.`);
      return;
    }
    if (!confirm("This permanently deletes your account. This cannot be undone. Continue?")) return;
    setBusy(true);
    setError("");
    const { error: err } = await deleteAccount();
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    onSuccess();
  };

  return (
    <div className="p-5 space-y-4">
      <div className="bg-[color-mix(in_oklab,var(--destructive)_6%,var(--surface))] border border-[color-mix(in_oklab,var(--destructive)_25%,var(--line))] rounded-[var(--radius-lg)] p-4 flex gap-3 items-start">
        <AlertTriangle className="h-5 w-5 text-[var(--destructive)] flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h3 className="font-display text-[16px] tracking-tight text-[var(--destructive)]">This cannot be undone.</h3>
          <p className="text-[12px] text-[var(--destructive)]/85 leading-snug">
            Deleting your account removes your profile, posts, swipes, matches, messages, and uploaded media permanently.
            You&apos;ll be signed out immediately.
          </p>
        </div>
      </div>

      <div>
        <label
          htmlFor="confirm-word"
          className="block text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)] mb-1.5"
        >
          Type <span className="text-[var(--ink)] font-semibold">{CONFIRM_WORD}</span> to confirm
        </label>
        <input
          id="confirm-word"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={CONFIRM_WORD}
          className="melange-input w-full"
          autoCapitalize="characters"
        />
      </div>

      {error ? (
        <p className="text-[12px] text-[var(--destructive)] bg-[color-mix(in_oklab,var(--destructive)_8%,var(--surface))] border border-[color-mix(in_oklab,var(--destructive)_25%,var(--line))] rounded-[var(--radius-md)] p-2.5">
          {error}
        </p>
      ) : null}

      <button
        onClick={submit}
        disabled={busy}
        className="w-full h-11 inline-flex items-center justify-center gap-2 bg-[var(--destructive)] text-white rounded-[var(--radius-lg)] text-[14px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {busy ? "Deleting…" : "Delete my account"}
      </button>
    </div>
  );
}
