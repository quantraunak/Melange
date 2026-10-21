import { supabase } from "./supabase";

/**
 * Re-order a deck by taste: how close each owner's work is to yours, from
 * the CLIP taste vectors (supabase/schema/26 and 27).
 *
 * `weight` is how much taste counts against the order the deck arrived in:
 * projects already come ranked by the server (recency, role, distance…), so
 * taste nudges them; people arrive in join order, so taste leads.
 *
 * Anyone without a taste vector yet keeps a neutral score instead of
 * sinking to the bottom. If the lookup fails, the deck comes back unchanged:
 * a slower or missing taste score must never stop Discover from showing.
 */
export async function orderByTaste<T>(
  items: T[],
  ownerOf: (item: T) => string,
  weight: number
): Promise<T[]> {
  if (items.length < 2) return items;
  const owners = [...new Set(items.map(ownerOf))].slice(0, 200);
  const { data, error } = await supabase.rpc("taste_scores", { p_others: owners });
  if (error || !data) {
    if (error) console.warn("taste_scores failed", error.message);
    return items;
  }
  const sims = new Map<string, number>();
  for (const row of data as { user_id: string; similarity: number | null }[]) {
    if (row.similarity !== null) sims.set(row.user_id, row.similarity);
  }
  if (sims.size === 0) return items; // you have no vector yet, or nobody does

  const values = [...sims.values()];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const norm = (v: number) => (hi > lo ? (v - lo) / (hi - lo) : 0.5);

  const n = items.length;
  return items
    .map((item, i) => {
      const sim = sims.get(ownerOf(item));
      const taste = sim === undefined ? 0.5 : norm(sim);
      const arrived = 1 - i / n;
      return { item, score: (1 - weight) * arrived + weight * taste, i };
    })
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.item);
}
