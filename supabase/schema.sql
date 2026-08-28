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
