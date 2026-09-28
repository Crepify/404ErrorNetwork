# Maintaining 404ErrorNetwork

## Content and theme

Bundled public site content lives in `content/site.json`: team name, members, profile URLs, project copy/links, the gratitude note and six theme colours. The current dark/soft-green treatment is provisional, pending Archit's final palette. Layout details live in `src/style.css`.

Only facts supplied by Archit are included. Do not invent teammates' bios, roles, repositories, photographs, project technical stacks, awards or event outcomes. Empty `profileUrl` values produce name-only cards instead of broken links. Empty project URLs show a detail panel rather than an invented destination.

Archit's profile points to `https://architspace.vercel.app`. CivicEye points to `https://civiceye.co.in`. Set `siteUrl` when the actual network deployment address or domain is known; no domain is assumed.

## Vercel

Import `Crepify/404ErrorNetwork`. Repository root contains `package.json` and `vercel.json`.

- Install: `npm ci`
- Build: `npm run build`
- Output: `dist`
- Framework: Vite

The repository contains the public team site and an optional Supabase publishing integration. No privileged credentials, academic records, analytics or personal notebook data are included. Only a public Supabase URL/publishable key belongs in browser configuration. ArchiSpace remains a separate site and repository; the team profile links to it.

## Local development

Node 20.19+ or a supported newer release is required.

- `npm ci`
- `npm run dev -- --port 5174`

The dev server accepts preview hosts and binds to `0.0.0.0`. Browser code uses no localhost APIs. All illustrations are local inline SVG; there are no external font or image dependencies.

## Future teammate websites

When a teammate's details and repository are supplied, build their individual site in that repository, with their own facts and academic records. Deploy it and then add its real URL to the matching member's `profileUrl`. Do not copy Archit's personal data or curriculum into another person's site without confirmation.

Current placeholders: Aswathram, Koushik, Himesh and Niranjhan. No separate websites for them are claimed or generated yet, as requested.

## Project Studio: local/file workflow

The website is public without login. Choose **Edit stories** in the footer, **Edit this story** in a project panel, or visit `/#studio` to open the editor sign-in gate. Only the five explicitly allowed, verified email identities can reach the editor. Without a connected backend, the editor stays locked; it is not an anonymous demo.

1. Select a project, or choose **Add project**.
2. Enter **Project name**, **Description**, **Problem statement**, **Our ideal solution**, and **Lessons learned**. Only the name is required; blank sections are explicitly identified as not yet added.
3. Optionally set the flagship, event name/type/level, venue, city, outcome, links, tools, context and illustration. Checking a flagship clears any other flagship. Move projects up or down; numbers and counts update automatically.
4. **Preview draft** shows your draft on the page with a prominent local-preview banner. **Exit preview** restores the published content. A reload shows published content, not an unpublished draft; reopen the Studio to recover your saved local draft.
5. **Download site.json**, review it, then use **Open GitHub upload** to upload it to `Crepify/404ErrorNetwork` → `content/`, replacing `site.json`. You must be signed into GitHub with repository write permission. Commit the change and let the connected Vercel deployment finish.

The download preserves the published team/profile/theme content and replaces only the project list. Importing a full site file into Studio likewise imports **projects only**, not arbitrary theme or member changes. To change people, the gratitude note or colours, edit the relevant sections of `content/site.json` directly.

Local drafts are stored under `404errornetwork.project-draft.v1`, separately from published content. Clearing browser data or changing domain can remove/separate drafts: export a file before doing so. In restricted previews where storage is unavailable, the editor warns you to export. There are no GitHub tokens, passwords or publishing credentials in this static site. Only signed-in approved editors can use file import/export. A repository-authorized commit is the publishing boundary for file-based deployment. In cloud mode, database-enforced editor approval and the publish RPC are the boundary.

### Cross-site public stories

**Export for ArchiSpace** creates `404-projects.json` with `format: "404-projects-v1"`. Import it using ArchiSpace's **Projects → Import project stories**. ArchiSpace preserves private project notes, next steps, status, milestones and existing visibility.

From ArchiSpace, **Export public projects** exports only projects marked public. **Import project stories** in this Studio accepts that file, a public-profile snapshot or the team's site file. Import replaces the entire local project draft after confirmation. Export a backup of the draft first if needed. Full private workspace backups are intentionally not accepted.

There is no automatic cross-site sync or automatic publishing. File imports require valid unique IDs and HTTP(S) links without embedded credentials. At most one project may be flagged as flagship. File uploads are limited to 2.5 MB and 200 projects.

### Schema and source map

`content/site.json` is the bundled fallback and the source for non-project site content. When activated, the shared cloud publication becomes the live source for project stories. Each project has:

- `id`: stable letters/numbers/dashes/underscores; preserve this for cross-site matching.
- `name`, `description`, `problemStatement`, `idealSolution`, `lessonsLearned`.
- `flagship`: boolean; the single featured project.
- `eventName`, `eventType`, `eventVenue`, `eventLocation`, `eventOutcome`: optional strings. SIH defaults to “National hackathon”; this is editable, not a hard-coded event enum.
- `context`, `tech`, `url`, `repository`, `linkLabel`: optional presentation/link fields.
- `visual`: `city`, `plant`, or `signal`; these are illustrations, not actual product screenshots.

Legacy `detail`/`summary` project descriptions are still accepted when importing. Numbering is generated; no `number` field needs maintaining. Seeded project stories reflect supplied facts only: CivicEye is flagship; AgriPulse was shortlisted for NexHack at **IITM Delhi**, travelled to Delhi and narrowly missed making the elimination round; MetrikAI is the SIH national hackathon project. Do not silently replace IITM Delhi with IIT Delhi. AgriPulse’s concept, challenges and research-first lesson now reflect Archit’s supplied account. Unknown CivicEye and MetrikAI problem/solution/lesson fields remain blank.

`src/studio.js` / `src/studio.css` implement the editor. `src/project-schema.js` is mirrored in ArchiSpace; keep its interchange behavior in sync. `npm test` runs project schema, migration, privacy and draft-validation tests. The end-to-end cross-site browser suite lives in ArchiSpace as `project-stories-smoke.mjs`.

## Optional shared online publishing (1.2)

See **ONLINE-PUBLISHING.md** for the complete activation and approval guide. Run `supabase/story-publishing.sql`, load the separate private five-email allowlist, enable both Auth hooks, configure invite-only email delivery, and set the same two public Vercel variables on both sites. No hosted backend is automatically created by deploying this code.

Public reads refresh every 30 seconds on visible pages. Drafts remain local until explicit Publish. The SQL enforces permission checks, validates a public-field allowlist, atomically checks the base revision and writes protected history. It rejects self-approval and stale overwrites.

## Editor privacy

`Editor-Allowlist.private.sql` is supplied separately and is deliberately not tracked. Never publish the five student addresses in source code, documentation, API responses or the public page. `*.private.sql` is ignored by both repositories. Generic SQL defines the restrictions; the private owner-run file supplies the actual approved identities. Both Auth hooks must be activated in the Supabase dashboard.
