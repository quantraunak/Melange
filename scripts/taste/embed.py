"""Build each member's taste vector from the images they've made and loved.

Usage:  python3 -I scripts/taste/embed.py [--dry-run]

Taste is the mean of CLIP image embeddings over a member's images:
  - their portfolio photos
  - the photos on shoots they posted or are credited on
  - the photos on shoots they hearted
An open-source model (open_clip ViT-B-32, LAION-2B weights) runs locally on
the Mac's GPU, so there's no per-image API cost and no image leaves the
machine for a third party. Faces are not scored: CLIP sees whole images, and
nothing here asks it about a person's looks.

Reads and writes go through the Supabase Management API with the access
token in .env.local, the same path scripts/apply_migration.mjs uses.
"""

import io
import json
import os
import pathlib
import ssl
import sys
import urllib.request

import certifi

import open_clip
import torch
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
MODEL_NAME, PRETRAINED = "ViT-B-32", "laion2b_s34b_b79k"
MODEL_ID = f"open_clip:{MODEL_NAME}/{PRETRAINED}"
MAX_IMAGES_PER_PERSON = 24


def env() -> dict:
    out = {}
    for line in (ROOT / ".env.local").read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out


# The python.org build ships without system CA roots; use certifi's.
CTX = ssl.create_default_context(cafile=certifi.where())

E = env()
REF = E["NEXT_PUBLIC_SUPABASE_URL"].split("//")[1].split(".")[0]
TOKEN = E["SUPABASE_ACCESS_TOKEN"]


def sql(query: str):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{REF}/database/query",
        data=json.dumps({"query": query}).encode(),
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json",
                 "User-Agent": "melange-taste/1"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60, context=CTX) as r:
        return json.loads(r.read() or b"[]")


# Every member's image URLs, one row per (user, url). Public stories only.
IMAGES_SQL = """
WITH imgs AS (
  SELECT p.user_id, unnest(p.portfolio_urls) AS url, 'portfolio' AS src
  FROM public.profiles p WHERE p.member_since IS NOT NULL
  UNION ALL
  SELECT s.author_id, unnest(s.media_urls), 'made' FROM public.collab_stories s WHERE s.is_public
  UNION ALL
  SELECT (c->>'user_id')::uuid, unnest(s.media_urls), 'made'
  FROM public.collab_stories s, jsonb_array_elements(s.credits) c
  WHERE s.is_public AND nullif(c->>'user_id','') IS NOT NULL
  UNION ALL
  SELECT h.from_user, unnest(s.media_urls), 'loved'
  FROM public.hearts h JOIN public.collab_stories s ON s.id = h.target_id
  WHERE h.kind = 'story' AND s.is_public
)
SELECT DISTINCT user_id::text, url FROM imgs WHERE url IS NOT NULL AND url <> '';
"""


def fetch_image(url: str) -> Image.Image | None:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "melange-taste/1"})
        with urllib.request.urlopen(req, timeout=20, context=CTX) as r:
            return Image.open(io.BytesIO(r.read())).convert("RGB")
    except Exception as e:  # a dead link shouldn't stop everyone else's vector
        print(f"  skip {url[:80]}: {e}", file=sys.stderr)
        return None


def main() -> None:
    dry = "--dry-run" in sys.argv
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    model, _, preprocess = open_clip.create_model_and_transforms(MODEL_NAME, pretrained=PRETRAINED)
    model = model.to(device).eval()

    rows = sql(IMAGES_SQL)
    by_user: dict[str, list[str]] = {}
    for r in rows:
        by_user.setdefault(r["user_id"], []).append(r["url"])
    print(f"{len(by_user)} members with images, {len(rows)} images")

    values = []
    for uid, urls in by_user.items():
        imgs = [im for im in (fetch_image(u) for u in urls[:MAX_IMAGES_PER_PERSON]) if im is not None]
        if not imgs:
            continue
        with torch.no_grad():
            batch = torch.stack([preprocess(im) for im in imgs]).to(device)
            feats = model.encode_image(batch)
            feats = feats / feats.norm(dim=-1, keepdim=True)
            taste = feats.mean(dim=0)
            taste = taste / taste.norm()
        vec = "[" + ",".join(f"{x:.6f}" for x in taste.cpu().tolist()) + "]"
        values.append(f"('{uid}', '{vec}', '{MODEL_ID}', {len(imgs)}, now())")
        print(f"  {uid[:8]}: {len(imgs)} images")

    if not values:
        print("nothing to write")
        return
    upsert = (
        "INSERT INTO public.taste_vectors (user_id, embedding, model, image_count, updated_at) VALUES "
        + ",".join(values)
        + " ON CONFLICT (user_id) DO UPDATE SET embedding = EXCLUDED.embedding, model = EXCLUDED.model, "
          "image_count = EXCLUDED.image_count, updated_at = now() RETURNING user_id;"
    )
    if dry:
        print(f"dry run: would write {len(values)} vectors")
        return
    written = sql(upsert)
    print(f"wrote {len(written)} taste vectors")


if __name__ == "__main__":
    main()
