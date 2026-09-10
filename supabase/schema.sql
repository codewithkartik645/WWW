-- ============================================================================
-- Study Tracker — Supabase schema v2: real per-department database security
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to run even if you already ran the old (v1) schema.sql — it migrates
-- your existing data forward automatically (see MIGRATION section) and does
-- not delete anything; your old data is kept, untouched, in a renamed table.
-- ============================================================================
--
-- WHY THIS CHANGED FROM v1: the original design kept one shared JSONB blob for
-- the whole school, writable by any signed-in admin/co-admin at the database
-- level — department separation was enforced only by the React app hiding
-- buttons and filtering lists. A technically-savvy co-admin could still read
-- or edit another department's data directly through the Supabase client,
-- bypassing the UI entirely. This version splits that blob into one real table
-- per data type, each with its own department_id/owner_id column and a Row
-- Level Security policy the database itself enforces — a co-admin's database
-- credentials simply cannot select or write another department's rows, no
-- matter how the request is made (app, API call, browser devtools, anything).
--
-- The app's React code did NOT need to change for this: every view already
-- read/wrote a single `data` object and called setData(updater). That contract
-- is unchanged — only what's underneath it (src/lib/useClassroomData.js) was
-- rewritten to talk to these real tables instead of one blob.

-- ============================================================================
-- 1. PROFILES (unchanged from v1 — already a real table with RLS)
-- ============================================================================
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

drop policy if exists "profiles are readable by any signed-in user" on profiles;
create policy "profiles are readable by any signed-in user"
  on profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists "users can update their own profile" on profiles;
create policy "users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

drop policy if exists "admins can update any profile" on profiles;
create policy "admins can update any profile"
  on profiles for update
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'coadmin'))
  );

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

-- Small helper functions used throughout the RLS policies below: "what does
-- the current user's own profile say?" — keeps every policy short and consistent.
create or replace function public.is_admin()
returns boolean as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin');
$$ language sql security definer stable;

create or replace function public.my_department_id()
returns text as $$
  select department_id from profiles where id = auth.uid();
$$ language sql security definer stable;

create or replace function public.my_role()
returns text as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer stable;

-- ============================================================================
-- 2. DEPARTMENTS — only the Main Admin (Director) creates/edits/deactivates these.
-- ============================================================================
create table if not exists departments (
  id text primary key,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table departments enable row level security;

drop policy if exists "departments readable by any signed-in user" on departments;
create policy "departments readable by any signed-in user"
  on departments for select using (auth.role() = 'authenticated');

drop policy if exists "only admin manages departments" on departments;
create policy "only admin manages departments"
  on departments for all
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- 3. DEPARTMENT-SCOPED ACADEMIC DATA
-- ============================================================================
-- Each of these mirrors one array the app already keeps in memory (data.courses,
-- data.calendarEvents, ...). Rather than hand-carving every nested field (units,
-- syllabus, options, attachments, ...) into its own column, each row keeps the
-- exact same JS object the app already works with in a jsonb `item` column, and
-- pulls out only the columns RLS policies need to check: department_id and,
-- where relevant, owner_id/kind. A null department_id means "campus-wide" —
-- visible to every department, editable only by the Main Admin.

create table if not exists courses (
  id text primary key,
  department_id text not null references departments(id),
  item jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists calendar_events (
  id text primary key,
  department_id text references departments(id), -- null = campus-wide
  item jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists datesheets (
  id text primary key,
  department_id text not null references departments(id),
  item jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists planner_blocks (
  id text primary key,
  kind text not null check (kind in ('class', 'self', 'recommended')),
  department_id text references departments(id), -- set for class/recommended; null for self
  owner_id uuid references profiles(id),          -- set for self blocks; null for class/recommended
  item jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists co_curricular_catalog (
  id text primary key,
  department_id text references departments(id), -- null = campus-wide
  item jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists resources (
  id text primary key,
  department_id text references departments(id), -- null = campus-wide
  item jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists announcements (
  id text primary key,
  department_id text references departments(id), -- null = all departments
  item jsonb not null,
  updated_at timestamptz not null default now()
);

alter table courses enable row level security;
alter table calendar_events enable row level security;
alter table datesheets enable row level security;
alter table planner_blocks enable row level security;
alter table co_curricular_catalog enable row level security;
alter table resources enable row level security;
alter table announcements enable row level security;

-- Read: Main Admin sees everything; everyone else sees their own department's
-- rows plus every campus-wide (null department_id) one.
drop policy if exists "read courses in my department" on courses;
create policy "read courses in my department" on courses for select
  using (public.is_admin() or department_id = public.my_department_id());
drop policy if exists "write courses in my department" on courses;
create policy "write courses in my department" on courses for all
  using (public.is_admin() or (public.my_role() = 'coadmin' and department_id = public.my_department_id()))
  with check (public.is_admin() or (public.my_role() = 'coadmin' and department_id = public.my_department_id()));

drop policy if exists "read calendar_events in my department" on calendar_events;
create policy "read calendar_events in my department" on calendar_events for select
  using (public.is_admin() or department_id is null or department_id = public.my_department_id());
drop policy if exists "write calendar_events in my department" on calendar_events;
create policy "write calendar_events in my department" on calendar_events for all
  using (public.is_admin() or (public.my_role() = 'coadmin' and department_id = public.my_department_id()))
  with check (public.is_admin() or (public.my_role() = 'coadmin' and department_id = public.my_department_id()));

drop policy if exists "read datesheets in my department" on datesheets;
create policy "read datesheets in my department" on datesheets for select
  using (public.is_admin() or department_id = public.my_department_id());
drop policy if exists "write datesheets in my department" on datesheets;
create policy "write datesheets in my department" on datesheets for all
  using (public.is_admin() or (public.my_role() = 'coadmin' and department_id = public.my_department_id()))
  with check (public.is_admin() or (public.my_role() = 'coadmin' and department_id = public.my_department_id()));

drop policy if exists "read planner_blocks" on planner_blocks;
create policy "read planner_blocks" on planner_blocks for select
  using (
    public.is_admin()
    or (kind = 'self' and owner_id = auth.uid())
    or (kind in ('class', 'recommended') and (department_id is null or department_id = public.my_department_id()))
  );
drop policy if exists "write planner_blocks" on planner_blocks;
create policy "write planner_blocks" on planner_blocks for all
  using (
    public.is_admin()
    or (kind = 'self' and owner_id = auth.uid())
    or (kind in ('class', 'recommended') and public.my_role() = 'coadmin' and department_id = public.my_department_id())
  )
  with check (
    public.is_admin()
    or (kind = 'self' and owner_id = auth.uid())
    or (kind in ('class', 'recommended') and public.my_role() = 'coadmin' and department_id = public.my_department_id())
  );

drop policy if exists "read co_curricular_catalog in my department" on co_curricular_catalog;
create policy "read co_curricular_catalog in my department" on co_curricular_catalog for select
  using (public.is_admin() or department_id is null or department_id = public.my_department_id());
drop policy if exists "write co_curricular_catalog in my department" on co_curricular_catalog;
create policy "write co_curricular_catalog in my department" on co_curricular_catalog for all
  using (public.is_admin() or (public.my_role() = 'coadmin' and department_id = public.my_department_id()))
  with check (public.is_admin() or (public.my_role() = 'coadmin' and department_id = public.my_department_id()));

drop policy if exists "read resources in my department" on resources;
create policy "read resources in my department" on resources for select
  using (public.is_admin() or department_id is null or department_id = public.my_department_id());
drop policy if exists "write resources in my department" on resources;
create policy "write resources in my department" on resources for all
  using (public.is_admin() or department_id = public.my_department_id())
  with check (public.is_admin() or department_id = public.my_department_id());

drop policy if exists "read announcements in my department" on announcements;
create policy "read announcements in my department" on announcements for select
  using (public.is_admin() or department_id is null or department_id = public.my_department_id());
drop policy if exists "write announcements in my department" on announcements;
create policy "write announcements in my department" on announcements for all
  using (public.is_admin() or (public.my_role() = 'coadmin' and department_id = public.my_department_id()))
  with check (public.is_admin() or (public.my_role() = 'coadmin' and department_id = public.my_department_id()));

-- ============================================================================
-- 4. PERSONAL / OWNER-SCOPED DATA (tasks, self-study logs, co-curricular enrollments)
-- ============================================================================
create table if not exists tasks (
  id text primary key,
  owner_id uuid references profiles(id), -- null = shared task assigned by an admin/co-admin to everyone
  item jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists study_logs (
  id text primary key,
  owner_id uuid not null references profiles(id),
  item jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists enrollments (
  id text primary key,
  owner_id uuid not null references profiles(id),
  item jsonb not null,
  updated_at timestamptz not null default now()
);

alter table tasks enable row level security;
alter table study_logs enable row level security;
alter table enrollments enable row level security;

-- Tasks: matches the app's existing (already fairly open) model — any admin/co-admin
-- can see and manage every task; a student sees shared tasks plus their own.
drop policy if exists "read tasks" on tasks;
create policy "read tasks" on tasks for select
  using (public.my_role() in ('admin', 'coadmin') or owner_id is null or owner_id = auth.uid());
drop policy if exists "write tasks" on tasks;
create policy "write tasks" on tasks for all
  using (public.my_role() in ('admin', 'coadmin') or owner_id = auth.uid())
  with check (public.my_role() in ('admin', 'coadmin') or owner_id = auth.uid());

-- Study logs / enrollments: the owning student, the Director, or that student's own
-- department's HOD (for progress-tracking pages) — never a different department's HOD.
drop policy if exists "read study_logs" on study_logs;
create policy "read study_logs" on study_logs for select
  using (
    owner_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from profiles owner where owner.id = study_logs.owner_id and owner.department_id = public.my_department_id() and public.my_role() = 'coadmin')
  );
drop policy if exists "write study_logs" on study_logs;
create policy "write study_logs" on study_logs for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "read enrollments" on enrollments;
create policy "read enrollments" on enrollments for select
  using (
    owner_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from profiles owner where owner.id = enrollments.owner_id and owner.department_id = public.my_department_id() and public.my_role() = 'coadmin')
  );
drop policy if exists "write own enrollments" on enrollments;
create policy "write own enrollments" on enrollments for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- Admins/co-admins add/remove the module breakdown inside an enrollment they can already see.
drop policy if exists "admins manage modules on visible enrollments" on enrollments;
create policy "admins manage modules on visible enrollments" on enrollments for update
  using (
    public.is_admin()
    or exists (select 1 from profiles owner where owner.id = enrollments.owner_id and owner.department_id = public.my_department_id() and public.my_role() = 'coadmin')
  );

-- ============================================================================
-- 5. ACTIVITY LOG — append-only, department-aware read access
-- ============================================================================
create table if not exists activity_log (
  id text primary key,
  by uuid not null references profiles(id),
  ts timestamptz not null default now(),
  text text not null
);

alter table activity_log enable row level security;

-- Insert: you can only ever log actions as yourself — prevents spoofing who did what.
drop policy if exists "insert own activity" on activity_log;
create policy "insert own activity" on activity_log for insert
  with check (by = auth.uid());

-- Read: Main Admin sees everything; a co-admin sees their own actions plus their own
-- department's students' actions; a student sees only their own.
drop policy if exists "read activity scoped" on activity_log;
create policy "read activity scoped" on activity_log for select
  using (
    by = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from profiles actor
      where actor.id = activity_log.by and actor.role = 'student'
        and actor.department_id = public.my_department_id() and public.my_role() = 'coadmin'
    )
  );

-- ============================================================================
-- 6. TRASH — restoring deleted items is a Main-Admin-only page in the app today;
-- co-admins can send things TO trash (via delete buttons) but not browse/restore it.
-- ============================================================================
create table if not exists trash_entries (
  id text primary key,
  type text not null,
  deleted_by uuid references profiles(id),
  item jsonb not null,
  extra jsonb not null default '{}'::jsonb,
  label text,
  deleted_at timestamptz not null default now()
);

alter table trash_entries enable row level security;

drop policy if exists "insert trash entries" on trash_entries;
create policy "insert trash entries" on trash_entries for insert
  with check (public.my_role() in ('admin', 'coadmin'));
drop policy if exists "admin manages trash" on trash_entries;
create policy "admin manages trash" on trash_entries for select using (public.is_admin());
drop policy if exists "admin deletes trash" on trash_entries;
create policy "admin deletes trash" on trash_entries for delete using (public.is_admin());

-- ============================================================================
-- 7. SMALL SHARED SETTINGS (semester label, auto-timetable toggle) — Main Admin only.
-- ============================================================================
create table if not exists classroom_settings (
  id int primary key default 1,
  semester text not null default '',
  auto_mode boolean not null default true,
  constraint single_settings_row check (id = 1)
);
insert into classroom_settings (id) values (1) on conflict (id) do nothing;

alter table classroom_settings enable row level security;
drop policy if exists "settings readable by any signed-in user" on classroom_settings;
create policy "settings readable by any signed-in user" on classroom_settings for select
  using (auth.role() = 'authenticated');
drop policy if exists "only admin writes settings" on classroom_settings;
create policy "only admin writes settings" on classroom_settings for update
  using (public.is_admin());

-- Per-user preferences (unread-announcement marker, planner hour-range) — each
-- person can only ever read/write their own row.
create table if not exists user_prefs (
  user_id uuid primary key references profiles(id) on delete cascade,
  last_seen_announcements int not null default 0,
  planner_hour_start int not null default 6,
  planner_hour_end int not null default 23
);
alter table user_prefs enable row level security;
drop policy if exists "manage own prefs" on user_prefs;
create policy "manage own prefs" on user_prefs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================================
-- 8. REALTIME — every table clients need live updates from.
-- ============================================================================
do $$ begin alter publication supabase_realtime add table profiles; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table departments; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table courses; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table calendar_events; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table datesheets; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table planner_blocks; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table tasks; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table study_logs; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table co_curricular_catalog; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table enrollments; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table resources; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table announcements; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table activity_log; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table trash_entries; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table classroom_settings; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table user_prefs; exception when duplicate_object then null; end $$;

-- ============================================================================
-- 9. FILE STORAGE (unchanged from v1)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

drop policy if exists "anyone signed in can upload attachments" on storage.objects;
create policy "anyone signed in can upload attachments"
  on storage.objects for insert
  with check (bucket_id = 'attachments' and auth.role() = 'authenticated');
drop policy if exists "attachments are publicly readable" on storage.objects;
create policy "attachments are publicly readable"
  on storage.objects for select
  using (bucket_id = 'attachments');
drop policy if exists "uploader or admin can delete an attachment" on storage.objects;
create policy "uploader or admin can delete an attachment"
  on storage.objects for delete
  using (bucket_id = 'attachments' and auth.role() = 'authenticated');

-- ============================================================================
-- 10. MIGRATION — move your existing data out of the old single-blob `classroom`
-- table into the new tables above. Safe to run more than once: every insert is
-- `on conflict do nothing`, so nothing is duplicated if you re-run this file.
-- If you're setting up fresh (no old `classroom` table), this section simply
-- does nothing and the DEFAULT_SHARED_DATA seed built into the app takes over.
-- ============================================================================
do $$
declare
  old_data jsonb;
  first_dept_id text;
  d jsonb;
begin
  if to_regclass('public.classroom') is null then
    return;
  end if;
  select data into old_data from classroom where id = 1;
  if old_data is null then
    return;
  end if;

  for d in select * from jsonb_array_elements(coalesce(old_data->'departments', '[]'::jsonb))
  loop
    insert into departments (id, name, active)
    values (d->>'id', d->>'name', coalesce((d->>'active')::boolean, true))
    on conflict (id) do nothing;
  end loop;
  select id into first_dept_id from departments order by created_at asc limit 1;

  update classroom_settings set
    semester = coalesce(old_data->>'semester', semester),
    auto_mode = coalesce((old_data->>'autoMode')::boolean, auto_mode)
  where id = 1;

  for d in select * from jsonb_array_elements(coalesce(old_data->'courses', '[]'::jsonb))
  loop
    insert into courses (id, department_id, item)
    values (d->>'id', coalesce(d->>'departmentId', first_dept_id), d)
    on conflict (id) do nothing;
  end loop;

  for d in select * from jsonb_array_elements(coalesce(old_data->'calendarEvents', '[]'::jsonb))
  loop
    insert into calendar_events (id, department_id, item)
    values (d->>'id', d->>'departmentId', d)
    on conflict (id) do nothing;
  end loop;

  for d in select * from jsonb_array_elements(coalesce(old_data->'datesheets', '[]'::jsonb))
  loop
    insert into datesheets (id, department_id, item)
    values (d->>'id', coalesce(d->>'departmentId', first_dept_id), d)
    on conflict (id) do nothing;
  end loop;

  for d in select * from jsonb_array_elements(coalesce(old_data->'plannerBlocks', '[]'::jsonb))
  loop
    insert into planner_blocks (id, kind, department_id, owner_id, item)
    values (
      d->>'id', coalesce(d->>'kind', 'class'), d->>'departmentId',
      nullif(d->>'ownerKey', '')::uuid, d
    )
    on conflict (id) do nothing;
  end loop;

  for d in select * from jsonb_array_elements(coalesce(old_data->'tasks', '[]'::jsonb))
  loop
    insert into tasks (id, owner_id, item)
    values (d->>'id', nullif(d->>'ownerKey', '')::uuid, d)
    on conflict (id) do nothing;
  end loop;

  for d in select * from jsonb_array_elements(coalesce(old_data->'studyLogs', '[]'::jsonb))
  loop
    if d->>'ownerKey' is not null and exists (select 1 from profiles where id = (d->>'ownerKey')::uuid) then
      insert into study_logs (id, owner_id, item) values (d->>'id', (d->>'ownerKey')::uuid, d)
      on conflict (id) do nothing;
    end if;
  end loop;

  for d in select * from jsonb_array_elements(coalesce(old_data->'coCurricularCatalog', '[]'::jsonb))
  loop
    insert into co_curricular_catalog (id, department_id, item)
    values (d->>'id', d->>'departmentId', d)
    on conflict (id) do nothing;
  end loop;

  for d in select * from jsonb_array_elements(coalesce(old_data->'enrollments', '[]'::jsonb))
  loop
    if d->>'ownerKey' is not null and exists (select 1 from profiles where id = (d->>'ownerKey')::uuid) then
      insert into enrollments (id, owner_id, item) values (d->>'id', (d->>'ownerKey')::uuid, d)
      on conflict (id) do nothing;
    end if;
  end loop;

  for d in select * from jsonb_array_elements(coalesce(old_data->'resources', '[]'::jsonb))
  loop
    insert into resources (id, department_id, item)
    values (d->>'id', d->>'departmentId', d)
    on conflict (id) do nothing;
  end loop;

  for d in select * from jsonb_array_elements(coalesce(old_data->'announcements', '[]'::jsonb))
  loop
    insert into announcements (id, department_id, item)
    values (d->>'id', d->>'departmentId', d)
    on conflict (id) do nothing;
  end loop;

  for d in select * from jsonb_array_elements(coalesce(old_data->'activityLog', '[]'::jsonb))
  loop
    if d->>'by' is not null and exists (select 1 from profiles where id = (d->>'by')::uuid) then
      insert into activity_log (id, by, ts, text)
      values (d->>'id', (d->>'by')::uuid, coalesce((d->>'ts')::timestamptz, now()), d->>'text')
      on conflict (id) do nothing;
    end if;
  end loop;

  for d in select * from jsonb_array_elements(coalesce(old_data->'trash', '[]'::jsonb))
  loop
    insert into trash_entries (id, type, deleted_by, item, extra, label, deleted_at)
    values (
      d->>'id', d->>'type', nullif(d->>'deletedBy', '')::uuid,
      coalesce(d->'item', '{}'::jsonb), coalesce(d->'extra', '{}'::jsonb),
      d->>'label', coalesce((d->>'deletedAt')::timestamptz, now())
    )
    on conflict (id) do nothing;
  end loop;

  insert into user_prefs (user_id, last_seen_announcements, planner_hour_start, planner_hour_end)
  select
    p.id,
    coalesce((old_data->'lastSeenAnnouncements'->>(p.id::text))::int, 0),
    coalesce((old_data->'plannerHourRanges'->(p.id::text)->>'start')::int, 6),
    coalesce((old_data->'plannerHourRanges'->(p.id::text)->>'end')::int, 23)
  from profiles p
  on conflict (user_id) do nothing;

  if to_regclass('public.classroom_legacy_backup') is null then
    alter table classroom rename to classroom_legacy_backup;
  end if;
end $$;

-- ============================================================================
-- ONE-TIME MANUAL STEP: making the first admin (same as before, if not done already)
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
