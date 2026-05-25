"use client";

import { useState } from "react";
import { Loader2, Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { trackEvent } from "../lib/analytics";
import { REVIEW_TAGS, submitCollabReview } from "../lib/reviews";

export default function ReviewDialog({
  open,
  onClose,
  matchId,
  reviewerId,
  revieweeId,
  revieweeName,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  matchId: string;
  reviewerId: string;
  revieweeId: string;
  revieweeName: string;
  onSubmitted?: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [tags, setTags] = useState<string[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length < 2 ? [...prev, tag] : prev
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error: err } = await submitCollabReview(
      matchId,
      reviewerId,
      revieweeId,
      rating,
      tags,
      body
    );
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    trackEvent("review_submitted", { match_id: matchId, rating });
    onSubmitted?.();
    onClose();
    setRating(5);
    setTags([]);
    setBody("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[360px] rounded-2xl">
        <DialogTitle className="text-base text-blue-900">Review {revieweeName}</DialogTitle>
        <DialogDescription className="text-xs text-gray-500">
          Your review stays hidden until they review you too (prevents retaliation).
        </DialogDescription>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className="p-1"
                aria-label={`${n} stars`}
              >
                <Star
                  className={`h-7 w-7 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`}
                />
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5 justify-center">
            {REVIEW_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  tags.includes(tag)
                    ? "bg-violet-100 border-violet-400 text-violet-800"
                    : "border-gray-200 text-gray-600 hover:border-blue-300"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-center text-gray-400">Pick up to 2 tags</p>

          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Optional: how did the collab go?"
            rows={3}
            className="rounded-xl text-sm"
          />

          {error ? (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 bg-violet-400 text-white text-sm font-medium rounded-xl hover:bg-violet-500 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit review
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
