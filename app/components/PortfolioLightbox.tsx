"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * Fullscreen image viewer for a creator's portfolio.
 * Supports keyboard navigation (← →) and click prev/next.
 */
export default function PortfolioLightbox({
  urls,
  startIndex,
  open,
  onClose,
  creatorName,
}: {
  urls: string[];
  startIndex: number;
  open: boolean;
  onClose: () => void;
  creatorName?: string;
}) {
  const [index, setIndex] = useState(startIndex);

  /* eslint-disable react-hooks/set-state-in-effect */
  // Sync local index whenever the parent opens us at a different start image.
  useEffect(() => {
    if (open) setIndex(startIndex);
  }, [open, startIndex]);

  // Keyboard navigation; setIndex only fires inside the event callback.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") setIndex((i) => (i === 0 ? urls.length - 1 : i - 1));
      else if (e.key === "ArrowRight") setIndex((i) => (i === urls.length - 1 ? 0 : i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, urls.length, onClose]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!open || urls.length === 0) return null;

  const safeIndex = Math.max(0, Math.min(index, urls.length - 1));
  const prev = () => setIndex((i) => (i === 0 ? urls.length - 1 : i - 1));
  const next = () => setIndex((i) => (i === urls.length - 1 ? 0 : i + 1));

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Portfolio viewer"
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="absolute top-4 left-4 flex items-baseline gap-2">
        {creatorName ? (
          <span className="font-display text-white text-[17px] tracking-tight">
            {creatorName}
          </span>
        ) : null}
        <span className="text-white/55 text-[12px] uppercase tracking-[0.16em]">
          {safeIndex + 1} / {urls.length}
        </span>
      </div>

      {urls.length > 1 ? (
        <button
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      ) : null}

      <img
        src={urls[safeIndex]}
        alt=""
        className="max-w-[92vw] max-h-[88vh] object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      {urls.length > 1 ? (
        <button
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
          aria-label="Next"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      ) : null}

      {urls.length > 1 ? (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5">
          {urls.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setIndex(i); }}
              className={`h-1.5 rounded-full transition-all ${
                i === safeIndex ? "bg-white w-6" : "bg-white/40 w-1.5 hover:bg-white/60"
              }`}
              aria-label={`Go to image ${i + 1}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
