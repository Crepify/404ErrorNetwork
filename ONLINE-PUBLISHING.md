# Activate shared online project stories

## Status and scope

The integration is implemented, but **it is not connected until you configure your own Supabase project**. No project, account, database, SMTP service or billing plan was created for you.

After one-time activation:

1. Everyone reads without an account. Clicking **Edit stories** or **Edit this story** opens the editor sign-in screen at **https://404-error-network.vercel.app/#studio**.
2. They load the latest online stories, edit and preview a local draft.
3. **Publish to both websites** saves the complete public project list to Supabase.
4. The team website and **https://architspace.vercel.app/portfolio/** load that same publication. No GitHub upload or Vercel rebuild is needed for subsequent story changes.

Visible pages check on load, about every 30 seconds, and when the tab regains focus. This is polling, not instantaneous WebSocket delivery. The publishing tab updates its own team view immediately.

**Private grades, attendance, notes, milestones and workflow are not connected to the cloud.** ArchiSpace's `/#projects` and `/#portfolio` are local workspace/editor views. They link to the online Studio but are not silently overwritten by cloud stories. Downloaded HTML portfolios and résumés are static snapshots.

## 1. Create or choose a Supabase project

Use a project you own at https://supabase.com/dashboard. Review the current plan, email costs and usage limits before enabling services. No paid service is required or provisioned by the source code itself, but your provider's terms and limits apply.

In the project's **SQL Editor**, run the complete file:

`supabase/story-publishing.sql`

It creates:

- `story_publications`: one public, versioned collection of stories.
- `story_editor_emails`: the private, owner-controlled exact-email allowlist. No public API reader can fetch this list.
- `story_history`: private publication history for approved editors.
- Row-level security, restricted grants and the transactional publishing function.

Run this file as the project owner. Do not disable RLS or add broad write policies. Re-running it preserves existing editors and publications. Revision `0` means no online publication yet: both sites keep their bundled stories until your first Publish.

## 2. Install the private five-email list and Auth hooks

Run **Editor-Allowlist.private.sql**, supplied separately in the workspace, in the same project’s SQL Editor. It configures exactly the five addresses Archit supplied (using the visible address text, not the repeated mailto links). This file is intentionally excluded from public repositories and source archives. Do not upload it to GitHub.

In **Authentication → Hooks**, enable BOTH Postgres hooks:

- **Before User Created** → `public.story_before_user_created_hook`
- **Custom Access Token** → `public.story_access_token_hook`

The first blocks account creation for emails outside the list. The second blocks new access tokens and token refresh for identities whose actual Auth email is not enabled and verified, including previously existing outsiders. Database publishing permissions independently check the same current email, confirmation and ban state. User metadata and client-side email checks cannot grant access.

**Installing the SQL does not enable Auth hooks automatically.** Configure both hooks in the dashboard and test them before claiming that other addresses cannot log in. These hooks are project-wide: use a dedicated story-editor Supabase project, not an unrelated application whose other users need to sign in.

The hooks preserve allowed users’ claims and run with explicitly granted Auth-service permissions. Client API roles cannot invoke them directly. See the [official Auth hook documentation](https://supabase.com/docs/guides/auth/auth-hooks).

## 3. Configure sign-in and invite the five approved inboxes

Use **Authentication → URL Configuration**:

- Site URL: `https://404-error-network.vercel.app/`
- Allowed redirect URLs: `https://404-error-network.vercel.app/` and `https://404-error-network.vercel.app/#studio`

Use exact production origins. If you need a test deployment, allow that specific origin deliberately, not every Vercel deployment. Changing the domain later also requires updating these URLs.

Enable the Email provider. **Turn ON “Confirm email”** in Supabase Authentication’s Email provider settings. Disable public sign-ups for this editor-only project. Do not enable automatic email confirmation. The application uses an emailed one-time link/code for sign-in; entering an address does not create an authenticated session. A connected Vercel integration does not change these Auth settings for you. Invite Archit and each approved teammate from **Authentication → Users**. Do not give ordinary editors Supabase dashboard/admin access simply to let them edit stories.

### Important: email delivery

Configure a production-capable **custom SMTP sender in Supabase**, including your provider's required domain verification. Keep SMTP credentials in the Supabase dashboard, never in GitHub, Vercel's public variables or chat.

Supabase's default email service is restricted to pre-authorized project-organization addresses and is not intended for production delivery to arbitrary invited editors. Database story approval does not make someone a Supabase organization member or authorize default SMTP delivery. See the [official SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp).

The app supports either:

- **Magic links** using the default `{{ .ConfirmationURL }}` email template. Open the sign-in link in the same browser where you requested it; the app uses PKCE.
- **Email codes** if you change the Magic Link template to include `{{ .Token }}`. Enter the code using “My email contains a sign-in code.” Supabase configuration controls expiry and code length.

The sign-in request uses `shouldCreateUser: false`; it will not create an account for an uninvited email. This option is documented in [1](https://supabase.com/docs/reference/javascript/auth-signinwithotp). Neither the assistant nor your teammates need your password, magic link or OTP.

### Approval and revocation

Archit has already selected the five allowed email addresses. After the private SQL is applied and those inboxes are invited, each owner must verify their inbox. No additional user-ID approval step is needed. A matching email string by itself does not prove ownership.

To revoke editor access as the database owner:

```sql
update public.story_editor_emails
set enabled = false
where email = 'EXACT-ADDRESS-TO-REVOKE';
```

This blocks subsequent publishing requests immediately, even from an existing session, and denies new tokens/refresh through the hook. An already issued token is not retroactively erased, but it cannot bypass the database permission check. Re-enable only an authorized member by setting `enabled = true` for the intended row. Do not add domain-wide or suffix-based allowances: the list is exact-match, normalized to lower case. Aliases and lookalike domains are not approved.

There is no public self-approval UI, and no email list is embedded in browser code. Only the project owner/admin may change the private table. Keep the list restricted to the five approved addresses unless Archit explicitly changes it.

## 4. Connect BOTH Vercel projects once

In **each** Vercel project's Settings → Environment Variables, add the same values:

```text
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
```

Use the project's API/Connect settings to obtain its URL and **publishable** key (`sb_publishable_…`). A legacy `anon` JWT is also supported. These values are public client configuration, not privileged credentials. The build also accepts common Vercel/Supabase integration aliases: `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` (or `SUPABASE_ANON_KEY`), their `NEXT_PUBLIC_` variants, and `VITE_SUPABASE_ANON_KEY`. Explicit `VITE_` values take priority. All accepted keys undergo the same public-key validation; secret/service-role keys are never a fallback.

**Never use a secret key, `service_role` key, database password or Supabase management token.** The build rejects secret/service-role keys and partially configured credentials. RLS and the publishing function—not hiding the public key—protect writes.

Redeploy **ArchiSpace and 404ErrorNetwork** after adding the variables. This one-time code/config deployment is still necessary. Afterwards, story publications need no rebuild.

For local development only, put these values in an ignored `.env.local`, then restart Vite. Do not point experiments at production unless you intend to publish there. If both variables are empty, the sites remain usable with bundled stories and file exports.

## 5. First publication and checks

1. Open the public homepage in incognito: no login prompt should appear. Click **Edit stories**. Its badge should no longer say **NOT CONNECTED**.
2. Sign in with one of the five invited, verified emails. Only after successful authentication should the editor forms appear and your account show **APPROVED EDITOR**.
3. Choose **Load latest online stories**. On revision 0, this prepares the bundled projects for the first publication.
4. Check AgriPulse's story and the other projects; fill unknown sections only when you have the facts.
5. Preview, then choose **Publish to both websites** and confirm the public scope.
6. Expect “Published revision 1” (or the next revision).
7. Open both public websites in a signed-out/incognito browser. Verify the change immediately after reload, or within about 30 seconds on a visible open page.
8. Test an outside address: it can read published stories anonymously, but the Auth hook must deny sign-in/token issuance and no editor form should appear. Also test sign-out: editing controls must disappear while public stories remain accessible.

Until you complete these checks on your actual project, the hosted integration is **not verified**. Local PostgreSQL and simulated-browser tests do not substitute for testing your real keys, email delivery, URL settings and database installation.

## Drafts, conflicts and recovery

Drafts still autosave **in the current browser**, not to a cloud draft table. You explicitly Publish the finished public version. Another device/editor gets the last publication, not your unfinished draft. Local previews do not change the live site.

The editor is entirely gated—not just the Publish button. Without configuration, a signed-in session or approved access, draft forms, import/export and mutation controls are not rendered. Public reading does not call the sign-in flow.

Each draft remembers the online revision it started from. The database locks the shared row and refuses a stale publication. If a teammate published first, your draft remains intact: export it, load the latest online stories, merge your changes, then Publish. The editor does not silently overwrite their work or automatically merge prose.

**Load latest**, local file import, and Reset have different effects. Loading latest replaces the local draft after confirmation. File import replaces the local project list but retains its base revision, so it cannot bypass the conflict check. Reset restores the last loaded published content; it is not a forced cloud overwrite.

Each successful publication records a protected history row. An approved editor can inspect `story_history` using an authorized client; the owner can inspect it in the dashboard. To restore an old version, copy/export its public `projects` array into a `404-projects-v1` file, load the latest revision in Studio, import that file as a draft, preview and Publish. Recovery creates a new revision rather than rewriting history. There is no one-click history UI yet.

If Supabase is unreachable, visitors retain the last loaded stories (or the bundled source snapshot on a fresh load), with a status message. A failed/uncertain Publish never claims success: check the online revision before retrying. Back up approved content to the repository periodically so the fallback stays useful. Public content is loaded client-side; this is not server-rendered SEO synchronization.

## Tests and maintenance

- `npm test` in the team repository runs schema/config tests and executes the actual SQL in local PostgreSQL via PGlite, with simulated `auth.uid()`, Auth-user records and database roles. Hook tests use synthetic addresses, never the private five-email list.
- The tests cover anonymous reads, blocked anonymous writes/history access, unapproved accounts, self-approval denial, approved publication, audit records, revocation, input validation, exact-email/verified-inbox gating, Auth hook privacy and stale-revision rejection.
- ArchiSpace's academic/privacy regression suite remains separate.
- Cloud browser tests use a simulated API; no real email, production user, or hosted database is created by them.
- Keep `src/cloud-config.js`, `src/cloud-public.js`, `src/project-schema.js` and `src/project-updates.js` aligned between repositories.
- Test migrations before applying them to an existing production database. The SQL here is the initial installation, not a general-purpose migration runner.
