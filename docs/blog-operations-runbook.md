# Blog Operations Runbook

## Purpose
Use this runbook to keep the Recon Workspace blog publishing consistently without losing SEO quality or product alignment.

## Publishing workflow
1. Pick one keyword with clear workflow intent.
2. Confirm the search intent is close to our product wedge: reconciliation prep, missing docs, unresolved items, month-end close.
3. Draft the article in `content/blog/<slug>.md`.
4. Generate one hero image with [`$imagegen`](imagegen skill).
5. Run `pnpm blog:check`.
6. Run `SITE_ORIGIN=https://your-firebase-project-id.web.app pnpm build`.
7. Review the built pages with `pnpm preview`.
8. Deploy only after metadata, CTA, and links look correct.

## Keyword selection rules
- Prefer terms that imply workflow pain and product fit.
- Prioritize searchers who are already doing the work.
- Examples:
  - `month-end close workflow`
  - `missing receipt workflow`
  - `reconcile bank statements faster`
  - `supporting documents for bookkeeping`

## Content authoring rules
- Use `content/blog/_template.md` as the starting point.
- Keep the body in Markdown only.
- Do not add an H1 inside the body.
- Keep titles inside 50-65 characters and descriptions inside 140-160 characters.
- Add at least 2 internal links, usually `/` and `/app`, plus optional blog-to-blog links.

## Image generation workflow
- Skill: [`$imagegen`](imagegen skill)
- Output path: `public/blog/images/<slug>.jpg`
- Use a landscape size such as `1536x1024`
- Keep the image text-free, brand-free, and editorial

## Suggested image prompt structure
```text
Use case: photorealistic-natural
Asset type: blog header image
Primary request: editorial scene for bookkeeping workflow
Scene/background: tidy finance desk or calm office setting
Subject: bank statements, support files, review materials, or follow-up workflow elements
Style/medium: photorealistic editorial photo
Composition/framing: wide crop with clear focal point and clean negative space
Lighting/mood: soft natural light, calm and credible
Constraints: no text; no logos; no watermark
Avoid: tacky stock-photo look; cheesy lens flare; oversaturated colors; clutter
```

## Example commands
```bash
pnpm blog:check
SITE_ORIGIN=https://your-firebase-project-id.web.app pnpm build
pnpm preview
```

## Production rule for absolute URLs
- Never hardcode the public domain in article content or templates.
- Use `SITE_ORIGIN=https://your-firebase-project-id.web.app` at build time for canonical URLs, Open Graph tags, RSS, and sitemap output.
- The build fails if `SITE_ORIGIN` is missing, and release builds fail if `SITE_ORIGIN` is not the canonical Firebase Hosting origin.

## Ongoing optimization loop
- Refresh existing articles when search intent changes or product messaging improves.
- Add internal links from older posts to new posts where the workflow connection is real.
- Revisit titles and descriptions before rewriting the full article.
- Keep the CTA stable so all organic traffic can enter the product through the same clear path.
