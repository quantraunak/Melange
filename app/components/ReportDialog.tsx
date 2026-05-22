"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Loader2, ShieldCheck, X } from "lucide-react";
import { submitReport, type ReportReason } from "../lib/db";

type Target = {
  kind: "user" | "post" | "message";
  id: string;
  label?: string;
};

const REASONS: { id: ReportReason; label: string; help: string }[] = [
  { id: "spam", label: "Spam or scam", help: "Repetitive, off-topic, or selling something unrelated." },
  { id: "harassment", label: "Harassment or hate speech", help: "Threats, insults, slurs, or targeted abuse." },
  { id: "inappropriate", label: "Inappropriate content", help: "Sexually explicit, violent, or otherwise unsafe." },
  { id: "fake", label: "Fake profile or impersonation", help: "Pretending to be someone they're not." },
  { id: "underage", label: "Minor / underage user", help: "Looks like the account belongs to someone under 18." },
  { id: "other", label: "Something else", help: "Tell us what's wrong below." },
];

export default function ReportDialog({
  reporterId,
  target,
  onClose,
}: {
  reporterId: string;
  target: Target | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!target} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[480px] p-0 rounded-[var(--radius-xl)] border-[var(--line)] bg-[var(--surface)] overflow-hidden">
        {target ? (
          <ReportInner
            key={`${target.kind}-${target.id}`}
            reporterId={reporterId}
            target={target}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ReportInner({
  reporterId,
  target,
  onClose,
}: {
  reporterId: string;
  target: Target;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const submit = async () => {
    if (!selected) {
      setError("Please pick a reason.");
      return;
    }
    setSubmitting(true);
    setError("");
    const { error: err } = await submitReport(
      reporterId,
      target.kind,
      target.id,
      selected,
      details.trim() || undefined
    );
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    setSuccess(true);
  };

  const kindLabel =
    target.kind === "user" ? "user" : target.kind === "post" ? "post" : "message";

  return (
    <>
      <div className="px-5 py-4 flex items-start justify-between border-b border-[var(--line)] sticky top-0 bg-[var(--surface)] z-10">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-3)] font-medium">Report</p>
          <DialogTitle className="font-display text-[20px] tracking-tight text-[var(--ink)] mt-0.5">
            {kindLabel.charAt(0).toUpperCase() + kindLabel.slice(1)}
            {target.label ? (
              <span className="text-[var(--ink-2)] font-display italic"> · {target.label}</span>
            ) : null}
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
      <DialogDescription className="sr-only">Report this content</DialogDescription>

      {success ? (
        <div className="p-8 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-[color-mix(in_oklab,var(--success)_12%,var(--surface))] text-[var(--success)] flex items-center justify-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h3 className="font-display text-[20px] tracking-tight text-[var(--ink)]">Thanks for letting us know.</h3>
          <p className="text-[13px] text-[var(--ink-2)] max-w-[36ch] mx-auto leading-relaxed">
            Reports are confidential. Our team will review and take action if it violates our rules.
          </p>
          <button
            onClick={onClose}
            className="mt-3 w-full h-11 inline-flex items-center justify-center bg-[var(--ink)] text-[var(--bg)] rounded-[var(--radius-lg)] text-[14px] font-medium hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="p-5 space-y-4">
          <p className="text-[12px] text-[var(--ink-3)]">
            Help us keep Melange safe. Reports are confidential.
          </p>

          <div className="space-y-1.5">
            {REASONS.map((r) => {
              const active = selected === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelected(r.id)}
                  className={`w-full text-left flex items-start gap-3 p-3 rounded-[var(--radius-md)] border transition-colors ${
                    active
                      ? "bg-[var(--secondary)] border-[var(--ink)]"
                      : "bg-[var(--surface)] border-[var(--line)] hover:bg-[var(--secondary)]/60"
                  }`}
                >
                  <span
                    className={`mt-0.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      active ? "bg-[var(--ink)] border-[var(--ink)]" : "border-[var(--line)]"
                    }`}
                  >
                    {active ? <Check className="h-2.5 w-2.5 text-white" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-medium text-[var(--ink)]">{r.label}</span>
                    <span className="block text-[12px] text-[var(--ink-2)] mt-0.5">{r.help}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div>
            <label
              htmlFor="report-details"
              className="block text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)] mb-1.5"
            >
              More detail (optional)
            </label>
            <textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Add anything you'd like us to know."
              rows={3}
              className="melange-input w-full resize-none"
            />
          </div>

          {error ? (
            <p className="text-[12px] text-[var(--destructive)] bg-[color-mix(in_oklab,var(--destructive)_8%,var(--surface))] border border-[color-mix(in_oklab,var(--destructive)_25%,var(--line))] rounded-[var(--radius-md)] p-2.5">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={submit}
            disabled={submitting || !selected}
            className="w-full h-11 inline-flex items-center justify-center gap-2 bg-[var(--ink)] text-[var(--bg)] rounded-[var(--radius-lg)] text-[14px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitting ? "Sending…" : "Send report"}
          </button>
        </div>
      )}
    </>
  );
}
