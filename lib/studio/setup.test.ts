import assert from "node:assert/strict";
import test from "node:test";
import { can, assertCan, NotAllowed } from "./permissions.ts";
import { instantiateChecklist, findProjectType, PROJECT_TYPES } from "./templates.ts";
import { createClient, createProject, inviteTeamMember, slugify } from "./store.ts";
import type { Person } from "./types.ts";

const superAdmin: Person = { id: "p_su", name: "Su", initials: "SU", role: "super_admin" };
const pm: Person = { id: "p_pm", name: "Pat", initials: "PT", role: "admin_pm" };
const lead: Person = { id: "p_lead", name: "Lee", initials: "LE", role: "lead" };
const member: Person = { id: "p_mem", name: "Mo", initials: "MO", role: "member" };

/* ---- permissions -------------------------------------------------------- */

test("PM and super admin create projects and clients; others don’t", () => {
  for (const p of [superAdmin, pm]) {
    assert.equal(can(p, "create_project"), true);
    assert.equal(can(p, "create_client"), true);
  }
  for (const p of [lead, member]) {
    assert.equal(can(p, "create_project"), false);
    assert.equal(can(p, "create_client"), false);
  }
});

test("only the super admin manages the team or authors SOPs", () => {
  assert.equal(can(superAdmin, "manage_team"), true);
  assert.equal(can(superAdmin, "author_templates"), true);
  for (const p of [pm, lead, member]) {
    assert.equal(can(p, "manage_team"), false, `${p.role} must not manage team`);
    assert.equal(can(p, "author_templates"), false, `${p.role} must not author SOPs`);
  }
});

test("assertCan throws NotAllowed rather than failing silently", () => {
  assert.throws(() => assertCan(member, "create_project"), NotAllowed);
  assert.doesNotThrow(() => assertCan(pm, "create_project"));
});

/* ---- instantiation ------------------------------------------------------ */

test("conditional checklist items only appear when the project carries the tag", () => {
  const icons = findProjectType("pt_brand")!.deliverables.find((d) => d.id === "dt_iconset")!;
  const without = instantiateChecklist("d1", icons.checklist!, []);
  const withDark = instantiateChecklist("d1", icons.checklist!, ["dark-mode"]);

  assert.ok(!without.items.some((i) => i.label.includes("Dark-mode")));
  assert.ok(withDark.items.some((i) => i.label.includes("Dark-mode")));
  assert.equal(withDark.items.length, without.items.length + 1);
});

test("instantiation is a snapshot — positions are dense and state is fresh", () => {
  const icons = findProjectType("pt_brand")!.deliverables.find((d) => d.id === "dt_iconset")!;
  const list = instantiateChecklist("d1", icons.checklist!, []);
  assert.deepEqual(
    list.items.map((i) => i.position),
    list.items.map((_, n) => n + 1),
  );
  assert.ok(list.items.every((i) => i.state === "open" && i.checkedById === null));
  assert.equal(list.templateVersion, icons.checklist!.version);
});

test("editing a template later cannot change an instance already created", () => {
  const template = { name: "T", version: 1, items: [{ label: "Original" }] };
  const instance = instantiateChecklist("d1", template, []);
  template.items[0].label = "Edited after the fact";
  template.version = 99;
  assert.equal(instance.items[0].label, "Original");
  assert.equal(instance.templateVersion, 1);
});

test("every project type has stages and at least one deliverable", () => {
  for (const t of PROJECT_TYPES) {
    assert.ok(t.milestones.length >= 3, `${t.name} needs a milestone spine`);
    assert.ok(t.deliverables.length > 0, `${t.name} needs deliverables`);
  }
});

test("no checklist template exceeds 12 items — past that they get rubber-stamped", () => {
  for (const t of PROJECT_TYPES) {
    for (const d of t.deliverables) {
      if (!d.checklist) continue;
      assert.ok(
        d.checklist.items.length <= 12,
        `${t.name} / ${d.name} has ${d.checklist.items.length} items`,
      );
    }
  }
});

/* ---- the write paths ---------------------------------------------------- */

test("slugify handles the messy names people actually type", () => {
  assert.equal(slugify("  Ovis  Health "), "ovis-health");
  assert.equal(slugify("Brand Identity (2026)"), "brand-identity-2026");
  // NFKD strips the accent rather than the letter: "café" -> "cafe", not "caf".
  assert.equal(slugify("Café — Rebrand"), "cafe-rebrand");
});

test("creating a project instantiates its deliverables and checklists", () => {
  const project = createProject(pm, {
    accountId: "acc_ovi",
    projectTypeId: "pt_brand",
    name: "Test Rebrand",
    leadId: "p_chike",
    targetEndOn: null,
    roundsIncluded: 2,
    tags: ["dark-mode"],
  });

  assert.equal(project.slug, "test-rebrand");
  assert.equal(project.deliverables.length, 4);
  // Checklists arrive automatically — that's the whole point of §10.2.
  const icons = project.deliverables.find((d) => d.name === "Icon set")!;
  assert.ok(icons.checklist);
  assert.ok(icons.checklist!.items.some((i) => i.label.includes("Dark-mode")));
  // Nothing is publishable on day one.
  assert.ok(project.deliverables.every((d) => d.status === "draft"));
});

test("a member cannot create a project even if they reach the action", () => {
  assert.throws(
    () =>
      createProject(member, {
        accountId: "acc_ovi",
        projectTypeId: "pt_brand",
        name: "Sneaky",
        leadId: "p_chike",
        targetEndOn: null,
        roundsIncluded: 2,
        tags: [],
      }),
    NotAllowed,
  );
});

test("duplicate names are refused with a sentence you can act on", () => {
  assert.throws(
    () =>
      createProject(pm, {
        accountId: "acc_ovi",
        projectTypeId: "pt_brand",
        name: "Test Rebrand",
        leadId: "p_chike",
        targetEndOn: null,
        roundsIncluded: 2,
        tags: [],
      }),
    /already a project called/,
  );
});

test("client creation validates and rejects duplicates", () => {
  const c = createClient(pm, {
    name: "Northwind Labs",
    contactName: "Ada",
    contactEmail: "Ada@Northwind.com ",
  });
  assert.equal(c.slug, "northwind-labs");
  assert.equal(c.contactEmail, "ada@northwind.com");
  assert.throws(
    () => createClient(pm, { name: "Northwind Labs", contactName: "x", contactEmail: "x@y.com" }),
    /already have a client/,
  );
  assert.throws(() => createClient(lead, { name: "X", contactName: "", contactEmail: "" }), NotAllowed);
});

test("only the super admin can invite, and the email must look like one", () => {
  assert.throws(
    () => inviteTeamMember(pm, { name: "Nope", email: "n@x.com", role: "member" }),
    NotAllowed,
  );
  assert.throws(
    () => inviteTeamMember(superAdmin, { name: "Bad", email: "not-an-email", role: "member" }),
    /doesn’t look like an email/,
  );
  const invite = inviteTeamMember(superAdmin, {
    name: "Kemi Ade",
    email: "Kemi@griida.com",
    role: "lead",
  });
  assert.equal(invite.email, "kemi@griida.com");
  assert.throws(
    () => inviteTeamMember(superAdmin, { name: "Kemi Ade", email: "other@x.com", role: "member" }),
    /already on the team/,
  );
});
