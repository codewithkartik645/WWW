# Study Tracker — deployment guide

Free-tier stack: **Vercel** (hosting) + **Supabase** (database, auth, file storage) + **GitHub** (code).
No credit card required for any of these at this scale.

## 1. Set up Supabase (5 min)

1. supabase.com -> sign in with GitHub -> New Project. Save the database password somewhere safe.
2. Once created: **SQL Editor** -> New query -> paste the entire contents of `supabase/schema.sql` -> Run.
3. **Project Settings -> API** -> copy the **Project URL** and **anon public** key. You'll need these in step 3.

## 2. Push the code to GitHub

```bash
cd study-tracker-app
git init
git add .
git commit -m "Initial commit"
gh repo create study-tracker --private --source=. --push
# (or manually: create a repo on github.com, then `git remote add origin <url>` and `git push -u origin main`)
```

## 3. Deploy to Vercel (5 min)

1. vercel.com -> sign in with GitHub -> **Add New -> Project** -> pick your `study-tracker` repo.
2. Framework preset: Vite (auto-detected).
3. **Environment Variables** -- add these two (from step 1.3):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. You'll get a live URL like `study-tracker-yourname.vercel.app`.

## 4. Become the first admin (one time only)

1. Open your deployed URL -> **Sign up** with your own email.
2. Back in Supabase -> SQL Editor, run (with your real email):
   ```sql
   update profiles set role = 'admin' where email = 'you@example.com';
   ```
3. Log out and back in -- you're now the Director (top-level admin).

Everyone else who signs up afterward starts as a Student. Promote department heads to
Co-Admin from inside the app (Sidebar -> Co-Admins).

---

## How to update the app later

Whenever you (or Claude) change the code:

```bash
git add .
git commit -m "describe what changed"
git push
```

That's it -- Vercel automatically rebuilds and redeploys within about a minute of every push
to your main branch. No manual redeploy step, no dashboard clicking.

If the **database schema** changes (new tables/columns), you'll also need to run the new SQL
in Supabase's SQL Editor once -- Claude will tell you exactly what to paste when that happens.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase URL/key
npm run dev
```

## What's free here, and the limits

| Service | Free tier | When you'd outgrow it |
|---|---|---|
| Vercel | generous bandwidth/builds | a genuinely large school with heavy traffic |
| Supabase | 500MB database, 1GB file storage, 50k monthly active users | many years of a normal classroom's data |
| GitHub | free private repos | never, for this use case |

If you ever outgrow the free tiers, both Vercel and Supabase have paid plans you can upgrade
into without migrating anything -- but a single classroom/department is very unlikely to.
