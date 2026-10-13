<!-- 5 researchers, 68 findings, 62 sourced. 2026-10-12. -->

# Melange: should you build "the Shoot"?

## 1. The verdict

Do not build it. Not a smaller version, not a staged version. The Shoot monetizes step N+1 of a funnel whose step N has fired exactly once in the app's lifetime (`/Users/raunaksood/Projects/melange/docs/STATUS.md`: 9 accounts, 1 of them a real outside person who never returned; 12 swipes, 1 match, 1 message). You have already run the closest available experiment: Events is a structured, dated, city-scoped, RSVP-able object you shipped and tested, and it has zero rows. The Shoot is the same bet — a structured object replacing a chat thread — at several times the build cost, in a segment (unpaid TFP) where by definition no money changes hands, with the free half already shipped by PurplePort and by a live iOS competitor, and the paid half given away by Pixieset. Your own STATUS.md already wrote the correct next step and told you to do it before writing another line of code: test whether paid work (brands/agencies booking creatives) is a business. That test is a sales conversation, not a build.

## 2. Is the pain real

Partly, and not where you think. Ranked by evidence quality:

1. **No-shows and late cancellations — real, acute, and felt by the side you want to charge.** PurplePort has formal definitions ("fails to show up to a shoot they agreed to or cancels with less than 24 hours notice"; late cancellation inside 72 hours) and purpose-built reference options "Did not show up" and "Cancelled with less than 72 hours notice" (verified: purpleport.com/articles/29). Photographers self-report trade-shoot flake rates of 25–80% in Model Mayhem threads (modelmayhem.com/forums/post/651708/2) — but that thread is from 2010, and no current, credible TFP no-show rate exists anywhere I or the five researchers could find.
2. **Undelivered images after trade shoots — real breach, wrong payer.** PurplePort's guidance to photographers ("longer than 2 weeks then you are doing it wrong"; two months is reputation-destroying), plus first-person accounts from models, MUAs and stylists. But in every account the defaulting party is the photographer and the victim is the model/MUA — the roles you plan to never charge. You cannot sell a photographer a product whose core promise is enforcement against himself. Also: it does not appear in the only ranked list of model complaints anyone found (Fstoppers' top four: photographer is awkward, no concept, bad lighting, overstated ability — delivery absent). Your assumption that non-delivery is the #1 TFP complaint is unsupported.
3. **"Getting paid" is not the top client-work pain.** Client acquisition is. SOPI 2026 (verified, N=4,916, 90+ countries): 39% name business development/client acquisition as the primary pressure, 32% social-media demands, only 5% manage stress well, ~half admit to undercharging. The 2025 edition (zenfolio.com/sopi/2025-april) states plainly that "finding new clients was their biggest challenge" — I could not verify the 46.4% figure on that page itself, so treat the number as unconfirmed and the ranking as confirmed. Bonsai's invoice dataset puts photographers among the *fastest*-paid freelancers (24% late vs 29% average). Kill "get paid faster" as a pitch.
4. **Coordination itself — no evidence found.** Across five researchers and repeated searching, nobody found a photographer, model or MUA describing coordination (group chats, call times, call sheets) as a pain in their own words. People complain about outcomes — they flaked, he never sent the photos — not about the planning medium. The free tier's premise is the least evidenced part of the whole proposal. (Caveat: Reddit was unreachable from this environment, so r/photography and r/modeling were never searched.)

Blunt version: one of your three assumed pains survives, and the one that survives is enforcement, not coordination.

## 3. Is the category crowded

Yes, on both halves, and the whitespace you identified is real but worth roughly zero.

**Your paid tier is free elsewhere.** Verified today at pixieset.com/pricing-studio-manager: Free ($0) includes "Unlimited invoices," "3 contracts," "3 quotes or questionnaires," "1 active session type," "Basic booking & scheduling features," "Accept online payments." Plus $12/mo, Pro $18/mo (the only real gate is retainer collection, at Pro). Above that: HoneyBook $29/$49/$109, Dubsado $335–525/yr, Studio Ninja $16/$27/$40, Sprout $19–69, Session $19, 17hats $60, VSCO Workspace (formerly Táve, acquired May 2025) $22–45. Releases are a $12.99 one-time or $9.99/yr commodity (Easy Release, Getty/iStock/Alamy/Shutterstock-approved since 2010). Call sheets are free (StudioBinder, callsheet.tools, Callsheet Pro at $1.99/mo).

**Your free tier already exists, field for field.** PurplePort's Shoot Plans (verified: purpleport.com/articles/1002) contain concept/moodboard, paid-or-trade, location, date and time, equipment, "props and clothing details with provider information," model requirements, "Other creatives involved in the shoot (including contact details and their role)," and image agreements — and they are shareable with named members with edit permissions and expiry. That is your Shoot plus the release, shipped years ago. Inpose (verified: App Store, 4.0 from 56 ratings, v17.18.0 updated 6 days ago) ships "Safe Shoot": "organize the shoot location, schedule, conditions, and how the final photos may be used," monetized with $0.99–$9.99 memberships and $1.99–$8.99 credit packs.

**The one genuine gap:** no photography CRM models a multi-party shoot with free, first-class participants, and HoneyBook's team-member feature is seat-priced (2 members at $49/mo, unlimited at $109) — absurd for a model, MUA and stylist who each appear once. Real gap. But production tooling fills it from the other direction at $0–29, and the $1.99/mo iOS version of it has 2 ratings. The market has already priced a multi-party shoot object: free.

**Your pricing is inverted.** Verified: Model Mayhem's free tier is gated precisely at contact (1 casting call/week, 10 casting messages/day, 10 friend requests/day, messages to friends only), with Basic $6/mo and Premium $10/mo buying reach and search placement. PurplePort's free accounts cannot send more than 4 new messages a day, are capped at 15 visible portfolio images, and — the telling one — "cannot apply to paid calls." Twenty years of pricing experiments in your exact segment converge on charging for access *before* the match and giving coordination away after it. Your thesis is the exact inverse of every revealed price in the market. Backstage ($19.99–24.99/mo) and Casting Networks (~$26–30/mo) go further: the *abundant* side pays. Model Mayhem tried charging the outreach side in 2017 and got a backlash and an exodus (Fstoppers, 169510).

## 4. Is it defensible

The collaboration-graph moat is a story, and it has already been falsified at full scale. Model Mayhem accumulated millions of profiles with TFP credits and cross-links between photographers, models and MUAs — exactly the asset you describe — and lost to Instagram anyway; its own forums now read "Photographer=Tyrannosaurus Rex, Social Media=Asteroid," and its iOS app sits at 1.6 stars. Behance took 1M members to reach a ~$130–150M Adobe acquisition (Adobe FY12 10-K: ~$130.0M). Pictage held 11,000 photographers *and their image files* — the highest switching cost available in this vertical — and closed in 2017 once its take rate felt unfair. ShootQ passed through three owners in 17 years and ended as a customer list.

The only durable moat anyone has built here is payments volume: HoneyBook forbids bring-your-own-processor and clears $8.4B through Stripe (stripe.com/customers/honeybook), and even that is rented rails plus behavioral lock-in at 100,000 users. That moat is structurally unavailable in segment B, because there is no transaction. And "can't be scraped" is not a moat — hiQ v. LinkedIn settled that scraping public data isn't a CFAA violation, and the collaboration credits you'd hold are already public as Instagram tags.

"Hard to create" is false. A competitor built the core of the Shoot as one feature release.

## 5. The strongest argument against building it

One real outside person has ever used Melange, once, in July. The structured coordination object you already shipped — Events — has zero rows, against pre-registered targets in METRICS.md ("Events created per week per city ≥ 4", "Event RSVPs / event view ≥ 15%") that never received a single data point. Nothing in the repo explains why Events failed, so predicting a different outcome for the Shoot is faith, not inference. Meanwhile GAPS.md names the actual blocker in your own words: "Distance | Missing, and this is the biggest structural hole... no coordinates on profiles or posts at all, only a free-text location field. You cannot filter to 'people I could actually shoot with this month', which for a product about meeting up to make work is close to the whole point." The Shoot would be built on a base with no geo, no tests (14,000 lines, zero), no error monitoring, a sleeping free-tier database, and two codebases that double every feature's cost — and the Shoot itself needs geo, so it inherits the blocker instead of removing it. Three months of Shoot is three months not spent on the hole you already identified, to monetize a step that has fired once, with a feature a competitor ships free.

## 6. If you build anything, the smallest test

Don't write the state machine. Test willingness to pay with no code.

- **Build:** nothing. Make a Stripe payment link and a Notion page.
- **Do:** recruit 10 collaborative shoots (your own network, local Instagram, a photo-walk). Coordinate each by hand in the DM: date, location, roles, deliverable count, delivery date, usage rights. Offer one paid thing — a refundable commitment hold ($20–25, returned on attendance, forfeited on a no-show inside 24 hours) — and ask both sides to post it.
- **Measure, within 30 days:** of 10 shoots offered the hold, how many have *both* parties actually pay? And of shoots that happen, how many are delivered inside 14 days?
- **The number:** ≥4 of 10 pairs post the hold → there is a product, and it is commitment/reputation, not invoices. ≤2 → kill the paid tier permanently; PurplePort's answer (reputation, not money, after 15 years) was right and you now know it for your users too.

If you want to spend engineering time instead, the cheapest version inside the existing app is a confirm button plus a delivery date on the existing chat thread, and a no-show flag on the existing reviews table. That is days, not a quarter. It is also free-tier retention, not revenue.

## 7. If not building, what instead

In this order, because the constraint is liquidity, not workflow:

1. **Two weeks of distribution, zero features.** DM 100 photographers and 100 models in one neighborhood of one city (your STRATEGY.md already says this; you haven't done it). Target: 50 signups, 20 posts, 15 matches in 30 days. If you cannot get 15 matches by hand, no post-match feature matters.
2. **Ship coordinates and a distance filter, plus photos in chat and Sign in with Apple.** Your own GAPS.md calls distance the biggest structural hole; the inability to send a moodboard in chat is the exact behavior pushing people back to Instagram DMs.
3. **Instrument the funnel server-side** (signup → post → swipe → match → message → shoot happened). You currently infer behavior from one user. Everything above is unmeasurable without this.
4. **Run the segment-A test as a sales motion, not a build.** Twenty conversations with brands, agencies and small studios who book creatives: would you pay a fee to source and pay a crew through one place? Your STATUS.md already identified this as the only version that could be a company. If 3 of 20 say yes with a budget, that is a bigger signal than anything the Shoot could produce — and it would be a different product, which is worth knowing before you spend a quarter.
5. **Pay for the database.** It sleeps. A reviewer or a real user hitting a sleeping backend is the cheapest unforced loss in the repo.

## 8. What nobody could verify

- **Current TFP no-show and non-delivery rates.** Every number is a 2010–2013 forum self-report. Closest fix: instrument match → shoot-happened → delivered in your own app, and ask 10 people who ran a collab last month (an afternoon).
- **Reddit.** r/photography, r/modeling, r/WeddingPhotography were never searched — the tool is blocked here. Fix: post the question yourself from your own account, free.
- **Whether delivery or no-shows or safety ranks first for US collab creatives in 2026.** One Fstoppers list says neither. Fix: a 5-question poll to 30 people in your target city.
- **The 46.4% "finding clients" figure.** The ranking is on Zenfolio's SOPI 2025 page; the percentage is not. SOPI 2026's 39% is verified. Don't quote 46.4%.
- **"There are no practical ways in which a photographer can be compensated for a late cancellation"** — attributed to PurplePort, but the article as fetched does not contain that sentence. The reference-based remedy is verified; the quote is not. Don't repeat it.
- **Whether PurplePort's Shoot Plans are VIP-gated.** The guide article doesn't say. Fix: make a free account, 10 minutes. Worth doing before you tell yourself the free tier is novel.
- **Inpose's actual revenue and retention.** 56 ratings after ~6 years bounds the category, but not its economics. Fix: install Inpose and Litmind this weekend and find out why they haven't won. That is the single highest-value research task left, and it costs nothing.