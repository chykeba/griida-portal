-- HSF Website Redesign — the page schedule, transcribed from the studio's
-- working spreadsheet.
--
-- Fixed ids so this is replayable: running it twice updates in place rather
-- than doubling the schedule.
--
-- Three corrections made deliberately, since these names are client-facing:
--   "Admisssion" -> "Admission"
--   "Tution"     -> "Tuition"
--   "8/30/20206" -> 2026-08-30
-- "About Hust" is left exactly as written — it may be the institution's name.
--
-- The project's three template deliverables (Sitemap, Page designs, Built
-- site) are intentionally left undated, which keeps them internal. The client
-- sees these twenty rows and nothing else.

INSERT OR REPLACE INTO deliverables
  (id, project_id, deliverable_type_id, name, type_name, status, current_round, due_on)
VALUES
  ('dlv_hsf_01','prj_hsf-website-redesign_5AvtEg',NULL,'Homepage','Page design','draft',1,'2026-08-06'),
  ('dlv_hsf_02','prj_hsf-website-redesign_5AvtEg',NULL,'Header & Footer','Page design','draft',1,'2026-08-06'),
  ('dlv_hsf_03','prj_hsf-website-redesign_5AvtEg',NULL,'About Hust','Page design','draft',1,'2026-08-08'),
  ('dlv_hsf_04','prj_hsf-website-redesign_5AvtEg',NULL,'Academics','Page design','draft',1,'2026-08-10'),
  ('dlv_hsf_05','prj_hsf-website-redesign_5AvtEg',NULL,'Admission','Page design','draft',1,'2026-08-12'),
  ('dlv_hsf_06','prj_hsf-website-redesign_5AvtEg',NULL,'Tuition','Page design','draft',1,'2026-08-14'),
  ('dlv_hsf_07','prj_hsf-website-redesign_5AvtEg',NULL,'Research','Page design','draft',1,'2026-08-16'),
  ('dlv_hsf_08','prj_hsf-website-redesign_5AvtEg',NULL,'Blog','Page design','draft',1,'2026-08-18'),
  ('dlv_hsf_09','prj_hsf-website-redesign_5AvtEg',NULL,'Founder’s Message','Page design','draft',1,'2026-08-19'),
  ('dlv_hsf_10','prj_hsf-website-redesign_5AvtEg',NULL,'Student Life','Page design','draft',1,'2026-08-20'),
  ('dlv_hsf_11','prj_hsf-website-redesign_5AvtEg',NULL,'Contact Us','Page design','draft',1,'2026-08-21'),
  ('dlv_hsf_12','prj_hsf-website-redesign_5AvtEg',NULL,'Medicine & Health','Page design','draft',1,'2026-08-22'),
  ('dlv_hsf_13','prj_hsf-website-redesign_5AvtEg',NULL,'Engineering & Computing','Page design','draft',1,'2026-08-23'),
  ('dlv_hsf_14','prj_hsf-website-redesign_5AvtEg',NULL,'Agriculture & Life Sciences','Page design','draft',1,'2026-08-24'),
  ('dlv_hsf_15','prj_hsf-website-redesign_5AvtEg',NULL,'Business, Law & Education','Page design','draft',1,'2026-08-25'),
  ('dlv_hsf_16','prj_hsf-website-redesign_5AvtEg',NULL,'Programmes','Page design','draft',1,'2026-08-26'),
  ('dlv_hsf_17','prj_hsf-website-redesign_5AvtEg',NULL,'Academic Calendar','Page design','draft',1,'2026-08-27'),
  ('dlv_hsf_18','prj_hsf-website-redesign_5AvtEg',NULL,'Centre for Innovation (CRI)','Page design','draft',1,'2026-08-28'),
  ('dlv_hsf_19','prj_hsf-website-redesign_5AvtEg',NULL,'Intelligence Studies (CISS)','Page design','draft',1,'2026-08-29'),
  ('dlv_hsf_20','prj_hsf-website-redesign_5AvtEg',NULL,'Apply Now','Page design','draft',1,'2026-08-30');
