# Gather

Gather is a global, anonymous-first group chat application built for Vercel and Supabase.

## Local development

```bash
npm install
copy .env.example .env.local
npm run dev
```

The UI includes a local demo fallback when `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` are not set.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/migrations/20260922124500_initial_schema.sql` in the Supabase SQL editor.
3. Enable Email auth in **Authentication → Providers**.
4. Add the project URL and anon key to `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

The schema uses row-level security and exposes only an anonymous message projection
through `public_messages`. Private identity mappings and authenticated user IDs are
not part of that public projection.

## Vercel deployment

1. Import the repository into Vercel.
2. Keep the detected build command as `npm run build`.
3. Set the output directory to `dist`.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Production and Preview environment variables.
5. Deploy.

`vercel.json` includes the SPA rewrite required for client-side navigation.

## Production follow-up

Before opening the service to the public, configure email verification and password
reset URLs in Supabase, add a server-side GIF proxy/rate limit, and run the
moderation/admin workflows against a protected server-side role. Never put a
Supabase service-role key in a `VITE_` variable or browser code.
