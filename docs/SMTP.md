# Email delivery

## Where it stands

Melange sends two kinds of email: password resets and (if ever enabled) signup
confirmations. Both go through **Supabase's built-in sender**, which is meant
for development only:

- **2 emails per hour, project-wide.** Not per user. If two people hit "forgot
  password" in the same hour, the third gets nothing and sees no error.
- **Frequently filed as spam.** The sender domain is Supabase's, not ours, so
  there is no SPF or DKIM record tying it to melange-psi.vercel.app.
- **Supabase will not let the rate limit be raised** until custom SMTP is
  configured. That is the error you get from `scripts/fix-auth-redirects.sh`
  if you try.

Jolea hit exactly this on 2026-10-10, compounded by the localhost redirect bug
fixed the same day.

## The fix, when it matters

Thirty minutes, free at this scale:

1. Make a [Resend](https://resend.com) account. Free tier is 3,000 emails/month.
2. Add and verify a sending domain. If melange.app is not owned, use Resend's
   shared `onboarding@resend.dev` to test, but real deliverability needs a
   domain with SPF and DKIM records.
3. In Supabase: Authentication → Emails → SMTP Settings, enable custom SMTP:
   - host `smtp.resend.com`, port `465`, user `resend`
   - pass: the Resend API key
   - sender: `no-reply@<your domain>`, name `Melange`
4. Raise the rate limit in the same screen, or re-run
   `scripts/fix-auth-redirects.sh` with `rate_limit_email_sent` added back.

## When to do it

Not urgent at 12 accounts. It becomes urgent the day real signups start,
because a password reset that silently does not arrive is the kind of failure
nobody reports — they just leave.
