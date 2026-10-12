// Talk to the App Store Connect API with an individual API key.
//
// Individual keys differ from team keys: the JWT carries `sub: "user"` and no
// issuer id. Node's crypto signs ES256 natively, so there is no dependency to
// install.
//
// Setup (once):
//   export ASC_KEY_ID=VE2PO29H01SI
//   key file at ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8
//
// Usage:
//   node scripts/asc.mjs versions          # every iOS version and its state
//   node scripts/asc.mjs GET /v1/apps      # any raw endpoint
import { createSign } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const APP_ID = "6774481477";
const DIR = path.join(homedir(), ".appstoreconnect", "private_keys");

function loadKey() {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".p8"));
  if (!files.length) throw new Error(`no .p8 in ${DIR}`);
  // Apple names team keys AuthKey_<id>.p8 and individual keys ApiKey_<id>.p8.
  // Newest first, so a freshly generated key wins over a stale one.
  const stat = (f) => statSync(path.join(DIR, f)).mtimeMs;
  const file = process.env.ASC_KEY_ID
    ? files.find((f) => f.includes(process.env.ASC_KEY_ID)) ?? files[0]
    : files.sort((a, b) => stat(b) - stat(a))[0];
  const keyId = process.env.ASC_KEY_ID || (file.match(/(?:AuthKey|ApiKey)_(.+)\.p8$/)?.[1] ?? null);
  if (!keyId) throw new Error("set ASC_KEY_ID or name the file AuthKey_<KEYID>.p8");
  return { pem: readFileSync(path.join(DIR, file), "utf8"), keyId };
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

/** Individual keys: sub=user, no iss. Team keys: iss=<issuer>, no sub. */
function token({ pem, keyId }, issuer) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const payload = issuer
    ? { iss: issuer, iat: now, exp: now + 600, aud: "appstoreconnect-v1" }
    : { sub: "user", iat: now, exp: now + 600, aud: "appstoreconnect-v1" };
  const body = `${b64(header)}.${b64(payload)}`;
  const sig = createSign("SHA256").update(body).end()
    .sign({ key: pem, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${body}.${sig}`;
}

async function call(method, endpoint) {
  const key = loadKey();
  // Try the individual-key shape first, fall back to team if an issuer is set.
  for (const issuer of [null, process.env.ASC_ISSUER_ID].filter((v) => v !== undefined)) {
    const r = await fetch(`https://api.appstoreconnect.apple.com${endpoint}`, {
      method,
      headers: { Authorization: `Bearer ${token(key, issuer)}` },
    });
    if (r.ok) return r.json();
    if (r.status !== 401) throw new Error(`${r.status} ${endpoint}: ${await r.text()}`);
  }
  throw new Error("401 from App Store Connect — key, key id, or JWT shape is wrong");
}

const [, , cmd, ...rest] = process.argv;

if (cmd === "versions") {
  const d = await call("GET", `/v1/apps/${APP_ID}/appStoreVersions?limit=10&fields[appStoreVersions]=versionString,appStoreState,createdDate,platform`);
  console.log("version  state                          created");
  for (const v of d.data) {
    const a = v.attributes;
    console.log(`${(a.versionString || "?").padEnd(8)} ${(a.appStoreState || "?").padEnd(30)} ${(a.createdDate || "").slice(0, 10)}`);
  }
} else if (cmd === "GET") {
  console.log(JSON.stringify(await call("GET", rest[0]), null, 2).slice(0, 4000));
} else {
  console.log("usage: node scripts/asc.mjs versions | GET <endpoint>");
}
