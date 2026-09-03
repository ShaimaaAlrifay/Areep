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
