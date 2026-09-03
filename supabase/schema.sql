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
-- PRD Feedback phase — post-generation quality signal
--
-- Run this section in Supabase: Dashboard → SQL Editor → New query →
-- paste → Run. Adds the `prd_feedback` table the PRD screen writes to
-- (see src/features/projects/PrdFeedback.jsx +
-- src/services/prdFeedbackService.js) and is later aggregated by
-- admin_analytics() below into the owner dashboard's Quality section.
--
-- Keyed by `project_id`, not a `prd_id` — there is no PRD-history concept
-- in this product (see `prd_data` above: regeneration overwrites the
-- previous document), so one project has at most one PRD at any time,
-- and therefore at most one feedback row (`unique (project_id)`). Writes
-- from the client are always an upsert on that constraint — every step
-- of the feedback flow updates the same row rather than inserting a new
-- one, which is what makes "one feedback per PRD" (not "per submit
-- click") true by construction rather than by an app-level check.
--
-- `submitted_at` — not just `created_at` — is what separates a completed
-- submission from a row that only has a few early-step answers saved
-- because the user left before finishing. admin_analytics() only counts
-- rows where this is set, so an abandoned flow never dilutes a
-- satisfaction number with someone who never actually said how they felt.
--
-- Every enum column stores the raw selection the user made, not a
-- computed score — spec's own instruction, echoed in this file's
-- comment style elsewhere: don't turn a selection into a percentage
-- without a stated definition. That translation happens in
-- src/admin/analytics/client.js, once, not here and not twice.
-- ============================================================
create table if not exists prd_feedback (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null not null,
  sentiment text check (sentiment in ('positive','negative')),
  positive_reasons text[] not null default '{}',
  negative_reasons text[] not null default '{}',
  requirement_accuracy text check (requirement_accuracy in ('all_correct','mostly_correct','some_correct','many_incorrect','unsure')),
  requirement_completeness text check (requirement_completeness in ('complete','slightly_incomplete','clearly_incomplete','unsure')),
  edit_level text check (edit_level in ('none','light','moderate','heavy')),
  value_rating text check (value_rating in ('significant','some','limited','none')),
  rating int check (rating between 1 and 5),
  comment text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id),
  -- Mirrors the client-side validation that picking "شيء آخر" (other)
  -- makes the comment required — enforced here too so the rule holds
  -- even if a future caller bypasses the form.
  constraint prd_feedback_other_requires_comment check (
    not ('other' = any(negative_reasons)) or (comment is not null and length(btrim(comment)) > 0)
  )
);

create index if not exists prd_feedback_submitted_idx on prd_feedback (submitted_at) where submitted_at is not null;

-- Reuses the generic touch_updated_at() defined above (projects' own
-- trigger) rather than a third per-table copy.
drop trigger if exists prd_feedback_touch_updated_at on prd_feedback;
create trigger prd_feedback_touch_updated_at
  before update on prd_feedback
  for each row execute function touch_updated_at();

alter table prd_feedback enable row level security;

-- Feedback is private to the person who gave it — not org-wide like
-- projects/requirements/messages. Spec section 26: "Users can read/
-- update only their own feedback." The aggregate view for an owner is
-- admin_analytics() below, which reads across all of prd_feedback as
-- security definer and returns only aggregated counts, never a raw row.
create policy "users can read their own prd feedback"
  on prd_feedback for select
  using (user_id = (select auth.uid()));

create policy "users can insert their own prd feedback"
  on prd_feedback for insert
  with check (
    user_id = (select auth.uid())
    and project_id in (select id from projects where organization_id in (select organization_id from organization_members where user_id = (select auth.uid())))
  );

create policy "users can update their own prd feedback"
  on prd_feedback for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- No delete policy — feedback is immutable once a row exists, matching
-- "one feedback per PRD." No org-wide select policy either: a teammate
-- in the same organisation cannot read (or overwrite, via upsert) another
-- member's feedback row for a shared project — an accepted limitation
-- while organisations are effectively single-owner (see the
-- organization_members comment near the top of this file for the same
-- "teams are a later phase" boundary).

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
  -- Mirrors `cohort`/`f_prd` one period back, so the KPI card has a real
  -- previous value to diff against instead of `activationRate.change`
  -- being permanently null. Only the final stage is needed here — the
  -- comparison card shows one number, not a second funnel.
  cohort_prev as (select id as user_id from signups_prev),
  f_prd_prev as (
    select distinct po.user_id
    from project_owner po join cohort_prev c on c.user_id = po.user_id
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
  -- ---------- activation rate, bucketed by signup day ----------
  -- Same definition as f_prd above (did any project of theirs ever reach
  -- a PRD, no time bound on when) — just grouped by the day someone
  -- signed up instead of collapsed into one number for the whole range.
  -- A cohort from yesterday has had less time to convert than one from
  -- three weeks ago; that is an honest property of the chart; it is not
  -- hidden, and no cohort is excluded to hide it.
  activation_daily as (
    select
      to_char(d.d, 'YYYY-MM-DD') as day,
      (select count(*) from auth.users u where u.created_at >= d.d and u.created_at < d.d + interval '1 day') as cohort_size,
      (select count(distinct u.id)
         from auth.users u
         join project_owner po on po.user_id = u.id
         where u.created_at >= d.d and u.created_at < d.d + interval '1 day'
           and po.prd_generated_at is not null) as activated
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
  ),
  -- ---------- PRD feedback (Quality section) ----------
  -- submitted_at, not created_at: a row started but never finished (no
  -- click on the final star-rating "إرسال التقييم") is not a completed
  -- feedback and must not count toward satisfaction/reason percentages.
  prd_feedback_cur as (
    select * from prd_feedback where submitted_at is not null and submitted_at >= p_from and submitted_at < p_to
  ),
  prd_feedback_prev as (
    select * from prd_feedback
    where p_compare_from is not null and submitted_at is not null and submitted_at >= p_compare_from and submitted_at < p_compare_to
  ),
  -- Denominator for Feedback Response Rate (spec section 29): every PRD
  -- that COULD have received feedback in this period, whether or not it
  -- did. Absence of feedback is not the same as dissatisfaction, and this
  -- is what lets the client say so instead of reading a low positive rate
  -- as a low satisfaction rate.
  eligible_prds_cur as (
    select * from projects where prd_generated_at is not null and prd_generated_at >= p_from and prd_generated_at < p_to
  ),
  feedback_pos_reasons as (select unnest(positive_reasons) as reason from prd_feedback_cur),
  feedback_neg_reasons as (select unnest(negative_reasons) as reason from prd_feedback_cur),
  feedback_series as (
    select
      to_char(d.d, 'YYYY-MM-DD') as day,
      count(pf.id) as responses,
      round(avg(pf.rating) filter (where pf.rating is not null), 2) as avg_rating,
      count(*) filter (where pf.sentiment = 'positive') as positive,
      count(*) filter (where pf.sentiment = 'negative') as negative
    from days d
    left join prd_feedback pf on pf.submitted_at >= d.d and pf.submitted_at < d.d + interval '1 day'
    group by d.d order by d.d
  ),
  -- ---------- recent activity feed (Overview only) ----------
  -- Kind and a timestamp, nothing else. No user id, no project id, no
  -- provider name tied to a specific failure — an owner recognising "a
  -- PRD came in eight minutes ago" needs none of that, and the privacy
  -- boundary this function has kept since it was written (counts, rates,
  -- buckets, timestamps — never an identifier) does not get an exception
  -- just because this feed reads chronologically instead of aggregated.
  -- Limited to the last 20 across four kinds, newest first, capped to the
  -- selected period so a wide range does not pull in ancient events.
  recent_signups as (
    select 'signup'::text as kind, created_at from signups
  ),
  recent_projects as (
    select 'project'::text as kind, created_at from projects_cur
  ),
  recent_prds as (
    -- prd_generated_at, not created_at — the event this row represents
    -- is the PRD being generated, which can happen long after the
    -- project itself was created.
    select 'prd'::text as kind, prd_generated_at as created_at from prds_cur
  ),
  recent_fallbacks as (
    select 'fallback'::text as kind, created_at from ai_cur where ok and attempt > 0
  ),
  recent_activity as (
    select kind, created_at from (
      select * from recent_signups
      union all select * from recent_projects
      union all select * from recent_prds
      union all select * from recent_fallbacks
    ) all_events
    order by created_at desc
    limit 20
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
      'prdsBeforeTracking', (select count(*) from projects where prd_data is not null and prd_generated_at is null),
      -- null unless a compare period is selected AND the previous cohort
      -- had at least one signup — a rate over zero people is not a rate.
      'activationRatePrevious', case
        when p_compare_from is null then null
        when (select count(*) from signups_prev) = 0 then null
        else round(100.0 * (select count(*) from f_prd_prev) / (select count(*) from signups_prev), 1)
      end,
      'dailyRate', coalesce((select jsonb_agg(jsonb_build_object(
          'day', day, 'cohortSize', cohort_size,
          'rate', case when cohort_size = 0 then null else round(100.0 * activated / cohort_size, 1) end
        ) order by day) from activation_daily), '[]'::jsonb)
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

    'recentActivity', coalesce((select jsonb_agg(jsonb_build_object(
        'kind', kind, 'at', created_at) order by created_at desc) from recent_activity), '[]'::jsonb),

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
    ) end,

    -- Unlike `ai` above, this is never nulled out for "no rows yet" — zero
    -- submitted feedback is a real, sayable zero (the feature exists, no
    -- one has used it yet), not a "not tracked" gap. Every field here is a
    -- count, an enum label, or a rounded average — never `comment`, which
    -- stays in prd_feedback for the row's own owner to read, and never
    -- reaches this security-definer aggregate at all.
    'feedback', jsonb_build_object(
      'totalSubmitted', (select count(*) from prd_feedback_cur),
      'totalSubmittedPrevious', case when p_compare_from is null then null else (select count(*) from prd_feedback_prev) end,
      'eligiblePrds', (select count(*) from eligible_prds_cur),
      'responseRate', (
        select case when (select count(*) from eligible_prds_cur) = 0 then null
          else round(100.0 * (select count(*) from prd_feedback_cur) / (select count(*) from eligible_prds_cur), 1) end
      ),
      'sentiment', jsonb_build_object(
        'positive', (select count(*) filter (where sentiment = 'positive') from prd_feedback_cur),
        'negative', (select count(*) filter (where sentiment = 'negative') from prd_feedback_cur)
      ),
      'avgRating', (select round(avg(rating), 2) from prd_feedback_cur where rating is not null),
      'ratingSampleSize', (select count(*) from prd_feedback_cur where rating is not null),
      'ratingDistribution', coalesce((select jsonb_agg(jsonb_build_object('stars', r, 'count', c) order by r)
        from (select rating r, count(*) c from prd_feedback_cur where rating is not null group by rating) rd), '[]'::jsonb),
      'positiveReasons', coalesce((select jsonb_agg(jsonb_build_object('reason', reason, 'count', c) order by c desc)
        from (select reason, count(*) c from feedback_pos_reasons group by reason) pr), '[]'::jsonb),
      'negativeReasons', coalesce((select jsonb_agg(jsonb_build_object('reason', reason, 'count', c) order by c desc)
        from (select reason, count(*) c from feedback_neg_reasons group by reason) nr), '[]'::jsonb),
      'requirementAccuracy', coalesce((select jsonb_agg(jsonb_build_object('value', requirement_accuracy, 'count', c) order by c desc)
        from (select requirement_accuracy, count(*) c from prd_feedback_cur where requirement_accuracy is not null group by requirement_accuracy) ra), '[]'::jsonb),
      'requirementCompleteness', coalesce((select jsonb_agg(jsonb_build_object('value', requirement_completeness, 'count', c) order by c desc)
        from (select requirement_completeness, count(*) c from prd_feedback_cur where requirement_completeness is not null group by requirement_completeness) rc), '[]'::jsonb),
      'editLevel', coalesce((select jsonb_agg(jsonb_build_object('value', edit_level, 'count', c) order by c desc)
        from (select edit_level, count(*) c from prd_feedback_cur where edit_level is not null group by edit_level) el), '[]'::jsonb),
      'valueRating', coalesce((select jsonb_agg(jsonb_build_object('value', value_rating, 'count', c) order by c desc)
        from (select value_rating, count(*) c from prd_feedback_cur where value_rating is not null group by value_rating) vr), '[]'::jsonb),
      'series', coalesce((select jsonb_agg(jsonb_build_object(
          'day', day, 'responses', responses, 'avgRating', avg_rating, 'positive', positive, 'negative', negative) order by day)
        from feedback_series), '[]'::jsonb)
    )
  ) into result;

  return result;
end;
$$;

-- Only the service role may call this, and only through the
-- admin-analytics Edge Function, which checks app_admins first.
revoke all on function admin_analytics(timestamptz, timestamptz, timestamptz, timestamptz) from public;
revoke all on function admin_analytics(timestamptz, timestamptz, timestamptz, timestamptz) from anon;
revoke all on function admin_analytics(timestamptz, timestamptz, timestamptz, timestamptz) from authenticated;

-- ============================================================
-- Project limits phase — cap how many projects a user may create
--
-- Run this section in Supabase: Dashboard → SQL Editor → New query →
-- paste → Run. Idempotent like every phase above.
--
-- The number itself lives in the database, not in any app code — the
-- whole point of this feature is that a Super Admin changes it from the
-- dashboard without a deploy. And the check that matters runs in
-- Postgres, in a BEFORE INSERT trigger on `projects`: RLS already allows
-- any org member to insert a project row directly against Supabase with
-- nothing but the public anon key and their own JWT, so anything short
-- of a database-level gate is a UI suggestion, not an enforcement — a
-- request crafted by hand against the REST API would sail right through
-- a check that only existed in this project's JavaScript.
-- ============================================================

-- ---------- system_settings ----------
-- A singleton row (id is always literally `true`) rather than a generic
-- key/value table: this project has exactly one global setting so far,
-- and a key/value design would trade a `where id = true` for a `where
-- key = 'max_projects_per_user'` with no real gain — more flexible for a
-- future that may never need it, at the cost of a string key to typo today.
create table if not exists system_settings (
  id boolean primary key default true,
  max_projects_per_user integer not null default 10 check (max_projects_per_user > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint system_settings_is_singleton check (id)
);

-- 10 is a deliberately generous default: this migration is what TURNS ON
-- enforcement, and nobody using the product today agreed to a cap. A
-- tight default (e.g. 3) would silently lock out any existing user who
-- already has more projects than that, the moment this file is run —
-- before a Super Admin ever consciously chose a number. The Super Admin
-- sets the real policy from the dashboard, informed by the usage counts
-- admin_project_limit_status() reports below.
insert into system_settings (id) values (true) on conflict (id) do nothing;

alter table system_settings enable row level security;
-- No policy grants access to anyone. Same reasoning as app_admins: read
-- and written only by the two functions below (SECURITY DEFINER) and by
-- the enforcement trigger, all of which bypass RLS by design — the
-- browser's anon key can see nothing here directly.

-- ---------- enforcement ----------
-- Runs for every insert into `projects`, regardless of whether it came
-- from this app's own createProject() call or a request built by hand
-- against the REST API with a valid user JWT — a trigger on the table
-- itself is the one place that is not optional to go through.
--
-- Scoped by `organization_id`, not a `projects.user_id` column — this
-- table has never had one (every project belongs to an organisation, and
-- membership maps users to orgs). Today every user's signup creates
-- exactly one personal organisation, so "this org's project count" and
-- "this user's project count" are the same number for every real user.
-- If Areeb ever ships multi-member organisations, this limit becomes a
-- shared cap on the organisation's total, not a per-seat one — worth
-- knowing before that feature ships, not a silent behavior change.
create or replace function enforce_project_limit() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_count integer;
begin
  select max_projects_per_user into v_limit from system_settings where id = true;

  select count(*) into v_count from projects where organization_id = new.organization_id;

  if v_count >= v_limit then
    -- `detail` carries the two numbers the frontend needs to render an
    -- honest message ("your limit is N") without a second round trip.
    -- PostgREST surfaces this as error.details on the client.
    raise exception 'project_limit_reached'
      using detail = jsonb_build_object('limit', v_limit, 'current', v_count)::text;
  end if;

  return new;
end;
$$;

drop trigger if exists projects_enforce_limit on projects;
create trigger projects_enforce_limit
  before insert on projects
  for each row execute function enforce_project_limit();

-- ---------- admin read/write ----------
-- Two functions rather than exposing system_settings' columns directly
-- through PostgREST: `admin_set_project_limit` validates the input (no
-- zero, no negative, no null) in one place, and both read paths compute
-- the same usage breakdown the dashboard shows before AND after a change
-- — the Super Admin decides the new number informed by how many people
-- it would immediately affect, not blind.
create or replace function admin_project_limit_status() returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_limit integer;
  v_updated_at timestamptz;
  result jsonb;
begin
  select max_projects_per_user, updated_at into v_limit, v_updated_at
  from system_settings where id = true;

  with counts as (
    -- left join: a member with zero projects must still count toward
    -- "below limit" — an inner join would silently drop them.
    select m.user_id, count(p.id) as n
    from organization_members m
    left join projects p on p.organization_id = m.organization_id
    group by m.user_id
  )
  select jsonb_build_object(
    'maxProjectsPerUser', v_limit,
    'updatedAt', v_updated_at,
    'usage', jsonb_build_object(
      'atLimit', (select count(*) from counts where n >= v_limit),
      'belowLimit', (select count(*) from counts where n < v_limit),
      'totalUsers', (select count(*) from counts)
    )
  ) into result;

  return result;
end;
$$;

revoke all on function admin_project_limit_status() from public, anon, authenticated;

create or replace function admin_set_project_limit(p_limit integer, p_admin_user_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if p_limit is null or p_limit < 1 then
    raise exception 'invalid_limit';
  end if;

  update system_settings
  set max_projects_per_user = p_limit, updated_at = now(), updated_by = p_admin_user_id
  where id = true;

  return admin_project_limit_status();
end;
$$;

revoke all on function admin_set_project_limit(integer, uuid) from public, anon, authenticated;


-- ============================================================
-- AI usage & quota phase — per-user token/request limits for Gemini/Groq
--
-- Run this section in Supabase: Dashboard → SQL Editor → New query →
-- paste → Run. Idempotent like every phase above.
--
-- Extends system_settings (rather than a second global-config table) with
-- the AI-specific ceilings, adds two new per-user tables, and widens
-- ai_events — already the per-attempt AI call log — instead of standing
-- up a parallel ai_usage table. This codebase already has exactly one
-- home for "one global number the admin edits" (system_settings) and
-- exactly one home for "one row per model call" (ai_events); duplicating
-- either would just create two places that can disagree.
-- ============================================================

-- ---------- system_settings: AI ceilings ----------
-- Same reasoning as max_projects_per_user: generous defaults so turning
-- this migration on cannot retroactively lock out anyone already using
-- the product before a Super Admin has consciously chosen real numbers.
alter table system_settings add column if not exists tokens_per_month integer not null default 100000 check (tokens_per_month > 0);
alter table system_settings add column if not exists requests_per_day integer not null default 30 check (requests_per_day > 0);
alter table system_settings add column if not exists max_prd_generations_per_month integer not null default 5 check (max_prd_generations_per_month > 0);
alter table system_settings add column if not exists max_regenerations_per_project integer not null default 3 check (max_regenerations_per_project > 0);
alter table system_settings add column if not exists max_tokens_per_request integer not null default 8000 check (max_tokens_per_request > 0);

-- ---------- user_usage_limits ----------
-- Per-user override of the columns above. A row here — with enabled =
-- true — wins field by field over system_settings; a null field in an
-- enabled row still falls through to the global default rather than to
-- zero. No row at all, or enabled = false, means "use the global default
-- for everything", which is what a Super Admin's "Reset to Default" does.
create table if not exists user_usage_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tokens_per_month integer check (tokens_per_month > 0),
  requests_per_day integer check (requests_per_day > 0),
  max_projects_per_user integer check (max_projects_per_user > 0),
  max_prd_generations_per_month integer check (max_prd_generations_per_month > 0),
  max_regenerations_per_project integer check (max_regenerations_per_project > 0),
  max_tokens_per_request integer check (max_tokens_per_request > 0),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table user_usage_limits enable row level security;
-- Same reasoning as system_settings/app_admins: no policy at all. Read
-- and written only by the SECURITY DEFINER functions below and the admin
-- Edge Function's service role — the browser's anon key sees nothing
-- here directly, for any user, including the row's own owner.

-- ---------- user_usage ----------
-- One row per user per calendar month. This is the row every quota check
-- locks — see check_and_reserve_ai_usage() below — and the running total
-- the sidebar's usage indicator reads back through get-my-usage.
--
-- period_start/period_end rather than a single "current usage" row per
-- user: a new month is just a new row (created lazily, on first use, by
-- the check function's upsert), so nothing has to run a reset job, and
-- every previous month's row stays exactly as it was — real history,
-- never overwritten.
create table if not exists user_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  tokens_used integer not null default 0,
  requests_used integer not null default 0,
  discovery_requests integer not null default 0,
  prd_generations integer not null default 0,
  regenerations integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period_start)
);

create index if not exists user_usage_user_period_idx on user_usage (user_id, period_start desc);

alter table user_usage enable row level security;
-- Same "no policy" pattern as ai_events. Reads go through get-my-usage
-- (the caller's own row only, re-derived server-side from their verified
-- JWT — never a client-supplied user_id) and admin-settings (any user's
-- row, admin-gated); writes only ever happen inside the two functions
-- below, both SECURITY DEFINER.

-- ---------- ai_events: widen for AI usage tracking ----------
-- model: which model actually answered — Gemini and Groq have exactly
-- one model each today, but the column exists so a future model change
-- is a fact in the data instead of an assumption about which phase it
-- happened in.
--
-- total_tokens: a generated column, not a value the application computes
-- and writes twice — it can never drift from input_tokens/output_tokens,
-- and it stays null (not zero) exactly when they are both null, matching
-- this table's existing "null is not zero" rule.
--
-- error_code: the short machine code (QUOTA_EXCEEDED, AI_RATE_LIMITED,
-- ...) the frontend branches on, kept separate from the free-text `error`
-- column, which stays the provider's own truncated message for
-- debugging.
--
-- fallback_used is deliberately NOT a new column — this table's own
-- comment already defines it: any successful row with attempt > 0.
alter table ai_events add column if not exists model text;
alter table ai_events add column if not exists total_tokens integer generated always as (
  case when input_tokens is null and output_tokens is null then null
  else coalesce(input_tokens, 0) + coalesce(output_tokens, 0) end
) stored;
alter table ai_events add column if not exists error_code text;

alter table ai_events drop constraint if exists ai_events_kind_check;
alter table ai_events add constraint ai_events_kind_check check (kind in ('discovery', 'prd', 'regeneration'));

-- ---------- effective_limits() ----------
-- The one place "which limit applies to this user" is decided. Both
-- enforcement (check_and_reserve_ai_usage) and the user's own usage
-- readout (get-my-usage) call this, so they can never compute a
-- different answer for the same user.
create or replace function effective_limits(p_user_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g record;
  o record;
begin
  select * into g from system_settings where id = true;
  select * into o from user_usage_limits where user_id = p_user_id and enabled = true;

  return jsonb_build_object(
    'tokensPerMonth', coalesce(o.tokens_per_month, g.tokens_per_month),
    'requestsPerDay', coalesce(o.requests_per_day, g.requests_per_day),
    'maxProjectsPerUser', coalesce(o.max_projects_per_user, g.max_projects_per_user),
    'maxPrdGenerationsPerMonth', coalesce(o.max_prd_generations_per_month, g.max_prd_generations_per_month),
    'maxRegenerationsPerProject', coalesce(o.max_regenerations_per_project, g.max_regenerations_per_project),
    'maxTokensPerRequest', coalesce(o.max_tokens_per_request, g.max_tokens_per_request)
  );
end;
$$;

revoke all on function effective_limits(uuid) from public, anon, authenticated;

-- ---------- get_or_create_current_usage() ----------
-- Locates (or lazily creates) this user's row for the calendar month
-- `now()` falls in, and locks it `for update`. Used only by
-- check_and_reserve_ai_usage() — that lock is what closes the race two
-- concurrent requests from the same user would otherwise open: whichever
-- call gets here first holds the row lock until it commits (the outer
-- function returning), so a second concurrent call's read of
-- tokens_used/requests_used already reflects the first call's decision
-- rather than racing against it.
create or replace function get_or_create_current_usage(p_user_id uuid) returns user_usage
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period_start date := date_trunc('month', now())::date;
  v_period_end date := (date_trunc('month', now()) + interval '1 month')::date;
  v_row user_usage;
begin
  insert into user_usage (user_id, period_start, period_end)
  values (p_user_id, v_period_start, v_period_end)
  on conflict (user_id, period_start) do nothing;

  select * into v_row from user_usage
  where user_id = p_user_id and period_start = v_period_start
  for update;

  return v_row;
end;
$$;

revoke all on function get_or_create_current_usage(uuid) from public, anon, authenticated;

-- ---------- check_and_reserve_ai_usage() ----------
-- The single place quota is decided and reserved, atomically, before any
-- provider is ever called.
--
-- The reservation amount is this user's own effective maxTokensPerRequest
-- — computed internally from effective_limits(), not accepted as a
-- caller-supplied argument, so an Edge Function cannot reserve a smaller
-- (or larger) number than the ceiling the database itself has decided
-- applies. It is checked as a ceiling, not the request's actual eventual
-- token count (which cannot be known before the model responds), and is
-- pre-added to tokens_used on approval; that reservation is corrected to
-- the real number by finalize_ai_usage() once the call completes (or
-- released in full if it fails).
--
-- p_project_id matters only for request_type = 'regeneration': the cap
-- is per project, not a monthly total, so it is checked against a direct
-- count of that project's own past regenerations in ai_events rather
-- than against user_usage's monthly regenerations counter (which stays a
-- reporting total across all of a user's projects, not the enforcement
-- source for this particular limit).
create or replace function check_and_reserve_ai_usage(
  p_user_id uuid,
  p_request_type text,
  p_project_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  limits jsonb;
  v_reservation integer;
  usage_row user_usage;
  requests_today integer;
  project_regen_count integer;
begin
  limits := effective_limits(p_user_id);
  v_reservation := (limits->>'maxTokensPerRequest')::integer;
  usage_row := get_or_create_current_usage(p_user_id);

  -- attempt = 0 only: ai_events has one row per provider ATTEMPT, and a
  -- discovery/PRD call that fell through to a fallback provider produces
  -- more than one row for what was, from the user's side, a single
  -- request. attempt = 0 (chain.ts's primary candidate, always run —
  -- never skipped by the deadline check, since the full budget is always
  -- available for the first attempt) is the one row guaranteed to exist
  -- exactly once per logical request, success or failure alike.
  select count(*) into requests_today
  from ai_events
  where user_id = p_user_id and created_at >= date_trunc('day', now()) and attempt = 0;

  if requests_today >= (limits->>'requestsPerDay')::integer then
    return jsonb_build_object('allowed', false, 'reason', 'DAILY_LIMIT_EXCEEDED', 'limits', limits, 'usage', to_jsonb(usage_row));
  end if;

  if usage_row.tokens_used + v_reservation > (limits->>'tokensPerMonth')::integer then
    return jsonb_build_object('allowed', false, 'reason', 'QUOTA_EXCEEDED', 'limits', limits, 'usage', to_jsonb(usage_row));
  end if;

  if p_request_type = 'prd' and usage_row.prd_generations >= (limits->>'maxPrdGenerationsPerMonth')::integer then
    return jsonb_build_object('allowed', false, 'reason', 'PRD_LIMIT_EXCEEDED', 'limits', limits, 'usage', to_jsonb(usage_row));
  end if;

  if p_request_type = 'regeneration' then
    select count(*) into project_regen_count
    from ai_events
    where user_id = p_user_id and project_id = p_project_id and kind = 'regeneration' and ok = true;

    if project_regen_count >= (limits->>'maxRegenerationsPerProject')::integer then
      return jsonb_build_object('allowed', false, 'reason', 'REGENERATION_LIMIT_EXCEEDED', 'limits', limits, 'usage', to_jsonb(usage_row));
    end if;
  end if;

  update user_usage set
    tokens_used = tokens_used + v_reservation,
    requests_used = requests_used + 1,
    discovery_requests = discovery_requests + (case when p_request_type = 'discovery' then 1 else 0 end),
    prd_generations = prd_generations + (case when p_request_type = 'prd' then 1 else 0 end),
    regenerations = regenerations + (case when p_request_type = 'regeneration' then 1 else 0 end),
    updated_at = now()
  where id = usage_row.id;

  return jsonb_build_object('allowed', true, 'reservedTokens', v_reservation, 'limits', limits);
end;
$$;

revoke all on function check_and_reserve_ai_usage(uuid, text, uuid) from public, anon, authenticated;

-- ---------- finalize_ai_usage() ----------
-- Reconciles a reservation made by check_and_reserve_ai_usage() to the
-- real token count once the provider has actually answered — or releases
-- it in full (p_actual_tokens = 0) when the call failed and consumed
-- nothing. A single UPDATE on one row is already atomic; no explicit lock
-- is needed here the way it is above, because there is no conditional
-- decision being made, only an adjustment.
create or replace function finalize_ai_usage(
  p_user_id uuid,
  p_reserved_tokens integer,
  p_actual_tokens integer
) returns void
language sql
security definer
set search_path = public
as $$
  update user_usage
  set tokens_used = greatest(0, tokens_used + (p_actual_tokens - p_reserved_tokens)), updated_at = now()
  where user_id = p_user_id and period_start = date_trunc('month', now())::date;
$$;

revoke all on function finalize_ai_usage(uuid, integer, integer) from public, anon, authenticated;

-- ---------- get_my_usage() ----------
-- Backs the get-my-usage Edge Function. Deliberately separate from
-- admin_lookup_user_usage() below even though the shape overlaps: this
-- one is callable for "myself" only by construction (the Edge Function
-- passes the caller's own id, taken from their verified JWT, never a
-- client-supplied one), so it needs no admin gate — the caller cannot
-- point it at anyone else no matter what they send.
create or replace function get_my_usage(p_user_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  limits jsonb;
  usage_row user_usage;
  requests_today integer;
begin
  limits := effective_limits(p_user_id);

  select * into usage_row from user_usage
  where user_id = p_user_id and period_start = date_trunc('month', now())::date;

  -- attempt = 0 only: ai_events has one row per provider ATTEMPT, and a
  -- discovery/PRD call that fell through to a fallback provider produces
  -- more than one row for what was, from the user's side, a single
  -- request. attempt = 0 (chain.ts's primary candidate, always run —
  -- never skipped by the deadline check, since the full budget is always
  -- available for the first attempt) is the one row guaranteed to exist
  -- exactly once per logical request, success or failure alike.
  select count(*) into requests_today
  from ai_events
  where user_id = p_user_id and created_at >= date_trunc('day', now()) and attempt = 0;

  return jsonb_build_object(
    'tokensUsed', coalesce(usage_row.tokens_used, 0),
    'tokensLimit', (limits->>'tokensPerMonth')::integer,
    'requestsToday', requests_today,
    'dailyRequestLimit', (limits->>'requestsPerDay')::integer,
    'prdGenerationsUsed', coalesce(usage_row.prd_generations, 0),
    'prdGenerationsLimit', (limits->>'maxPrdGenerationsPerMonth')::integer
  );
end;
$$;

revoke all on function get_my_usage(uuid) from public, anon, authenticated;

-- ---------- admin_get_ai_limits() / admin_set_ai_limits() ----------
-- Same split as admin_project_limit_status/admin_set_project_limit: one
-- read path, one write path that validates then delegates to the read
-- path, so the dashboard always renders exactly what was just saved.
--
-- The usage breakdown counts each currently-tracked user (anyone with a
-- user_usage row this month) against their own EFFECTIVE limit — an
-- override changes which bucket a user falls in — and is deliberately
-- just three counts, no ids, no emails: the same "nothing identifying"
-- rule admin_analytics() already follows.
create or replace function admin_get_ai_limits() returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  g record;
  result jsonb;
begin
  select * into g from system_settings where id = true;

  with current_usage as (
    select
      u.user_id,
      u.tokens_used,
      coalesce((l.tokens_per_month), g.tokens_per_month) as effective_limit
    from user_usage u
    left join user_usage_limits l on l.user_id = u.user_id and l.enabled = true
    where u.period_start = date_trunc('month', now())::date
  )
  select jsonb_build_object(
    'tokensPerMonth', g.tokens_per_month,
    'requestsPerDay', g.requests_per_day,
    'maxPrdGenerationsPerMonth', g.max_prd_generations_per_month,
    'maxRegenerationsPerProject', g.max_regenerations_per_project,
    'maxTokensPerRequest', g.max_tokens_per_request,
    'updatedAt', g.updated_at,
    'usage', jsonb_build_object(
      'overLimit', (select count(*) from current_usage where tokens_used >= effective_limit),
      'nearLimit', (select count(*) from current_usage where tokens_used >= effective_limit * 0.8 and tokens_used < effective_limit),
      'healthy', (select count(*) from current_usage where tokens_used < effective_limit * 0.8),
      'totalTrackedUsers', (select count(*) from current_usage)
    )
  ) into result;

  return result;
end;
$$;

revoke all on function admin_get_ai_limits() from public, anon, authenticated;

create or replace function admin_set_ai_limits(
  p_tokens_per_month integer,
  p_requests_per_day integer,
  p_max_prd_generations_per_month integer,
  p_max_regenerations_per_project integer,
  p_max_tokens_per_request integer,
  p_admin_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if p_tokens_per_month is null or p_tokens_per_month < 1
    or p_requests_per_day is null or p_requests_per_day < 1
    or p_max_prd_generations_per_month is null or p_max_prd_generations_per_month < 1
    or p_max_regenerations_per_project is null or p_max_regenerations_per_project < 1
    or p_max_tokens_per_request is null or p_max_tokens_per_request < 1 then
    raise exception 'invalid_limit';
  end if;

  update system_settings set
    tokens_per_month = p_tokens_per_month,
    requests_per_day = p_requests_per_day,
    max_prd_generations_per_month = p_max_prd_generations_per_month,
    max_regenerations_per_project = p_max_regenerations_per_project,
    max_tokens_per_request = p_max_tokens_per_request,
    updated_at = now(),
    updated_by = p_admin_user_id
  where id = true;

  return admin_get_ai_limits();
end;
$$;

revoke all on function admin_set_ai_limits(integer, integer, integer, integer, integer, uuid) from public, anon, authenticated;

-- ---------- admin_lookup_user_usage() / admin_set_user_limits() / admin_reset_user_limits() ----------
-- The "separate, logged lookup by id" this dashboard's own Users page
-- already says is the right way to look at one person's data — by
-- email or id, on demand, never a standing browsable list. Returns
-- exactly one user's own usage, limits and last 20 AI calls; nothing
-- about any other user.
create or replace function admin_lookup_user_usage(p_query text) returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_email text;
  v_created_at timestamptz;
  v_limits jsonb;
  v_has_override boolean;
  v_usage user_usage;
  v_events jsonb;
begin
  if p_query ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select id, email, created_at into v_user_id, v_email, v_created_at from auth.users where id = p_query::uuid;
  else
    select id, email, created_at into v_user_id, v_email, v_created_at from auth.users where lower(email) = lower(trim(p_query));
  end if;

  if v_user_id is null then
    return jsonb_build_object('found', false);
  end if;

  v_limits := effective_limits(v_user_id);
  select exists(select 1 from user_usage_limits where user_id = v_user_id and enabled = true) into v_has_override;
  select * into v_usage from user_usage where user_id = v_user_id and period_start = date_trunc('month', now())::date;

  select coalesce(jsonb_agg(jsonb_build_object(
    'createdAt', ev.created_at, 'kind', ev.kind, 'provider', ev.provider, 'model', ev.model,
    'inputTokens', ev.input_tokens, 'outputTokens', ev.output_tokens, 'totalTokens', ev.total_tokens,
    'ok', ev.ok, 'fallback', ev.attempt > 0, 'errorCode', ev.error_code
  ) order by ev.created_at desc), '[]'::jsonb) into v_events
  from (select * from ai_events where user_id = v_user_id order by created_at desc limit 20) ev;

  return jsonb_build_object(
    'found', true,
    'userId', v_user_id,
    'email', v_email,
    'signedUpAt', v_created_at,
    'limits', v_limits,
    'hasOverride', v_has_override,
    'usage', jsonb_build_object(
      'tokensUsed', coalesce(v_usage.tokens_used, 0),
      'requestsUsed', coalesce(v_usage.requests_used, 0),
      'discoveryRequests', coalesce(v_usage.discovery_requests, 0),
      'prdGenerations', coalesce(v_usage.prd_generations, 0),
      'regenerations', coalesce(v_usage.regenerations, 0)
    ),
    'recentEvents', v_events
  );
end;
$$;

revoke all on function admin_lookup_user_usage(text) from public, anon, authenticated;

create or replace function admin_set_user_limits(
  p_user_id uuid,
  p_tokens_per_month integer,
  p_requests_per_day integer,
  p_max_projects_per_user integer,
  p_max_prd_generations_per_month integer,
  p_max_regenerations_per_project integer,
  p_max_tokens_per_request integer,
  p_admin_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into user_usage_limits (
    user_id, tokens_per_month, requests_per_day, max_projects_per_user,
    max_prd_generations_per_month, max_regenerations_per_project, max_tokens_per_request,
    enabled, updated_at, updated_by
  ) values (
    p_user_id, p_tokens_per_month, p_requests_per_day, p_max_projects_per_user,
    p_max_prd_generations_per_month, p_max_regenerations_per_project, p_max_tokens_per_request,
    true, now(), p_admin_user_id
  )
  on conflict (user_id) do update set
    tokens_per_month = excluded.tokens_per_month,
    requests_per_day = excluded.requests_per_day,
    max_projects_per_user = excluded.max_projects_per_user,
    max_prd_generations_per_month = excluded.max_prd_generations_per_month,
    max_regenerations_per_project = excluded.max_regenerations_per_project,
    max_tokens_per_request = excluded.max_tokens_per_request,
    enabled = true,
    updated_at = now(),
    updated_by = p_admin_user_id;

  return admin_lookup_user_usage(p_user_id::text);
end;
$$;

revoke all on function admin_set_user_limits(uuid, integer, integer, integer, integer, integer, integer, uuid) from public, anon, authenticated;

create or replace function admin_reset_user_limits(p_user_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  delete from user_usage_limits where user_id = p_user_id;
  return admin_lookup_user_usage(p_user_id::text);
end;
$$;

revoke all on function admin_reset_user_limits(uuid) from public, anon, authenticated;
