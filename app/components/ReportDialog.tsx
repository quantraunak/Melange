"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Check, X } from "lucide-react";
import { submitReport, type ReportReason } from "../lib/db";

type Target = {
  kind: "user" | "post" | "message";
  id: string;
  label?: string;
};

const REASONS: { id: ReportReason; label: string; help: string }[] = [
  { id: "spam", label: "Spam or scam", help: "Repetitive, off-topic, or trying to sell something unrelated." },
  { id: "harassment", label: "Harassment or hate speech", help: "Threats, insults, slurs, or targeted abuse." },
  { id: "inappropriate", label: "Inappropriate content", help: "Sexually explicit, violent, or otherwise unsafe content." },
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
      <DialogContent className="max-w-[480px] p-0 rounded-2xl">
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
      <div className="p-4 flex items-center justify-between border-b border-gray-100">
        <DialogTitle className="text-base font-semibold text-gray-900">
          Report {kindLabel}
          {target.label ? <span className="text-gray-500 font-normal">: {target.label}</span> : null}
        </DialogTitle>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <DialogDescription className="sr-only">Report this content</DialogDescription>

      {success ? (
          <div className="p-6 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
              <Check className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">Report received</h3>
            <p className="text-sm text-gray-500">
              Thanks for letting us know. Our team will review this and take action if it violates our rules.
            </p>
            <button
              onClick={onClose}
              className="mt-2 w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <p className="text-xs text-gray-500">
              Help us keep Melange safe. Reports are confidential and reviewed by our team.
            </p>

            <div className="space-y-2">
              {REASONS.map((r) => {
                const active = selected === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelected(r.id)}
                    className={`w-full text-left flex items-start gap-2.5 p-3 rounded-xl border transition-colors ${
                      active ? "bg-blue-50 border-blue-300" : "bg-white border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <span
                      className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        active ? "bg-blue-600 border-blue-600" : "border-gray-300"
                      }`}
                    >
                      {active ? <Check className="h-2.5 w-2.5 text-white" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-sm font-medium ${active ? "text-blue-700" : "text-gray-900"}`}>
                        {r.label}
                      </span>
                      <span className="block text-xs text-gray-500 mt-0.5">{r.help}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">More detail (optional)</label>
              <Textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Add anything you'd like us to know."
                rows={3}
                className="rounded-xl"
              />
            </div>

            {error ? (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-2">{error}</p>
            ) : null}

            <button
              type="button"
              onClick={submit}
              disabled={submitting || !selected}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Sending..." : "Send report"}
            </button>
          </div>
        )}
    </>
  );
}
