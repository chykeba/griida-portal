-- =============================================================================
-- Phase 1 schema — Cloudflare D1 (SQLite)
--
-- Ported from db/reference/postgres-rls-schema.sql. Read that file first if you
-- want to understand the intended visibility model: it expresses the
-- client/internal boundary as Postgres RLS policies, which is how this was
-- originally designed.
--
-- ⚠ D1 HAS NO ROW-LEVEL SECURITY.
-- The publish boundary that Postgres enforced in the engine is now enforced in
-- application code — see lib/db/gateway.ts, which is the ONLY module permitted
-- to query this database on behalf of a client, and lib/db/gateway.test.ts,
-- which asserts client paths cannot reach internal tables. If you add a table
-- here, you must classify it in gateway.ts or the boundary test fails.
--
-- SQLite conventions used throughout:
--   ids         TEXT (uuid or readable slug-ish key)
--   timestamps  TEXT, ISO-8601 UTC
--   booleans    INTEGER 0/1
--   enums       TEXT + CHECK constraint
--   arrays/json TEXT holding JSON
-- =============================================================================

PRAGMA foreign_keys = ON;

-- ---------- tenancy ----------------------------------------------------------
-- Griida is the only studio. The column exists now because adding it to an
-- empty database is free and retrofitting it later is a downtime migration.
CREATE TABLE studios (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO studios (id, name, slug) VALUES ('studio_griida', 'Griida', 'griida');

-- ---------- identity ---------------------------------------------------------
-- Our own users table: D1 has no auth service, so sessions are ours to issue.
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  kind          TEXT NOT NULL CHECK (kind IN ('studio', 'client')),
  studio_id     TEXT REFERENCES studios(id),
  studio_role   TEXT CHECK (studio_role IN ('super_admin','admin_pm','lead','member')),
  full_name     TEXT NOT NULL,
  first_name    TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  -- Studio users have a role and a studio; client users have neither.
  CHECK ((kind = 'studio') = (studio_role IS NOT NULL)),
  CHECK ((kind = 'studio') = (studio_id IS NOT NULL))
);
CREATE INDEX users_by_email ON users(email);

-- Single-use magic links. No passwords anywhere in this product (§6b).
CREATE TABLE auth_tokens (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX auth_tokens_by_user ON auth_tokens(user_id);

CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX sessions_by_user ON sessions(user_id);

-- ---------- clients ----------------------------------------------------------
CREATE TABLE client_accounts (
  id            TEXT PRIMARY KEY,
  studio_id     TEXT NOT NULL REFERENCES studios(id),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL,
  contact_name  TEXT,
  contact_email TEXT,
  status        TEXT NOT NULL DEFAULT 'active',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (studio_id, slug)
);

CREATE TABLE account_members (
  account_id TEXT NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  PRIMARY KEY (account_id, user_id)
);

-- ---------- links: the artifact substrate (no file storage, §3c) ------------
CREATE TABLE links (
  id                TEXT PRIMARY KEY,
  url               TEXT NOT NULL,
  label             TEXT NOT NULL,
  provider          TEXT NOT NULL DEFAULT 'other'
                    CHECK (provider IN ('figma','drive','staging','loom','other')),
  account_id        TEXT REFERENCES client_accounts(id) ON DELETE CASCADE,
  added_by          TEXT REFERENCES users(id),
  is_durable        INTEGER NOT NULL DEFAULT 0 CHECK (is_durable IN (0,1)),
  best_on_desktop   INTEGER NOT NULL DEFAULT 0 CHECK (best_on_desktop IN (0,1)),
  -- NULL = never checked. The one gate with no override (§5b).
  client_access_ok  INTEGER CHECK (client_access_ok IN (0,1)),
  access_checked_at TEXT,
  health            TEXT NOT NULL DEFAULT 'unknown'
                    CHECK (health IN ('unknown','ok','unreachable','forbidden')),
  last_checked_at   TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE link_checks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id     TEXT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  checked_at  TEXT NOT NULL DEFAULT (datetime('now')),
  http_status INTEGER,
  result      TEXT NOT NULL CHECK (result IN ('unknown','ok','unreachable','forbidden')),
  note        TEXT
);
CREATE INDEX link_checks_recent ON link_checks(link_id, checked_at DESC);

CREATE TABLE brand_library_items (
  id         TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  link_id    TEXT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  category   TEXT NOT NULL DEFAULT 'other',
  notes      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- taxonomy & SOP templates (super admin only) ----------------------
CREATE TABLE project_types (
  id        TEXT PRIMARY KEY,
  studio_id TEXT NOT NULL REFERENCES studios(id),
  name      TEXT NOT NULL,
  slug      TEXT NOT NULL,
  tags      TEXT NOT NULL DEFAULT '[]',   -- JSON array of scope tags
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  UNIQUE (studio_id, slug)
);

CREATE TABLE milestone_templates (
  id              TEXT PRIMARY KEY,
  project_type_id TEXT NOT NULL REFERENCES project_types(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  position        INTEGER NOT NULL,
  UNIQUE (project_type_id, position)
);

CREATE TABLE deliverable_types (
  id              TEXT PRIMARY KEY,
  project_type_id TEXT NOT NULL REFERENCES project_types(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  requires_considered_review INTEGER NOT NULL DEFAULT 0
                             CHECK (requires_considered_review IN (0,1))
);

CREATE TABLE checklist_templates (
  id                  TEXT PRIMARY KEY,
  scope               TEXT NOT NULL CHECK (scope IN ('deliverable','project_closeout')),
  deliverable_type_id TEXT REFERENCES deliverable_types(id) ON DELETE CASCADE,
  project_type_id     TEXT REFERENCES project_types(id) ON DELETE CASCADE,
  version             INTEGER NOT NULL,
  status              TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','published','archived')),
  published_at        TEXT,
  published_by        TEXT REFERENCES users(id),
  CHECK (
    (scope = 'deliverable'      AND deliverable_type_id IS NOT NULL AND project_type_id IS NULL) OR
    (scope = 'project_closeout' AND project_type_id IS NOT NULL AND deliverable_type_id IS NULL)
  )
);
-- SQLite treats NULLs as distinct in UNIQUE, so a plain composite unique would
-- let duplicates through. coalesce() closes that.
CREATE UNIQUE INDEX checklist_templates_version
  ON checklist_templates(scope, coalesce(deliverable_type_id,''), coalesce(project_type_id,''), version);

CREATE TABLE checklist_template_items (
  id                   TEXT PRIMARY KEY,
  template_id          TEXT NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  position             INTEGER NOT NULL,
  label                TEXT NOT NULL,
  guidance             TEXT,
  is_required          INTEGER NOT NULL DEFAULT 1 CHECK (is_required IN (0,1)),
  evidence_kind        TEXT NOT NULL DEFAULT 'none'
                       CHECK (evidence_kind IN ('none','link','text')),
  expected_source      TEXT,
  requires_countersign INTEGER NOT NULL DEFAULT 0 CHECK (requires_countersign IN (0,1)),
  is_final_deliverable INTEGER NOT NULL DEFAULT 0 CHECK (is_final_deliverable IN (0,1)),
  applies_when_tag     TEXT,
  UNIQUE (template_id, position)
);

-- ---------- projects ---------------------------------------------------------
CREATE TABLE projects (
  id              TEXT PRIMARY KEY,
  account_id      TEXT NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  project_type_id TEXT NOT NULL REFERENCES project_types(id),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','active','on_hold','done','archived')),
  health          TEXT NOT NULL DEFAULT 'on_track'
                  CHECK (health IN ('on_track','at_risk','blocked')),
  health_note     TEXT,
  health_set_by   TEXT REFERENCES users(id),
  health_set_at   TEXT,
  lead_id         TEXT REFERENCES users(id),
  applies_tags    TEXT NOT NULL DEFAULT '[]',   -- JSON array
  rounds_included INTEGER NOT NULL DEFAULT 2,
  starts_on       TEXT,
  target_end_on   TEXT,
  actual_end_on   TEXT,
  last_published_at TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, slug)
);
CREATE INDEX projects_by_account ON projects(account_id);

CREATE TABLE project_client_roles (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('owner','reviewer','viewer')),
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE project_team (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_lead    INTEGER NOT NULL DEFAULT 0 CHECK (is_lead IN (0,1)),
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE milestones (
  id                 TEXT PRIMARY KEY,
  project_id         TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  position           INTEGER NOT NULL,
  status             TEXT NOT NULL DEFAULT 'not_started'
                     CHECK (status IN ('not_started','in_progress','complete')),
  target_date        TEXT,
  completed_at       TEXT,
  state_changed_at   TEXT NOT NULL DEFAULT (datetime('now')),
  source_template_id TEXT REFERENCES milestone_templates(id),
  UNIQUE (project_id, position)
);

CREATE TABLE deliverables (
  id                  TEXT PRIMARY KEY,
  project_id          TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id        TEXT REFERENCES milestones(id) ON DELETE SET NULL,
  deliverable_type_id TEXT REFERENCES deliverable_types(id),
  name                TEXT NOT NULL,
  type_name           TEXT NOT NULL,
  summary             TEXT,
  status              TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','in_review','changes_requested','approved','delivered')),
  state_changed_at    TEXT NOT NULL DEFAULT (datetime('now')),
  owner_id            TEXT REFERENCES users(id),
  current_round       INTEGER NOT NULL DEFAULT 1,
  requires_considered_review INTEGER NOT NULL DEFAULT 0
                             CHECK (requires_considered_review IN (0,1)),
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX deliverables_by_project ON deliverables(project_id);

CREATE TABLE deliverable_versions (
  id             TEXT PRIMARY KEY,
  deliverable_id TEXT NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  round          INTEGER NOT NULL,
  review_link_id TEXT REFERENCES links(id),
  summary        TEXT,
  published_at   TEXT,
  published_by   TEXT REFERENCES users(id),
  UNIQUE (deliverable_id, round)
);

-- ---------- checklist instances & the signed event log (§5b) ----------------
CREATE TABLE checklists (
  id                 TEXT PRIMARY KEY,
  scope              TEXT NOT NULL CHECK (scope IN ('deliverable','project_closeout')),
  project_id         TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  deliverable_id     TEXT REFERENCES deliverables(id) ON DELETE CASCADE,
  template_name      TEXT NOT NULL,
  source_template_id TEXT REFERENCES checklist_templates(id),
  source_version     INTEGER NOT NULL,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((scope = 'deliverable') = (deliverable_id IS NOT NULL))
);

CREATE TABLE checklist_items (
  id                   TEXT PRIMARY KEY,
  checklist_id         TEXT NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  position             INTEGER NOT NULL,
  -- Copied at instantiation. Never joined back to the template (§2.4).
  label                TEXT NOT NULL,
  guidance             TEXT,
  is_required          INTEGER NOT NULL CHECK (is_required IN (0,1)),
  evidence_kind        TEXT NOT NULL CHECK (evidence_kind IN ('none','link','text')),
  expected_source      TEXT,
  requires_countersign INTEGER NOT NULL CHECK (requires_countersign IN (0,1)),
  is_final_deliverable INTEGER NOT NULL CHECK (is_final_deliverable IN (0,1)),
  is_applicable        INTEGER NOT NULL DEFAULT 1 CHECK (is_applicable IN (0,1)),
  -- Projection of the event log below, maintained by trigger. Never written
  -- directly by application code.
  state                TEXT NOT NULL DEFAULT 'open'
                       CHECK (state IN ('open','checked','countersigned','waived')),
  state_changed_at     TEXT NOT NULL DEFAULT (datetime('now')),
  checked_by           TEXT REFERENCES users(id),
  checked_at           TEXT,
  countersigned_by     TEXT REFERENCES users(id),
  evidence_link_id     TEXT REFERENCES links(id),
  evidence_text        TEXT,
  waived_reason        TEXT,
  UNIQUE (checklist_id, position)
);

-- APPEND ONLY. This is the audit trail (§2.3). The triggers below make that
-- structural rather than a convention people are asked to honour.
CREATE TABLE checklist_item_events (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id          TEXT NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL CHECK (kind IN
                   ('checked','unchecked','countersigned','countersign_revoked','waived','evidence_updated')),
  actor_id         TEXT NOT NULL REFERENCES users(id),
  occurred_at      TEXT NOT NULL DEFAULT (datetime('now')),
  evidence_link_id TEXT REFERENCES links(id),
  evidence_text    TEXT,
  reason           TEXT
);
CREATE INDEX checklist_item_events_by_item ON checklist_item_events(item_id, occurred_at DESC);

CREATE TRIGGER checklist_item_events_no_update
BEFORE UPDATE ON checklist_item_events
BEGIN
  SELECT RAISE(ABORT, 'checklist_item_events is append-only');
END;

CREATE TRIGGER checklist_item_events_no_delete
BEFORE DELETE ON checklist_item_events
BEGIN
  SELECT RAISE(ABORT, 'checklist_item_events is append-only');
END;

-- ---------- work, tagging & blockers (§5a) ----------------------------------
CREATE TABLE tasks (
  id               TEXT PRIMARY KEY,
  project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id     TEXT REFERENCES milestones(id) ON DELETE SET NULL,
  deliverable_id   TEXT REFERENCES deliverables(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  notes            TEXT,
  -- Exactly one person, never a team.
  responsible_id   TEXT REFERENCES users(id),
  status           TEXT NOT NULL DEFAULT 'todo'
                   CHECK (status IN ('todo','in_progress','blocked','done')),
  state_changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  due_on           TEXT,
  created_by       TEXT REFERENCES users(id),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at     TEXT
);
CREATE INDEX tasks_by_project ON tasks(project_id);
CREATE INDEX tasks_by_responsible ON tasks(responsible_id) WHERE status != 'done';

CREATE TABLE task_blockers (
  id               TEXT PRIMARY KEY,
  task_id          TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL CHECK (kind IN ('user','task','client_action')),
  blocked_by_user  TEXT REFERENCES users(id),
  blocked_by_task  TEXT REFERENCES tasks(id),
  client_action_id TEXT,
  note             TEXT,
  created_by       TEXT REFERENCES users(id),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at      TEXT,
  CHECK (
    (blocked_by_user IS NOT NULL) + (blocked_by_task IS NOT NULL) + (client_action_id IS NOT NULL) = 1
  )
);
-- Makes "Blocking others" a single fast lookup — the screen nobody builds.
CREATE INDEX task_blockers_blocking ON task_blockers(blocked_by_user) WHERE resolved_at IS NULL;

-- ---------- client actions: "waiting on you" (§5A) --------------------------
CREATE TABLE client_actions (
  id               TEXT PRIMARY KEY,
  project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  assigned_to      TEXT REFERENCES users(id),
  due_on           TEXT,
  status           TEXT NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open','submitted','accepted')),
  blocks_note      TEXT,
  response_link_id TEXT REFERENCES links(id),
  response_text    TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  submitted_at     TEXT,
  accepted_at      TEXT,
  nudge_count      INTEGER NOT NULL DEFAULT 0,
  last_nudged_at   TEXT
);
CREATE INDEX client_actions_open ON client_actions(project_id) WHERE status = 'open';

-- ---------- publishing, reviews, decisions ----------------------------------
CREATE TABLE activity_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  actor_id     TEXT REFERENCES users(id),
  kind         TEXT NOT NULL,
  subject_kind TEXT,
  subject_id   TEXT,
  payload      TEXT NOT NULL DEFAULT '{}',
  visibility   TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal','client')),
  occurred_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX activity_recent ON activity_events(project_id, occurred_at DESC);

CREATE TRIGGER activity_events_no_update
BEFORE UPDATE ON activity_events
BEGIN
  SELECT RAISE(ABORT, 'activity_events is append-only');
END;

CREATE TABLE updates (
  id                    TEXT PRIMARY KEY,
  project_id            TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  body                  TEXT NOT NULL,
  health_at_publish     TEXT CHECK (health_at_publish IN ('on_track','at_risk','blocked')),
  review_deliverable_id TEXT REFERENCES deliverables(id),
  document_link_id      TEXT REFERENCES links(id),
  status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  drafted_at            TEXT,
  published_by          TEXT REFERENCES users(id),
  published_at          TEXT
);
CREATE INDEX updates_published ON updates(project_id, published_at DESC) WHERE status = 'published';

CREATE TABLE update_reads (
  update_id     TEXT NOT NULL REFERENCES updates(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_read_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_read_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (update_id, user_id)
);

CREATE TABLE reviews (
  id            TEXT PRIMARY KEY,
  version_id    TEXT NOT NULL REFERENCES deliverable_versions(id) ON DELETE CASCADE,
  round         INTEGER NOT NULL,
  decision      TEXT NOT NULL DEFAULT 'pending'
                CHECK (decision IN ('pending','approved','changes_requested')),
  requested_at  TEXT NOT NULL DEFAULT (datetime('now')),
  decided_by    TEXT REFERENCES users(id),
  decided_at    TEXT,
  decision_note TEXT
);

CREATE TABLE feedback_comments (
  id          TEXT PRIMARY KEY,
  version_id  TEXT NOT NULL REFERENCES deliverable_versions(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'portal' CHECK (source IN ('portal','email')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  resolved_by TEXT REFERENCES users(id)
);

CREATE TABLE revision_requests (
  id             TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  deliverable_id TEXT REFERENCES deliverables(id),
  description    TEXT NOT NULL,
  cost_amount    REAL,
  currency       TEXT DEFAULT 'NGN',
  status         TEXT NOT NULL DEFAULT 'proposed'
                 CHECK (status IN ('proposed','accepted','declined')),
  accepted_by    TEXT REFERENCES users(id),
  accepted_at    TEXT
);

-- Ends the "I thought we agreed…" conversation (§10.1).
CREATE TABLE decisions (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  summary           TEXT NOT NULL,
  decided_on        TEXT NOT NULL,
  decided_by        TEXT NOT NULL,     -- free text: may be a client with no login
  deliverable_id    TEXT REFERENCES deliverables(id),
  recorded_by       TEXT REFERENCES users(id),
  is_client_visible INTEGER NOT NULL DEFAULT 1 CHECK (is_client_visible IN (0,1)),
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE project_documents (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  link_id           TEXT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  category          TEXT NOT NULL DEFAULT 'other',
  is_client_visible INTEGER NOT NULL DEFAULT 1 CHECK (is_client_visible IN (0,1)),
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  deep_link   TEXT NOT NULL,
  entity_kind TEXT,
  entity_id   TEXT,
  read_at     TEXT,
  emailed_at  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX notifications_unread ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;
