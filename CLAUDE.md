# 75 Hard (Sue and Los) — project rules

This repo overrides the machine-level "no git / no SQL" hard rules (Carlos, 2026-11-02). Everything else
in the machine doctrine still applies (no `--dangerously-skip-permissions`, never guess or invent values,
smallest safe change, inspect before editing).

## Allowed here
- Git: add, commit and push to the current feature branch. Never force-push, and never push to `main`
  unless Carlos says so.
- Supabase SQL, migrations and edge function deploys on project `75-hard` (`axbjvkkcqardmkircknn`)
  through the Supabase MCP tools. Check live state before changing it.
- Keep `supabase/migrations/` in step with anything applied to the live DB.

## Project facts
- Static PWA (no build step) in the repo root; edge functions in `supabase/functions/` (`api`, `notify`).
- `api` is deployed with `verify_jwt: false` and its `_shared/` files as siblings of the entrypoint.
- RLS is on for every table with no policies; `anon`/`authenticated` have no grants. Only the service role
  (the edge functions) touches data. New functions must `revoke all ... from public, anon, authenticated`.
- Entry saves go through the `save_entry` RPC and photo swaps through `replace_photo`, so they stay atomic.
- Person rows hold key hashes; `app_secrets` holds VAPID keys. Never print or commit either.
- Any throwaway test data must be deleted when done (`people` is shown to both users).

## Verification
- No build or type-check tooling here. Done = migration applied, function deployed, bad-key smoke test
  returns 401, and any new SQL tested against throwaway rows that are cleaned up.
