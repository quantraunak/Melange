# Hand-picked matching: setup and testing

How it works: a school sends students a Google Form. Each response becomes an
**applicant** in Melange (no copy-paste). On the admin page you pair people
by hand, review and approve the drafts, text or email both people yourself,
then mark the match **sent**. Only then does it appear in their app, under
**Your matches** at the top of Discover.

| Piece | Where |
|---|---|
| Database (tables, admin-only functions, students' own matches) | `supabase/schema/29_intro_matches.sql` |
| Endpoint the sheet posts to | `app/api/applicants/route.ts` |
| Reading a form response | `app/lib/applicantForm.ts` (tests: `tests/applicantForm.test.ts`) |
| Admin page | `/internal/matches` on the website (`app/internal/matches/page.tsx`) |
| The script you paste into the sheet | `scripts/google-apps-script/applicants.gs` |
| Your matches in the app | `mobile/app/matches/index.tsx`, `mobile/src/lib/intros.ts` |
| Profile and first post started from the form | `mobile/app/onboarding/from-form.tsx` |

**Starting from the form.** When someone signs in and their confirmed email
matches a form response, the app opens "We started your profile from your
form": their name, what they do (from "What do you make?"), who they're looking
for, Instagram and work link are filled in. They add photos, fix anything, and
tap Save. Then a project post is filled in from their idea and who they're
looking for. They add pictures, edit, and tap Post, or skip it. Nothing becomes
public until they tap Save or Post: their answers were shared with their
matches, not with everyone. It comes back each time they open the app until
they finish it.

Do the steps in this order.

---

## 1. Apply the database change (Raunak)

```bash
bash scripts/apply-schema.sh supabase/schema/29_intro_matches.sql
```

Then make yourselves admins, in Supabase → SQL Editor. Find your user ids
first:

```sql
SELECT id, email FROM auth.users WHERE email IN ('<jolea email>', '<raunak email>');
INSERT INTO public.app_admins (user_id) VALUES ('<id>'), ('<id>') ON CONFLICT DO NOTHING;
```

## 2. Turn on email confirmation (both of you, together)

Students' matches connect to their account **by the email they used on the
form**. Right now anyone could sign up with someone else's email, so until
confirmation is on, Melange links nobody by email (`emails_confirmed_since`
below starts empty). Sign-up in both the app and the website already handles
confirmation: they show "Check your email" instead of an error.

### 2a. Set up an email sender (about 30 minutes)

Supabase's built-in sender only sends 2 emails an hour for the whole project,
and lands in spam. Confirmation needs a real one. Resend is free up to 3,000
emails a month.

1. Go to resend.com and sign up.
2. **Domains → Add Domain.** Use a domain you own (Melange's own domain if you
   have one). `melange.app` is not ours, so don't use it.
3. Resend shows 3 or 4 DNS records (TXT for SPF, CNAME or TXT for DKIM, MX for
   bounces). Add each one in your domain registrar's DNS settings (wherever you
   bought the domain: GoDaddy, Namecheap, Squarespace, Cloudflare…), exactly as
   shown.
4. Back in Resend, click **Verify**. It can take a few minutes to an hour. Wait
   until the domain shows **Verified**.
5. **API Keys → Create API Key.** Name it "Supabase", permission "Sending
   access". Copy the key now (it is shown once).
6. In Supabase: **Authentication → Emails → SMTP Settings → Enable custom SMTP.**
   - Sender email: `no-reply@<your domain>`
   - Sender name: `Melange`
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: the API key from step 5
   - Save.
7. Same area, **Rate limits**: raise "Emails sent per hour" (30 is plenty for now).
8. Test it: on the login screen, use "Forgot password" with your own email. The
   reset email should arrive within a minute and not in spam.

No domain yet? Resend lets you send from `onboarding@resend.dev`, but only to
your own address. Fine for a quick test, not for real students.

### 2b. Switch confirmation on

1. Supabase: **Authentication → Sign In / Providers → Email.** Turn on **Confirm
   email**. Save.
2. **Authentication → URL Configuration:** Site URL should be
   `https://melange-psi.vercel.app` (it is, since the fix on 2026-10-10). That is
   where the confirm link sends people after they tap it.
3. Right after saving, in the SQL Editor:

   ```sql
   UPDATE public.melange_settings SET emails_confirmed_since = now();
   ```

   From now on, an account whose confirmed email matches a form email sees that
   person's sent matches. Accounts created before this moment never link by
   email, because their email was never proven. If a student already had an
   account before today, pair them on the admin page as an **existing Melange
   user** instead (search their name).

4. Test: sign up in the app with a new email you can read. You should see
   "Check your email". Tap the link in the email, then sign in.

## 3. The endpoint secret (Raunak, in Vercel)

1. Make a long random secret, for example run `openssl rand -hex 32` in a
   terminal, or use a password manager to generate 40+ characters.
2. Vercel → the Melange project → **Settings → Environment Variables**:
   - `APPLICANT_IMPORT_SECRET` = the secret (Production).
   - Check `SUPABASE_SERVICE_ROLE_KEY` is there too (the reports page already
     uses it). It is server-only and never reaches a browser.
3. Redeploy (Deployments → the latest → Redeploy) so the variables load.

## 4. The Google Form

Create the form with these questions. **Titles must match exactly** (capital
letters and a trailing "?" don't matter; the words do). Options for choice
questions should match too.

| # | Question title | Type | Options / notes |
|---|---|---|---|
| 1 | `Name` | Short answer | Required |
| 2 | `School` | Short answer (or dropdown of schools) | |
| 3 | `Email` | Short answer, email validation | Required. Tell them: "use the email you'll sign up to Melange with". (Or turn on Settings → Collect email addresses; Google's "Email Address" column works too.) |
| 4 | `Phone` | Short answer | Optional. Only you see it. Never shown in the app. |
| 5 | `Best way to reach you` | Multiple choice | `Email`, `Text`, `Instagram` |
| 6 | `Instagram` | Short answer | Optional |
| 7 | `What do you make?` | Checkboxes | `Film`, `Photo`, `Writing`, `Music`, `Art`, `Design`, `Other` |
| 8 | `Who are you looking for?` | Checkboxes | `Model`, `Photographer`, `Videographer or editor`, `Illustrator or artist`, `Writer or poet`, `Musician or producer`, `Actor or performer`, `Designer`, `Other` |
| 9 | `Tell us more about who you're looking for` | Short answer | Optional |
| 10 | `Do you have an idea or want to join someone else's?` | Multiple choice | `I have an idea`, `I want to join someone's`, `Both` |
| 11 | `Your idea, or what you'd love to work on` | Paragraph | |
| 12 | `How much time do you have?` | Multiple choice | `A weekend`, `A few weeks`, `Ongoing` |
| 13 | `Link to your work` | Short answer | Optional |
| 14 | `Can we share your answers with your matches?` | Multiple choice | `Yes`, `No`. Required. Anyone who answers No is **not imported**. |

Google adds `Timestamp` itself; it becomes "submitted at".

Then: **Responses → Link to Sheets → Create a new spreadsheet.**

## 5. The script on the sheet

1. Open the response **spreadsheet** (not the form). **Extensions → Apps Script.**
2. Delete what's in `Code.gs` and paste all of `scripts/google-apps-script/applicants.gs`.
   Save (the disk icon).
3. Left sidebar, **Project Settings** (gear) → **Script Properties → Add script property**:
   - Property: `APPLICANT_IMPORT_SECRET`
   - Value: the same secret you put in Vercel. Save.
4. Left sidebar, **Triggers** (alarm clock) → **Add Trigger**:
   - Function: `onFormSubmit`
   - Deployment: Head
   - Event source: **From spreadsheet**
   - Event type: **On form submit**
   - Failure notifications: Notify me immediately
   - Save. Google asks you to authorise: pick your account → Advanced → "Go to
     (project) (unsafe)" → Allow. (It says unsafe because the script is yours and
     unreviewed; it only reads the sheet and calls Melange.)
5. Already have responses? Back in the editor, choose `importExistingRows` in the
   function dropdown at the top and click **Run**. Check **Executions** for
   "Sent N rows".
6. Test: submit the form once yourself. Within a few seconds the person shows up
   on `/internal/matches`. If not: Apps Script → **Executions** shows the error
   (401 = the secrets don't match; 500 = check Vercel's variables).

## 6. Using the admin page

Go to `https://melange-psi.vercel.app/internal/matches` on a computer and sign in
with your Melange account.

- **Counts at the top:** applicants, draft / approved / sent matches, waiting,
  and how many matched people have signed up.
- **Applicants:** filter by school, what they make, who they're looking for and
  status. "Pick" two people (or search an existing Melange user), write "why
  you two", **Create draft match**. Each row shows their matches as N/3; a 4th
  is refused with the person's name. "Waiting" marks someone with no good match
  yet. **Export CSV** downloads everyone. **Delete** removes an applicant and
  all their matches for good (use this when someone asks to be removed).
- **Review drafts:** both people's answers side by side, your note, **Swap**
  either person, **Delete**, and the **Approve** checkbox.
- **Ready to send:** for each person, the intro text with **Copy text**, their
  email / phone / Instagram and how they prefer to be reached. Text or email
  them, then **Mark as sent**. Untick "Approved" to send it back to drafts;
  nothing changes for the students until it's sent.
- **Sent:** what's live. Deleting one here removes it from both people's app.

---

## Testing on your iPhone

These parts could not be tested against the real database from here; do them
once after steps 1–5.

1. **Form → admin page.** Submit the form twice with the same email, changing
   one answer. You should see one applicant, with the newer answer. Submit once
   with "No" for consent: nobody new appears.
2. **Admin page sign-in.** Sign in at `/internal/matches` with a non-admin
   account: "Not available". With yours: the page.
3. **Drafts stay hidden.** Make a draft match between applicant A (a test email
   you control) and an existing account B (your second test account). On B's
   iPhone: Discover → **Your matches** shows "We're finding your match".
   Approve it: still nothing. **Mark as sent**: pull down to refresh Your
   matches on B's phone; the match appears with A's name, what they make, who
   they're looking for, your note and their idea. A has no account yet, so it
   says they aren't on Melange yet.
4. **Signing up later links the match.** On another phone (or sign out), sign
   up in the app with A's form email. You should get "Check your email". Tap the
   link, sign in. Discover shows **Your matches 1**; open it: B is there with
   **Message** and **View profile**.
4b. **Starting from the form.** Right after that first sign-in, the app opens
   "We started your profile from your form". Check the fields match the form,
   add a photo, Save. Next comes the post filled in from the idea: add a
   picture, Post. It opens the post. Close and reopen the app: the setup doesn't
   come back. (On a fresh test account, try "Do this later" first: it comes back
   on the next launch.)
5. **Messaging with no photos.** From A's brand-new account (no photos, no
   role) tap **Message** on the match and send. It goes through. Then try
   messaging some random person from their profile: it asks for a photo and
   role first. That's expected.
6. **The once-only prompt.** On A, after opening the profile or sending the
   message, go back to Your matches: "Want to meet more people?" appears once.
   Do it again: it doesn't.
7. **Three matches.** Give one applicant 3 matches, then try a 4th: refused with
   their name.
8. **Delete.** Delete the test applicant A: their match disappears from B's
   Your matches after a refresh.

## Deleting test data

Use test emails you can recognise (for example `you+test1@gmail.com`). Then in
the SQL Editor:

```sql
-- Applicants (and every match they're in) from your test emails.
DELETE FROM public.applicants WHERE email LIKE '%+test%';
-- Any test matches between existing accounts.
DELETE FROM public.intro_matches WHERE a_user_id = '<test user id>' OR b_user_id = '<test user id>';
-- Test accounts themselves: Authentication → Users → … → Delete user.
```

Or delete one at a time with **Delete** on the admin page.
