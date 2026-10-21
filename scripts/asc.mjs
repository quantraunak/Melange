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
import { createHash } from "node:crypto";
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

async function call(method, endpoint, body) {
  const key = loadKey();
  // Try the individual-key shape first, fall back to team if an issuer is set.
  for (const issuer of [null, process.env.ASC_ISSUER_ID].filter((v) => v !== undefined)) {
    const r = await fetch(`https://api.appstoreconnect.apple.com${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token(key, issuer)}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (r.ok) return r.status === 204 ? null : r.json();
    if (r.status !== 401) throw new Error(`${r.status} ${endpoint}: ${await r.text()}`);
  }
  throw new Error("401 from App Store Connect — key, key id, or JWT shape is wrong");
}


const IPHONE_67 = "APP_IPHONE_67";

/** The appStoreVersion for a version string, created if it does not exist. */
async function version(v, { create = false } = {}) {
  const d = await call("GET", `/v1/apps/${APP_ID}/appStoreVersions?filter[versionString]=${v}&limit=1`);
  if (d.data.length) return d.data[0];
  if (!create) throw new Error(`no App Store version ${v}`);
  const made = await call("POST", "/v1/appStoreVersions", {
    data: {
      type: "appStoreVersions",
      attributes: { platform: "IOS", versionString: v },
      relationships: { app: { data: { type: "apps", id: APP_ID } } },
    },
  });
  return made.data;
}

async function localization(versionId) {
  const d = await call("GET", `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`);
  const en = d.data.find((l) => l.attributes.locale === "en-US") ?? d.data[0];
  if (!en) throw new Error("no localization on that version");
  return en;
}

async function screenshotSet(localizationId) {
  const d = await call("GET", `/v1/appStoreVersionLocalizations/${localizationId}/appScreenshotSets`);
  const found = d.data.find((s) => s.attributes.screenshotDisplayType === IPHONE_67);
  if (found) return found;
  const made = await call("POST", "/v1/appScreenshotSets", {
    data: {
      type: "appScreenshotSets",
      attributes: { screenshotDisplayType: IPHONE_67 },
      relationships: {
        appStoreVersionLocalization: {
          data: { type: "appStoreVersionLocalizations", id: localizationId },
        },
      },
    },
  });
  return made.data;
}

/** Reserve, PUT the bytes exactly as Apple dictates, then commit with the md5. */
async function uploadScreenshot(setId, filePath, fileName) {
  const bytes = readFileSync(filePath);
  const reserved = await call("POST", "/v1/appScreenshots", {
    data: {
      type: "appScreenshots",
      attributes: { fileName, fileSize: bytes.length },
      relationships: { appScreenshotSet: { data: { type: "appScreenshotSets", id: setId } } },
    },
  });
  const id = reserved.data.id;
  for (const op of reserved.data.attributes.uploadOperations) {
    const headers = Object.fromEntries((op.requestHeaders || []).map((h) => [h.name, h.value]));
    const r = await fetch(op.url, {
      method: op.method,
      headers,
      body: bytes.subarray(op.offset, op.offset + op.length),
    });
    if (!r.ok) throw new Error(`upload chunk failed ${r.status}: ${await r.text()}`);
  }
  await call("PATCH", `/v1/appScreenshots/${id}`, {
    data: {
      type: "appScreenshots",
      id,
      attributes: { uploaded: true, sourceFileChecksum: createHash("md5").update(bytes).digest("hex") },
    },
  });
  return id;
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
} else if (cmd === "ensure-version") {
  const v = await version(rest[0], { create: true });
  console.log(`version ${rest[0]}: ${v.id} (${v.attributes.appStoreState})`);
} else if (cmd === "whatsnew") {
  const v = await version(rest[0]);
  const loc = await localization(v.id);
  await call("PATCH", `/v1/appStoreVersionLocalizations/${loc.id}`, {
    data: { type: "appStoreVersionLocalizations", id: loc.id, attributes: { whatsNew: rest.slice(1).join(" ") } },
  });
  console.log("what's new updated");
} else if (cmd === "screenshots") {
  const [v, dir] = rest;
  const ver = await version(v);
  const loc = await localization(ver.id);
  const set = await screenshotSet(loc.id);
  const existing = await call("GET", `/v1/appScreenshotSets/${set.id}/appScreenshots`);
  for (const s of existing.data) {
    await call("DELETE", `/v1/appScreenshots/${s.id}`);
    console.log(`removed ${s.attributes.fileName}`);
  }
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".png")).sort()) {
    await uploadScreenshot(set.id, path.join(dir, f), f);
    console.log(`uploaded ${f}`);
  }
} else if (cmd === "attach-build") {
  const [v, num] = rest;
  const ver = await version(v);
  const builds = await call("GET", `/v1/builds?filter[app]=${APP_ID}&filter[version]=${num}&limit=1`);
  if (!builds.data.length) throw new Error(`build ${num} not found or still processing`);
  await call("PATCH", `/v1/appStoreVersions/${ver.id}/relationships/build`, {
    data: { type: "builds", id: builds.data[0].id },
  });
  console.log(`build ${num} attached to ${v}`);
} else if (cmd === "withdraw") {
  // Remove a version from review. Apple exposes this as cancelling the open
  // reviewSubmission; the version falls back to PREPARE_FOR_SUBMISSION and the
  // build stays attached, so it can be resubmitted without rebuilding.
  const open = await call(
    "GET",
    `/v1/apps/${APP_ID}/reviewSubmissions?filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW&limit=1`
  );
  const sub = open.data[0];
  if (!sub) throw new Error("no open review submission to withdraw");
  await call("PATCH", `/v1/reviewSubmissions/${sub.id}`, {
    data: { type: "reviewSubmissions", id: sub.id, attributes: { canceled: true } },
  });
  console.log(`withdrew review submission ${sub.id}`);
} else if (cmd === "submit") {
  // /v1/appStoreVersionSubmissions is retired (403). The current flow is a
  // reviewSubmission that you add items to and then mark submitted.
  const ver = await version(rest[0]);
  const open = await call("GET", `/v1/apps/${APP_ID}/reviewSubmissions?filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW&limit=1`);
  let sub = open.data[0];
  if (!sub) {
    const made = await call("POST", "/v1/reviewSubmissions", {
      data: {
        type: "reviewSubmissions",
        attributes: { platform: "IOS" },
        relationships: { app: { data: { type: "apps", id: APP_ID } } },
      },
    });
    sub = made.data;
  }
  console.log(`review submission ${sub.id} (${sub.attributes.state})`);

  const items = await call("GET", `/v1/reviewSubmissions/${sub.id}/items`);
  const already = items.data.some((i) => i.relationships?.appStoreVersion?.data?.id === ver.id);
  if (!already) {
    await call("POST", "/v1/reviewSubmissionItems", {
      data: {
        type: "reviewSubmissionItems",
        relationships: {
          reviewSubmission: { data: { type: "reviewSubmissions", id: sub.id } },
          appStoreVersion: { data: { type: "appStoreVersions", id: ver.id } },
        },
      },
    });
    console.log(`added ${rest[0]} to the submission`);
  }

  await call("PATCH", `/v1/reviewSubmissions/${sub.id}`, {
    data: { type: "reviewSubmissions", id: sub.id, attributes: { submitted: true } },
  });
  console.log(`${rest[0]} submitted for review`);
} else if (cmd === "review-login") {
  // The demo account App Review signs in with. The password comes from the
  // environment (REVIEW_PASSWORD in .env.local), never from the command line
  // or this repo, which is public.
  const [v, email] = rest;
  const password = process.env.REVIEW_PASSWORD;
  if (!email || !password) throw new Error("usage: REVIEW_PASSWORD=... review-login <v> <email>");
  const ver = await version(v);
  const attributes = { demoAccountName: email, demoAccountPassword: password, demoAccountRequired: true };
  let detail = null;
  try {
    detail = (await call("GET", `/v1/appStoreVersions/${ver.id}/appStoreReviewDetail`)).data;
  } catch (e) {
    if (!String(e.message).startsWith("404")) throw e;
  }
  if (detail) {
    await call("PATCH", `/v1/appStoreReviewDetails/${detail.id}`, {
      data: { type: "appStoreReviewDetails", id: detail.id, attributes },
    });
  } else {
    await call("POST", "/v1/appStoreReviewDetails", {
      data: {
        type: "appStoreReviewDetails",
        attributes,
        relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: ver.id } } },
      },
    });
  }
  console.log(`review login for ${v} set to ${email}`);
} else if (cmd === "listing") {
  // Store text for a version from a JSON file:
  //   { "subtitle", "description", "keywords", "promotionalText" }
  // Subtitle lives on the app's info record (editable while a version is
  // being prepared); the rest on the version's localization.
  const [v, file] = rest;
  const text = JSON.parse(readFileSync(file, "utf8"));
  const ver = await version(v);
  const loc = await localization(ver.id);
  const versionAttrs = {};
  for (const k of ["description", "keywords", "promotionalText"]) if (text[k]) versionAttrs[k] = text[k];
  if (Object.keys(versionAttrs).length) {
    await call("PATCH", `/v1/appStoreVersionLocalizations/${loc.id}`, {
      data: { type: "appStoreVersionLocalizations", id: loc.id, attributes: versionAttrs },
    });
    console.log(`updated ${Object.keys(versionAttrs).join(", ")}`);
  }
  if (text.subtitle) {
    const infos = await call("GET", `/v1/apps/${APP_ID}/appInfos`);
    const editable = infos.data.find((i) => i.attributes.appStoreState !== "READY_FOR_SALE") ?? infos.data[0];
    const locs = await call("GET", `/v1/appInfos/${editable.id}/appInfoLocalizations`);
    const en = locs.data.find((l) => l.attributes.locale === "en-US") ?? locs.data[0];
    await call("PATCH", `/v1/appInfoLocalizations/${en.id}`, {
      data: { type: "appInfoLocalizations", id: en.id, attributes: { subtitle: text.subtitle } },
    });
    console.log(`subtitle: ${text.subtitle}`);
  }
} else {
  console.log("usage: node scripts/asc.mjs versions | ensure-version <v> | whatsnew <v> <text> | listing <v> <file.json> | review-login <v> <email> | screenshots <v> <dir> | attach-build <v> <num> | submit <v> | withdraw | GET <endpoint>");
}
