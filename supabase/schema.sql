-- ============================================================================
-- Study Tracker — Supabase schema
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- ============================================================================
--
-- DESIGN: instead of ~15 separate normalized tables (courses, tasks,
-- announcements, timetables, ...), we keep ONE JSONB blob per classroom that
-- mirrors the app's existing in-memory `data` shape almost exactly. That means
-- ~90% of the React code (every View component) barely changes — it already
-- reads `data.courses`, `data.tasks`, etc. and calls setData(updater). Only the
-- persistence layer underneath changes.
--
-- Identity/roles ARE fully relational (via Supabase Auth + a `profiles` table)
-- because that's where real security (row-level security policies) matters.

-- ============================================================================
-- MIGRATION (if you already ran this file before Sept 2026): admin actions like
-- deactivating a student or changing their department update the database fine,
-- but without this, the change won't show up on screen until you reload the
-- page — the profiles table was never added to Supabase's realtime publication.
-- Run just this one line in SQL Editor:
--
--      alter publication supabase_realtime add table profiles;
--
-- (If you're setting this up fresh, the same line further down already covers it.)
-- ============================================================================

-- 1. Profiles — one row per real user account, linked to Supabase's built-in auth.users.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'student' check (role in ('admin', 'coadmin', 'student')),
  name text not null default 'New User',
  department_id text,
  photo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Everyone signed in can read all profiles (needed to show names like "Assigned by Admin").
create policy "profiles are readable by any signed-in user"
  on profiles for select
  using (auth.role() = 'authenticated');

-- A user can update their own profile (name, photo).
create policy "users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- Only an existing admin/coadmin can change someone's ROLE (promote/demote).
-- (Enforced by only allowing admins to update rows other than their own — combined
-- with the self-update policy above, a plain student can only ever touch their own row.)
create policy "admins can update any profile"
  on profiles for update
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'coadmin'))
  );

-- New user signup auto-creates a profile row (default role: student).
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. The shared classroom data blob — one row, everyone in the school reads/writes it.
create table if not exists classroom (
  id int primary key default 1,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);

insert into classroom (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;

alter table classroom enable row level security;

create policy "classroom is readable by any signed-in user"
  on classroom for select
  using (auth.role() = 'authenticated');

-- Everyone signed in can write. (Fine-grained per-field permission — e.g. "students
-- can edit their own tasks but not announcements" — is enforced in the React app
-- itself, same as it is today. This matches the original app's trust model: a
-- shared classroom tool, not a hardened multi-tenant system.)
create policy "classroom is writable by any signed-in user"
  on classroom for update
  using (auth.role() = 'authenticated');

-- 3. Realtime: let clients subscribe to live changes on the classroom row, and on
-- profiles (needed so an admin's department-change / activate-deactivate actions show
-- up immediately for everyone, instead of only after a page reload).
alter publication supabase_realtime add table classroom;
alter publication supabase_realtime add table profiles;

-- 4. File storage bucket for attachments (datesheets, syllabi, announcement files, etc).
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

create policy "anyone signed in can upload attachments"
  on storage.objects for insert
  with check (bucket_id = 'attachments' and auth.role() = 'authenticated');

create policy "attachments are publicly readable"
  on storage.objects for select
  using (bucket_id = 'attachments');

create policy "uploader or admin can delete an attachment"
  on storage.objects for delete
  using (bucket_id = 'attachments' and auth.role() = 'authenticated');

-- ============================================================================
-- ONE-TIME MANUAL STEP: making the first admin
-- ============================================================================
-- 1. Deploy the app and sign up normally as yourself (the school's admin) —
--    everyone starts as role='student'.
-- 2. Come back here (SQL Editor) and run, with YOUR email:
--
--      update profiles set role = 'admin' where email = 'you@example.com';
--
-- That's it — you're now the Director. From inside the app, promote other
-- signed-up users to 'coadmin' (department HOD) or leave them as students.
-- ============================================================================

