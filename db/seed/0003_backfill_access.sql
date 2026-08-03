-- Repair: the demo client memberships never landed in production.
--
-- `account_members` and `project_client_roles` were both empty on the live D1
-- while every other seeded table was populated, so the seed ran before these
-- statements existed. The effect is total: every client query scopes through
-- project_client_roles, so with it empty no client could see any project, and
-- /p/<slug> returned "We can’t find that page" to everyone.
--
-- Identical to the statements in 0001_demo.sql, replayable, and safe to run
-- more than once.

INSERT OR REPLACE INTO account_members (account_id, user_id, is_primary) VALUES
  ('acc_ovis', 'u_tunde', 1),
  ('acc_ovis', 'u_zainab', 0);

INSERT OR REPLACE INTO project_client_roles (project_id, user_id, role) VALUES
  ('prj_brand','u_tunde','owner'),
  ('prj_brand','u_zainab','reviewer'),
  ('prj_site','u_tunde','owner');
