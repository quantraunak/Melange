"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { getVisibleReviewsForUser, type ReviewWithReviewer } from "../lib/reviews";
function ReviewAvatar({
  name,
  url,
}: {
  name: string;
  url: string | null;
}) {
  if (url) {
    return <img src={url} alt={name} className="w-8 h-8 rounded-full object-cover" />;
  }
  return (
    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 text-xs font-semibold flex items-center justify-center">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function ProfileReviews({ userId }: { userId: string }) {
  const [reviews, setReviews] = useState<ReviewWithReviewer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await getVisibleReviewsForUser(userId);
      if (!cancelled) {
        setReviews(data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return <p className="text-xs text-gray-400 py-2">Loading reviews...</p>;
  }
  if (reviews.length === 0) {
    return (
      <p className="text-xs text-gray-400 italic py-1">
        No public reviews yet. Reviews appear after you and your match both submit one.
      </p>
    );
  }

  const avg =
    reviews.reduce((s, r) => s + r.rating, 0) / Math.max(reviews.length, 1);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
        <span className="text-sm font-semibold text-blue-900">{avg.toFixed(1)}</span>
        <span className="text-xs text-gray-400">({reviews.length} reviews)</span>
      </div>
      {reviews.slice(0, 5).map((r) => (
        <div key={r.id} className="p-2.5 border border-blue-100 rounded-xl bg-blue-50/30">
          <div className="flex items-center gap-2 mb-1">
            <ReviewAvatar name={r.reviewer_name} url={r.reviewer_avatar_url} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-900 truncate">{r.reviewer_name}</p>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={`h-3 w-3 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`}
                  />
                ))}
              </div>
            </div>
          </div>
          {r.tags.length > 0 ? (
            <p className="text-[10px] text-violet-700">{r.tags.join(" · ")}</p>
          ) : null}
          {r.body ? <p className="text-xs text-gray-600 mt-1 line-clamp-2">{r.body}</p> : null}
        </div>
      ))}
    </div>
  );
}
