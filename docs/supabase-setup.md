# Supabase Setup

Recon Workspace uses Supabase for the simplest version of:
- Google login
- user-scoped workspaces
- transaction persistence

## Required environment variables
In Vercel and local `.env.local`:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Auth provider
Enable **Google** in Supabase Auth providers.

### Redirect URLs
Add:
- local dev: `http://localhost:5173`
- production: `https://recon-workspace.vercel.app`

## SQL schema
Run the SQL in `docs/supabase-schema.sql`.

## Row level security
RLS is enabled in the schema so users can only access their own workspace rows.

## Product behavior
- No Supabase env vars → demo mode only
- Supabase configured → Google sign-in available and cloud save enabled
