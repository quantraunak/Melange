import { BadgeCheck } from "lucide-react";

export default function VerifiedBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-blue-600 ${
        compact ? "text-[10px]" : "text-xs"
      }`}
      title="Verified creator"
    >
      <BadgeCheck className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} fill-blue-500 text-white`} />
      {!compact ? <span className="font-semibold">Verified</span> : null}
    </span>
  );
}
