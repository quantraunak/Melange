-- ============================================================
-- 19_looking_for_consent.sql — do not publish what people wrote in private
--
-- 18_hearts.sql's client renames profiles.current_project to "What you're
-- looking for" and prints it on everybody's public profile.
--
-- That column has never been displayed to anyone. It lived inside Edit
-- profile, labelled "Current project", under the placeholder "What you're
-- working on right now". Seven profiles have text in it and five of those are
-- real people, including Jolea and Raunak. Shipping that change would take
-- something each of them typed into a private box and put it on their public
-- page, under a different label, with no notice and no way to review it first.
--
-- The rename is good and the field is worth showing. The consent is what is
-- missing, so this adds it: the text is published only once its owner has
-- saved their profile from a client that shows them the new label. Anyone who
-- opens Edit profile, sees "What you're looking for", and presses Save has
-- agreed to it. Everyone else keeps it private until they do, and loses
-- nothing.
--
-- Safe to run more than once.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS looking_for_is_public BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.looking_for_is_public IS
  'True once the owner saved their profile from a client that labels '
  'current_project as the public "What you''re looking for". Until then the '
  'text stays private, because it was written into a field that was never '
  'shown to anyone.';
