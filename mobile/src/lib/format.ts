export function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Compact timestamp for the right edge of a conversation row: "3m", "2h",
 * "Tue", then a date once it's more than a week old. Deliberately terser than
 * formatTimeAgo — in a list, the column is only a few characters wide.
 */
export function formatListTime(iso: string): string {
  const then = new Date(iso);
  const diff = Date.now() - then.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return then.toLocaleDateString([], { weekday: "short" });
  // Never slashes: "8/25" is the 25th of August to half the world and the
  // August of 2025 to the other half.
  return then.toLocaleDateString([], { day: "numeric", month: "short" });
}

/**
 * The one date format for metadata columns: credits, work, projects, stories.
 *
 * The app shipped four at once — "Jul 2026", "Aug 26", "8/25" and "5/25/2026"
 * — three of them ambiguous outside the US. Spec fix 17.
 *
 *   under a week   "3d"
 *   this year      "12 Aug"
 *   otherwise      "Aug 2025"
 *
 * Never slashes. A bare date ("2026-09-20") is read as local noon so a
 * timezone west of UTC cannot roll it back a day.
 */
export function formatRecordDate(value: string): string {
  const d = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days >= 0 && days < 7) return days < 1 ? "today" : `${days}d`;
  if (d.getFullYear() === new Date().getFullYear()) {
    return d.toLocaleDateString([], { day: "numeric", month: "short" });
  }
  return d.toLocaleDateString([], { month: "short", year: "numeric" });
}
