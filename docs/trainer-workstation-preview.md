# Trainer workstation preview

This preview uses a branch deployment in the existing Cloudflare Pages project `s-trainerapp-production`. It does not change the `main` deployment or its custom domains. The workflow is manual-only and always checks out `trainer-workstation-phase1`.

## GitHub environment

Create a GitHub Actions environment named `preview`. Keep its secrets outside Git. Configure:

Variables:

- `PREVIEW_SUPABASE_URL` = `https://rfxyisqvrukslnlgzzek.supabase.co`
- `PREVIEW_SUPABASE_PUBLISHABLE_KEY` = the existing production publishable key
- `CLOUDFLARE_ACCOUNT_ID` = the account that owns the existing Pages project

Secret:

- `CLOUDFLARE_API_TOKEN` = a token scoped to deploy Pages on that account

The build rejects a Supabase URL other than the production project. It never accepts a service-role key. The environment can require reviewers before a workflow run proceeds.

## Cloudflare Pages

Use the existing `s-trainerapp-production` Pages project. Do not change its production branch, production deployment setting, custom domains, or DNS. The workflow uploads the static build with Wrangler's branch set to `trainer-workstation-phase1`, which creates/updates that branch's preview deployment.

Preview URLs are public unless the existing Pages preview-access policy is enabled. Because this build reads production client data after Trainer sign-in, enable a Cloudflare Access policy for preview deployments and allow the CEO before deployment. Pages preview-access policy applies to preview deployments; verify the configured policy in the Pages dashboard.

## Authentication and validation

The Trainer login uses Supabase email/password sign-in without a redirect callback, so this path does not require a new Auth redirect URL. Password recovery builds its callback from the preview origin. Do not use password recovery from this preview unless the exact branch-preview callback is already allowed in production Supabase Auth; no Auth setting is changed by this workflow.

If password recovery is later required and separately approved, the branch URL pattern to allow is `https://trainer-workstation-phase1.s-trainerapp-production.pages.dev/**`. Keep the production Site URL unchanged.

The preview connects to production Supabase so the existing Trainer account and assigned Clients are available. Its preview-only client guard blocks writes even if a write control remains reachable. The visible controls are not a security boundary; the guard and production RLS are both retained. Navigate and inspect only.

After an authorized configuration change is approved, the workflow must first be present on the repository's default branch for GitHub's manual dispatch control. Dispatch it manually, then verify the workflow succeeds, the deployment's source SHA matches the workstation branch, the branch preview URL and assets return HTTP 200, and the built frontend points only at the production Supabase project. Do not call the URL a valid preview before those checks pass.
# Preview security mode

The manual preview build sets `VITE_READ_ONLY_PREVIEW=true`. In that build the
shared Supabase client rejects PostgREST `insert`, `update`, `upsert`, and
`delete`, rejects non-read RPCs, blocks Storage writes and Edge Function
invocations, and only permits the existing Trainer sign-in/session/read calls.
AppContext write entry points also reject before changing visible client,
program, assignment, or nutrition state. The preview shows a persistent
read-only notice and starts with no client/program data from localStorage, so a
failed server read cannot be mistaken for current production data.

This is a frontend safeguard, not a database-enforced read-only role. The
preview still uses production's public Supabase key and production RLS. A browser
user can alter or replace frontend code; therefore protect the preview URL with
Cloudflare Access and limit review to trusted people. RLS remains the actual
data-access boundary. Do not treat this mode as safe for an untrusted audience.

Before a preview run, configure the GitHub `preview` Environment with the
Cloudflare deployment credentials and the production Supabase URL/publishable
key under the documented variable names. Configure Cloudflare Access for the
branch-preview hostname before sharing it. Do not add private Supabase keys.
The manual workflow refuses to build unless the read-only flag is exactly
enabled. No Supabase Auth, RLS, database, or production workflow changes are
part of this preview mode.
