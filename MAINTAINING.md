# Maintaining 404ErrorNetwork

## Content and theme

Public site content lives in `content/site.json`: team name, members, profile URLs, project copy/links, the gratitude note and six theme colours. The current dark/soft-green treatment is provisional, pending Archit's final palette. Layout details live in `src/style.css`.

Only facts supplied by Archit are included. Do not invent teammates' bios, roles, repositories, photographs, project technical stacks, awards or event outcomes. Empty `profileUrl` values produce name-only cards instead of broken links. Empty project URLs show a detail panel rather than an invented destination.

Archit's profile points to `https://architspace.vercel.app`. CivicEye points to `https://civiceye.co.in`. Set `siteUrl` when the actual network deployment address or domain is known; no domain is assumed.

## Vercel

Import `Crepify/404ErrorNetwork`. Repository root contains `package.json` and `vercel.json`.

- Install: `npm ci`
- Build: `npm run build`
- Output: `dist`
- Framework: Vite

The repository contains the public team site only. There are no API keys, accounts, analytics, private academic records or personal notebook data. ArchiSpace remains a separate site and repository; the team profile links to it.

## Local development

Node 20.19+ or a supported newer release is required.

- `npm ci`
- `npm run dev -- --port 5174`

The dev server accepts preview hosts and binds to `0.0.0.0`. Browser code uses no localhost APIs. All illustrations are local inline SVG; there are no external font or image dependencies.

## Future teammate websites

When a teammate's details and repository are supplied, build their individual site in that repository, with their own facts and academic records. Deploy it and then add its real URL to the matching member's `profileUrl`. Do not copy Archit's personal data or curriculum into another person's site without confirmation.

Current placeholders: Aswathram, Koushik, Himesh and Niranjhan. No separate websites for them are claimed or generated yet, as requested.
