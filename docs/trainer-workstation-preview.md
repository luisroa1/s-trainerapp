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

The preview connects to production Supabase so the existing Trainer account and assigned Clients are available. Treat it as read-only: navigate and inspect only. Do not apply/remove training assignments, save a program, edit nutrition, or submit any other form. Existing RLS remains in force, but the application UI still exposes write controls.

After an authorized configuration change is approved, the workflow must first be present on the repository's default branch for GitHub's manual dispatch control. Dispatch it manually, then verify the workflow succeeds, the deployment's source SHA matches the workstation branch, the branch preview URL and assets return HTTP 200, and the built frontend points only at the production Supabase project. Do not call the URL a valid preview before those checks pass.
