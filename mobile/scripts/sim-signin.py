"""Write a Supabase session into the booted simulator's AsyncStorage.

Signing in by typing into the simulator is slow and flaky under synthetic
input. The app reads its session from AsyncStorage, which on iOS is a
directory of files named by the md5 of the key, plus a manifest. Writing the
session there directly and relaunching puts the app in a signed-in state with
no keyboard involved.

Usage: python3 scripts/sim-signin.py
"""

import hashlib
import json
import os
import pathlib
import re
import ssl
import subprocess
import urllib.request

ENV = pathlib.Path("/Users/raunaksood/Projects/melange/.env.local")
EMAIL = os.environ.get("SIM_EMAIL", "review@melange.app")
PASSWORD = os.environ["REVIEW_PASSWORD"]
BUNDLE = "com.melange.app"


def main() -> None:
    env = {}
    for line in ENV.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()

    url = env["NEXT_PUBLIC_SUPABASE_URL"]
    anon = env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
    ref = re.match(r"https://([^.]+)\.supabase\.co", url).group(1)

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(
        f"{url}/auth/v1/token?grant_type=password",
        method="POST",
        headers={"apikey": anon, "Content-Type": "application/json"},
        data=json.dumps({"email": EMAIL, "password": PASSWORD}).encode(),
    )
    session = json.loads(urllib.request.urlopen(req, context=ctx).read())
    if not session.get("access_token"):
        raise SystemExit(f"no token: {session}")

    container = subprocess.check_output(
        ["xcrun", "simctl", "get_app_container", "booted", BUNDLE, "data"], text=True
    ).strip()
    store = pathlib.Path(container) / "Library/Application Support" / BUNDLE / "RCTAsyncLocalStorage_V1"
    store.mkdir(parents=True, exist_ok=True)

    key = f"sb-{ref}-auth-token"
    digest = hashlib.md5(key.encode()).hexdigest()
    (store / digest).write_text(json.dumps(session))
    (store / "manifest.json").write_text(json.dumps({key: None}))
    print(f"signed in as {EMAIL}\nkey {key}\nfile {store / digest}")


if __name__ == "__main__":
    main()
