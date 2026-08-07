-- Two people pasting the same list, or one person double-clicking, doubled the
-- schedule: addScheduleItems reads the existing names and then writes, and D1
-- has no transactions to make that pair atomic. The database is the only place
-- that can actually settle it.
--
-- NOCASE because the dedupe read compares lowercased, and the two must agree —
-- otherwise "Homepage" and "homepage" pass the application check and then
-- collide here, turning a duplicate into an error.
CREATE UNIQUE INDEX deliverables_unique_name
  ON deliverables(project_id, name COLLATE NOCASE);
