"use client";

import { Check, Circle } from "lucide-react";
import type { Profile } from "../lib/db";

export default function SetupChecklist({ profile }: { profile: Profile }) {
  const hasRole = !!profile.role?.trim();
  const hasBio = !!profile.bio?.trim();
  const portfolioN = profile.portfolio_urls?.length ?? 0;
  const hasPortfolio = portfolioN >= 1;
  const hasVibes = (profile.vibes?.length ?? 0) > 0;
  const hasInstagram = !!profile.instagram_url;

  const steps = [
    { done: hasRole, label: "Add your role (e.g. Photographer)" },
    { done: hasPortfolio, label: "Add at least 1 portfolio image" },
    { done: hasVibes, label: "Pick creative vibes for better matches" },
    { done: hasBio, label: "Write a short bio" },
    { done: hasInstagram, label: "Link Instagram (helps earn Verified)" },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200">
      <p className="text-xs font-semibold text-blue-900 mb-2">
        Complete your profile ({doneCount}/{steps.length})
      </p>
      <p className="text-[11px] text-blue-700 mb-2">
        Better profiles get shown higher in the feed and build trust faster.
      </p>
      <ul className="space-y-1">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-[11px] text-blue-800">
            {s.done ? (
              <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-blue-300 flex-shrink-0" />
            )}
            {s.label}
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-blue-600 mt-2">
        Verified badge: Instagram + 3 portfolio images + 2 reviews (4.0+ avg).
      </p>
    </div>
  );
}
