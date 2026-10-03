import assert from "node:assert/strict";
import { workOpportunities } from "../src/data";
import {
  activeWorkApplication,
  closeWorkOpportunity,
  copyWorkOpportunityToDraft,
  createInitialWorkState,
  createWorkPostDraft,
  discardWorkApplicationDraft,
  discardWorkPostDraft,
  editWorkPostDraft,
  markWorkApplicationReviewed,
  openWorkOpportunities,
  ownedWorkOpportunities,
  publishWorkPost,
  removedWorkPostDraft,
  restoreWorkPostDraft,
  reviewWorkPostDraft,
  submitWorkApplication,
  updateWorkApplicantView,
  updateWorkApplicationDraft,
  updateWorkHiringView,
  updateWorkMarketplaceView,
  updateWorkPostDraft,
  validateWorkApplicationDraft,
  validateWorkPostDraft,
  visibleWorkApplications,
  withdrawWorkApplication,
  workApplicantView,
  workApplicationDraft,
  workApplicationDrafts,
  workHiringView,
  workMarketplaceView,
  workPostDrafts,
  workspaceWorkApplicant,
  workspaceWorkBusiness,
  type WorkApplicationDraft,
  type WorkPostFields,
  type WorkState,
} from "../src/components/workState";

const now = new Date(2026, 9, 3, 11, 30);
const later = new Date(2026, 9, 3, 12, 30);
const initial = createInitialWorkState();
const sharedId = "work-volt-electrical";
const foreignId = "work-casa-cleaning";
const goodPost: WorkPostFields = {
  title: "  Electrical project assistant  ",
  type: "Project",
  location: "  Barcelona  ",
  pay: "  €20–€25 per hour, agreed directly  ",
  description:
    "  Assist the business with electrical project preparation and agreed support tasks.  ",
  skills: "Electrical, Customer care, electrical,  Preparation ,",
};
const goodApplication: WorkApplicationDraft = {
  introduction:
    "  I have experience supporting maintenance projects and communicating with customers.  ",
  availability: "Choose a date",
  customDate: "2026-10-20",
};
const post = (state: WorkState, id = sharedId) =>
  state.opportunities.find((item) => item.id === id)!;
const application = (state: WorkState, id: string) =>
  state.applications.find((item) => item.id === id)!;

assert.equal(workspaceWorkBusiness.id, "volt-co");
assert.equal(workspaceWorkBusiness.name, "Volt & Co.");
assert.equal(workspaceWorkApplicant.id, "tenant-ines");
assert.equal(
  new Set(workOpportunities.map((item) => item.id)).size,
  workOpportunities.length,
);
assert.ok(
  workOpportunities.every((item) => item.businessId && item.description),
);
assert.deepEqual(
  ownedWorkOpportunities(initial, "provider").map((item) => item.id),
  [sharedId],
);
assert.equal(openWorkOpportunities(initial).length, 4);
assert.ok(
  initial.opportunities.every(
    (item) => item.source === "sample" && item.status === "Open",
  ),
);
assert.notEqual(initial.opportunities[0].skills, workOpportunities[0].skills);
assert.notEqual(
  createInitialWorkState().opportunities[0],
  initial.opportunities[0],
);
assert.deepEqual(initial.applications, []);
assert.equal(
  closeWorkOpportunity(initial, "provider", foreignId, now),
  initial,
  "Matching display names cannot grant authority over another business",
);
const renamedForeign: WorkState = {
  ...initial,
  opportunities: initial.opportunities.map((item) =>
    item.id === foreignId ? { ...item, business: "Volt & Co." } : item,
  ),
};
assert.equal(
  closeWorkOpportunity(renamedForeign, "provider", foreignId, now),
  renamedForeign,
);
const renamedOwn: WorkState = {
  ...initial,
  opportunities: initial.opportunities.map((item) =>
    item.id === sharedId ? { ...item, business: "Updated display name" } : item,
  ),
};
assert.equal(
  post(closeWorkOpportunity(renamedOwn, "provider", sharedId, now)).status,
  "Closed",
  "Stable business id controls ownership",
);

for (const role of ["tenant", "landlord", "spaceOperator", "admin"] as const) {
  assert.deepEqual(ownedWorkOpportunities(initial, role), []);
  assert.deepEqual(workPostDrafts(initial, role), []);
  assert.equal(createWorkPostDraft(initial, role, now).state, initial);
  assert.equal(closeWorkOpportunity(initial, role, sharedId, now), initial);
  assert.equal(
    updateWorkHiringView(initial, role, { query: "private" }),
    initial,
  );
  assert.equal(removedWorkPostDraft(initial, role), null);
  assert.equal(restoreWorkPostDraft(initial, role).state, initial);
}
for (const role of [
  "provider",
  "landlord",
  "spaceOperator",
  "admin",
] as const) {
  assert.equal(workApplicationDraft(initial, role, sharedId), null);
  assert.deepEqual(workApplicationDrafts(initial, role), []);
  assert.equal(
    updateWorkApplicationDraft(initial, role, sharedId, goodApplication),
    initial,
  );
  assert.equal(
    submitWorkApplication(initial, role, sharedId, now).state,
    initial,
  );
  assert.equal(
    updateWorkApplicantView(initial, role, { filter: "Withdrawn" }),
    initial,
  );
}
assert.equal(workApplicationDraft(initial, "tenant", "unknown"), null);
assert.equal(
  submitWorkApplication(initial, "tenant", "unknown", now).issue?.code,
  "unavailable",
);
assert.equal(
  closeWorkOpportunity(initial, "provider", "unknown", now),
  initial,
);

const created = createWorkPostDraft(initial, "provider", now);
assert.ok(created.draftId);
const draftId = created.draftId!;
assert.equal(created.state.hiringView.section, "drafts");
assert.equal(created.state.hiringView.selectedDraftId, draftId);
const emptyDraft = workPostDrafts(created.state, "provider")[0];
assert.equal(emptyDraft.businessId, workspaceWorkBusiness.id);
assert.equal(emptyDraft.stage, "editing");
assert.equal(emptyDraft.title, "");
assert.ok(Object.keys(validateWorkPostDraft(emptyDraft)).length);
assert.equal(
  reviewWorkPostDraft(created.state, "provider", draftId, now).state,
  created.state,
);
assert.equal(
  publishWorkPost(created.state, "provider", draftId, emptyDraft.revision, now)
    .issue?.code,
  "notReviewed",
);
assert.deepEqual(workPostDrafts(created.state, "tenant"), []);
assert.equal(
  created.state.opportunities,
  initial.opportunities,
  "Private draft creation does not publish a catalogue record",
);

const edited = updateWorkPostDraft(
  created.state,
  "provider",
  draftId,
  goodPost,
  now,
);
const draft = workPostDrafts(edited, "provider")[0];
assert.equal(draft.revision, 1);
assert.equal(emptyDraft.title, "");
assert.equal(
  draft.title,
  goodPost.title,
  "Unsent input, including whitespace, is retained until publication",
);
assert.deepEqual(validateWorkPostDraft(draft), {});
assert.equal(
  updateWorkPostDraft(edited, "provider", draftId, goodPost, later),
  edited,
  "Identical FormData does not invalidate a current preview",
);
assert.equal(
  updateWorkPostDraft(edited, "tenant", draftId, { title: "Overwrite" }),
  edited,
);
assert.equal(reviewWorkPostDraft(edited, "tenant", draftId).state, edited);
assert.equal(
  publishWorkPost(edited, "tenant", draftId, draft.revision).state,
  edited,
);
const extraDraft = createWorkPostDraft(edited, "provider", now);
const preview = reviewWorkPostDraft(extraDraft.state, "provider", draftId, now);
assert.equal(preview.issue, null);
const reviewedDraft = workPostDrafts(preview.state, "provider").find(
  (item) => item.id === draftId,
)!;
assert.equal(reviewedDraft.stage, "review");
assert.equal(reviewedDraft.reviewedRevision, reviewedDraft.revision);
const changedAfterReview = updateWorkPostDraft(
  preview.state,
  "provider",
  draftId,
  { pay: "€30 per hour" },
  later,
);
assert.equal(
  publishWorkPost(
    changedAfterReview,
    "provider",
    draftId,
    reviewedDraft.revision,
    later,
  ).issue?.code,
  "staleDraft",
);
assert.equal(
  publishWorkPost(
    changedAfterReview,
    "provider",
    draftId,
    reviewedDraft.revision + 1,
    later,
  ).issue?.code,
  "notReviewed",
);
const backToEdit = editWorkPostDraft(preview.state, "provider", draftId);
assert.equal(
  publishWorkPost(
    backToEdit,
    "provider",
    draftId,
    reviewedDraft.revision,
    later,
  ).issue?.code,
  "notReviewed",
);
const published = publishWorkPost(
  preview.state,
  "provider",
  draftId,
  reviewedDraft.revision,
  now,
);
assert.equal(published.issue, null);
assert.ok(published.opportunityId);
const localId = published.opportunityId!;
const localPost = post(published.state, localId);
assert.equal(localPost.businessId, workspaceWorkBusiness.id);
assert.equal(localPost.business, workspaceWorkBusiness.name);
assert.equal(localPost.source, "local");
assert.equal(localPost.status, "Open");
assert.equal(localPost.title, goodPost.title.trim());
assert.equal(localPost.description, goodPost.description.trim());
assert.equal(localPost.pay, goodPost.pay.trim());
assert.deepEqual(localPost.skills, [
  "Electrical",
  "Customer care",
  "Preparation",
]);
assert.equal(localPost.createdAt, now.toISOString());
assert.equal(
  published.state.postDrafts.length,
  1,
  "Publishing consumes only the reviewed draft",
);
assert.equal(published.state.postDrafts[0].id, extraDraft.draftId);
assert.equal(published.state.hiringView.selectedPostId, localId);
assert.equal(published.state.hiringView.section, "posts");
assert.equal(
  publishWorkPost(
    published.state,
    "provider",
    draftId,
    reviewedDraft.revision,
    now,
  ).state,
  published.state,
  "A consumed draft cannot publish twice",
);
assert.equal(
  updateWorkPostDraft(published.state, "provider", draftId, {
    title: "Cannot mutate published terms",
  }),
  published.state,
);
assert.equal(openWorkOpportunities(published.state).length, 5);

for (const invalid of [
  { ...goodPost, title: " " },
  { ...goodPost, title: "ab" },
  { ...goodPost, title: "x".repeat(101) },
  { ...goodPost, type: "Internship" as WorkPostFields["type"] },
  { ...goodPost, location: "x" },
  { ...goodPost, location: "x".repeat(141) },
  { ...goodPost, pay: " " },
  { ...goodPost, pay: "x".repeat(161) },
  { ...goodPost, description: "Too little" },
  { ...goodPost, description: "x".repeat(4001) },
  { ...goodPost, skills: "x".repeat(41) },
  {
    ...goodPost,
    skills: Array.from({ length: 11 }, (_, index) => `Skill${index}`).join(","),
  },
])
  assert.ok(Object.keys(validateWorkPostDraft(invalid)).length);
assert.deepEqual(
  validateWorkPostDraft({ ...goodPost, skills: "" }),
  {},
  "Skills are optional; no invented certifications",
);
const discarded = discardWorkPostDraft(preview.state, "provider", draftId);
assert.equal(removedWorkPostDraft(discarded, "provider"), reviewedDraft);
assert.equal(removedWorkPostDraft(discarded, "tenant"), null);
assert.equal(
  discardWorkPostDraft(preview.state, "tenant", draftId),
  preview.state,
);
assert.equal(restoreWorkPostDraft(discarded, "tenant").state, discarded);
const restored = restoreWorkPostDraft(discarded, "provider");
assert.equal(restored.issue, null);
assert.equal(
  workPostDrafts(restored.state, "provider").find(
    (item) => item.id === draftId,
  ),
  reviewedDraft,
);
assert.equal(restored.state.removedPostDraft, null);
assert.equal(
  restoreWorkPostDraft(restored.state, "provider").issue?.code,
  "nothingToRestore",
);
assert.equal(
  discardWorkPostDraft(restored.state, "provider", "unknown"),
  restored.state,
);

assert.deepEqual(validateWorkApplicationDraft(goodApplication, now), {});
for (const invalid of [
  { ...goodApplication, introduction: " " },
  { ...goodApplication, introduction: "short" },
  { ...goodApplication, introduction: "x".repeat(2001) },
  {
    ...goodApplication,
    availability: "Unknown" as WorkApplicationDraft["availability"],
  },
  { ...goodApplication, customDate: "2026-10-02" },
  { ...goodApplication, customDate: "2026-02-30" },
  { ...goodApplication, customDate: "2026-10-3" },
])
  assert.ok(Object.keys(validateWorkApplicationDraft(invalid, now)).length);
assert.deepEqual(
  validateWorkApplicationDraft(
    { ...goodApplication, customDate: "2026-10-03" },
    now,
  ),
  {},
);
const invalidRetained = updateWorkApplicationDraft(
  published.state,
  "tenant",
  localId,
  { introduction: "x", availability: "", customDate: "" },
);
assert.equal(invalidRetained.applications, published.state.applications);
assert.equal(
  workApplicationDraft(invalidRetained, "tenant", localId)?.introduction,
  "x",
);
assert.equal(workApplicationDraft(invalidRetained, "provider", localId), null);
assert.equal(
  submitWorkApplication(invalidRetained, "tenant", localId, now).state,
  invalidRetained,
);
const applicantDrafts = updateWorkApplicationDraft(
  updateWorkApplicationDraft(
    invalidRetained,
    "tenant",
    localId,
    goodApplication,
  ),
  "tenant",
  foreignId,
  {
    ...goodApplication,
    availability: "Within 2 weeks",
    customDate: "not used",
  },
);
assert.equal(workApplicationDrafts(applicantDrafts, "tenant").length, 2);
assert.deepEqual(workApplicationDrafts(applicantDrafts, "provider"), []);
assert.deepEqual(
  visibleWorkApplications(applicantDrafts, "provider"),
  [],
  "Employers cannot inspect unsent applicant drafts",
);
const submitted = submitWorkApplication(
  applicantDrafts,
  "tenant",
  localId,
  now,
);
assert.equal(submitted.issue, null);
assert.ok(submitted.applicationId);
const appId = submitted.applicationId!;
const app = application(submitted.state, appId);
assert.equal(app.applicantId, workspaceWorkApplicant.id);
assert.equal(app.applicantName, workspaceWorkApplicant.name);
assert.equal(app.businessId, workspaceWorkBusiness.id);
assert.equal(app.status, "Submitted");
assert.equal(app.reviewedAt, undefined);
assert.deepEqual(app.submission, {
  introduction: goodApplication.introduction.trim(),
  availability: "Choose a date",
  availableFrom: "2026-10-20",
});
assert.equal(app.opportunity.id, localId);
assert.equal(app.opportunity.title, localPost.title);
assert.equal(app.opportunity.pay, localPost.pay);
assert.notEqual(app.opportunity, localPost);
assert.notEqual(app.opportunity.skills, localPost.skills);
assert.equal(Object.hasOwn(app.opportunity, "status"), false);
assert.equal(app.history[0].action, "submitted");
assert.equal(app.submittedAt, now.toISOString());
assert.equal(submitted.state.applicationDrafts[localId], undefined);
assert.equal(
  submitted.state.applicationDrafts[foreignId],
  applicantDrafts.applicationDrafts[foreignId],
);
assert.equal(submitted.state.applicantView.selectedApplicationId, appId);
assert.equal(visibleWorkApplications(submitted.state, "provider")[0], app);
assert.equal(visibleWorkApplications(submitted.state, "tenant")[0], app);
assert.equal(activeWorkApplication(submitted.state, "tenant", localId), app);
assert.equal(
  activeWorkApplication(submitted.state, "provider", localId),
  undefined,
);
assert.equal(
  submitWorkApplication(submitted.state, "tenant", localId, later).issue?.code,
  "duplicate",
);
assert.equal(
  updateWorkApplicationDraft(submitted.state, "tenant", localId, {
    introduction: "Must not overwrite submitted snapshot",
  }),
  submitted.state,
);

const foreignSubmitted = submitWorkApplication(
  submitted.state,
  "tenant",
  foreignId,
  now,
);
const foreignApp = application(
  foreignSubmitted.state,
  foreignSubmitted.applicationId!,
);
assert.equal(foreignApp.submission.availableFrom, "2026-10-17");
assert.equal(foreignApp.submission.availability, "Within 2 weeks");
assert.equal(
  visibleWorkApplications(foreignSubmitted.state, "provider").length,
  1,
);
assert.equal(
  markWorkApplicationReviewed(
    foreignSubmitted.state,
    "provider",
    foreignApp.id,
    later,
  ),
  foreignSubmitted.state,
);
const mismatchedBusiness = { ...app, businessId: "casa-clara" };
assert.deepEqual(
  visibleWorkApplications(
    { ...submitted.state, applications: [mismatchedBusiness] },
    "provider",
  ),
  [],
);
const mismatchedSnapshot = {
  ...app,
  opportunity: { ...app.opportunity, businessId: "casa-clara" },
};
assert.deepEqual(
  visibleWorkApplications(
    { ...submitted.state, applications: [mismatchedSnapshot] },
    "provider",
  ),
  [],
);
const mismatchedCandidate = {
  ...app,
  applicantId: "different-applicant",
  applicantName: workspaceWorkApplicant.name,
};
assert.deepEqual(
  visibleWorkApplications(
    { ...submitted.state, applications: [mismatchedCandidate] },
    "tenant",
  ),
  [],
);
for (const role of ["tenant", "landlord", "spaceOperator", "admin"] as const)
  assert.equal(
    markWorkApplicationReviewed(submitted.state, role, appId, later),
    submitted.state,
  );
const reviewed = markWorkApplicationReviewed(
  submitted.state,
  "provider",
  appId,
  later,
);
assert.equal(
  application(reviewed, appId).status,
  "Submitted",
  "Review records no hiring, acceptance or rejection decision",
);
assert.equal(application(reviewed, appId).reviewedAt, later.toISOString());
assert.equal(application(reviewed, appId).submission, app.submission);
assert.equal(application(reviewed, appId).opportunity, app.opportunity);
assert.equal(application(reviewed, appId).history.at(-1)!.action, "reviewed");
assert.equal(
  app.reviewedAt,
  undefined,
  "Prior application state remains unchanged",
);
assert.equal(
  markWorkApplicationReviewed(reviewed, "provider", appId, later),
  reviewed,
);
for (const role of ["provider", "landlord", "spaceOperator", "admin"] as const)
  assert.equal(withdrawWorkApplication(reviewed, role, appId, later), reviewed);
const withdrawn = withdrawWorkApplication(reviewed, "tenant", appId, later);
assert.equal(application(withdrawn, appId).status, "Withdrawn");
assert.equal(
  application(withdrawn, appId).reviewedAt,
  later.toISOString(),
  "Withdrawal preserves factual earlier review history",
);
assert.equal(application(withdrawn, appId).submission, app.submission);
assert.equal(application(withdrawn, appId).history.at(-1)!.action, "withdrawn");
assert.equal(activeWorkApplication(withdrawn, "tenant", localId), undefined);
assert.equal(
  markWorkApplicationReviewed(withdrawn, "provider", appId, later),
  withdrawn,
);
assert.equal(
  withdrawWorkApplication(withdrawn, "tenant", appId, later),
  withdrawn,
);
const reapplyDraft = updateWorkApplicationDraft(withdrawn, "tenant", localId, {
  ...goodApplication,
  availability: "Immediately",
  customDate: "old ignored value",
});
const reapplied = submitWorkApplication(reapplyDraft, "tenant", localId, later);
assert.ok(reapplied.applicationId);
assert.notEqual(reapplied.applicationId, appId);
assert.equal(reapplied.state.applications.length, 2);
assert.equal(
  application(reapplied.state, reapplied.applicationId!).submission
    .availableFrom,
  "2026-10-03",
);
assert.equal(
  application(reapplied.state, appId),
  application(withdrawn, appId),
);
assert.equal(
  application(reapplied.state, reapplied.applicationId!).reviewedAt,
  undefined,
);

const closed = closeWorkOpportunity(
  reapplied.state,
  "provider",
  localId,
  later,
);
assert.equal(post(closed, localId).status, "Closed");
assert.equal(post(closed, localId).closedAt, later.toISOString());
assert.equal(post(reapplied.state, localId).status, "Open");
assert.equal(
  openWorkOpportunities(closed).some((item) => item.id === localId),
  false,
);
assert.equal(
  closed.applications,
  reapplied.state.applications,
  "Closing a post does not alter submitted application snapshots",
);
assert.equal(
  submitWorkApplication(closed, "tenant", localId, later).issue?.code,
  "closed",
);
assert.equal(closeWorkOpportunity(closed, "provider", localId, later), closed);
const reviewedClosed = markWorkApplicationReviewed(
  closed,
  "provider",
  reapplied.applicationId!,
  later,
);
assert.equal(
  application(reviewedClosed, reapplied.applicationId!).reviewedAt,
  later.toISOString(),
  "Closing stops new applications but does not hide existing review work",
);
const withdrawnClosed = withdrawWorkApplication(
  reviewedClosed,
  "tenant",
  reapplied.applicationId!,
  later,
);
assert.equal(
  application(withdrawnClosed, reapplied.applicationId!).status,
  "Withdrawn",
);
assert.equal(
  submitWorkApplication(withdrawnClosed, "tenant", localId, later).issue?.code,
  "closed",
  "Reapplication cannot bypass closed-post guard",
);
const draftBeforeClosure = updateWorkApplicationDraft(
  published.state,
  "tenant",
  localId,
  goodApplication,
);
const closedWithDraft = closeWorkOpportunity(
  draftBeforeClosure,
  "provider",
  localId,
  later,
);
assert.equal(
  workApplicationDraft(closedWithDraft, "tenant", localId),
  draftBeforeClosure.applicationDrafts[localId],
);
assert.equal(
  updateWorkApplicationDraft(closedWithDraft, "tenant", localId, {
    introduction: "Overwrite closed draft",
  }),
  closedWithDraft,
);
assert.equal(
  submitWorkApplication(closedWithDraft, "tenant", localId, later).issue?.code,
  "closed",
);
assert.equal(
  discardWorkApplicationDraft(closedWithDraft, "provider", localId),
  closedWithDraft,
);
assert.equal(
  discardWorkApplicationDraft(closedWithDraft, "tenant", localId)
    .applicationDrafts[localId],
  undefined,
);

const yearRollover = new Date(2026, 11, 25, 23, 30);
const rolloverDraft = updateWorkApplicationDraft(initial, "tenant", sharedId, {
  ...goodApplication,
  availability: "Within 2 weeks",
  customDate: "",
});
const rolloverApplication = submitWorkApplication(
  rolloverDraft,
  "tenant",
  sharedId,
  yearRollover,
);
assert.equal(
  application(rolloverApplication.state, rolloverApplication.applicationId!)
    .submission.availableFrom,
  "2027-01-08",
);
const datePassed = new Date(2026, 9, 21, 9);
assert.equal(
  submitWorkApplication(draftBeforeClosure, "tenant", localId, datePassed)
    .errors.customDate,
  "invalidDate",
  "A retained custom date is revalidated at submission",
);

const views = updateWorkMarketplaceView(
  updateWorkMarketplaceView(initial, "tenant", {
    type: "Project",
    status: "All",
    query: "electric",
    section: "applications",
    selectedOpportunityId: sharedId,
  }),
  "provider",
  { query: "provider search", type: "Freelance" },
);
assert.equal(workMarketplaceView(views, "tenant").query, "electric");
assert.equal(workMarketplaceView(views, "provider").query, "provider search");
assert.equal(workMarketplaceView(views, "tenant").type, "Project");
assert.equal(workMarketplaceView(views, "landlord").query, "");
assert.equal(
  workMarketplaceView(
    updateWorkMarketplaceView(views, "tenant", {
      selectedOpportunityId: "unknown",
    }),
    "tenant",
  ).selectedOpportunityId,
  sharedId,
);
assert.equal(
  workMarketplaceView(
    updateWorkMarketplaceView(views, "admin", { query: "x".repeat(201) }),
    "admin",
  ).query.length,
  200,
);
const hiringFiltered = updateWorkHiringView(
  foreignSubmitted.state,
  "provider",
  {
    section: "applications",
    applicationFilter: "Unreviewed",
    filter: "Closed",
    query: "x".repeat(201),
    selectedPostId: localId,
    selectedApplicationId: appId,
  },
);
assert.equal(workHiringView(hiringFiltered, "provider").query.length, 200);
assert.equal(workHiringView(hiringFiltered, "tenant").query, "");
assert.equal(
  workHiringView(
    updateWorkHiringView(hiringFiltered, "provider", {
      selectedApplicationId: foreignApp.id,
    }),
    "provider",
  ).selectedApplicationId,
  appId,
);
assert.equal(
  workHiringView(
    updateWorkHiringView(hiringFiltered, "provider", {
      selectedPostId: foreignId,
    }),
    "provider",
  ).selectedPostId,
  localId,
);
const applicantFiltered = updateWorkApplicantView(reapplied.state, "tenant", {
  filter: "Withdrawn",
  selectedApplicationId: appId,
});
assert.equal(
  workApplicantView(applicantFiltered, "tenant").filter,
  "Withdrawn",
);
assert.equal(
  workApplicantView(applicantFiltered, "provider").selectedApplicationId,
  null,
);
assert.equal(
  workApplicantView(
    updateWorkApplicantView(applicantFiltered, "tenant", {
      selectedApplicationId: "unknown",
    }),
    "tenant",
  ).selectedApplicationId,
  appId,
);

// Record-creating actions open only their own target, even from an application.
const fromApplication = createWorkPostDraft(hiringFiltered, "provider", now);
assert.equal(fromApplication.state.hiringView.selectedPostId, null);
assert.equal(fromApplication.state.hiringView.selectedApplicationId, null);
assert.equal(
  fromApplication.state.hiringView.selectedDraftId,
  fromApplication.draftId,
);
const restoredFromApplication = restoreWorkPostDraft(
  { ...discarded, hiringView: hiringFiltered.hiringView },
  "provider",
);
assert.equal(restoredFromApplication.state.hiringView.selectedPostId, null);
assert.equal(
  restoredFromApplication.state.hiringView.selectedApplicationId,
  null,
);
assert.equal(restoredFromApplication.state.hiringView.selectedDraftId, draftId);
const publishedFromApplication = publishWorkPost(
  { ...preview.state, hiringView: hiringFiltered.hiringView },
  "provider",
  draftId,
  reviewedDraft.revision,
  now,
);
assert.ok(publishedFromApplication.opportunityId);
assert.equal(publishedFromApplication.state.hiringView.selectedDraftId, null);
assert.equal(
  publishedFromApplication.state.hiringView.selectedApplicationId,
  null,
);
assert.equal(
  publishedFromApplication.state.hiringView.selectedPostId,
  publishedFromApplication.opportunityId,
);

Object.freeze(reviewedDraft);
Object.freeze(localPost.skills);
Object.freeze(localPost);
Object.freeze(app.submission);
Object.freeze(app.opportunity.skills);
Object.freeze(app.opportunity);
Object.freeze(app.history[0]);
Object.freeze(app.history);
Object.freeze(app);
assert.ok(
  publishWorkPost(
    preview.state,
    "provider",
    draftId,
    reviewedDraft.revision,
    now,
  ).opportunityId,
);
assert.equal(
  application(
    markWorkApplicationReviewed(submitted.state, "provider", appId, later),
    appId,
  ).status,
  "Submitted",
);
assert.equal(
  application(
    withdrawWorkApplication(submitted.state, "tenant", appId, later),
    appId,
  ).status,
  "Withdrawn",
);
assert.equal(
  post(
    closeWorkOpportunity(published.state, "provider", localId, later),
    localId,
  ).status,
  "Closed",
);
assert.equal(initial.opportunities.length, 4);
assert.equal(initial.postDrafts.length, 0);
assert.equal(initial.applications.length, 0);
assert.equal(
  new Set(application(withdrawn, appId).history.map((event) => event.id)).size,
  application(withdrawn, appId).history.length,
);

// Reusing a post copies only editable listing content into a fresh private draft.
for (const [sourceState, sourceId] of [
  [initial, sharedId],
  [closeWorkOpportunity(initial, "provider", sharedId, now), sharedId],
  [published.state, localId],
  [closed, localId],
] as const) {
  const original = post(sourceState, sourceId);
  const copy = copyWorkOpportunityToDraft(
    sourceState,
    "provider",
    sourceId,
    later,
  );
  assert.equal(copy.issue, null);
  assert.ok(copy.draftId);
  const copiedDraft = workPostDrafts(copy.state, "provider").find(
    (item) => item.id === copy.draftId,
  )!;
  assert.deepEqual(
    {
      title: copiedDraft.title,
      type: copiedDraft.type,
      location: copiedDraft.location,
      pay: copiedDraft.pay,
      description: copiedDraft.description,
      skills: copiedDraft.skills,
    },
    {
      title: original.title,
      type: original.type,
      location: original.location,
      pay: original.pay,
      description: original.description,
      skills: original.skills.join(", "),
    },
  );
  assert.equal(copiedDraft.revision, 0);
  assert.equal(copiedDraft.stage, "editing");
  assert.equal(copiedDraft.reviewedRevision, null);
  assert.equal(copiedDraft.createdAt, later.toISOString());
  assert.equal(copiedDraft.updatedAt, later.toISOString());
  assert.equal(copiedDraft.businessId, workspaceWorkBusiness.id);
  assert.equal(copy.state.hiringView.section, "drafts");
  assert.equal(copy.state.hiringView.selectedDraftId, copy.draftId);
  assert.equal(copy.state.hiringView.selectedPostId, null);
  assert.equal(copy.state.hiringView.selectedApplicationId, null);
  assert.equal(copy.state.postDrafts.length, sourceState.postDrafts.length + 1);
  for (const existing of sourceState.postDrafts)
    assert.equal(
      copy.state.postDrafts.find((item) => item.id === existing.id),
      existing,
    );
  assert.equal(copy.state.removedPostDraft, sourceState.removedPostDraft);
  assert.equal(copy.state.opportunities, sourceState.opportunities);
  assert.equal(copy.state.applications, sourceState.applications);
  assert.equal(copy.state.applicationDrafts, sourceState.applicationDrafts);
  assert.equal(copy.state.nextPostId, sourceState.nextPostId);
  assert.equal(copy.state.nextApplicationId, sourceState.nextApplicationId);
  assert.equal(post(copy.state, sourceId), original);
  assert.equal(
    publishWorkPost(
      copy.state,
      "provider",
      copy.draftId,
      copiedDraft.revision,
      later,
    ).issue?.code,
    "notReviewed",
  );

  const reviewedCopy = reviewWorkPostDraft(
    copy.state,
    "provider",
    copy.draftId,
    later,
  );
  assert.deepEqual(reviewedCopy.errors, {});
  assert.equal(reviewedCopy.issue, null);
  const newPost = publishWorkPost(
    reviewedCopy.state,
    "provider",
    copy.draftId,
    copiedDraft.revision,
    later,
  );
  assert.equal(newPost.issue, null);
  assert.ok(newPost.opportunityId);
  assert.notEqual(newPost.opportunityId, sourceId);
  const newRecord = post(newPost.state, newPost.opportunityId);
  assert.equal(newRecord.status, "Open");
  assert.equal(newRecord.source, "local");
  assert.equal(newRecord.closedAt, undefined);
  assert.equal(newRecord.createdAt, later.toISOString());
  assert.deepEqual(newRecord.skills, original.skills);
  assert.notEqual(newRecord.skills, original.skills);
  assert.equal(post(newPost.state, sourceId), original);
  assert.equal(newPost.state.applications, sourceState.applications);
  assert.equal(newPost.state.applicationDrafts, sourceState.applicationDrafts);
  assert.ok(
    newPost.state.applications.every(
      (item) => item.opportunityId !== newPost.opportunityId,
    ),
  );
}
for (const role of ["tenant", "landlord", "spaceOperator", "admin"] as const) {
  const copy = copyWorkOpportunityToDraft(closed, role, localId, later);
  assert.equal(copy.state, closed);
  assert.equal(copy.draftId, null);
  assert.equal(copy.issue?.code, "unavailable");
}
for (const id of [foreignId, "unknown", "__proto__"]) {
  const copy = copyWorkOpportunityToDraft(
    renamedForeign,
    "provider",
    id,
    later,
  );
  assert.equal(copy.state, renamedForeign);
  assert.equal(copy.draftId, null);
  assert.equal(copy.issue?.code, "unavailable");
}
assert.ok(
  copyWorkOpportunityToDraft(renamedOwn, "provider", sharedId, later).draftId,
);
const copyFromApplication = copyWorkOpportunityToDraft(
  hiringFiltered,
  "provider",
  localId,
  later,
);
assert.equal(copyFromApplication.state.hiringView.selectedApplicationId, null);
assert.equal(copyFromApplication.state.hiringView.selectedPostId, null);
assert.equal(
  copyFromApplication.state.hiringView.selectedDraftId,
  copyFromApplication.draftId,
);

const firstCopy = copyWorkOpportunityToDraft(
  closed,
  "provider",
  localId,
  later,
);
const secondCopy = copyWorkOpportunityToDraft(
  firstCopy.state,
  "provider",
  localId,
  later,
);
assert.ok(firstCopy.draftId && secondCopy.draftId);
assert.notEqual(firstCopy.draftId, secondCopy.draftId);
const copyRemoved = discardWorkPostDraft(
  secondCopy.state,
  "provider",
  firstCopy.draftId,
);
const collisionCopy = copyWorkOpportunityToDraft(
  { ...copyRemoved, nextDraftId: 1 },
  "provider",
  localId,
  later,
);
assert.ok(collisionCopy.draftId);
assert.notEqual(collisionCopy.draftId, firstCopy.draftId);
assert.notEqual(collisionCopy.draftId, secondCopy.draftId);
assert.equal(collisionCopy.state.removedPostDraft?.id, firstCopy.draftId);
const reviewedReuse = reviewWorkPostDraft(
  secondCopy.state,
  "provider",
  secondCopy.draftId,
  later,
);
const editedReuse = updateWorkPostDraft(
  reviewedReuse.state,
  "provider",
  secondCopy.draftId,
  { skills: "Independent new requirement", title: "Revised electrical role" },
  later,
);
const editedReuseDraft = workPostDrafts(editedReuse, "provider").find(
  (item) => item.id === secondCopy.draftId,
)!;
assert.equal(editedReuseDraft.revision, 1);
assert.equal(editedReuseDraft.reviewedRevision, null);
assert.equal(editedReuseDraft.stage, "editing");
assert.equal(
  publishWorkPost(editedReuse, "provider", secondCopy.draftId, 0, later).issue
    ?.code,
  "staleDraft",
);
assert.equal(
  publishWorkPost(editedReuse, "provider", secondCopy.draftId, 1, later).issue
    ?.code,
  "notReviewed",
);
assert.equal(post(editedReuse, localId), post(closed, localId));
assert.equal(editedReuse.applications, closed.applications);
assert.equal(
  application(editedReuse, appId).history,
  application(closed, appId).history,
);
assert.equal(
  application(editedReuse, appId).opportunity,
  application(closed, appId).opportunity,
);
assert.equal(
  application(editedReuse, appId).submission,
  application(closed, appId).submission,
);
const invalidReuse = updateWorkPostDraft(
  editedReuse,
  "provider",
  secondCopy.draftId,
  { title: "" },
  later,
);
assert.equal(
  reviewWorkPostDraft(invalidReuse, "provider", secondCopy.draftId, later)
    .errors.title,
  "required",
);
assert.equal(post(invalidReuse, localId).status, "Closed");
console.log(
  "Work state checks passed: canonical business/applicant scope, private retained drafts, validated review/publish revisions, immutable opportunity/application snapshots, dated availability, explicit review/withdrawal, reapplication history, closed-post guards, scoped retained views and independent post reuse.",
);
