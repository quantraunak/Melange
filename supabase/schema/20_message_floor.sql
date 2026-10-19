-- ============================================================
-- 20_message_floor.sql — a low bar for cold messages, none for warm ones
--
-- 18_hearts.sql fixes a real bug: 14_ungate_until_1_4.sql lifted the profile
-- floor from posting and liking but left it inside start_conversation() and
-- can_message(), so the one person it was lifted FOR still could not message
-- anybody. Verified against production before changing anything: Jolea's
-- account got "Add three photos and your role to your profile first."
--
-- But 18 fixes it by removing the floor from messaging entirely, and that is
-- the one place a floor earns its keep. Messaging a stranger who never asked
-- to hear from you is the harassment path on an app for meeting strangers,
-- and two of the five real accounts have no photo and no filled-in role at
-- all. "Anyone may cold-approach anyone" is not a thing to arrive at by
-- accident while fixing something else.
--
-- So the bar moves rather than disappearing:
--
--   * Someone you already share a heart or a like with: no bar. They raised
--     their hand. This is what 18_hearts.sql's has_heart_between() enables and
--     it is the right idea.
--   * A cold approach: one photo and a role. Not three. Three is a portfolio
--     and this only needs to show there is a person behind the message.
--     Jolea, with one photo and a role, passes. A blank profile does not.
--
-- The block check and the five-a-day limit are unchanged.
--
-- Safe to run more than once. Apply AFTER 18_hearts.sql.
-- ============================================================

CREATE OR REPLACE FUNCTION public.meets_message_floor(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(cardinality(portfolio_urls), 0) >= 1
     AND COALESCE(btrim(role), '') <> ''
  FROM public.profiles
  WHERE user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.meets_message_floor(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.meets_message_floor(UUID) TO authenticated;

-- can_message(): what the Message button asks before it shows itself.
CREATE OR REPLACE FUNCTION public.can_message(p_other UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND p_other IS NOT NULL
     AND p_other <> auth.uid()
     AND EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_other)
     AND NOT public.is_blocked_pair(auth.uid(), p_other)
     AND (
       -- Already talking, or they raised their hand: no bar.
       EXISTS (
         SELECT 1 FROM public.matches m
         WHERE (m.user1_id = auth.uid() AND m.user2_id = p_other)
            OR (m.user1_id = p_other AND m.user2_id = auth.uid())
       )
       OR public.has_heart_between(auth.uid(), p_other)
       OR COALESCE(public.meets_message_floor(auth.uid()), false)
     );
$$;

REVOKE ALL ON FUNCTION public.can_message(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_message(UUID) TO authenticated;
