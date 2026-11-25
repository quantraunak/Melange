# Melange: notes for Claude sessions

## Who can merge

Jolea (`huttjolea-maker`) and Raunak can both merge pull requests into `main`.
GitHub requires the two CI checks ("Web (lint, typecheck, build)" and
"Mobile (lint, typecheck)") to pass, and the branch to be up to date with
`main`. No approval is required.

Jolea's PRs merge themselves. Right after opening one, turn on auto-merge:
`gh pr merge <number> --auto --merge`. GitHub then merges it the moment both
checks pass, with no one needing to click anything. If a check fails, fix it
and push; the PR still merges on its own once it is green. If GitHub says the
branch is out of date, run `gh pr update-branch <number>`.

Before turning on auto-merge, read the whole diff once as if you were a user
of the app (see the last section), and fix what you find first.

## What merging does and does not do

- Phone app (`mobile/`): merging changes nothing on anyone's phone. A change
  reaches phones only in a new App Store build, and Raunak runs builds.
- Website (`app/`): merging to `main` deploys the site.
- Database (`supabase/schema/*.sql`): merging does NOT apply a migration to
  production. Raunak applies migrations. A migration must keep the version of
  the app that is on the App Store now working, not just the new code.

## Before merging a PR that has not been run

Jolea cannot run the app on her machine, so read the change the way a user
would hit it: what happens on a slow network, on a failed request, after a
second tap, and when you go back to the screen. Bugs found in past PRs were
mostly of that kind.
