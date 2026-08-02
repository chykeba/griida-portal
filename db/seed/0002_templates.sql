-- =============================================================================
-- The rest of the SOP template library.
--
-- 0001 seeded only the Icon set checklist, which was enough to demonstrate the
-- mechanism but meant creating any other project produced deliverables with no
-- standard attached. These are the templates from lib/studio/templates.ts,
-- moved into the database where they belong — D1 is the source of truth now,
-- and the TypeScript copy is only a fallback for demo mode.
--
-- Idempotent. Re-run freely.
-- =============================================================================

-- Product / UI design had no deliverable types at all.
INSERT OR REPLACE INTO deliverable_types (id, project_type_id, name, requires_considered_review) VALUES
  ('dt_wireframes','pt_product','Wireframe set',0),
  ('dt_screens','pt_product','UI screens',1),
  ('dt_prototype','pt_product','Prototype',0),
  ('dt_handoff','pt_product','Dev handoff',0);

-- ---------- checklist templates ---------------------------------------------
INSERT OR REPLACE INTO checklist_templates (id, scope, deliverable_type_id, version, status, published_at, published_by) VALUES
  ('ct_moodboard_v1','deliverable','dt_moodboard',1,'published', datetime('now','-90 days'),'u_chike'),
  ('ct_concepts_v3','deliverable','dt_concepts',3,'published', datetime('now','-90 days'),'u_chike'),
  ('ct_guidelines_v1','deliverable','dt_guidelines',1,'published', datetime('now','-90 days'),'u_chike'),
  ('ct_screens_v2','deliverable','dt_screens',2,'published', datetime('now','-90 days'),'u_chike'),
  ('ct_handoff_v1','deliverable','dt_handoff',1,'published', datetime('now','-90 days'),'u_chike'),
  ('ct_built_v4','deliverable','dt_built',4,'published', datetime('now','-90 days'),'u_chike');

-- Moodboard
INSERT OR REPLACE INTO checklist_template_items
  (id, template_id, position, label, guidance, is_required, evidence_kind, expected_source, requires_countersign, is_final_deliverable, applies_when_tag) VALUES
  ('cti_mb1','ct_moodboard_v1',1,'Three distinct territories, not three versions of one',NULL,1,'none',NULL,0,0,NULL),
  ('cti_mb2','ct_moodboard_v1',2,'References credited and licensed',NULL,1,'none',NULL,0,0,NULL),
  ('cti_mb3','ct_moodboard_v1',3,'Source file archived to the brand library',NULL,1,'link','Figma',0,0,NULL),
  ('cti_mb4','ct_moodboard_v1',4,'Client sharing permissions verified','Nothing publishes with a link they can’t open.',1,'none',NULL,0,0,NULL);

-- Logo concepts
INSERT OR REPLACE INTO checklist_template_items
  (id, template_id, position, label, guidance, is_required, evidence_kind, expected_source, requires_countersign, is_final_deliverable, applies_when_tag) VALUES
  ('cti_lc1','ct_concepts_v3',1,'Works at 24px and at poster size',NULL,1,'none',NULL,0,0,NULL),
  ('cti_lc2','ct_concepts_v3',2,'Monochrome version holds up',NULL,1,'none',NULL,1,0,NULL),
  ('cti_lc3','ct_concepts_v3',3,'No unlicensed type in the wordmark',NULL,1,'none',NULL,1,0,NULL),
  ('cti_lc4','ct_concepts_v3',4,'Dark-surface variant',NULL,1,'link',NULL,0,0,'dark-mode'),
  ('cti_lc5','ct_concepts_v3',5,'Source file archived to the brand library',NULL,1,'link','Figma',0,0,NULL),
  ('cti_lc6','ct_concepts_v3',6,'Client sharing permissions verified','Nothing publishes with a link they can’t open.',1,'none',NULL,0,0,NULL);

-- Brand guidelines
INSERT OR REPLACE INTO checklist_template_items
  (id, template_id, position, label, guidance, is_required, evidence_kind, expected_source, requires_countersign, is_final_deliverable, applies_when_tag) VALUES
  ('cti_bg1','ct_guidelines_v1',1,'Covers logo, type, colour, spacing, misuse',NULL,1,'none',NULL,0,0,NULL),
  ('cti_bg2','ct_guidelines_v1',2,'Colour values given in hex, RGB and CMYK',NULL,1,'none',NULL,0,0,NULL),
  ('cti_bg3','ct_guidelines_v1',3,'Accessible colour pairings documented',NULL,1,'text',NULL,1,0,NULL),
  ('cti_bg4','ct_guidelines_v1',4,'Exported as PDF',NULL,1,'link','Drive',0,1,NULL),
  ('cti_bg5','ct_guidelines_v1',5,'Source file archived to the brand library',NULL,1,'link','Figma',0,0,NULL),
  ('cti_bg6','ct_guidelines_v1',6,'Client sharing permissions verified','Nothing publishes with a link they can’t open.',1,'none',NULL,0,0,NULL);

-- UI screens
INSERT OR REPLACE INTO checklist_template_items
  (id, template_id, position, label, guidance, is_required, evidence_kind, expected_source, requires_countersign, is_final_deliverable, applies_when_tag) VALUES
  ('cti_ui1','ct_screens_v2',1,'Empty, loading and error states drawn',NULL,1,'none',NULL,0,0,NULL),
  ('cti_ui2','ct_screens_v2',2,'Contrast meets AA',NULL,1,'text',NULL,1,0,NULL),
  ('cti_ui3','ct_screens_v2',3,'Touch targets at least 44px',NULL,1,'none',NULL,0,0,NULL),
  ('cti_ui4','ct_screens_v2',4,'Dark theme',NULL,1,'link',NULL,0,0,'dark-mode'),
  ('cti_ui5','ct_screens_v2',5,'Copy proofread','Real copy, not lorem.',1,'none',NULL,0,0,NULL),
  ('cti_ui6','ct_screens_v2',6,'Source file archived to the brand library',NULL,1,'link','Figma',0,0,NULL),
  ('cti_ui7','ct_screens_v2',7,'Client sharing permissions verified','Nothing publishes with a link they can’t open.',1,'none',NULL,0,0,NULL);

-- Dev handoff
INSERT OR REPLACE INTO checklist_template_items
  (id, template_id, position, label, guidance, is_required, evidence_kind, expected_source, requires_countersign, is_final_deliverable, applies_when_tag) VALUES
  ('cti_dh1','ct_handoff_v1',1,'Tokens exported',NULL,1,'link','Drive',0,1,NULL),
  ('cti_dh2','ct_handoff_v1',2,'Components named to match the codebase',NULL,1,'none',NULL,0,0,NULL),
  ('cti_dh3','ct_handoff_v1',3,'Walkthrough recorded',NULL,1,'link','Loom',0,0,NULL),
  ('cti_dh4','ct_handoff_v1',4,'Source file archived to the brand library',NULL,1,'link','Figma',0,0,NULL),
  ('cti_dh5','ct_handoff_v1',5,'Client sharing permissions verified','Nothing publishes with a link they can’t open.',1,'none',NULL,0,0,NULL);

-- Built site
INSERT OR REPLACE INTO checklist_template_items
  (id, template_id, position, label, guidance, is_required, evidence_kind, expected_source, requires_countersign, is_final_deliverable, applies_when_tag) VALUES
  ('cti_bs1','ct_built_v4',1,'Responsive from 320px up',NULL,1,'none',NULL,0,0,NULL),
  ('cti_bs2','ct_built_v4',2,'Lighthouse pass',NULL,1,'text',NULL,1,0,NULL),
  ('cti_bs3','ct_built_v4',3,'Forms tested end to end',NULL,1,'none',NULL,0,0,NULL),
  ('cti_bs4','ct_built_v4',4,'Analytics installed and firing',NULL,1,'none',NULL,0,0,NULL),
  ('cti_bs5','ct_built_v4',5,'Favicon and social preview set',NULL,1,'none',NULL,0,0,NULL),
  ('cti_bs6','ct_built_v4',6,'Redirects mapped from the old site',NULL,1,'none',NULL,0,0,NULL),
  ('cti_bs7','ct_built_v4',7,'Language switcher tested',NULL,1,'none',NULL,0,0,'multi-language'),
  ('cti_bs8','ct_built_v4',8,'Checkout tested with a live card',NULL,1,'none',NULL,0,0,'ecommerce'),
  ('cti_bs9','ct_built_v4',9,'Source file archived to the brand library',NULL,1,'link','Figma',0,0,NULL),
  ('cti_bs10','ct_built_v4',10,'Client sharing permissions verified','Nothing publishes with a link they can’t open.',1,'none',NULL,0,0,NULL);
