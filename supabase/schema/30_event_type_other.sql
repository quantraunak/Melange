-- 30_event_type_other.sql — an event's type, typed in when "Other" is picked.
--
-- events.category stays the fixed list (photo walk, meetup, ... other). When
-- the host picks Other, the app asks what kind of event it is and keeps the
-- answer here, and shows it instead of the word "Other".
--
-- Safe to run more than once.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS category_label TEXT
    CHECK (category_label IS NULL OR length(category_label) <= 40);
