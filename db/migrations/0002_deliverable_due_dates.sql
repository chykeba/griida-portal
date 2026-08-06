-- Per-deliverable due dates, and the schedule they make possible.
--
-- Until now a client could see a date on the project and a date on each stage,
-- but nothing on the individual pieces of work. The studio's real client
-- artifact — the one this replaces — is a page-by-page schedule: one row per
-- deliverable, its own date, ordered by when it lands. There was nothing to
-- sort by.
--
-- `due_on` doubles as the signal that a deliverable has been *planned*. A
-- draft with no date is someone's scratch row and stays internal; giving it a
-- date is the act of putting it on the client's schedule. That's what makes
-- "Not started, due the 12th" — the most common row in the sheet this replaces
-- — expressible at all, without exposing drafts nobody has thought about yet.

ALTER TABLE deliverables ADD COLUMN due_on TEXT;

-- The schedule reads project-wide, ordered by date.
CREATE INDEX deliverables_by_due ON deliverables(project_id, due_on);
