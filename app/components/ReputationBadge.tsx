import { Star } from "lucide-react";

export default function ReputationBadge({
  avgRating,
  reviewCount,
  compact = false,
}: {
  avgRating: number;
  reviewCount: number;
  compact?: boolean;
}) {
  if (reviewCount === 0) return null;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-amber-600 ${
        compact ? "text-[11px]" : "text-xs"
      }`}
    >
      <Star className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} fill-amber-400 text-amber-400`} />
      <span className="font-semibold">{avgRating.toFixed(1)}</span>
      <span className="text-gray-400 font-normal">({reviewCount})</span>
    </span>
  );
}
