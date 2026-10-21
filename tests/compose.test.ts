import { describe, expect, it } from "vitest";

import {
  BLOCKED,
  composeAI,
  composeRandom,
  objective,
  pairScores,
  rng,
  roleFit,
  seatNight,
  type Person,
} from "../supabase/functions/compose-tables/compose";

const model = { w_taste: 1, w_roles: 0.6, w_vibes: 0.3, w_bias: 0 };

// Two taste clusters in 3 dimensions: "film" people near x, "studio" near y.
function person(id: string, role: string, cluster: "film" | "studio" | null): Person {
  const taste = cluster === "film" ? [1, 0.05, 0] : cluster === "studio" ? [0.05, 1, 0] : null;
  const n = taste ? Math.hypot(...taste) : 1;
  return { user_id: id, role, vibes: [], taste: taste ? taste.map((x) => x / n) : null };
}

describe("roleFit", () => {
  it("prefers roles that make each other's work possible", () => {
    expect(roleFit("photographer", "model")).toBeGreaterThan(roleFit("photographer", "photographer"));
    expect(roleFit("mua", "photographer")).toBe(1);
  });
});

describe("composeAI", () => {
  it("seats similar taste together when it can", () => {
    const people = [
      person("a", "photographer", "film"), person("b", "model", "film"), person("c", "mua", "film"),
      person("d", "photographer", "studio"), person("e", "model", "studio"), person("f", "mua", "studio"),
    ];
    const S = pairScores(people, model, []);
    const tables = composeAI([0, 1, 2, 3, 4, 5], S, 3, rng(7));
    const groups = tables.map((t) => t.map((i) => people[i].user_id).sort().join(""));
    expect(groups.sort()).toEqual(["abc", "def"]);
  });

  it("beats random seating on the objective", () => {
    const people = Array.from({ length: 12 }, (_, i) =>
      person(`p${i}`, ["photographer", "model", "mua"][i % 3], i % 2 ? "film" : "studio"),
    );
    const S = pairScores(people, model, []);
    const idx = people.map((_, i) => i);
    const ai = objective(composeAI(idx, S, 6, rng(1)), S);
    const rand = objective(composeRandom(idx, S, 6, rng(1)), S);
    expect(ai).toBeGreaterThanOrEqual(rand);
  });

  it("never seats a blocked pair together", () => {
    const people = [person("a", "photographer", "film"), person("b", "model", "film"),
      person("c", "mua", "studio"), person("d", "stylist", "studio")];
    const S = pairScores(people, model, [["a", "b"]]);
    expect(S[0][1]).toBe(BLOCKED);
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const t of composeAI([0, 1, 2, 3], S, 2, rng(seed))) {
        expect(t.includes(0) && t.includes(1)).toBe(false);
      }
      for (const t of composeRandom([0, 1, 2, 3], S, 2, rng(seed))) {
        expect(t.includes(0) && t.includes(1)).toBe(false);
      }
    }
  });
});

describe("seatNight", () => {
  it("splits a big enough night into two arms and seats everyone once", () => {
    const people = Array.from({ length: 20 }, (_, i) =>
      person(`p${i}`, ["photographer", "model", "mua", "stylist"][i % 4], i % 3 ? "film" : null),
    );
    const { seats, experiment } = seatNight(people, model, [], { seed: 42 });
    expect(experiment).toBe(true);
    expect(seats).toHaveLength(20);
    expect(new Set(seats.map((s) => s.user_id)).size).toBe(20);
    expect(seats.filter((s) => s.arm === "ai").length).toBe(10);
    // Every table has its own number across both arms.
    const tableArms = new Map<number, Set<string>>();
    for (const s of seats) tableArms.set(s.table_no, (tableArms.get(s.table_no) ?? new Set()).add(s.arm));
    for (const arms of tableArms.values()) expect(arms.size).toBe(1);
  });

  it("is reproducible from its seed", () => {
    const people = Array.from({ length: 16 }, (_, i) => person(`p${i}`, "photographer", i % 2 ? "film" : "studio"));
    expect(seatNight(people, model, [], { seed: 9 })).toEqual(seatNight(people, model, [], { seed: 9 }));
  });

  it("doesn't run an experiment on a tiny night", () => {
    const people = Array.from({ length: 5 }, (_, i) => person(`p${i}`, "model", "film"));
    const { seats, experiment } = seatNight(people, model, [], { seed: 3 });
    expect(experiment).toBe(false);
    expect(seats.every((s) => s.arm === "ai")).toBe(true);
  });
});

describe("table sizes", () => {
  it("gives each arm at least two tables once a night has 16+ people, so the AI has a choice", () => {
    const people = Array.from({ length: 16 }, (_, i) => person(`p${i}`, "model", i % 2 ? "film" : "studio"));
    const { seats } = seatNight(people, model, [], { seed: 5 });
    for (const arm of ["ai", "random"] as const) {
      expect(new Set(seats.filter((s) => s.arm === arm).map((s) => s.table_no)).size).toBeGreaterThanOrEqual(2);
    }
  });
});
