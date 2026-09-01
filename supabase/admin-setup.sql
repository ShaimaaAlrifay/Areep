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
