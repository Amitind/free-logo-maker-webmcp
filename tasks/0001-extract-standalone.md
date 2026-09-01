# Extract standalone Free Logo Maker WebMCP demo

## Why
`allsvgicons.com/free-logo-maker/` has a WebMCP-enabled logo editor (source
repo is private, no license). For the OpenAI WebMCP Challenge submission we
need a small PUBLIC repo with just this component: full source, MIT license
visible in repo root, no dependency on private backend infra. This project
IS that public repo.

Source project (read-only reference, do not modify): `/interstellar/Projects/svgoose`
Target project (build here): `/interstellar/Projects/free-logo-maker-webmcp`

## What "barebone" means
Homepage renders ONLY the logo maker tool. No marketing copy, no FAQ, no
ads, no blog links, no SEO schema blocks, no showcase gallery section. Just:
a page `<title>`/meta description, the tool itself, and a one-line footer:
"Full version with more presets & guides -> allsvgicons.com/free-logo-maker/"
linking to `https://allsvgicons.com/free-logo-maker/`.

## Step 1: scaffold
New Astro project, pnpm, TypeScript strict, React integration (the tool is
a client-side React component, this is a deliberate exception to the
"no React in Astro" site rule since we're extracting an existing React tool,
not building new UI), Tailwind v4 via `@tailwindcss/vite`.

`package.json` name: `free-logo-maker-webmcp`. Base `astro.config.ts` on
`/interstellar/Projects/svgoose/astro.config.ts` but strip everything not
needed: no mdx, no sitemap, no rss, no favicons integration, no footerLinks
integration, no `PUBLIC_API_URL` env schema (not needed, see Step 3). Keep:
`@astrojs/react`, `@tailwindcss/vite` plugin, `site:` set to
`https://webmcp.allsvgicons.com` (placeholder subdomain, may change before
deploy), `trailingSlash: 'always'` not required (single page), path alias
`@/*` -> `./src/*` in tsconfig (copy tsconfig.json from svgoose as-is).

Copy `src/styles/global.css` from svgoose as-is (generic shadcn/Tailwind v4
theme tokens, nothing site-specific). Skip `astro-favicons`, `motion` fonts
config (fontProviders) — use system font stack or a single Google Font via
`@astrojs/react`-friendly `<link>` in the layout head, whichever is less
code. Skip biome/prettier config unless trivial to copy — not required for
a working demo.

## Step 2: copy component tree from svgoose (read-only source)
Copy these files verbatim into the same relative paths under `src/`,
UNCHANGED except where Step 3/4 below say otherwise:

Components:
- `components/LogoMaker.tsx`
- `components/logo-maker/*.tsx` (all files: BackgroundControls, ExportPanel,
  GeneratePanel, IconSearchPanel, LogoCanvas, MyLogosPanel, Previews,
  RandomizeControl, RightSidebar, TemplatesPanel, WebMcpDebugPanel)
- `components/logo-maker/showcase.ts`, `components/logo-maker/templates.ts`
- `components/common/LazySvg.tsx`
- `components/common/WebMcp.astro` (site-wide `document.modelContext`
  polyfill + `send_feedback` tool bootstrap, copy unchanged, no secrets)
- `components/ui/{button,context-menu,dialog,dropdown-menu,input,input-group,
  label,popover,slider,switch,tabs,textarea,tooltip}.tsx` — these are the
  ones directly imported. If any of these transitively import another
  `components/ui/*` file not in this list, copy that one too.

Lib:
- `lib/layer-clipboard.ts`
- `lib/logo-icons.ts` (EDIT, see Step 3)
- `lib/logo-presets.ts`
- `lib/logo-share.ts` (EDIT, see Step 4)
- `lib/my-logos.ts`
- `lib/pattern-utils.ts`
- `lib/svg-utils.ts`
- `lib/utils.ts`
- `lib/webmcp-debug.ts`

Do NOT copy `lib/keywordIconResolver.ts`, `data/iconKeywords.ts`, or
`data/emojiKeywords.json` — those power an unrelated SEO page
(`/icons/[slug]`) and are not used by the logo maker component tree.
Do NOT add `@iconify/collections` as a dependency, it is only needed by the
files just excluded.

`config/siteConfig.ts`: do not copy the real one (it has allsvgicons-wide
nav links, ad config references, etc). Create a minimal
`src/config/siteConfig.ts` that exports just:
```ts
export const siteUrl = 'https://webmcp.allsvgicons.com';
```
(matches the `astro.config.ts` `site` value from Step 1.)

Verify after copying: `grep -rn "PUBLIC_API_URL\|AdUnit\|adsConfig\|siteStats\|gtag" src/` should return nothing outside `lib/logo-icons.ts` (handled in Step 3) and the harmless `gtag` check-before-use guard already inside `lib/webmcp-debug.ts` (safe to keep, it's a no-op without GA4 present, do not strip it).

## Step 3: swap icon backend to the public Iconify API
`lib/logo-icons.ts` and `LogoMaker.tsx`'s `search_logo_icons` tool currently
call `import.meta.env.PUBLIC_API_URL` for two endpoints:
- `${apiUrl}/search?query=...&limit=...&prefixes=...` -> `{ icons: string[] }`
- `${apiUrl}/${prefix}/${name}.svg` -> raw SVG

The public Iconify API (`https://api.iconify.design`) implements BOTH of
these exact paths with the same response shape. So: in `lib/logo-icons.ts`,
change `iconUrl()`'s fallback default from `'https://i.allsvgicons.com'` to
`'https://api.iconify.design'`, and make `fetchLogoIcons()` use that same
constant instead of `import.meta.env.PUBLIC_API_URL` (delete the env var
read, no env var needed at all for this project — it's dependency-free).

In `components/LogoMaker.tsx`'s `search_logo_icons` tool `execute()`, same
change: replace `import.meta.env.PUBLIC_API_URL` with the
`https://api.iconify.design` constant (import it from `lib/logo-icons.ts`,
export a `ICON_API_URL` constant there so both call sites share one value —
this one deviation from "copy verbatim" is required and expected).

Remove the `env: { schema: { PUBLIC_API_URL: ... } } }` block from
`astro.config.ts` entirely (already excluded per Step 1, just confirming).

## Step 4: fix share URL for the new single-page layout
`lib/logo-share.ts`'s `buildShareUrl()` currently returns
`` `${location.origin}/free-logo-maker/?logo=${code}` `` — that path doesn't
exist on this project (the tool IS the homepage here). Change it to:
```ts
export function buildShareUrl(code: string): string {
	return `${location.origin}/?logo=${code}`;
}
```
Everything else in that file (encode/decode, compression) stays unchanged.

## Step 5: fix the AI-agent starter prompt string
`components/LogoMaker.tsx` has `AI_AGENT_STARTER_PROMPT`, a copy-pasteable
prompt for humans to hand to their AI agent. It contains:
`` `Then open ${siteUrl}/free-logo-maker/ in the browser...` `` — change the
path to just `` `${siteUrl}/` `` (drop `/free-logo-maker/`) since `siteUrl`
here will resolve to this project's own root.

## Step 6: homepage
`src/pages/index.astro`: minimal layout (own `src/layouts/Layout.astro`,
NOT copied from svgoose — write a small one: `<html>`, `<head>` with
title/meta description/viewport/global.css import, `<body>`, a `<slot />`,
nothing else — no header nav, no ad slots, no schema.org blocks).

Page content: `<WebMcp />` (the site-wide bootstrap, mount once) then
`<LogoMaker client:load />`, then a `<footer>` with exactly one line and
one link: text "Full version with more presets & guides" linking to
`https://allsvgicons.com/free-logo-maker/`. Nothing else on the page.

Title: "Free Logo Maker — WebMCP Demo". Meta description: one sentence
that this is a free SVG logo editor with WebMCP tools an AI agent can
drive directly, built for the OpenAI WebMCP Challenge.

## Step 7: license + readme
- `LICENSE`: MIT, copyright "Amit Yadav" 2026.
- `README.md` covering: what this is (standalone extract of the Logo Maker
  from allsvgicons.com, published open source for the OpenAI WebMCP
  Challenge), why WebMCP fits (an agent can drive the exact same canvas a
  human uses, no separate API to build/maintain), the 7 registered WebMCP
  tools with one-line descriptions each (`get_logo_maker_state`,
  `update_logo_maker_state`, `set_logo_maker_state`, `search_logo_icons`,
  `load_logo_maker_share`, `get_logo_preview`, `manage_saved_logos`), how
  to test manually from a browser console (`await (await
  document.modelContext.getTools()).find(t => t.name === '...')` then
  `.execute({...})` pattern — check `WebMcpDebugPanel.tsx` and the site-wide
  polyfill in `WebMcp.astro` for the exact shape), dev setup
  (`pnpm install && pnpm dev`), link to the full-featured live version at
  `https://allsvgicons.com/free-logo-maker/`.

## Step 8: verify
- `pnpm install` succeeds.
- `pnpm build` succeeds with zero errors.
- `pnpm dev`, open the page, confirm: canvas renders, icon search returns
  results from Iconify (type a keyword like "coffee" in the search panel),
  dragging/recoloring works, export panel produces an SVG, and in the
  browser console `await document.modelContext.getTools()` lists all 7
  tools plus `send_feedback`.
- `git init`, `git add -A`, one commit. Do NOT push, no remote configured,
  that's a separate step the user does after reviewing.

## Explicitly out of scope (do not do)
- Do not touch `/interstellar/Projects/svgoose` (read-only reference).
- Do not create a GitHub repo or push anywhere.
- Do not deploy anywhere (Netlify/Vercel/etc) — repo prep only.
- Do not add analytics/ads/GA4 beyond the harmless existing no-op guard.
- Do not add the AI "Generate" panel's own backend calls — there are none
  (`GeneratePanel.tsx` is local-only, uses `lib/logo-icons.ts` candidate
  picking, no LLM backend), confirm this stays true when copied.
