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

/* -------------------------------------------------------------------------- */
/* Closing a project — the reason the SOP exists                               */
/* -------------------------------------------------------------------------- */

/** Settle everything on prj_brand so the gate has nothing left to object to. */
function settleBrandProject() {
  h.db.exec(`UPDATE deliverables SET status = 'approved' WHERE project_id = 'prj_brand'`);
  h.db.exec(`UPDATE checklist_items SET state = 'waived', waived_reason = 'test'
              WHERE checklist_id IN (SELECT id FROM checklists WHERE project_id = 'prj_brand')`);
  h.db.exec(`UPDATE client_actions SET status = 'accepted' WHERE project_id = 'prj_brand'`);
  h.db.exec(`UPDATE tasks SET status = 'done' WHERE project_id = 'prj_brand'`);
}

test("the gate names what is actually outstanding", async () => {
  const { closeoutCheck } = await import("./closeout.ts");
  const check = (await closeoutCheck("prj_brand"))!;

  assert.equal(check.ok, false);
  const kinds = check.blockers.map((b) => b.kind);
  assert.deepEqual(
    [...kinds].sort(),
    ["checklist", "client", "deliverable", "task"],
    "all four sources of unfinished work are checked",
  );
  for (const b of check.blockers) {
    assert.ok(b.items.length > 0, `${b.kind} must list the specific items, not just a count`);
  }
});

test("closing with things outstanding is refused without a reason, allowed with one", async () => {
  const { closeProject, closeoutCheck } = await import("./closeout.ts");

  await assert.rejects(
    () => closeProject({ projectId: "prj_brand", actorId: "u_chike", note: "  " }),
    /say why/i,
    "a warn-not-block gate still has to cost a sentence",
  );
  assert.equal(
    h.one<{ status: string }>("SELECT status FROM projects WHERE id='prj_brand'")?.status,
    "active",
    "the refusal must not have half-closed it",
  );

  await closeProject({
    projectId: "prj_brand",
    actorId: "u_chike",
    note: "Client signed off verbally; remaining items are internal tidying.",
  });

  const row = h.one<{ status: string; actual_end_on: string }>(
    "SELECT status, actual_end_on FROM projects WHERE id='prj_brand'",
  );
  assert.equal(row?.status, "done");
  assert.ok(row?.actual_end_on, "closing dates the project");
  assert.equal((await closeoutCheck("prj_brand"))!.status, "done");
});

test("what was outstanding is copied into the record, not referenced", async () => {
  const { closeProject } = await import("./closeout.ts");
  await closeProject({ projectId: "prj_brand", actorId: "u_chike", note: "Shipping anyway." });

  const event = h.one<{ payload: string; actor_id: string; visibility: string }>(
    "SELECT payload, actor_id, visibility FROM activity_events WHERE kind='project.closed'",
  );
  assert.equal(event?.actor_id, "u_chike", "a decision has an author");
  assert.equal(event?.visibility, "client", "the client is told their project closed");

  const clientSide = JSON.parse(event!.payload);
  assert.equal(clientSide.clean, false);
  assert.equal(clientSide.note, "Shipping anyway.");
  assert.equal(
    clientSide.outstanding,
    undefined,
    "the client-labelled row must not carry internal task and checklist names",
  );

  const snapshot = h.one<{ payload: string; visibility: string }>(
    "SELECT payload, visibility FROM activity_events WHERE kind='project.closed_snapshot'",
  );
  assert.equal(snapshot?.visibility, "internal");
  const payload = JSON.parse(snapshot!.payload);
  assert.ok(payload.outstanding.length > 0);

  // The underlying rows keep moving. The record of what was known when someone
  // signed this off must not move with them.
  h.db.exec(`UPDATE tasks SET status = 'done' WHERE project_id = 'prj_brand'`);
  const after = JSON.parse(
    h.one<{ payload: string }>(
      "SELECT payload FROM activity_events WHERE kind='project.closed_snapshot'",
    )!.payload,
  );
  assert.deepEqual(after.outstanding, payload.outstanding, "the snapshot is frozen");
});

test("a clean project closes without needing an excuse", async () => {
  const { closeProject, closeoutCheck } = await import("./closeout.ts");
  settleBrandProject();

  const check = (await closeoutCheck("prj_brand"))!;
  assert.equal(check.ok, true, `expected nothing outstanding, got ${JSON.stringify(check.blockers)}`);

  await closeProject({ projectId: "prj_brand", actorId: "u_chike", note: "" });
  assert.equal(
    h.one<{ status: string }>("SELECT status FROM projects WHERE id='prj_brand'")?.status,
    "done",
  );
  assert.equal(JSON.parse(h.one<{ payload: string }>(
    "SELECT payload FROM activity_events WHERE kind='project.closed'",
  )!.payload).clean, true);
});

test("an item awaiting a countersign is not finished", async () => {
  const { closeoutCheck } = await import("./closeout.ts");
  settleBrandProject();
  // ci_5 requires a countersign. Ticked by Femi, nobody has signed it off.
  h.db.exec(`UPDATE checklist_items SET state='checked', checked_by='u_femi', waived_reason=NULL
              WHERE id='ci_5'`);

  const check = (await closeoutCheck("prj_brand"))!;
  assert.equal(check.ok, false, "ticked-but-unsigned is the case the SOP exists for");
  assert.equal(check.blockers[0]?.kind, "checklist");
});

test("closing twice is refused, and reopening needs a reason the client will read", async () => {
  const { closeProject, reopenProject } = await import("./closeout.ts");
  settleBrandProject();
  await closeProject({ projectId: "prj_brand", actorId: "u_chike", note: "" });

  await assert.rejects(
    () => closeProject({ projectId: "prj_brand", actorId: "u_ada", note: "again" }),
    /already closed/i,
  );
  assert.equal(h.count("activity_events", "kind = 'project.closed'"), 1);

  await assert.rejects(
    () => reopenProject({ projectId: "prj_brand", actorId: "u_chike", note: "" }),
    /say why/i,
  );

  await reopenProject({
    projectId: "prj_brand",
    actorId: "u_chike",
    note: "Client came back on the icon set.",
  });
  const row = h.one<{ status: string; actual_end_on: string | null }>(
    "SELECT status, actual_end_on FROM projects WHERE id='prj_brand'",
  );
  assert.equal(row?.status, "active");
  assert.equal(row?.actual_end_on, null, "reopening clears the end date");
  assert.equal(h.count("activity_events", "kind = 'project.reopened'"), 1);
});

test("a closed project stays visible to the client", async () => {
  const { closeProject } = await import("./closeout.ts");
  const { projectsForUser } = await import("./client-queries.ts");
  settleBrandProject();
  await closeProject({ projectId: "prj_brand", actorId: "u_chike", note: "" });

  const visible = await projectsForUser("u_tunde");
  assert.ok(
    visible.some((p) => p.id === "prj_brand"),
    "closing is not archiving — the client keeps the record they were given",
  );
});

/* -------------------------------------------------------------------------- */
/* The delivery schedule — and the one place it changes what a client sees     */
/* -------------------------------------------------------------------------- */

test("an undated draft stays invisible; dating it puts it on the schedule", async () => {
  const { deliverablesForUser } = await import("./client-queries.ts");
  const { addScheduleItems, parseScheduleLines } = await import("./schedule-writes.ts");

  await addScheduleItems({
    projectId: "prj_brand",
    actorId: "u_chike",
    lines: parseScheduleLines("Undated page\nDated page\t2026-09-01"),
  });

  const names = (await deliverablesForUser("u_tunde", "prj_brand")).map((d) => d.name);
  assert.ok(
    !names.includes("Undated page"),
    "a draft with no date is scratch work and stays internal",
  );
  assert.ok(
    names.includes("Dated page"),
    "committing to a date is what puts it on the client's plan",
  );
});

test("a scheduled item carries a name, a date and a status — and no link", async () => {
  const { deliverablesForUser } = await import("./client-queries.ts");
  const { addScheduleItems, parseScheduleLines } = await import("./schedule-writes.ts");

  await addScheduleItems({
    projectId: "prj_brand",
    actorId: "u_chike",
    lines: parseScheduleLines("Homepage\t2026-09-01"),
  });

  const row = (await deliverablesForUser("u_tunde", "prj_brand")).find(
    (d) => d.name === "Homepage",
  )!;
  assert.equal(row.status, "draft");
  assert.equal(row.due_on, "2026-09-01");
  assert.equal(row.review_url, null, "nothing has been sent, so there is nothing to open");
  assert.equal(row.client_access_ok, null);
});

test("the schedule is still scoped to the client's own projects", async () => {
  const { deliverablesForUser } = await import("./client-queries.ts");
  const { addScheduleItems, parseScheduleLines } = await import("./schedule-writes.ts");

  await addScheduleItems({
    projectId: "prj_site",
    actorId: "u_chike",
    lines: parseScheduleLines("Site page\t2026-09-01"),
  });

  // Zainab has a role on prj_brand only.
  const zainab = await deliverablesForUser("u_zainab", "prj_site");
  assert.equal(zainab.length, 0, "widening draft visibility must not widen project scope");
});

test("pasting the same list twice does not double the schedule", async () => {
  const { addScheduleItems, parseScheduleLines } = await import("./schedule-writes.ts");
  const list = "Homepage\t2026-09-01\nAbout\t2026-09-02";

  const first = await addScheduleItems({
    projectId: "prj_brand",
    actorId: "u_chike",
    lines: parseScheduleLines(list),
  });
  assert.equal(first.added, 2);

  const second = await addScheduleItems({
    projectId: "prj_brand",
    actorId: "u_chike",
    lines: parseScheduleLines(`${list}\nContact\t2026-09-03`),
  });
  assert.equal(second.added, 1, "only the new line is added");
  assert.deepEqual(second.skipped.sort(), ["About", "Homepage"]);
  assert.equal(h.count("deliverables", "project_id='prj_brand' AND name='Homepage'"), 1);
});

test("a due date can only be moved from inside its own project", async () => {
  const { addScheduleItems, parseScheduleLines, setDueDate } = await import("./schedule-writes.ts");
  await addScheduleItems({
    projectId: "prj_brand",
    actorId: "u_chike",
    lines: parseScheduleLines("Homepage\t2026-09-01"),
  });
  const id = h.one<{ id: string }>(
    "SELECT id FROM deliverables WHERE name='Homepage'",
  )!.id;

  await assert.rejects(
    () => setDueDate({ deliverableId: id, projectId: "prj_site", dueOn: "2027-01-01", actorId: "u_chike" }),
    /isn’t part of this project/,
  );
  assert.equal(
    h.one<{ due_on: string }>("SELECT due_on FROM deliverables WHERE id=?", id)?.due_on,
    "2026-09-01",
  );

  await setDueDate({ deliverableId: id, projectId: "prj_brand", dueOn: "2026-09-15", actorId: "u_chike" });
  assert.equal(
    h.one<{ due_on: string }>("SELECT due_on FROM deliverables WHERE id=?", id)?.due_on,
    "2026-09-15",
  );
});

test("scheduled items count toward closing the project", async () => {
  const { closeoutCheck } = await import("./closeout.ts");
  const { addScheduleItems, parseScheduleLines } = await import("./schedule-writes.ts");
  settleBrandProject();

  await addScheduleItems({
    projectId: "prj_brand",
    actorId: "u_chike",
    lines: parseScheduleLines("Homepage\t2026-09-01"),
  });

  const check = (await closeoutCheck("prj_brand"))!;
  assert.equal(check.ok, false, "a planned page nobody delivered is unfinished work");
  assert.equal(check.blockers[0]?.kind, "deliverable");
  assert.ok(check.blockers[0].items.some((i) => i.startsWith("Homepage")));
});

/* -------------------------------------------------------------------------- */
/* Ship review: the schedule must not leak unsent work                         */
/* -------------------------------------------------------------------------- */

test("a dated draft with a review link attached still shows the client no link", async () => {
  const { deliverablesForUser } = await import("./client-queries.ts");
  const { setDueDate } = await import("./schedule-writes.ts");

  // dlv_iconset is a draft that ALREADY has a version row and a link — the
  // normal state of every delivery between attaching a link and sending it,
  // because the publish gate refuses to send until a link exists. The old
  // query joined on the version's existence and handed this URL straight over,
  // before anyone had attested the client could open it.
  await setDueDate({
    deliverableId: "dlv_iconset",
    projectId: "prj_brand",
    dueOn: "2026-09-01",
    actorId: "u_chike",
  });

  const row = (await deliverablesForUser("u_tunde", "prj_brand")).find(
    (d) => d.id === "dlv_iconset",
  )!;
  assert.equal(row.due_on, "2026-09-01", "it is on the schedule");
  assert.equal(row.status, "draft");
  assert.equal(row.review_url, null, "an unattested link must never reach a client");
  assert.equal(row.review_label, null);
  assert.equal(row.summary, null, "the working note is written for us, not them");
});

test("the link appears only once the work is actually sent", async () => {
  const { deliverablesForUser } = await import("./client-queries.ts");
  const { sendToClient } = await import("./checklist-writes.ts");
  const { setDueDate } = await import("./schedule-writes.ts");

  await setDueDate({
    deliverableId: "dlv_iconset", projectId: "prj_brand",
    dueOn: "2026-09-01", actorId: "u_chike",
  });
  h.db.exec(`UPDATE links SET client_access_ok = 1 WHERE id = 'lnk_icons'`);
  h.db.exec(`UPDATE checklist_items SET state='waived', waived_reason='t' WHERE checklist_id='cl_iconset'`);

  await sendToClient("dlv_iconset", "u_chike");

  const row = (await deliverablesForUser("u_tunde", "prj_brand")).find(
    (d) => d.id === "dlv_iconset",
  )!;
  assert.equal(row.status, "in_review");
  assert.equal(row.review_url, "https://drive.google.com/drive/folders/ovis-icons");
});

test("a client cannot lodge feedback on work never sent to them", async () => {
  const { requestChanges } = await import("./client-writes.ts");

  // The guarded UPDATE used to run third — after the feedback comment, and
  // with the billable revision request behind it. So a request against a draft
  // wrote a comment and raised a priced revision on work nobody had delivered.
  const before = {
    comments: h.count("feedback_comments"),
    revisions: h.count("revision_requests"),
  };

  await assert.rejects(
    () =>
      requestChanges(
        "u_tunde",
        {
          deliverableId: "dlv_iconset",
          projectId: "prj_brand",
          versionId: "dv_iconset_1",
          currentRound: 1,
          roundsIncluded: 0,
          name: "Icon set",
        },
        "Please change everything",
      ),
    /isn’t waiting on your notes/,
  );

  assert.equal(h.count("feedback_comments"), before.comments, "no comment on unsent work");
  assert.equal(
    h.count("revision_requests"),
    before.revisions,
    "and certainly no billable revision",
  );
  assert.equal(
    h.one<{ status: string }>("SELECT status FROM deliverables WHERE id='dlv_iconset'")?.status,
    "draft",
  );
});

test("two people pasting the same list cannot double the schedule", async () => {
  const { addScheduleItems, parseScheduleLines } = await import("./schedule-writes.ts");
  const lines = parseScheduleLines("Homepage\t2026-09-01\nAbout\t2026-09-02");

  // Read-then-write with no transaction: the application dedupe can't settle
  // this on its own, so the unique index in 0003 is the thing that has to.
  const results = await Promise.allSettled([
    addScheduleItems({ projectId: "prj_brand", actorId: "u_chike", lines }),
    addScheduleItems({ projectId: "prj_brand", actorId: "u_ada", lines }),
  ]);

  assert.ok(
    results.some((r) => r.status === "fulfilled"),
    "one of them must succeed",
  );
  assert.equal(h.count("deliverables", "project_id='prj_brand' AND name='Homepage'"), 1);
  assert.equal(h.count("deliverables", "project_id='prj_brand' AND name='About'"), 1);
});

test("a date the picker didn’t produce is refused", async () => {
  const { addScheduleItems, parseScheduleLines, setDueDate } = await import("./schedule-writes.ts");
  await addScheduleItems({
    projectId: "prj_brand", actorId: "u_chike",
    lines: parseScheduleLines("Homepage\t2026-09-01"),
  });
  const id = h.one<{ id: string }>("SELECT id FROM deliverables WHERE name='Homepage'")!.id;

  for (const junk of ["<script>x</script>", "tomorrow", "2026-13-45", "9/1/2026"]) {
    await assert.rejects(
      () => setDueDate({ deliverableId: id, projectId: "prj_brand", dueOn: junk, actorId: "u_chike" }),
      /isn’t a date/,
      junk,
    );
  }
  assert.equal(
    h.one<{ due_on: string }>("SELECT due_on FROM deliverables WHERE id=?", id)?.due_on,
    "2026-09-01",
  );
});

test("moving a client-visible date is recorded against a name", async () => {
  const { addScheduleItems, parseScheduleLines, setDueDate } = await import("./schedule-writes.ts");
  await addScheduleItems({
    projectId: "prj_brand", actorId: "u_chike",
    lines: parseScheduleLines("Homepage\t2026-09-01"),
  });
  const id = h.one<{ id: string }>("SELECT id FROM deliverables WHERE name='Homepage'")!.id;

  await setDueDate({ deliverableId: id, projectId: "prj_brand", dueOn: "2026-09-15", actorId: "u_ada" });
  assert.equal(
    h.count("activity_events", `kind='deliverable.date_changed' AND actor_id='u_ada'`),
    1,
  );
});

test("an oversized paste is refused whole rather than written halfway", async () => {
  const { addScheduleItems, parseScheduleLines, MAX_ITEMS } = await import("./schedule-writes.ts");
  const many = Array.from({ length: MAX_ITEMS + 1 }, (_, n) => `Page ${n}\t2026-09-01`).join("\n");

  const before = h.count("deliverables", "project_id='prj_brand'");
  await assert.rejects(
    () => addScheduleItems({ projectId: "prj_brand", actorId: "u_chike", lines: parseScheduleLines(many) }),
    /most in one go/,
  );
  assert.equal(
    h.count("deliverables", "project_id='prj_brand'"),
    before,
    "nothing written — there is no transaction to undo a partial one",
  );
});

test("a failed notification is reported, and never fails the write", async () => {
  const { sendToClient } = await import("./checklist-writes.ts");
  const { notifyReviewReady, deliveryProblem } = await import("./notify.ts");

  h.db.exec(`UPDATE links SET client_access_ok = 1 WHERE id = 'lnk_icons'`);
  h.db.exec(`UPDATE checklist_items SET state='waived', waived_reason='t' WHERE checklist_id='cl_iconset'`);
  const check = await sendToClient("dlv_iconset", "u_chike");

  // SES isn't configured in the harness, so nothing is attempted at all —
  // which is exactly the case that used to look identical to success.
  const delivery = await notifyReviewReady({
    projectId: check.projectId,
    projectSlug: check.projectSlug,
    projectName: check.projectName,
    deliverableId: "dlv_iconset",
    deliverableName: check.name,
    actorId: "u_chike",
  });

  assert.equal(delivery.notConfigured, true);
  assert.match(deliveryProblem(delivery) ?? "", /nobody was notified/i);
  assert.equal(
    h.one<{ status: string }>("SELECT status FROM deliverables WHERE id='dlv_iconset'")?.status,
    "in_review",
    "the work still moved — a courtesy failing is not the fact failing",
  );
});

/* -------------------------------------------------------------------------- */
/* One click from the email into the portal                                    */
/* -------------------------------------------------------------------------- */

test("a notification link signs that person in and lands them on the thing", async () => {
  const { issueNotificationLink } = await import("../auth/links.ts");
  const { hash, landingFor } = await import("../auth/tokens.ts");

  const url = await issueNotificationLink("u_tunde", "/p/brand-identity", "https://x.test");
  const parsed = new URL(url);
  const token = parsed.searchParams.get("token")!;

  // The raw token is never stored — only its hash, so a database leak yields
  // nothing anyone could click.
  assert.equal(h.count("auth_tokens", `token = '${await hash(token)}'`), 1);
  assert.equal(h.count("auth_tokens", `token = '${token}'`), 0, "raw token must not be stored");

  const row = h.one<{ user_id: string; purpose: string; used_at: string | null }>(
    "SELECT user_id, purpose, used_at FROM auth_tokens WHERE token = ?",
    await hash(token),
  )!;
  assert.equal(row.user_id, "u_tunde");
  assert.equal(row.purpose, "notify");
  assert.equal(row.used_at, null);

  // And it deep-links: the client lands on the project, not a generic home.
  assert.equal(landingFor("client", parsed.searchParams.get("next")), "/p/brand-identity");
});

test("a notification link cannot be pointed off-site", async () => {
  const { issueNotificationLink } = await import("../auth/links.ts");
  for (const evil of ["//evil.example/x", "https://evil.example", "/\\evil.example"]) {
    const url = await issueNotificationLink("u_tunde", evil, "https://x.test");
    assert.equal(
      new URL(url).searchParams.get("next"),
      "/",
      `${evil} must not survive into the link`,
    );
  }
});

test("notification links do not use up a client’s allowance to request one", async () => {
  const { issueNotificationLink } = await import("../auth/links.ts");
  const { MAX_LINKS_PER_WINDOW } = await import("../auth/tokens.ts");

  // Publishing a lot must never lock someone out of asking for their own link.
  for (let n = 0; n < MAX_LINKS_PER_WINDOW + 2; n++) {
    await issueNotificationLink("u_tunde", "/p/brand-identity", "https://x.test");
  }
  const counted = h.count(
    "auth_tokens",
    `user_id = 'u_tunde' AND used_at IS NULL AND purpose = 'login'`,
  );
  assert.equal(counted, 0, "the rate limit counts requested links only");
});

test("each recipient gets their own link, and it is theirs alone", async () => {
  const { issueNotificationLink } = await import("../auth/links.ts");
  const { hash } = await import("../auth/tokens.ts");

  const one = await issueNotificationLink("u_tunde", "/p/brand-identity", "https://x.test");
  const two = await issueNotificationLink("u_zainab", "/p/brand-identity", "https://x.test");
  const tokenOf = (u: string) => new URL(u).searchParams.get("token")!;

  assert.notEqual(tokenOf(one), tokenOf(two));
  assert.equal(
    h.one<{ user_id: string }>(
      "SELECT user_id FROM auth_tokens WHERE token = ?",
      await hash(tokenOf(two)),
    )?.user_id,
    "u_zainab",
    "a link signs in exactly the person it was addressed to",
  );
});
