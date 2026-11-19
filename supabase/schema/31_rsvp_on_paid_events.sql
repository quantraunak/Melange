-- 31_rsvp_on_paid_events.sql — paid events take "I'm going" and "Interested".
--
-- 29_projects_and_regions.sql blocked every RSVP on a paid event, so a paid
-- event showed no guest list and its guests never got the event chat. Now a
-- paid event works like a free one; the page still says how to pay, and
-- payment still happens off the app.
--
-- Safe for the live 2.1 app: it already hides the buttons on paid events, so
-- nothing changes there until the next build. Safe to run more than once.

DROP TRIGGER IF EXISTS trg_no_rsvp_on_paid_event ON public.event_rsvps;
DROP TRIGGER IF EXISTS trg_no_web_rsvp_on_paid_event ON public.event_web_rsvps;
DROP FUNCTION IF EXISTS public.no_rsvp_on_paid_event();
