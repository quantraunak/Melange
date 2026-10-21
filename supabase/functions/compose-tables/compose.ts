// The room composer: who sits with whom at a night.
//
// Pure TypeScript, no Deno or Node APIs, so the Edge Function runs it and
// vitest tests it (tests/compose.test.ts) from the same file.
//
// Attendees are split at random into two arms. The 'random' arm is seated
// at random; the 'ai' arm is seated to make whole tables work. Comparing the
// arms afterwards (night_experiment_results) is how we know whether the AI
// helps, rather than assuming it does.

export type Person = {
  user_id: string;
  role: string | null;
  vibes: string[];
  taste: number[] | null; // unit-length CLIP vector, or null if no images yet
};

export type Model = { w_taste: number; w_roles: number; w_vibes: number; w_bias: number };

export type Seat = { user_id: string; arm: "ai" | "random"; table_no: number };

/** Small seeded PRNG (mulberry32), so a run can be reproduced from its seed. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // both are unit vectors
}

// Roles that make each other's work possible score higher than two of the
// same role. A table of six photographers is a worse night than a mix.
const MAKES_WORK_WITH: Record<string, string[]> = {
  photographer: ["model", "mua", "stylist", "hair", "designer"],
  videographer: ["model", "actor", "director", "musician", "dancer"],
  model: ["photographer", "videographer", "mua", "stylist", "hair"],
  mua: ["photographer", "model", "stylist", "hair"],
  stylist: ["photographer", "model", "mua", "designer"],
  hair: ["photographer", "model", "mua"],
  director: ["dp", "actor", "editor", "videographer", "producer"],
  musician: ["videographer", "producer", "dancer", "designer"],
  dancer: ["videographer", "musician", "photographer"],
  designer: ["photographer", "stylist", "musician", "illustrator"],
};

export function roleFit(a: string | null, b: string | null): number {
  if (!a || !b || a === "other" || b === "other") return 0.3;
  if (MAKES_WORK_WITH[a]?.includes(b) || MAKES_WORK_WITH[b]?.includes(a)) return 1;
  return a === b ? 0.2 : 0.5;
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const sa = new Set(a);
  const inter = b.filter((x) => sa.has(x)).length;
  return inter / (sa.size + b.length - inter);
}

export const BLOCKED = -1e6;

/** Pairwise chemistry score from the current model. */
export function pairScores(people: Person[], model: Model, blocked: Array<[string, string]>): number[][] {
  // People without a taste vector get the room's average taste, so they're
  // neither favoured nor punished for not having posted yet.
  const withTaste = people.filter((p) => p.taste);
  const dim = withTaste[0]?.taste?.length ?? 0;
  const mean = new Array(dim).fill(0);
  for (const p of withTaste) p.taste!.forEach((x, i) => (mean[i] += x / withTaste.length));
  const norm = Math.hypot(...mean) || 1;
  const fallback = mean.map((x) => x / norm);

  const block = new Set(blocked.map(([a, b]) => (a < b ? `${a}|${b}` : `${b}|${a}`)));
  const n = people.length;
  const S = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = people[i], b = people[j];
      const key = a.user_id < b.user_id ? `${a.user_id}|${b.user_id}` : `${b.user_id}|${a.user_id}`;
      const s = block.has(key)
        ? BLOCKED
        : model.w_bias +
          model.w_taste * (dim ? cosine(a.taste ?? fallback, b.taste ?? fallback) : 0) +
          model.w_roles * roleFit(a.role, b.role) +
          model.w_vibes * jaccard(a.vibes, b.vibes);
      S[i][j] = S[j][i] = s;
    }
  }
  return S;
}

/** Split n people into k tables as evenly as possible. */
function tableSizes(n: number, target: number): number[] {
  const k = Math.max(1, Math.round(n / target));
  return Array.from({ length: k }, (_, t) => Math.floor(n / k) + (t < n % k ? 1 : 0));
}

/**
 * The objective for a seating: each person's average chemistry with their
 * tablemates, passed through a concave curve so lifting the person who's
 * worst off counts more than making a good table slightly better. Nobody
 * should be stranded at a table they don't fit.
 */
export function objective(tables: number[][], S: number[][]): number {
  let total = 0;
  for (const t of tables) {
    for (const i of t) {
      if (t.length < 2) continue;
      let sum = 0;
      for (const j of t) if (j !== i) sum += S[i][j];
      const avg = sum / (t.length - 1);
      total += avg <= -1e5 ? -1e9 : Math.sign(avg) * Math.sqrt(Math.abs(avg) + 1e-9);
    }
  }
  return total;
}

/** Seat people to maximise the objective: random starts + pairwise swaps. */
export function composeAI(idx: number[], S: number[][], target: number, rand: () => number, restarts = 20): number[][] {
  const sizes = tableSizes(idx.length, target);
  let best: number[][] = [];
  let bestScore = -Infinity;
  for (let r = 0; r < restarts; r++) {
    const order = shuffle(idx, rand);
    const tables: number[][] = [];
    let k = 0;
    for (const size of sizes) tables.push(order.slice(k, (k += size)));
    let score = objective(tables, S);
    // Swap people between tables while any swap improves the objective.
    let improved = true;
    while (improved) {
      improved = false;
      for (let a = 0; a < tables.length; a++) {
        for (let b = a + 1; b < tables.length; b++) {
          for (let x = 0; x < tables[a].length; x++) {
            for (let y = 0; y < tables[b].length; y++) {
              [tables[a][x], tables[b][y]] = [tables[b][y], tables[a][x]];
              const s = objective(tables, S);
              if (s > score + 1e-9) {
                score = s;
                improved = true;
              } else {
                [tables[a][x], tables[b][y]] = [tables[b][y], tables[a][x]];
              }
            }
          }
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = tables.map((t) => t.slice());
    }
  }
  return best;
}

/** Random seating that still never puts a blocked pair together. */
export function composeRandom(idx: number[], S: number[][], target: number, rand: () => number): number[][] {
  const sizes = tableSizes(idx.length, target);
  for (let attempt = 0; attempt < 200; attempt++) {
    const order = shuffle(idx, rand);
    const tables: number[][] = [];
    let k = 0;
    for (const size of sizes) tables.push(order.slice(k, (k += size)));
    if (objective(tables, S) > -1e8) return tables;
  }
  return composeAI(idx, S, target, rand, 1); // couldn't avoid blocks at random
}

/**
 * The whole run: split attendees into arms at random, seat each arm, and
 * return one Seat per person. With fewer than 2 * minTable people there's
 * no room for two arms, so everyone is seated by the AI and the night
 * doesn't count toward the experiment (arm 'ai', flagged by the caller).
 */
export function seatNight(
  people: Person[],
  model: Model,
  blocked: Array<[string, string]>,
  opts: { seed: number; tableSize?: number; minTable?: number } = { seed: 1 },
): { seats: Seat[]; experiment: boolean } {
  const tableSize = opts.tableSize ?? 6;
  const minTable = opts.minTable ?? 4;
  const rand = rng(opts.seed);
  const S = pairScores(people, model, blocked);
  const all = people.map((_, i) => i);

  const experiment = people.length >= 2 * minTable;
  const order = shuffle(all, rand);
  const aiIdx = experiment ? order.filter((_, k) => k % 2 === 0) : order;
  const randIdx = experiment ? order.filter((_, k) => k % 2 === 1) : [];

  // Composing only helps if there's a choice to make: one table per arm
  // means the AI can't move anyone. So shrink tables (never below 4) until
  // each arm has at least two. Found in a production test where a 13-person
  // night gave each arm a single table and the "AI" table was just random.
  const sizeFor = (n: number) => Math.max(minTable, Math.min(tableSize, Math.floor(n / 2)));
  const seats: Seat[] = [];
  const aiTables = composeAI(aiIdx, S, sizeFor(aiIdx.length), rand);
  aiTables.forEach((t, n) =>
    t.forEach((i) => seats.push({ user_id: people[i].user_id, arm: "ai", table_no: n + 1 })),
  );
  if (randIdx.length) {
    const randTables = composeRandom(randIdx, S, sizeFor(randIdx.length), rand);
    randTables.forEach((t, n) =>
      t.forEach((i) =>
        seats.push({ user_id: people[i].user_id, arm: "random", table_no: aiTables.length + n + 1 }),
      ),
    );
    // Shuffle table numbers across both halves, so a table's number says
    // nothing about which half it's in (numbering the random half after the
    // AI half would let anyone who knew the scheme tell them apart).
    const total = aiTables.length + randTables.length;
    const relabel = shuffle(Array.from({ length: total }, (_, k) => k + 1), rand);
    for (const s of seats) s.table_no = relabel[s.table_no - 1];
  }
  return { seats, experiment };
}
