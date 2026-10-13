# Saving your work

## "push blocked" / "protected branch"

Nothing is broken and you did nothing wrong. `main` is the branch that ships to
the App Store, so GitHub refuses any commit pushed straight to it. Work has to
go on its own branch first, where the automatic checks run, and merge into main
once they pass.

One command does all of that:

```bash
./scripts/save.sh "made the buttons bigger on the profile page"
```

That puts your work on a branch, pushes it, and opens it for review. The checks
take about two minutes. If they pass, it can be merged.

Run it as often as you like. Small saves are better than one big one.

## If it says something about a secret

GitHub also blocks any push that contains a password or an API key, which is
why `.env` and `.env.local` are never committed. If you see that, the fix is to
take the key out of the file you edited and put it in `.env.local`, which stays
on your machine. **This repository is public**, so anything committed is visible
to anyone.

## Starting from scratch on a new machine

```bash
git clone https://github.com/quantraunak/Melange.git
cd Melange
node scripts/setup_all.mjs
```

`setup_all.mjs` needs `.env.local` in the repo root. Ask Raunak for it; do not
commit it. `docs/SETUP.md` has the longer version, and `docs/ONBOARDING.md`
covers which credentials get handed out and which do not.

## Running it

```bash
npm run dev          # the website, at localhost:3000
cd mobile && npx expo start   # the iOS app
```

## Getting unstuck

- **The app will not build.** Usually a stale build. `cd mobile && npx expo start -c`.
- **Someone else changed the same files.** `git pull --rebase origin main`, then
  run the save script again.
- **You want to throw away what you changed.** `git checkout -- .` discards
  everything uncommitted and cannot be undone.
