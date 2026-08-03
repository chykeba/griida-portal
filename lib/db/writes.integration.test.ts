/**
 * Behavioural tests for the write layer, against a real SQLite database.
 *
 * These replace source-regex assertions with ones that execute the SQL. Each
 * test here was written against a defect the /ship review found; several
 * failed before the fix and pass after, which is the only evidence that a
 * guard actually guards anything.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createHarness, type Harness } from "./testing/harness.ts";

let h: Harness;

test.beforeEach(() => {
  h = createHarness();
});
test.afterEach(() => {
  h.restore();
});

/* -------------------------------------------------------------------------- */
/* Blocker 1 & 2 — the client response path                                   */
/* -------------------------------------------------------------------------- */

test("a client cannot touch a request on a project they have no role on", async () => {
  const { respondToAction } = await import("./client-writes.ts");

  // ca_1 belongs to prj_brand. Zainab is a reviewer there; give ourselves a
  // client with no role on it at all.
  h.db.exec(
    `INSERT INTO users (id,email,kind,full_name) VALUES ('u_outsider','out@x.com','client','Out Sider')`,
  );

  const before = h.count("links", "id = 'lnk_resp_ca_1'");
  const result = await respondToAction("u_outsider", "ca_1", { url: "https://evil.example/x" });

  assert.equal(result.ok, false, "an outsider must not be able to answer");
  assert.equal(
    h.count("links", "id = 'lnk_resp_ca_1'"),
    before,
    "no link row may be written before the ownership check — this was the hole",
  );
  assert.equal(
    h.one<{ status: string }>("SELECT status FROM client_actions WHERE id='ca_1'")?.status,
    "open",
    "the request must be untouched",
  );
});

test("answering twice is refused, and the first answer survives", async () => {
  const { respondToAction } = await import("./client-writes.ts");

  const first = await respondToAction("u_tunde", "ca_1", { url: "https://drive.example/real" });
  assert.equal(first.ok, true);

  const second = await respondToAction("u_tunde", "ca_1", { url: "https://evil.example/swapped" });
  assert.equal(second.ok, false, "a double submit must not report success");
  assert.match(second.error ?? "", /already been answered/);

  assert.equal(
    h.one<{ url: string }>("SELECT url FROM links WHERE id='lnk_resp_ca_1'")?.url,
    "https://drive.example/real",
    "the second submit must not overwrite what they actually sent",
  );
  assert.equal(
    h.count("activity_events", "kind = 'client_action.submitted'"),
    1,
    "exactly one submission event",
  );
});

test("a genuine answer is recorded", async () => {
  const { respondToAction } = await import("./client-writes.ts");
  const result = await respondToAction("u_tunde", "ca_1", { text: "Direction B, please." });

  assert.equal(result.ok, true);
  const row = h.one<{ status: string; response_text: string }>(
    "SELECT status, response_text FROM client_actions WHERE id='ca_1'",
  );
  assert.equal(row?.status, "submitted");
  assert.equal(row?.response_text, "Direction B, please.");
});

/* -------------------------------------------------------------------------- */
/* Blocker 4 / recommended 5 — the publish gate                                */
/* -------------------------------------------------------------------------- */

test("sending the same deliverable twice changes nothing the second time", async () => {
  const { sendToClient } = await import("./checklist-writes.ts");

  // Open the gate: verify the link and settle every required item.
  h.db.exec(`UPDATE links SET client_access_ok = 1 WHERE id = 'lnk_icons'`);
  h.db.exec(`UPDATE checklist_items SET state = 'waived', waived_reason = 'test'
              WHERE checklist_id = 'cl_iconset'`);

  await sendToClient("dlv_iconset", "u_chike");
  const firstPublishedAt = h.one<{ published_at: string }>(
    "SELECT published_at FROM deliverable_versions WHERE deliverable_id='dlv_iconset'",
  )?.published_at;

  await assert.rejects(
    () => sendToClient("dlv_iconset", "u_ada"),
    /already with the client/i,
    "a second send must be refused, not silently repeated",
  );

  assert.equal(
    h.count("activity_events", "kind = 'deliverable.in_review' AND subject_id = 'dlv_iconset'"),
    1,
    "one send, one event — a duplicate event means a duplicate client email",
  );
  assert.equal(
    h.one<{ published_at: string }>(
      "SELECT published_at FROM deliverable_versions WHERE deliverable_id='dlv_iconset'",
    )?.published_at,
    firstPublishedAt,
    "the original publication record must not be re-stamped by a second actor",
  );
});

test("an unverified link blocks the send even with an override reason", async () => {
  const { sendToClient } = await import("./checklist-writes.ts");
  h.db.exec(`UPDATE checklist_items SET state='waived', waived_reason='t' WHERE checklist_id='cl_iconset'`);
  // lnk_icons has client_access_ok NULL in the seed.
  await assert.rejects(
    () => sendToClient("dlv_iconset", "u_chike", { reason: "client is waiting" }),
    /can’t be overridden/,
  );
  assert.equal(
    h.count("activity_events", "kind = 'deliverable.in_review' AND subject_id = 'dlv_iconset'"),
    0,
  );
});

/* -------------------------------------------------------------------------- */
/* Recommended 7 — countersign ordering                                        */
/* -------------------------------------------------------------------------- */

test("a countersign that cannot apply leaves no event behind", async () => {
  const { countersign, itemContext } = await import("./checklist-writes.ts");

  // ci_5 requires a countersign and was checked by Femi in the seed.
  const ctx = (await itemContext("ci_5"))!;
  // Someone unticks it in the gap between reading and writing.
  h.db.exec(`UPDATE checklist_items SET state='open', checked_by=NULL WHERE id='ci_5'`);

  const before = h.count("checklist_item_events", "kind = 'countersigned'");
  await assert.rejects(() => countersign(ctx, "u_ada", "lead"));

  assert.equal(
    h.count("checklist_item_events", "kind = 'countersigned'"),
    before,
    "the log is immutable, so an event written for a change that didn’t happen is permanent",
  );
});

test("a countersign that applies is recorded once", async () => {
  const { countersign, itemContext } = await import("./checklist-writes.ts");
  const ctx = (await itemContext("ci_5"))!;
  await countersign(ctx, "u_ada", "lead");

  assert.equal(
    h.one<{ state: string; countersigned_by: string }>(
      "SELECT state, countersigned_by FROM checklist_items WHERE id='ci_5'",
    )?.state,
    "countersigned",
  );
  assert.equal(h.count("checklist_item_events", "kind = 'countersigned'"), 1);
});

/* -------------------------------------------------------------------------- */
/* Recommended 6 — a courtesy must never fail a fact                           */
/* -------------------------------------------------------------------------- */

test("a deliverable still moves to the client when the notification lookup fails", async () => {
  const { sendToClient } = await import("./checklist-writes.ts");
  const { notifyReviewReady } = await import("./notify.ts");

  h.db.exec(`UPDATE links SET client_access_ok = 1 WHERE id = 'lnk_icons'`);
  h.db.exec(`UPDATE checklist_items SET state='waived', waived_reason='t' WHERE checklist_id='cl_iconset'`);

  const check = await sendToClient("dlv_iconset", "u_chike");
  // The recipient lookup is the next query notify makes.
  h.failNext(/FROM project_client_roles r/);

  await assert.doesNotReject(
    () =>
      notifyReviewReady({
        projectId: check.projectId,
        projectSlug: check.projectSlug,
        projectName: check.projectName,
        deliverableId: "dlv_iconset",
        deliverableName: check.name,
        actorId: "u_chike",
      }),
    "email failure must never surface as a failed write — the work has already moved",
  );

  assert.equal(
    h.one<{ status: string }>("SELECT status FROM deliverables WHERE id='dlv_iconset'")?.status,
    "in_review",
  );
});

/* -------------------------------------------------------------------------- */
/* Template immutability — replacing the regex assertions with behaviour       */
/* -------------------------------------------------------------------------- */

test("a published template cannot be edited; editing forks the next version", async () => {
  const t = await import("./template-writes.ts");

  // ct_iconset_v2 is published with 8 items and one live instance.
  await assert.rejects(() => t.addItem("ct_iconset_v2", "Sneaky"), /published/);
  await assert.rejects(() => t.publishTemplate("ct_iconset_v2", "u_chike"), /published/);

  const draftId = await t.editableDraftFor("dt_iconset");
  const draft = (await t.loadTemplate(draftId))!;
  assert.equal(draft.version, 3);
  assert.equal(draft.status, "draft");
  assert.equal(draft.items.length, 8, "items are copied so an edit starts from what works");

  await t.addItem(draftId, "Favicon exported");
  assert.equal((await t.loadTemplate(draftId))!.items.length, 9);
  assert.equal(
    (await t.loadTemplate("ct_iconset_v2"))!.items.length,
    8,
    "the published version must be byte-identical after the fork",
  );

  await t.publishTemplate(draftId, "u_chike");
  assert.equal((await t.loadTemplate("ct_iconset_v2"))!.status, "archived", "history survives");
  assert.equal(
    h.one<{ source_version: number }>(
      "SELECT source_version FROM checklists WHERE deliverable_id='dlv_iconset'",
    )?.source_version,
    2,
    "a project already running keeps the snapshot it started with",
  );
});

test("removing an item leaves positions dense", async () => {
  const t = await import("./template-writes.ts");
  const draftId = await t.editableDraftFor("dt_iconset");
  const items = (await t.loadTemplate(draftId))!.items;

  await t.removeItem(draftId, items[2].id);
  const after = (await t.loadTemplate(draftId))!.items;

  assert.deepEqual(
    after.map((i) => i.position),
    after.map((_, n) => n + 1),
    "a gap makes the next insert collide with the unique constraint",
  );
  assert.equal(after.length, items.length - 1);
});

/* -------------------------------------------------------------------------- */
/* Blockers 3 & 4 — the studio side is the only thing holding the boundary     */
/* -------------------------------------------------------------------------- */

test("a link can only be attested from the project it belongs to", async () => {
  const { attestClientAccess } = await import("./link-writes.ts");

  // lnk_icons hangs off dlv_iconset, which is on prj_brand.
  await assert.rejects(
    () => attestClientAccess("lnk_icons", "u_chike", true, "prj_site"),
    /isn’t part of this project/,
    "the link id comes from a form; another project must not be able to name it",
  );
  assert.equal(
    h.one<{ ok: number | null }>("SELECT client_access_ok AS ok FROM links WHERE id='lnk_icons'")
      ?.ok,
    null,
    "the one gate with no override must not have moved",
  );

  await attestClientAccess("lnk_icons", "u_chike", true, "prj_brand");
  assert.equal(
    h.one<{ ok: number }>("SELECT client_access_ok AS ok FROM links WHERE id='lnk_icons'")?.ok,
    1,
  );
});

test("granting and revoking client access is recorded against a name", async () => {
  const { addClientToProject, removeClientFromProject } = await import("./project-writes.ts");

  const { userId, isNew } = await addClientToProject({
    projectId: "prj_brand",
    actorId: "u_chike",
    name: "New Contact",
    email: "new@client.com",
    role: "viewer",
  });
  assert.equal(isNew, true);
  assert.equal(
    h.count("activity_events", `kind = 'project.client_added' AND subject_id = '${userId}'`),
    1,
    "who can see a project is the whole product — both halves need an author",
  );

  await removeClientFromProject("prj_brand", userId, "u_chike");
  assert.equal(h.count("project_client_roles", `user_id = '${userId}'`), 0);
  assert.equal(
    h.count("activity_events", `kind = 'project.client_removed' AND subject_id = '${userId}'`),
    1,
  );
  assert.equal(
    h.count("account_members", `user_id = '${userId}'`),
    1,
    "removing them from one job must not erase the relationship",
  );
});

test("a client action can only be resolved from its own project", async () => {
  const { acceptClientAction } = await import("./project-writes.ts");
  h.db.exec(`UPDATE client_actions SET status = 'submitted' WHERE id = 'ca_1'`);

  await acceptClientAction("ca_1", "u_chike", "prj_site");
  assert.equal(
    h.one<{ status: string }>("SELECT status FROM client_actions WHERE id='ca_1'")?.status,
    "submitted",
    "ca_1 is on prj_brand — a different project naming it must change nothing",
  );

  await acceptClientAction("ca_1", "u_chike", "prj_brand");
  assert.equal(
    h.one<{ status: string }>("SELECT status FROM client_actions WHERE id='ca_1'")?.status,
    "accepted",
  );
});
