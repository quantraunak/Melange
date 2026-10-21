"""Refit the pair model from what happened at real nights.

Usage:  python3 scripts/taste/learn.py [--dry-run]

Every pair that shared a table is a training example (night_pair_outcomes).
The label is whether they hearted each other in Afterglow; the features are
the same three the composer scores: taste similarity, role fit, shared
vibes. A logistic regression gives new weights, which go into pair_model as
a new row (the composer always reads the newest).

It refuses to fit on too little: below MIN_PAIRS pairs or MIN_POSITIVE
mutual hearts it prints why and changes nothing, because a model fit on a
handful of pairs would just memorise them.
"""

import json
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from embed import sql  # noqa: E402  (same Management API helper)

MIN_PAIRS, MIN_POSITIVE = 60, 8

# Mirrors roleFit in supabase/functions/compose-tables/compose.ts.
MAKES_WORK_WITH = {
    "photographer": ["model", "mua", "stylist", "hair", "designer"],
    "videographer": ["model", "actor", "director", "musician", "dancer"],
    "model": ["photographer", "videographer", "mua", "stylist", "hair"],
    "mua": ["photographer", "model", "stylist", "hair"],
    "stylist": ["photographer", "model", "mua", "designer"],
    "hair": ["photographer", "model", "mua"],
    "director": ["dp", "actor", "editor", "videographer", "producer"],
    "musician": ["videographer", "producer", "dancer", "designer"],
    "dancer": ["videographer", "musician", "photographer"],
    "designer": ["photographer", "stylist", "musician", "illustrator"],
}


def role_fit(a, b):
    if not a or not b or "other" in (a, b):
        return 0.3
    if b in MAKES_WORK_WITH.get(a, []) or a in MAKES_WORK_WITH.get(b, []):
        return 1.0
    return 0.2 if a == b else 0.5


PAIRS_SQL = """
SELECT o.mutual,
       1 - (ta.embedding OPERATOR(extensions.<=>) tb.embedding) AS taste,
       public.norm_role(pa.role) AS role_a, public.norm_role(pb.role) AS role_b,
       coalesce(pa.vibes, '{}') AS vibes_a, coalesce(pb.vibes, '{}') AS vibes_b
FROM public.night_pair_outcomes o
JOIN public.night_seating s ON s.event_id = o.event_id AND s.user_id = o.user_a
JOIN public.profiles pa ON pa.user_id = o.user_a
JOIN public.profiles pb ON pb.user_id = o.user_b
LEFT JOIN public.taste_vectors ta ON ta.user_id = o.user_a
LEFT JOIN public.taste_vectors tb ON tb.user_id = o.user_b
WHERE s.in_experiment;
"""


def jaccard(a, b):
    a, b = set(a or []), set(b or [])
    return len(a & b) / len(a | b) if a and b else 0.0


def fit(X, y, l2=0.1, steps=4000, lr=0.1):
    w = [0.0] * len(X[0])
    b = 0.0
    n = len(X)
    for _ in range(steps):
        gw = [0.0] * len(w)
        gb = 0.0
        for xi, yi in zip(X, y):
            p = 1 / (1 + math.exp(-(sum(wj * xj for wj, xj in zip(w, xi)) + b)))
            for j, xj in enumerate(xi):
                gw[j] += (p - yi) * xj / n
            gb += (p - yi) / n
        w = [wj - lr * (g + l2 * wj) for wj, g in zip(w, gw)]
        b -= lr * gb
    return w, b


def main():
    rows = sql(PAIRS_SQL)
    pos = sum(1 for r in rows if r["mutual"])
    print(f"{len(rows)} pairs from real nights, {pos} mutual")
    if len(rows) < MIN_PAIRS or pos < MIN_POSITIVE:
        print(f"not enough yet (need {MIN_PAIRS}+ pairs and {MIN_POSITIVE}+ mutual); keeping the current model")
        return
    X = [[float(r["taste"] or 0), role_fit(r["role_a"], r["role_b"]), jaccard(r["vibes_a"], r["vibes_b"])] for r in rows]
    y = [1.0 if r["mutual"] else 0.0 for r in rows]
    (w_taste, w_roles, w_vibes), bias = fit(X, y)
    print(f"weights: taste {w_taste:.3f}, roles {w_roles:.3f}, vibes {w_vibes:.3f}, bias {bias:.3f}")
    if "--dry-run" in sys.argv:
        return
    note = json.dumps({"pairs": len(rows), "mutual": pos})
    sql(
        "INSERT INTO public.pair_model (w_taste, w_roles, w_vibes, w_bias, trained_on, note) "
        f"VALUES ({w_taste}, {w_roles}, {w_vibes}, {bias}, {len(rows)}, '{note}');"
    )
    print("saved a new pair model")


if __name__ == "__main__":
    main()
