-- =============================================================================
-- Demo seed — mirrors lib/data/demo.ts and lib/studio/demo.ts so the app looks
-- the same whether it reads fixtures or D1.
--
-- Dates are relative to when this runs (datetime('now','-9 days')), not fixed,
-- so the natural-language layer keeps producing "last week" and "the 17th of
-- next month" rather than drifting into "8 months ago" after a while.
--
-- Idempotent: every insert is INSERT OR REPLACE / OR IGNORE, so re-running it
-- refreshes rather than erroring on primary keys.
-- =============================================================================

-- ---------- studio & people --------------------------------------------------
INSERT OR IGNORE INTO studios (id, name, slug) VALUES ('studio_griida', 'Griida', 'griida');

INSERT OR REPLACE INTO users (id, email, kind, studio_id, studio_role, full_name, first_name) VALUES
  ('u_chike',  'hellogriida@gmail.com', 'studio', 'studio_griida', 'super_admin', 'Chike Adebayo', 'Chike'),
  ('u_pat',    'pat@griida.com',        'studio', 'studio_griida', 'admin_pm',    'Pat Nwosu',     'Pat'),
  ('u_ada',    'ada@griida.com',        'studio', 'studio_griida', 'lead',        'Ada Okafor',    'Ada'),
  ('u_femi',   'femi@griida.com',       'studio', 'studio_griida', 'member',      'Femi Bello',    'Femi');

-- Client users carry no studio_id and no role — they reach a studio through
-- account_members, so one contact is never forced into two logins.
INSERT OR REPLACE INTO users (id, email, kind, full_name, first_name) VALUES
  ('u_tunde',  'tunde@ovishealth.com',  'client', 'Tunde Balogun', 'Tunde'),
  ('u_zainab', 'zainab@ovishealth.com', 'client', 'Zainab Yusuf',  'Zainab');

-- ---------- the client account ----------------------------------------------
INSERT OR REPLACE INTO client_accounts (id, studio_id, name, slug, contact_name, contact_email, created_at)
VALUES ('acc_ovis', 'studio_griida', 'Ovis Health', 'ovis-health', 'Tunde', 'tunde@ovishealth.com',
        datetime('now','-60 days'));

INSERT OR REPLACE INTO account_members (account_id, user_id, is_primary) VALUES
  ('acc_ovis', 'u_tunde', 1),
  ('acc_ovis', 'u_zainab', 0);

-- ---------- project types & SOP templates -----------------------------------
INSERT OR REPLACE INTO project_types (id, studio_id, name, slug, tags) VALUES
  ('pt_brand',   'studio_griida', 'Brand identity',     'brand-identity', '["dark-mode","multi-language"]'),
  ('pt_product', 'studio_griida', 'Product / UI design','product-ui',     '["dark-mode","multi-language"]'),
  ('pt_website', 'studio_griida', 'Website',            'website',        '["multi-language","ecommerce"]');

INSERT OR REPLACE INTO milestone_templates (id, project_type_id, name, position) VALUES
  ('mt_b1','pt_brand','Discovery',1), ('mt_b2','pt_brand','Moodboard',2),
  ('mt_b3','pt_brand','Concepts',3),  ('mt_b4','pt_brand','Refinement',4),
  ('mt_b5','pt_brand','Final assets',5),
  ('mt_p1','pt_product','Research',1), ('mt_p2','pt_product','Wireframes',2),
  ('mt_p3','pt_product','UI design',3),('mt_p4','pt_product','Prototype',4),
  ('mt_p5','pt_product','Handoff',5),
  ('mt_w1','pt_website','Kickoff',1), ('mt_w2','pt_website','Design',2),
  ('mt_w3','pt_website','Content',3), ('mt_w4','pt_website','Build',4),
  ('mt_w5','pt_website','Review',5),  ('mt_w6','pt_website','Launch',6);

INSERT OR REPLACE INTO deliverable_types (id, project_type_id, name, requires_considered_review) VALUES
  ('dt_moodboard','pt_brand','Direction & moodboard',0),
  ('dt_concepts','pt_brand','Logo concepts',1),
  ('dt_iconset','pt_brand','Icon set',0),
  ('dt_guidelines','pt_brand','Brand guidelines',1),
  ('dt_sitemap','pt_website','Sitemap',0),
  ('dt_pages','pt_website','Page designs',1),
  ('dt_built','pt_website','Built site',0);

INSERT OR REPLACE INTO checklist_templates (id, scope, deliverable_type_id, version, status, published_at, published_by)
VALUES ('ct_iconset_v2','deliverable','dt_iconset',2,'published', datetime('now','-90 days'), 'u_chike');

INSERT OR REPLACE INTO checklist_template_items
  (id, template_id, position, label, guidance, is_required, evidence_kind, expected_source, requires_countersign, is_final_deliverable, applies_when_tag) VALUES
  ('cti_1','ct_iconset_v2',1,'SVG set exported and optimised','Outline strokes, strip metadata, 24px artboard.',1,'link','Drive',0,1,NULL),
  ('cti_2','ct_iconset_v2',2,'PNG set @1x/2x/3x',NULL,1,'link','Drive',0,1,NULL),
  ('cti_3','ct_iconset_v2',3,'Consistent grid and stroke weight',NULL,1,'none',NULL,0,0,NULL),
  ('cti_4','ct_iconset_v2',4,'Named per convention','kebab-case, category prefix.',1,'none',NULL,0,0,NULL),
  ('cti_5','ct_iconset_v2',5,'Contrast checked','Against both surfaces. Self-certification isn’t enough here.',1,'text',NULL,1,0,NULL),
  ('cti_6','ct_iconset_v2',6,'Dark-mode variants',NULL,1,'link',NULL,0,0,'dark-mode'),
  ('cti_7','ct_iconset_v2',7,'Source file archived to the brand library',NULL,1,'link','Figma',0,0,NULL),
  ('cti_8','ct_iconset_v2',8,'Client sharing permissions verified','Nothing publishes with a link they can’t open.',1,'none',NULL,0,0,NULL);

-- ---------- links -------------------------------------------------------------
INSERT OR REPLACE INTO links (id, url, label, provider, account_id, added_by, best_on_desktop, client_access_ok, health, is_durable) VALUES
  ('lnk_bl1','https://drive.google.com/drive/folders/ovis-brand','Brand assets (master folder)','drive','acc_ovis','u_chike',0,1,'ok',1),
  ('lnk_bl2','https://www.figma.com/file/ovis-identity','Identity working file','figma','acc_ovis','u_chike',1,1,'ok',1),
  ('lnk_concepts','https://www.figma.com/proto/ovis-concepts','Three directions in Figma','figma',NULL,'u_chike',1,1,'ok',0),
  ('lnk_moodboard','https://www.figma.com/file/ovis-moodboard','Moodboard','figma',NULL,'u_chike',0,1,'ok',0),
  ('lnk_pages','https://www.figma.com/file/ovis-pages','All eleven pages','figma',NULL,'u_ada',1,1,'ok',0),
  ('lnk_icons','https://drive.google.com/drive/folders/ovis-icons','Icon set','drive',NULL,'u_femi',0,NULL,'unknown',0),
  ('lnk_icons_svg','https://drive.google.com/drive/folders/ovis-icons-svg','SVG exports','drive',NULL,'u_femi',0,NULL,'unknown',0),
  ('lnk_icons_png','https://drive.google.com/drive/folders/ovis-icons-png','PNG exports','drive',NULL,'u_femi',0,NULL,'unknown',0),
  ('lnk_sow','https://drive.google.com/file/ovis-sow','Statement of work','drive',NULL,'u_chike',0,1,'ok',1),
  ('lnk_proposal','https://drive.google.com/file/ovis-proposal','Proposal & scope','drive',NULL,'u_ada',0,1,'ok',1);

INSERT OR REPLACE INTO brand_library_items (id, account_id, link_id, category) VALUES
  ('bli_1','acc_ovis','lnk_bl1','logo'),
  ('bli_2','acc_ovis','lnk_bl2','source');

-- ---------- projects ----------------------------------------------------------
INSERT OR REPLACE INTO projects
  (id, account_id, project_type_id, name, slug, status, health, health_note, health_set_by, health_set_at,
   lead_id, applies_tags, rounds_included, target_end_on, last_published_at, created_at) VALUES
  ('prj_brand','acc_ovis','pt_brand','Brand Identity','brand-identity','active','blocked',
   'We’re holding until you pick a direction.','u_chike', datetime('now','-1 days'),
   'u_chike','["dark-mode"]',2, date('now','+40 days'), datetime('now','-9 days'), datetime('now','-45 days')),
  ('prj_site','acc_ovis','pt_website','Website','website','active','on_track',
   'Design’s done. We’re building.','u_ada', datetime('now','-2 days'),
   'u_ada','["multi-language"]',2, date('now','+56 days'), datetime('now','-2 days'), datetime('now','-40 days'));

INSERT OR REPLACE INTO project_client_roles (project_id, user_id, role) VALUES
  ('prj_brand','u_tunde','owner'), ('prj_brand','u_zainab','reviewer'),
  ('prj_site','u_tunde','owner');

INSERT OR REPLACE INTO project_team (project_id, user_id, is_lead) VALUES
  ('prj_brand','u_chike',1), ('prj_brand','u_ada',0), ('prj_brand','u_femi',0),
  ('prj_site','u_ada',1), ('prj_site','u_femi',0), ('prj_site','u_chike',0);

INSERT OR REPLACE INTO milestones (id, project_id, name, position, status, target_date, completed_at) VALUES
  ('ms_b1','prj_brand','Discovery',1,'complete', date('now','-30 days'), datetime('now','-28 days')),
  ('ms_b2','prj_brand','Moodboard',2,'complete', date('now','-18 days'), datetime('now','-17 days')),
  ('ms_b3','prj_brand','Concepts',3,'in_progress', date('now','+12 days'), NULL),
  ('ms_b4','prj_brand','Refinement',4,'not_started', date('now','+26 days'), NULL),
  ('ms_b5','prj_brand','Final assets',5,'not_started', date('now','+40 days'), NULL),
  ('ms_w1','prj_site','Kickoff',1,'complete', date('now','-40 days'), datetime('now','-40 days')),
  ('ms_w2','prj_site','Design',2,'complete', date('now','-12 days'), datetime('now','-10 days')),
  ('ms_w3','prj_site','Content',3,'in_progress', date('now','+10 days'), NULL),
  ('ms_w4','prj_site','Build',4,'in_progress', date('now','+30 days'), NULL),
  ('ms_w5','prj_site','Review',5,'not_started', date('now','+45 days'), NULL),
  ('ms_w6','prj_site','Launch',6,'not_started', date('now','+56 days'), NULL);

INSERT OR REPLACE INTO deliverables
  (id, project_id, milestone_id, deliverable_type_id, name, type_name, summary, status, state_changed_at,
   owner_id, current_round, requires_considered_review, created_at) VALUES
  ('dlv_concepts','prj_brand','ms_b3','dt_concepts','Three logo directions','Logo concepts',
   'Three genuinely different routes rather than three versions of one idea. We’ve a favourite, but we’d rather hear yours first.',
   'in_review', datetime('now','-9 days'),'u_chike',1,1, datetime('now','-14 days')),
  ('dlv_moodboard','prj_brand','ms_b2','dt_moodboard','Direction & moodboard','Moodboard', NULL,
   'approved', datetime('now','-17 days'),'u_chike',1,0, datetime('now','-24 days')),
  ('dlv_iconset','prj_brand','ms_b5','dt_iconset','Icon set','Icon set',
   'Not ready for the client yet — checklist still open.',
   'draft', datetime('now','-1 days'),'u_femi',1,0, datetime('now','-6 days')),
  ('dlv_pages','prj_site','ms_w2','dt_pages','Page designs','Page designs',
   'Your notes on the pricing page are in — we’re reworking that section now.',
   'changes_requested', datetime('now','-2 days'),'u_ada',2,1, datetime('now','-30 days')),
  ('dlv_staging','prj_site','ms_w4','dt_built','Staging site','Built site',
   'About half the pages are built. Nothing worth looking at yet — we’ll tell you when there is.',
   'draft', datetime('now','-2 days'),'u_femi',1,0, datetime('now','-20 days'));

INSERT OR REPLACE INTO deliverable_versions (id, deliverable_id, round, review_link_id, published_at, published_by) VALUES
  ('dv_concepts_1','dlv_concepts',1,'lnk_concepts', datetime('now','-9 days'),'u_chike'),
  ('dv_moodboard_1','dlv_moodboard',1,'lnk_moodboard', datetime('now','-17 days'),'u_chike'),
  ('dv_pages_1','dlv_pages',1,'lnk_pages', datetime('now','-12 days'),'u_ada'),
  ('dv_pages_2','dlv_pages',2,'lnk_pages', datetime('now','-2 days'),'u_ada'),
  ('dv_iconset_1','dlv_iconset',1,'lnk_icons', NULL, NULL);

INSERT OR REPLACE INTO reviews (id, version_id, round, decision, requested_at, decided_by, decided_at, decision_note) VALUES
  ('rev_moodboard','dv_moodboard_1',1,'approved', datetime('now','-19 days'),'u_tunde', datetime('now','-17 days'),
   'Love the warmth. Go.'),
  ('rev_pages_1','dv_pages_1',1,'changes_requested', datetime('now','-12 days'),'u_tunde', datetime('now','-4 days'),
   'Pricing page is doing too much.'),
  ('rev_concepts','dv_concepts_1',1,'pending', datetime('now','-9 days'), NULL, NULL, NULL);

INSERT OR REPLACE INTO feedback_comments (id, version_id, author_id, body, source, created_at) VALUES
  ('fb_1','dv_pages_1','u_tunde','The three-column pricing layout is doing too much. Can we try it simpler?','portal', datetime('now','-4 days'));

-- ---------- what the client owes us -------------------------------------------
INSERT OR REPLACE INTO client_actions (id, project_id, title, description, assigned_to, due_on, status, blocks_note, created_at) VALUES
  ('ca_1','prj_brand','Pick a direction from the three concepts',
   'You don’t need to love everything about one — just tell us which feels closest and we’ll take it from there.',
   'u_tunde', date('now','-2 days'),'open','refining the identity', datetime('now','-9 days')),
  ('ca_2','prj_site','Send us the team photos',
   'Headshots for the eight people on the About page. A Drive link is perfect — they don’t need to be edited.',
   'u_tunde', date('now','+6 days'),'open','building the About page', datetime('now','-3 days')),
  ('ca_3','prj_site','Confirm the pricing copy','Final wording for the three plan cards.',
   'u_tunde', date('now','+9 days'),'open', NULL, datetime('now','-1 days'));

-- ---------- published updates -------------------------------------------------
INSERT OR REPLACE INTO updates (id, project_id, body, health_at_publish, review_deliverable_id, status, published_by, published_at) VALUES
  ('upd_1','prj_brand',
   'Three directions are up and ready for you. They’re deliberately far apart — we’d rather find the right territory now than polish the wrong one later. Have a look when you get a proper moment at a desk, and tell us which one feels most like Ovis.',
   'blocked','dlv_concepts','published','u_chike', datetime('now','-9 days')),
  ('upd_2','prj_brand',
   'Moodboard’s signed off — thank you. We’re starting on concepts today and expect to have three routes with you by the end of next week.',
   'on_track', NULL,'published','u_chike', datetime('now','-17 days')),
  ('upd_3','prj_site',
   'Pricing page notes are in and they’re good ones — the three-column layout was doing too much. We’re reworking it and we’ll have it back to you this week. Everything else is signed off and building.',
   'on_track','dlv_pages','published','u_ada', datetime('now','-2 days'));

INSERT OR REPLACE INTO update_reads (update_id, user_id, first_read_at, last_read_at) VALUES
  ('upd_1','u_tunde', datetime('now','-8 days'), datetime('now','-6 days')),
  ('upd_3','u_tunde', datetime('now','-1 days'), datetime('now','-1 days'));

INSERT OR REPLACE INTO decisions (id, project_id, summary, decided_on, decided_by, recorded_by, is_client_visible) VALUES
  ('dec_1','prj_brand','Going warm and editorial rather than clinical — no blues, no crosses.', date('now','-17 days'),'Tunde','u_chike',1),
  ('dec_2','prj_brand','Wordmark first. A symbol only if it earns its place.', date('now','-24 days'),'Tunde and Chike','u_chike',1),
  ('dec_3','prj_site','Eleven pages at launch. The careers section waits for phase two.', date('now','-12 days'),'Tunde','u_ada',1);

INSERT OR REPLACE INTO project_documents (id, project_id, link_id, category, is_client_visible) VALUES
  ('pd_1','prj_brand','lnk_sow','sow',1),
  ('pd_2','prj_site','lnk_proposal','proposal',1);

-- ---------- internal work: tasks & blockers (§5a) -----------------------------
INSERT OR REPLACE INTO tasks (id, project_id, deliverable_id, title, responsible_id, status, due_on, state_changed_at, created_by) VALUES
  ('t_1','prj_brand', NULL,'Refine chosen direction','u_chike','blocked', date('now','+4 days'), datetime('now','-9 days'),'u_chike'),
  ('t_2','prj_brand', NULL,'Draft brand guidelines outline','u_ada','in_progress', date('now','+3 days'), datetime('now','-2 days'),'u_chike'),
  ('t_3','prj_brand','dlv_iconset','Prepare typography specimen','u_femi','blocked', date('now','+1 days'), datetime('now','-4 days'),'u_ada'),
  ('t_4','prj_site','dlv_pages','Rework pricing section','u_ada','in_progress', date('now','+2 days'), datetime('now','-1 days'),'u_ada'),
  ('t_5','prj_site', NULL,'Build About page','u_femi','blocked', date('now','+5 days'), datetime('now','-3 days'),'u_ada'),
  ('t_6','prj_site', NULL,'Set up staging deploy','u_femi','done', date('now','-4 days'), datetime('now','-4 days'),'u_ada'),
  ('t_7','prj_site', NULL,'Cross-browser pass','u_chike','todo', date('now','+11 days'), datetime('now','-1 days'),'u_ada');

INSERT OR REPLACE INTO task_blockers (id, task_id, kind, blocked_by_user, client_action_id, note, created_by, created_at) VALUES
  ('blk_1','t_1','client_action', NULL,'ca_1','Can’t refine until they choose','u_chike', datetime('now','-9 days')),
  ('blk_2','t_3','user','u_ada', NULL,'Waiting on the type licence decision','u_femi', datetime('now','-4 days')),
  ('blk_3','t_5','client_action', NULL,'ca_2','No team photos yet','u_femi', datetime('now','-3 days'));

-- ---------- the SOP checklist instance (§5b) ---------------------------------
INSERT OR REPLACE INTO checklists (id, scope, project_id, deliverable_id, template_name, source_template_id, source_version, created_at)
VALUES ('cl_iconset','deliverable','prj_brand','dlv_iconset','Icon set','ct_iconset_v2',2, datetime('now','-6 days'));

INSERT OR REPLACE INTO checklist_items
  (id, checklist_id, position, label, guidance, is_required, evidence_kind, expected_source,
   requires_countersign, is_final_deliverable, is_applicable, state, state_changed_at,
   checked_by, checked_at, countersigned_by, evidence_link_id, evidence_text) VALUES
  ('ci_1','cl_iconset',1,'SVG set exported and optimised','Outline strokes, strip metadata, 24px artboard.',1,'link','Drive',0,1,1,
   'checked', datetime('now','-1 days'),'u_femi', datetime('now','-1 days'), NULL,'lnk_icons_svg', NULL),
  ('ci_2','cl_iconset',2,'PNG set @1x/2x/3x',NULL,1,'link','Drive',0,1,1,
   'checked', datetime('now','-1 days'),'u_femi', datetime('now','-1 days'), NULL,'lnk_icons_png', NULL),
  ('ci_3','cl_iconset',3,'Consistent grid and stroke weight',NULL,1,'none',NULL,0,0,1,
   'checked', datetime('now','-1 days'),'u_femi', datetime('now','-1 days'), NULL, NULL, NULL),
  ('ci_4','cl_iconset',4,'Named per convention','kebab-case, category prefix.',1,'none',NULL,0,0,1,
   'open', datetime('now','-6 days'), NULL, NULL, NULL, NULL, NULL),
  ('ci_5','cl_iconset',5,'Contrast checked','Against both surfaces. Self-certification isn’t enough here.',1,'text',NULL,1,0,1,
   'checked', datetime('now','-1 days'),'u_femi', datetime('now','-1 days'), NULL, NULL,
   'Checked at 4.6:1 minimum on both paper and ink.'),
  -- Present because the project carries the dark-mode tag.
  ('ci_6','cl_iconset',6,'Dark-mode variants',NULL,1,'link',NULL,0,0,1,
   'open', datetime('now','-6 days'), NULL, NULL, NULL, NULL, NULL),
  ('ci_7','cl_iconset',7,'Source file archived to the brand library',NULL,1,'link','Figma',0,0,1,
   'open', datetime('now','-6 days'), NULL, NULL, NULL, NULL, NULL),
  ('ci_8','cl_iconset',8,'Client sharing permissions verified','Nothing publishes with a link they can’t open.',1,'none',NULL,0,0,1,
   'open', datetime('now','-6 days'), NULL, NULL, NULL, NULL, NULL);

-- The signed attestations behind those ticks. Append-only.
INSERT INTO checklist_item_events (item_id, kind, actor_id, occurred_at, evidence_link_id, evidence_text) VALUES
  ('ci_1','checked','u_femi', datetime('now','-1 days'),'lnk_icons_svg', NULL),
  ('ci_2','checked','u_femi', datetime('now','-1 days'),'lnk_icons_png', NULL),
  ('ci_3','checked','u_femi', datetime('now','-1 days'), NULL, NULL),
  ('ci_5','checked','u_femi', datetime('now','-1 days'), NULL,'Checked at 4.6:1 minimum on both paper and ink.');

-- ---------- activity spine ----------------------------------------------------
INSERT INTO activity_events (project_id, actor_id, kind, subject_kind, subject_id, visibility, occurred_at) VALUES
  ('prj_brand','u_chike','deliverable.in_review','deliverable','dlv_concepts','client', datetime('now','-9 days')),
  ('prj_brand','u_tunde','review.approved','deliverable','dlv_moodboard','client', datetime('now','-17 days')),
  ('prj_brand','u_femi','checklist.item_checked','checklist_item','ci_1','internal', datetime('now','-1 days')),
  ('prj_site','u_tunde','review.changes_requested','deliverable','dlv_pages','client', datetime('now','-4 days')),
  ('prj_site','u_femi','task.completed','task','t_6','internal', datetime('now','-4 days'));
