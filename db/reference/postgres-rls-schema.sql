-- =============================================================================
-- Phase 1 — the client lens
-- Implements the subset of Architecture-and-Schema.md §3 that the client-facing
-- screens read. The internal lens (tasks, checklists, SOP templates) lands in
-- migration 0002; nothing here depends on it.
--
-- The governing rule (§2.2): visibility is enforced by RLS, not by queries.
-- Internal tables get NO client policy — not a filtered one, none at all.
-- =============================================================================

-- ---------- enums ------------------------------------------------------------
create type user_kind          as enum ('studio', 'client');
create type studio_role        as enum ('super_admin', 'admin_pm', 'lead', 'member');
create type client_role        as enum ('owner', 'reviewer', 'viewer');
create type project_status     as enum ('draft', 'active', 'on_hold', 'done', 'archived');
create type health_status      as enum ('on_track', 'at_risk', 'blocked');
create type milestone_status   as enum ('not_started', 'in_progress', 'complete');
create type deliverable_status as enum ('draft', 'in_review', 'changes_requested', 'approved', 'delivered');
create type link_health        as enum ('unknown', 'ok', 'unreachable', 'forbidden');
create type update_status      as enum ('draft', 'published');
create type review_decision    as enum ('pending', 'approved', 'changes_requested');
create type client_action_status as enum ('open', 'submitted', 'accepted');
create type visibility         as enum ('internal', 'client');

-- ---------- tenancy ----------------------------------------------------------
-- Griida is the only studio today. This exists because adding a tenant column
-- to an empty database costs nothing, and retrofitting one onto a year of live
-- projects is a migration with downtime and a chance of cross-tenant leakage.
-- The door is left unlocked, not opened: nothing in the app reads studio_id
-- yet, and full tenant isolation is finished only if the product is ever sold.
create table studios (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  created_at timestamptz not null default now()
);

insert into studios (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'Griida', 'griida');

-- ---------- identity ---------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  kind        user_kind not null,
  -- Set for studio staff (their employer). Null for client users, who reach a
  -- studio through account_members instead — so one client contact is never
  -- forced into a second login to work with a second studio.
  studio_id   uuid references studios on delete restrict,
  studio_role studio_role,
  full_name   text not null,
  first_name  text,                       -- used for "Hello Tunde" (voice layer)
  avatar_url  text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint studio_users_have_a_role
    check ((kind = 'studio') = (studio_role is not null)),
  constraint studio_users_belong_to_a_studio
    check ((kind = 'studio') = (studio_id is not null))
);

create table client_accounts (
  id         uuid primary key default gen_random_uuid(),
  studio_id  uuid not null references studios on delete restrict
             default '00000000-0000-0000-0000-000000000001',
  name       text not null,
  slug       text not null,
  status     text not null default 'active',
  created_at timestamptz not null default now(),
  -- Slugs are unique per studio, not globally: two studios may both have a
  -- client called "Northwind".
  unique (studio_id, slug)
);
create index client_accounts_by_studio on client_accounts (studio_id);

create table account_members (
  account_id uuid not null references client_accounts on delete cascade,
  user_id    uuid not null references profiles on delete cascade,
  is_primary boolean not null default false,
  primary key (account_id, user_id)
);

-- ---------- links: the artifact substrate (§3c) ------------------------------
create table links (
  id                uuid primary key default gen_random_uuid(),
  url               text not null,
  label             text not null,
  provider          text not null default 'other'
                    check (provider in ('figma','drive','staging','loom','other')),
  account_id        uuid references client_accounts on delete cascade,
  added_by          uuid not null references profiles,
  is_durable        boolean not null default false,
  best_on_desktop   boolean not null default false,
  -- The one gate with no override: nothing publishes carrying a link the
  -- client cannot open (§5b).
  client_access_ok  boolean,
  access_checked_at timestamptz,
  health            link_health not null default 'unknown',
  last_checked_at   timestamptz,
  created_at        timestamptz not null default now()
);

create table link_checks (
  id          bigserial primary key,
  link_id     uuid not null references links on delete cascade,
  checked_at  timestamptz not null default now(),
  http_status int,
  result      link_health not null,
  note        text
);
create index link_checks_recent on link_checks (link_id, checked_at desc);

create table brand_library_items (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references client_accounts on delete cascade,
  link_id    uuid not null references links on delete cascade,
  category   text not null default 'other',
  notes      text,
  created_at timestamptz not null default now()
);

-- ---------- taxonomy ---------------------------------------------------------
create table project_types (
  id        uuid primary key default gen_random_uuid(),
  -- SOP templates are studio IP. They never cross a tenant boundary.
  studio_id uuid not null references studios on delete restrict
            default '00000000-0000-0000-0000-000000000001',
  name      text not null,
  slug      text not null,
  is_active boolean not null default true,
  unique (studio_id, slug)
);

create table milestone_templates (
  id              uuid primary key default gen_random_uuid(),
  project_type_id uuid not null references project_types on delete cascade,
  name            text not null,
  position        int not null,
  unique (project_type_id, position)
);

create table deliverable_types (
  id              uuid primary key default gen_random_uuid(),
  project_type_id uuid not null references project_types on delete cascade,
  name            text not null,
  -- §6b: high-stakes work has no approve button on a phone
  requires_considered_review boolean not null default false
);

-- ---------- projects ---------------------------------------------------------
create table projects (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references client_accounts on delete cascade,
  project_type_id uuid not null references project_types,
  name            text not null,
  slug            text not null,
  status          project_status not null default 'draft',
  health          health_status not null default 'on_track',
  health_note     text,
  health_set_by   uuid references profiles,
  health_set_at   timestamptz,
  applies_tags    text[] not null default '{}',
  rounds_included int not null default 2,
  starts_on       date,
  target_end_on   date,
  actual_end_on   date,
  created_at      timestamptz not null default now(),
  unique (account_id, slug)
);

create table project_client_roles (
  project_id uuid not null references projects on delete cascade,
  user_id    uuid not null references profiles on delete cascade,
  role       client_role not null,
  primary key (project_id, user_id)
);

create table project_team (
  project_id uuid not null references projects on delete cascade,
  user_id    uuid not null references profiles on delete cascade,
  is_lead    boolean not null default false,
  primary key (project_id, user_id)
);

create table milestones (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects on delete cascade,
  name             text not null,
  position         int not null,
  status           milestone_status not null default 'not_started',
  target_date      date,
  completed_at     timestamptz,
  state_changed_at timestamptz not null default now(),
  source_template_id uuid references milestone_templates,
  unique (project_id, position)
);

create table deliverables (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references projects on delete cascade,
  milestone_id        uuid references milestones on delete set null,
  deliverable_type_id uuid not null references deliverable_types,
  name                text not null,
  summary             text,
  status              deliverable_status not null default 'draft',
  state_changed_at    timestamptz not null default now(),   -- aging (§2.5)
  owner_id            uuid references profiles,
  current_round       int not null default 1,
  requires_considered_review boolean not null default false,
  created_at          timestamptz not null default now()
);

create table deliverable_versions (
  id             uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references deliverables on delete cascade,
  round          int not null,
  review_link_id uuid not null references links,
  summary        text,
  published_at   timestamptz,
  published_by   uuid references profiles,
  unique (deliverable_id, round)
);

-- ---------- client actions: "waiting on you" (§5A) ---------------------------
create table client_actions (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects on delete cascade,
  title          text not null,
  description    text,
  assigned_to    uuid references profiles,
  due_on         date,
  status         client_action_status not null default 'open',
  blocks_note    text,
  response_link_id uuid references links,
  response_text  text,
  created_at     timestamptz not null default now(),
  submitted_at   timestamptz,
  accepted_at    timestamptz,
  nudge_count    int not null default 0,
  last_nudged_at timestamptz
);

-- ---------- publishing, reviews, decisions -----------------------------------
create table activity_events (
  id           bigserial primary key,
  project_id   uuid not null references projects on delete cascade,
  actor_id     uuid references profiles,
  kind         text not null,
  subject_kind text,
  subject_id   uuid,
  payload      jsonb not null default '{}',
  visibility   visibility not null default 'internal',
  occurred_at  timestamptz not null default now()
);
create index activity_recent on activity_events (project_id, occurred_at desc);
create rule activity_events_no_update as on update to activity_events do instead nothing;
create rule activity_events_no_delete as on delete to activity_events do instead nothing;

create table updates (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references projects on delete cascade,
  body                  text not null,
  health_at_publish     health_status,
  review_deliverable_id uuid references deliverables,
  document_link_id      uuid references links,
  status                update_status not null default 'draft',
  drafted_at            timestamptz,
  published_by          uuid references profiles,
  published_at          timestamptz
);

create table update_reads (          -- "seen by" (§10.4) — studio eyes only
  update_id     uuid not null references updates on delete cascade,
  user_id       uuid not null references profiles on delete cascade,
  first_read_at timestamptz not null default now(),
  last_read_at  timestamptz not null default now(),
  primary key (update_id, user_id)
);

create table reviews (
  id            uuid primary key default gen_random_uuid(),
  version_id    uuid not null references deliverable_versions on delete cascade,
  round         int not null,
  decision      review_decision not null default 'pending',
  requested_at  timestamptz not null default now(),
  decided_by    uuid references profiles,
  decided_at    timestamptz,
  decision_note text
);

create table feedback_comments (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null references deliverable_versions on delete cascade,
  author_id   uuid not null references profiles,
  body        text not null,
  source      text not null default 'portal' check (source in ('portal','email')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles
);

create table decisions (             -- §10.1
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects on delete cascade,
  summary           text not null,
  decided_on        date not null,
  decided_by        text not null,
  deliverable_id    uuid references deliverables,
  recorded_by       uuid not null references profiles,
  is_client_visible boolean not null default true,
  created_at        timestamptz not null default now()
);

create table project_documents (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects on delete cascade,
  link_id           uuid not null references links on delete cascade,
  category          text not null default 'other',
  is_client_visible boolean not null default true,
  created_at        timestamptz not null default now()
);

-- =============================================================================
-- RLS
-- =============================================================================

/**
 * The studio the current user works for. Null for client users.
 * Used by the tenant predicates below; harmless while there is only one studio.
 */
create or replace function current_studio_id() returns uuid
language sql stable security definer set search_path = public as $$
  select studio_id from profiles where id = (select auth.uid());
$$;

create or replace function is_studio() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = (select auth.uid()) and kind = 'studio' and is_active
  );
$$;

create or replace function has_project_access(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_studio() or exists (
    select 1 from project_client_roles
    where project_id = p and user_id = (select auth.uid())
  );
$$;

create or replace function has_account_access(a uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_studio() or exists (
    select 1 from account_members
    where account_id = a and user_id = (select auth.uid())
  );
$$;

-- Enable RLS everywhere. Tables that get no policy below are studio-only by
-- construction: with RLS on and no permissive policy, a client selects nothing.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','client_accounts','account_members','links','link_checks',
    'brand_library_items','project_types','milestone_templates','deliverable_types',
    'projects','project_client_roles','project_team','milestones','deliverables',
    'deliverable_versions','client_actions','activity_events','updates',
    'update_reads','reviews','feedback_comments','decisions','project_documents'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy studio_all on %I for all to authenticated using (is_studio()) with check (is_studio())', t);
  end loop;
end $$;

alter table studios enable row level security;
create policy studio_read_own on studios for select to authenticated
  using (id = current_studio_id());

-- Tenant predicates on the three roots. Everything else reaches a studio
-- through these by foreign key, so scoping here is what makes the rest
-- scopeable later without touching data.
--
-- ⚠ THIS IS NOT YET A SECURITY BOUNDARY. Downstream tables (projects,
-- deliverables, tasks, checklists…) still grant any studio user access via the
-- unscoped `studio_all` policy above. With one studio that is correct and
-- simple. Before a second studio is ever onboarded, every one of those policies
-- must gain a tenant predicate and this warning must be deleted. Treat a second
-- row in `studios` as a release blocker until then.
drop policy studio_all on client_accounts;
create policy studio_all on client_accounts for all to authenticated
  using (is_studio() and studio_id = current_studio_id())
  with check (is_studio() and studio_id = current_studio_id());

drop policy studio_all on project_types;
create policy studio_all on project_types for all to authenticated
  using (is_studio() and studio_id = current_studio_id())
  with check (is_studio() and studio_id = current_studio_id());

drop policy studio_all on profiles;
create policy studio_all on profiles for all to authenticated
  using (is_studio() and (studio_id is null or studio_id = current_studio_id()))
  with check (is_studio());

-- ---- client-readable surface (§3b: timeline, updates, review action) --------

create policy client_read on projects for select to authenticated
  using (has_project_access(id));

create policy client_read on milestones for select to authenticated
  using (has_project_access(project_id));

-- Drafts are never client-visible; the gate in §5b decides when this flips.
create policy client_read on deliverables for select to authenticated
  using (status <> 'draft' and has_project_access(project_id));

create policy client_read on deliverable_versions for select to authenticated
  using (exists (
    select 1 from deliverables d
    where d.id = deliverable_id and d.status <> 'draft' and has_project_access(d.project_id)
  ));

create policy client_read on updates for select to authenticated
  using (status = 'published' and has_project_access(project_id));

create policy client_read on decisions for select to authenticated
  using (is_client_visible and has_project_access(project_id));

create policy client_read on project_documents for select to authenticated
  using (is_client_visible and has_project_access(project_id));

create policy client_read on client_actions for select to authenticated
  using (has_project_access(project_id));

create policy client_respond on client_actions for update to authenticated
  using (has_project_access(project_id))
  with check (has_project_access(project_id));

create policy client_read on brand_library_items for select to authenticated
  using (has_account_access(account_id));

create policy client_read on client_accounts for select to authenticated
  using (has_account_access(id));

create policy client_read on links for select to authenticated
  using (
    account_id is not null and has_account_access(account_id)
    or exists (select 1 from deliverable_versions v
               join deliverables d on d.id = v.deliverable_id
               where v.review_link_id = links.id
                 and d.status <> 'draft'
                 and has_project_access(d.project_id))
    or exists (select 1 from project_documents pd
               where pd.link_id = links.id and pd.is_client_visible
                 and has_project_access(pd.project_id))
  );

create policy client_read on reviews for select to authenticated
  using (exists (
    select 1 from deliverable_versions v join deliverables d on d.id = v.deliverable_id
    where v.id = version_id and has_project_access(d.project_id)
  ));

create policy client_decide on reviews for update to authenticated
  using (exists (
    select 1 from deliverable_versions v join deliverables d on d.id = v.deliverable_id
    where v.id = version_id and has_project_access(d.project_id)
  ));

create policy client_read on feedback_comments for select to authenticated
  using (exists (
    select 1 from deliverable_versions v join deliverables d on d.id = v.deliverable_id
    where v.id = version_id and has_project_access(d.project_id)
  ));

create policy client_write on feedback_comments for insert to authenticated
  with check (
    author_id = (select auth.uid()) and exists (
      select 1 from deliverable_versions v join deliverables d on d.id = v.deliverable_id
      where v.id = version_id and has_project_access(d.project_id)
    )
  );

create policy self_read on profiles for select to authenticated
  using (id = (select auth.uid()) or is_studio());

-- NOTE: project_team, activity_events, update_reads, link_checks,
-- milestone_templates, deliverable_types and project_types intentionally have
-- no client policy. That is the publish boundary (§2.2, §3b).

-- ---------- the gate (§5.2) --------------------------------------------------
create or replace function can_publish_deliverable(p_deliverable uuid)
returns table (ok boolean, blocking_reason text)
language sql stable set search_path = public as $$
  with link_ok as (
    select coalesce(bool_and(l.client_access_ok), false) as ok
    from deliverable_versions dv
    join links l on l.id = dv.review_link_id
    join deliverables d on d.id = dv.deliverable_id
    where dv.deliverable_id = p_deliverable and dv.round = d.current_round
  )
  select link_ok.ok,
         case when not link_ok.ok
           then 'The review link is not verified as viewable by this client'
         end
  from link_ok;
$$;

comment on function can_publish_deliverable is
  'Phase 1: verifies link access only. Migration 0002 adds the SOP checklist
   conditions (§5b). Checklist items may be waived with a reason; the link
   access check may not.';
