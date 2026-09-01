-- ============================================================
-- Areep — Phase 1 schema (Auth + Projects + Dashboard)
--
-- Run this in Supabase: Dashboard → SQL Editor → New query → paste
-- this whole file → Run. Later phases (discovery sessions, messages,
-- requirements, PRDs, exports) add their own tables in separate
-- migration files — this one only covers what Phase 1 needs.
--
-- Auth itself needs no table here — Supabase already provides
-- `auth.users`; every table below just references it.
-- ============================================================

-- ---------- organizations ----------
-- Every user gets one organization automatically on signup (see the
-- trigger at the bottom) — this is what makes "Business/Teams" in
-- later phases a straightforward extension instead of a rewrite.
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now()
);

-- ---------- organization_members ----------
-- Membership table, not just organizations.owner_id, so multi-user
-- teams (Section 45's "Business" tier) slot in later without
-- touching this table's shape — just insert more rows.
create table if not exists organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'owner' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz default now(),
  unique (organization_id, user_id)
);

-- ---------- clients ----------
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now()
);

-- ---------- projects ----------
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  client_id uuid references clients(id) on delete set null,
  name text not null,
  project_type text not null default 'other'
    check (project_type in ('mobile_app','web_app','saas','ecommerce','internal_system','marketplace','landing_page','dashboard','api_backend','other')),
  description text,
  status text not null default 'discovery'
    check (status in ('discovery','ready_for_review','prd_generated','completed')),
  discovery_progress int not null default 0 check (discovery_progress between 0 and 100),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists projects_org_idx on projects (organization_id);
create index if not exists clients_org_idx on clients (organization_id);
create index if not exists org_members_user_idx on organization_members (user_id);

-- ---------- updated_at auto-touch ----------
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists projects_touch_updated_at on projects;
create trigger projects_touch_updated_at
  before update on projects
  for each row execute function touch_updated_at();

-- ---------- new-user bootstrap ----------
-- Every signup gets its own organization automatically (named after
-- their email until they rename it) — the dashboard/project pages
-- can then assume `organization_members` always has at least one row
-- for the logged-in user, no "no org yet" edge case to handle in UI.
create or replace function handle_new_user() returns trigger as $$
declare
  new_org_id uuid;
begin
  insert into organizations (name, owner_id)
  values (coalesce(split_part(new.email, '@', 1), 'My Organization'), new.id)
  returning id into new_org_id;

  insert into organization_members (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  return new;
end;
$$ language plpgsql security definer set search_path = public;
-- `set search_path = public` matters here: this trigger fires from inside
-- Supabase's auth service (GoTrue), whose calling role doesn't have `public`
-- in its default search_path — without this, the unqualified table names
-- above silently fail to resolve and signup dies with a generic
-- "Database error saving new user" (confirmed live).

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- Row Level Security — every table locked down by default,
-- opened up only to rows the requesting user's organization(s)
-- actually own. This is what makes it safe to call Supabase
-- directly from the frontend with the public anon key.
-- ============================================================
alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table clients enable row level security;
alter table projects enable row level security;

create policy "members can read their orgs"
  on organizations for select
  using (id in (select organization_id from organization_members where user_id = auth.uid()));

create policy "owners can update their orgs"
  on organizations for update
  using (owner_id = auth.uid());

-- Deliberately NOT "or organization_id in (select ... from organization_members ...)"
-- here — a policy on organization_members that subqueries organization_members
-- inside itself makes Postgres recurse evaluating its own policy (error 42P17,
-- confirmed live). Each user only needs to see their own membership row(s) to
-- resolve their organization_id; seeing teammates' rows can wait for a
-- security-definer helper function in a later phase, if ever needed.
create policy "members can read their own membership rows"
  on organization_members for select
  using (user_id = auth.uid());

create policy "members can read their org's clients"
  on clients for select
  using (organization_id in (select organization_id from organization_members where user_id = auth.uid()));

create policy "members can write their org's clients"
  on clients for insert
  with check (organization_id in (select organization_id from organization_members where user_id = auth.uid()));

create policy "members can update their org's clients"
  on clients for update
  using (organization_id in (select organization_id from organization_members where user_id = auth.uid()));

create policy "members can read their org's projects"
  on projects for select
  using (organization_id in (select organization_id from organization_members where user_id = auth.uid()));

create policy "members can write their org's projects"
  on projects for insert
  with check (organization_id in (select organization_id from organization_members where user_id = auth.uid()));

create policy "members can update their org's projects"
  on projects for update
  using (organization_id in (select organization_id from organization_members where user_id = auth.uid()));

create policy "members can delete their org's projects"
  on projects for delete
  using (organization_id in (select organization_id from organization_members where user_id = auth.uid()));

-- ============================================================
-- Chat workspace phase — messages
--
-- Run this section (or the whole file — earlier statements are all
-- `if not exists` / `create or replace`, so re-running is safe) in
-- Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Chat history per project. `role` distinguishes the assistant's
-- scripted/AI turns from the user's — this phase only ever inserts
-- 'assistant' messages from the local scripted new-project flow
-- (see src/features/projects/useNewProjectFlow.js), never a real AI
-- call yet (Gemini discovery integration is a later phase).
-- ============================================================
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

create index if not exists messages_project_idx on messages (project_id, created_at);

alter table messages enable row level security;

-- auth.uid() wrapped in `select` so Postgres evaluates it once per
-- statement (cached as an initplan) instead of once per row scanned —
-- see the "members can read their own membership rows" policy above
-- for why this file doesn't do that in a couple of the older policies;
-- it's a safe, behavior-identical addition here since these are new.
create policy "members can read their org's project messages"
  on messages for select
  using (project_id in (
    select id from projects where organization_id in (
      select organization_id from organization_members where user_id = (select auth.uid())
    )
  ));

create policy "members can write their org's project messages"
  on messages for insert
  with check (project_id in (
    select id from projects where organization_id in (
      select organization_id from organization_members where user_id = (select auth.uid())
    )
  ));

-- ============================================================
-- Discovery phase — confidence + running discovery snapshot
--
-- Run this section in Supabase: Dashboard → SQL Editor → New query →
-- paste → Run. Adds two columns to `projects` for the real Gemini
-- discovery agent (see areep/server/routes/discovery.js): `confidence`
-- mirrors the 0-100 score Gemini assigns each turn, `discovery_state`
-- is a running JSON snapshot of the latest requirements_extracted /
-- missing_information / contradictions returned by Gemini — good enough
-- to survive a reload for now. A proper normalized `requirements` table
-- is the NEXT phase's "Requirements engine" step, not this one.
--
-- No new RLS policy needed: the existing "members can update their
-- org's projects" UPDATE policy (defined above) is row-scoped, not
-- column-scoped, and already covers UPDATE on every column of `projects`
-- — including these two new ones — for any row the policy's `using`
-- clause admits.
-- ============================================================
alter table projects add column if not exists confidence int not null default 0 check (confidence between 0 and 100);
alter table projects add column if not exists discovery_state jsonb;

-- ============================================================
-- Requirements engine — normalized `requirements` table
--
-- Run this section in Supabase: Dashboard → SQL Editor → New query →
-- paste → Run. `projects.discovery_state` (above) stays as-is — it's
-- still the raw per-turn audit trail / fallback the frontend reads when
-- this table hasn't been migrated yet or is empty. This table is the
-- real, editable, per-item normalization of it (spec section 9): every
-- item Gemini extracts in `requirements_extracted` gets merged in here
-- by `req_key` (see src/services/requirementsService.js), and the
-- Requirements Review UI (spec sections 25-26) reads/writes this table
-- directly for edits/deletes/manual additions.
--
-- Soft-delete decision: `status` exists for future undo/versioning, but
-- THIS phase hard-deletes on a user-initiated delete (Section 26's
-- "Delete" action issues a real `delete`, not a status flip) — `status`
-- is only ever written as its default 'active' for now. Documented here
-- so a future phase doesn't have to guess which behavior is live.
--
-- No new RLS-shape concern beyond the existing project-scoping pattern
-- (see `messages` above) — copied verbatim.
-- ============================================================
create table if not exists requirements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  req_key text not null,
  type text not null check (type in ('goal','target_user','feature','functional','non_functional','risk','assumption')),
  title text not null,
  description text,
  priority text not null default 'Unspecified' check (priority in ('Must Have','Should Have','Could Have','Won''t Have','Unspecified')),
  status text not null default 'active' check (status in ('active','deleted')),
  source text not null default 'ai' check (source in ('ai','user')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (project_id, req_key)
);

create index if not exists requirements_project_idx on requirements (project_id, status);

create or replace function touch_requirements_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists requirements_touch_updated_at on requirements;
create trigger requirements_touch_updated_at
  before update on requirements
  for each row execute function touch_requirements_updated_at();

alter table requirements enable row level security;

create policy "members can read their org's project requirements"
  on requirements for select
  using (project_id in (select id from projects where organization_id in (select organization_id from organization_members where user_id = (select auth.uid()))));

create policy "members can write their org's project requirements"
  on requirements for insert
  with check (project_id in (select id from projects where organization_id in (select organization_id from organization_members where user_id = (select auth.uid()))));

create policy "members can update their org's project requirements"
  on requirements for update
  using (project_id in (select id from projects where organization_id in (select organization_id from organization_members where user_id = (select auth.uid()))));

create policy "members can delete their org's project requirements"
  on requirements for delete
  using (project_id in (select id from projects where organization_id in (select organization_id from organization_members where user_id = (select auth.uid()))));

-- ============================================================
-- PRD generation phase — persisted PRD document snapshot
--
-- Run this section in Supabase: Dashboard → SQL Editor → New query →
-- paste → Run. Adds one column to `projects` so a generated PRD survives
-- a reload of /chat/:projectId/prd instead of requiring regeneration
-- every time (see areep/server/routes/prd.js + src/services/prdService.js
-- + src/features/projects/PrdPreview.jsx). `prd_data` stores the raw
-- validated JSON response from POST /api/prd as-is (metadata/sections/
-- requirements/user_stories/acceptance_criteria/risks/assumptions — see
-- server/lib/validatePrdResponse.js) — it is never re-shaped before
-- storage; the frontend maps it to the PDF renderer's own shape on read
-- (src/lib/prdMapper.js).
--
-- `status` already had 'prd_generated' in its check constraint from
-- Phase 1 (see the `projects` table definition above) — reused here as
-- the signal the frontend's ProjectTabs (src/features/projects/ChatPage.jsx)
-- uses to decide whether the "PRD" pill is shown at all, not a new enum
-- value.
--
-- No new RLS policy needed, same reasoning as the "Discovery phase"
-- migration above: the existing "members can update their org's
-- projects" UPDATE policy is row-scoped, not column-scoped, and already
-- covers UPDATE on every column of `projects`.
-- ============================================================
alter table projects add column if not exists prd_data jsonb;

-- ============================================================
-- Admin / analytics phase — super admins + AI telemetry
--
-- Run this section in Supabase: Dashboard → SQL Editor → New query →
-- paste → Run. Everything below is `if not exists` / `create or replace`,
-- so re-running the whole file stays safe.
-- ============================================================

-- ---------- app_admins ----------
-- Who may open /admin. Deliberately its own table rather than a column on
-- organization_members: that table's grain is one row per membership, so a
-- user in two organisations would carry two copies of a fact that is about
-- the person, not the membership — and the two could disagree.
--
-- No RLS policy grants SELECT to anyone. That is intentional: this table is
-- read by the admin Edge Function using the service role, which bypasses
-- RLS. With RLS enabled and no policy, the browser's anon key can read
-- nothing here at all, so the flag cannot be enumerated from the client.
create table if not exists app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_super_admin boolean not null default false,
  created_at timestamptz default now()
);

alter table app_admins enable row level security;

-- ---------- ai_events ----------
-- One row per attempt against a model provider. This is what makes the
-- dashboard's AI Operations and System Health sections real rather than
-- decorative: before it, the Edge Functions only console.warn'd, so nothing
-- about cost, latency, fallback or failure survived the request.
--
-- `attempt` is the position in the provider chain (0 = primary), so a
-- fallback is simply any successful row with attempt > 0 — no separate
-- flag to keep in sync.
--
-- Token counts are nullable on purpose: Gemini and Groq both report usage,
-- but a failed call reports none, and a provider may omit it. A null means
-- "not reported", which the dashboard must not silently read as zero.
create table if not exists ai_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- which endpoint: the discovery agent, or PRD generation
  kind text not null check (kind in ('discovery', 'prd')),
  project_id uuid references projects(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  provider text not null,
  attempt int not null default 0,
  ok boolean not null,
  duration_ms int,
  input_tokens int,
  output_tokens int,
  error text
);

create index if not exists ai_events_created_idx on ai_events (created_at desc);
create index if not exists ai_events_kind_created_idx on ai_events (kind, created_at desc);
create index if not exists ai_events_project_idx on ai_events (project_id, created_at);

alter table ai_events enable row level security;
-- Same reasoning as app_admins: written by the Edge Functions with the
-- service role, read by the admin function with the service role. The
-- browser has no business reading raw telemetry, so no policy is granted.

-- ---------- projects.prd_generated_at ----------
-- The moment a PRD was first stored for this project.
--
-- Without it, "how many PRDs this week" and "time to PRD" both had to be
-- approximated from `updated_at`, which the touch trigger moves on ANY
-- write — renaming a project would have counted as generating a document.
-- Rows that predate this column stay null, which the dashboard reports as
-- "generated before tracking began" rather than folding into a period
-- count it cannot actually place in time.
alter table projects add column if not exists prd_generated_at timestamptz;
create index if not exists projects_prd_generated_idx on projects (prd_generated_at);

-- ============================================================
-- admin_analytics() — every number the owner dashboard shows
--
-- One function, one round trip. It is `security definer` because it must
-- read across all organisations and into auth.users, which RLS correctly
-- forbids to everyone else — and it is never granted to anon or
-- authenticated: only the service role calls it, from the admin-analytics
-- Edge Function, which checks app_admins first.
--
-- Two rules govern the shape of what comes back:
--
--   * Nothing identifying. Counts, rates, buckets and timestamps only. No
--     email, no name, no project title, no message text ever leaves here.
--
--   * Absent, not zero. A metric with no way to be measured is simply not
--     a key in the result. The client renders a missing key as "not
--     tracked" and a present 0 as a real zero, so the dashboard can never
--     imply a measurement nobody took.
-- ============================================================
create or replace function admin_analytics(
  p_from timestamptz,
  p_to timestamptz,
  p_compare_from timestamptz default null,
  p_compare_to timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
  has_ai_events boolean;
begin
  select exists (select 1 from ai_events limit 1) into has_ai_events;

  with
  -- ---------- period-scoped primitives ----------
  signups as (
    select id, created_at from auth.users where created_at >= p_from and created_at < p_to
  ),
  signups_prev as (
    select id from auth.users
    where p_compare_from is not null and created_at >= p_compare_from and created_at < p_compare_to
  ),
  projects_cur as (
    select * from projects where created_at >= p_from and created_at < p_to
  ),
  projects_prev as (
    select * from projects
    where p_compare_from is not null and created_at >= p_compare_from and created_at < p_compare_to
  ),
  prds_cur as (
    select * from projects where prd_generated_at >= p_from and prd_generated_at < p_to
  ),
  prds_prev as (
    select * from projects
    where p_compare_from is not null and prd_generated_at >= p_compare_from and prd_generated_at < p_compare_to
  ),
  -- every project mapped to the user who owns its organisation
  project_owner as (
    select p.id as project_id, p.created_at, p.status, p.project_type, p.confidence,
           p.prd_generated_at, m.user_id
    from projects p
    join organization_members m on m.organization_id = p.organization_id
  ),
  -- ---------- activation funnel, over users who signed up in range ----------
  cohort as (select id as user_id from signups),
  f_projects as (
    select distinct po.user_id from project_owner po join cohort c on c.user_id = po.user_id
  ),
  f_discovery as (
    select distinct po.user_id
    from project_owner po
    join cohort c on c.user_id = po.user_id
    where exists (select 1 from messages m where m.project_id = po.project_id)
  ),
  f_completed as (
    select distinct po.user_id
    from project_owner po join cohort c on c.user_id = po.user_id
    where po.status in ('ready_for_review', 'prd_generated')
  ),
  f_prd as (
    select distinct po.user_id
    from project_owner po join cohort c on c.user_id = po.user_id
    where po.prd_generated_at is not null
  ),
  -- ---------- engagement ----------
  msg_per_project as (
    select p.id, count(m.id) as n
    from projects p left join messages m on m.project_id = p.id
    where p.created_at >= p_from and p.created_at < p_to
    group by p.id
  ),
  proj_per_user as (
    select user_id, count(*) as n from project_owner group by user_id
  ),
  ttp as (
    select extract(epoch from (prd_generated_at - created_at)) as secs
    from projects
    where prd_generated_at is not null and prd_generated_at >= p_from and prd_generated_at < p_to
  ),
  -- ---------- quality ----------
  reqs as (
    select
      count(*) filter (where source = 'ai') as generated,
      count(*) filter (where source = 'user') as user_added,
      count(*) filter (where updated_at > created_at + interval '2 seconds') as edited,
      count(*) filter (where status = 'deleted') as deleted
    from requirements r
    where r.created_at >= p_from and r.created_at < p_to
  ),
  -- ---------- retention: signup week x activity window ----------
  activity as (
    select m.user_id, po.created_at as at
    from project_owner po join organization_members m on m.user_id = po.user_id
    union all
    select m2.user_id, msg.created_at
    from messages msg
    join projects p on p.id = msg.project_id
    join organization_members m2 on m2.organization_id = p.organization_id
  ),
  cohorts as (
    select u.id as user_id, date_trunc('week', u.created_at) as week, u.created_at as joined
    from auth.users u
    where u.created_at >= p_from - interval '35 days' and u.created_at < p_to
  ),
  retention as (
    select
      c.week,
      count(distinct c.user_id) as size,
      count(distinct c.user_id) filter (
        where exists (select 1 from activity a where a.user_id = c.user_id
          and a.at >= c.joined + interval '1 day' and a.at < c.joined + interval '2 days')) as d1,
      count(distinct c.user_id) filter (
        where exists (select 1 from activity a where a.user_id = c.user_id
          and a.at >= c.joined + interval '7 days' and a.at < c.joined + interval '8 days')) as d7,
      count(distinct c.user_id) filter (
        where exists (select 1 from activity a where a.user_id = c.user_id
          and a.at >= c.joined + interval '30 days' and a.at < c.joined + interval '31 days')) as d30
    from cohorts c group by c.week order by c.week
  ),
  -- ---------- daily series for sparklines ----------
  days as (
    select generate_series(date_trunc('day', p_from), date_trunc('day', p_to - interval '1 second'), interval '1 day') as d
  ),
  series as (
    select
      to_char(d.d, 'YYYY-MM-DD') as day,
      (select count(*) from auth.users u where u.created_at >= d.d and u.created_at < d.d + interval '1 day') as signups,
      (select count(*) from projects p where p.created_at >= d.d and p.created_at < d.d + interval '1 day') as projects,
      (select count(*) from projects p where p.prd_generated_at >= d.d and p.prd_generated_at < d.d + interval '1 day') as prds
    from days d
  ),
  -- ---------- AI operations ----------
  ai_cur as (
    select * from ai_events where created_at >= p_from and created_at < p_to
  ),
  ai_by_provider as (
    select provider,
      count(*) as requests,
      count(*) filter (where ok) as succeeded,
      count(*) filter (where not ok) as failed,
      count(*) filter (where ok and attempt > 0) as served_as_fallback,
      round(avg(duration_ms) filter (where ok))::int as avg_ms,
      sum(input_tokens) as input_tokens,
      sum(output_tokens) as output_tokens
    from ai_cur group by provider
  )
  select jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to,
                                'compareFrom', p_compare_from, 'compareTo', p_compare_to),
    'generatedAt', now(),

    'acquisition', jsonb_build_object(
      'signups', (select count(*) from signups),
      'signupsPrevious', case when p_compare_from is null then null else (select count(*) from signups_prev) end
    ),

    'activation', jsonb_build_object(
      'funnel', jsonb_build_array(
        jsonb_build_object('key', 'signup',    'users', (select count(*) from cohort)),
        jsonb_build_object('key', 'project',   'users', (select count(*) from f_projects)),
        jsonb_build_object('key', 'discovery', 'users', (select count(*) from f_discovery)),
        jsonb_build_object('key', 'completed', 'users', (select count(*) from f_completed)),
        jsonb_build_object('key', 'prd',       'users', (select count(*) from f_prd))
      ),
      'projectsCreated', (select count(*) from projects_cur),
      'projectsCreatedPrevious', case when p_compare_from is null then null else (select count(*) from projects_prev) end,
      'prdsGenerated', (select count(*) from prds_cur),
      'prdsGeneratedPrevious', case when p_compare_from is null then null else (select count(*) from prds_prev) end,
      'prdsBeforeTracking', (select count(*) from projects where prd_data is not null and prd_generated_at is null)
    ),

    'engagement', jsonb_build_object(
      'avgMessagesPerProject', (select round(avg(n), 2) from msg_per_project),
      'avgProjectsPerUser', (select round(avg(n), 2) from proj_per_user),
      'medianTimeToPrdSeconds', (select percentile_cont(0.5) within group (order by secs) from ttp),
      'timeToPrdSampleSize', (select count(*) from ttp)
    ),

    'quality', jsonb_build_object(
      'requirementsGenerated', (select generated from reqs),
      'requirementsEdited', (select edited from reqs),
      'requirementsUserAdded', (select user_added from reqs),
      'requirementsDeleted', (select deleted from reqs)
    ),

    'retention', jsonb_build_object(
      'cohorts', coalesce((select jsonb_agg(jsonb_build_object(
          'week', to_char(week, 'YYYY-MM-DD'), 'size', size, 'd1', d1, 'd7', d7, 'd30', d30
        ) order by week) from retention), '[]'::jsonb),
      'secondProjectRate', (
        select case when count(*) = 0 then null
               else round(100.0 * count(*) filter (where n >= 2) / count(*), 1) end
        from proj_per_user
      )
    ),

    'projects', jsonb_build_object(
      'byType', coalesce((select jsonb_agg(jsonb_build_object('type', project_type, 'count', c) order by c desc)
                          from (select project_type, count(*) c from projects group by project_type) t), '[]'::jsonb),
      'confidenceBuckets', coalesce((select jsonb_agg(jsonb_build_object('bucket', b, 'count', c) order by b)
        from (select width_bucket(confidence, 0, 100, 5) * 20 as b, count(*) c
              from projects where confidence > 0 group by 1) cb), '[]'::jsonb),
      'total', (select count(*) from projects)
    ),

    'series', coalesce((select jsonb_agg(jsonb_build_object(
        'day', day, 'signups', signups, 'projects', projects, 'prds', prds) order by day) from series), '[]'::jsonb),

    -- Absent entirely when no telemetry has been recorded yet, so the
    -- client shows "collecting" rather than a page of confident zeroes.
    'ai', case when not has_ai_events then null else jsonb_build_object(
      'requests', (select count(*) from ai_cur),
      'succeeded', (select count(*) filter (where ok) from ai_cur),
      'failed', (select count(*) filter (where not ok) from ai_cur),
      'fallbackServed', (select count(*) filter (where ok and attempt > 0) from ai_cur),
      'inputTokens', (select sum(input_tokens) from ai_cur),
      'outputTokens', (select sum(output_tokens) from ai_cur),
      'byProvider', coalesce((select jsonb_agg(to_jsonb(ai_by_provider)) from ai_by_provider), '[]'::jsonb),
      'byKind', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'requests', c, 'failed', f))
        from (select kind, count(*) c, count(*) filter (where not ok) f from ai_cur group by kind) k), '[]'::jsonb),
      'recentFailures', coalesce((select jsonb_agg(jsonb_build_object(
          'at', created_at, 'kind', kind, 'provider', provider, 'error', left(error, 120)) order by created_at desc)
        from (select * from ai_cur where not ok order by created_at desc limit 5) rf), '[]'::jsonb)
    ) end
  ) into result;

  return result;
end;
$$;

-- Only the service role may call this, and only through the
-- admin-analytics Edge Function, which checks app_admins first.
revoke all on function admin_analytics(timestamptz, timestamptz, timestamptz, timestamptz) from public;
revoke all on function admin_analytics(timestamptz, timestamptz, timestamptz, timestamptz) from anon;
revoke all on function admin_analytics(timestamptz, timestamptz, timestamptz, timestamptz) from authenticated;
