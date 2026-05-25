"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  ChevronLeft,
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
      <DialogContent className="max-w-[460px] max-h-[85vh] overflow-y-auto p-0 rounded-2xl">
        {/* Mount key on `open` so a fresh open always starts on the menu view. */}
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
  return (
    <>
      <div className="p-4 border-b border-gray-100 flex items-center gap-2">
        {view !== "menu" ? (
          <button onClick={() => setView("menu")} className="text-gray-400 hover:text-gray-600" aria-label="Back">
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : null}
        <DialogTitle className="flex-1 text-base font-semibold text-gray-900">
          {view === "menu" ? "Account & safety" : view === "blocked" ? "Blocked users" : "Delete account"}
        </DialogTitle>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
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
    <div className="p-4 space-y-2">
      <MenuRow
        icon={<ShieldOff className="h-4 w-4 text-gray-500" />}
        label="Blocked users"
        sublabel="Review and unblock people you've blocked."
        onClick={() => onPick("blocked")}
      />
      <MenuRow
        icon={<Trash2 className="h-4 w-4 text-red-600" />}
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
      className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border ${
        danger ? "border-red-200 hover:bg-red-50" : "border-gray-200 hover:bg-gray-50"
      } transition-colors`}
    >
      <span className="mt-0.5">{icon}</span>
      <span className="flex-1">
        <span className={`block text-sm font-semibold ${danger ? "text-red-600" : "text-gray-900"}`}>{label}</span>
        <span className="block text-xs text-gray-500 mt-0.5">{sublabel}</span>
      </span>
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
      <div className="p-8 flex items-center justify-center text-gray-400 text-sm">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {error ? (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-2">{error}</p>
      ) : null}

      {list.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">You haven&apos;t blocked anyone.</p>
      ) : (
        list.map((u) => (
          <div key={u.user_id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl">
            {u.avatar_url ? (
              <img src={u.avatar_url} alt={u.name} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 font-semibold flex items-center justify-center">
                {u.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{u.name}</p>
              {u.role ? <p className="text-xs text-gray-500 truncate">{u.role}</p> : null}
            </div>
            <button
              onClick={() => unblock(u)}
              disabled={busyId === u.user_id}
              className="px-3 py-1.5 border border-gray-200 rounded-full text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {busyId === u.user_id ? "…" : "Unblock"}
            </button>
          </div>
        ))
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
    <div className="p-4 space-y-4">
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 items-start">
        <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-red-700">This cannot be undone.</h3>
          <p className="text-xs text-red-700/90 leading-snug">
            Deleting your account removes your profile, posts, swipes, matches, messages, and uploaded media permanently.
            You&apos;ll be signed out immediately.
          </p>
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">
          Type <span className="font-semibold text-gray-700">{CONFIRM_WORD}</span> to confirm
        </label>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={CONFIRM_WORD}
          className="rounded-xl"
          autoCapitalize="characters"
        />
      </div>

      {error ? (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-2">{error}</p>
      ) : null}

      <button
        onClick={submit}
        disabled={busy}
        className="w-full py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {busy ? "Deleting…" : "Delete my account"}
      </button>
    </div>
  );
}
