---
name: melange-design
description: Melange's visual and copy rules — how to make any screen, page, image or line of copy look like it was made by people with taste, not generated. Use before designing or changing any Melange UI (mobile/ or app/), choosing images, writing UI copy, or reviewing a screenshot.
---

# Melange design: made by people, not generated

Melange is for a real creative scene. If it looks like every AI-built app,
the people we want will feel it in one second and leave. Generated apps all
share the same tells; this skill bans them and says what to do instead.

## The test
Before shipping a screen, ask: **could this screenshot be from any of 500
AI-generated startups?** If yes, it's not done.

## Banned (the AI tells) → what to do instead

| Banned | Instead |
|---|---|
| Gradient backgrounds, gradient buttons, gradient text, "glow" blobs, blurred color orbs | Flat paper: `#FAFAF7`-ish off-white, white surfaces, one ink color. Color comes from photos, not decoration. |
| ✦ / sparkles / the `Sparkles` icon as decoration | ✦ is reserved for ONE meaning: Founding member. Nowhere else. |
| Icons in tinted rounded squares above every card ("feature grid") | No icon unless it's a control. Use type hierarchy, numbers, or a real photo. |
| Every block in a soft-shadow rounded card | Most content sits directly on the page, separated by space and hairline rules. Cards only for things you can tap and that move (a night, a person). |
| Purple everywhere | Indigo is the brand ink for links and the one primary action per screen. That's it. |
| Centered hero + slogan + two pill buttons | Left-aligned, editorial: a specific headline, a real photo, one action. |
| Placeholder art (gradient + icon where a photo should be) | A real photo, or nothing: a plain type-only block (title in the display serif on paper). |
| Stock photography (Unsplash, Pexels), AI-generated images, smiling-model perfection | Real photos by real members, credited. Film grain, flash, imperfect framing are good. |
| Emoji in UI copy, "✨", "🚀" | None. |
| Slogan copy ("Unlock your creative potential", "Where X meets Y") | Specific, concrete, local: "Thursday 7pm · Echo Park Lake steps · bring a film camera." Write like a friend texting, not a landing page. |
| Fake numbers, fake testimonials, "Trusted by 10,000 creatives" | Only true numbers. Early on, show real people and real photos instead of numbers. |
| Uniform 2xl radius + shadow on everything | Radius 6–10 for controls, 0–4 for photos. Shadows almost never. |

## What Melange looks like
- **Type does the work.** An editorial display serif for titles (already in
  the app), a plain grotesk for everything else. Big contrast in size, few
  weights. Generous line height. Left-aligned.
- **Photos are the color.** Full-bleed or tightly cropped, real, credited
  ("shot by @maya"). A grid of real photos beats any illustration.
- **Paper, ink, one accent.** Off-white paper, near-black ink, indigo for the
  one action. Light only (never dark-first — see docs/DESIGN.md).
- **Zine, not SaaS.** Small caps labels, hairline rules, dates and places set
  like a flyer. Asymmetry is fine. Density is fine where it's content.
- **Copy is human.** Short, lowercase-friendly where it fits, specific to a
  place and a night. No marketing adjectives.

## Images: the policy
1. Every image a member sees is either (a) uploaded by a real member, or
   (b) a real photo we have permission to use, credited. Never stock, never
   AI-generated.
2. Demo/seed accounts must use real photos donated by real people (with
   written OK), or be removed from what members see.
3. Marketing screenshots show real content only.
4. No cover photo? Use the type-only block, not a gradient.

## Review checklist (run on every screenshot)
- [ ] No gradient anywhere
- [ ] ✦ appears only next to a Founding member
- [ ] No icon-in-a-tinted-square
- [ ] At most one filled (indigo) button
- [ ] Every image is a real, permitted, credited photo
- [ ] No sentence that could appear on any other app's landing page
- [ ] Text left-aligned unless there's a reason
- [ ] Nothing is in a card that doesn't need to be tappable
