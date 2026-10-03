import assert from "node:assert/strict";
import {
  createInitialNotificationState,
  markAllNotificationsRead,
  markNotificationRead,
  notificationsForRole,
  unreadNotificationCount,
  type KasaNotification,
  type NotificationState,
} from "../src/components/notificationState";
import {
  openWorkNotification,
  reconcileWorkNotifications,
} from "../src/components/workNotifications";
import {
  closeWorkOpportunity,
  copyWorkOpportunityToDraft,
  createInitialWorkState,
  markWorkApplicationReviewed,
  publishWorkPost,
  reviewWorkPostDraft,
  submitWorkApplication,
  updateWorkApplicantView,
  updateWorkApplicationDraft,
  updateWorkHiringView,
  updateWorkMarketplaceView,
  withdrawWorkApplication,
  workApplicantView,
  workHiringView,
  workMarketplaceView,
  workPostDrafts,
  type WorkApplication,
  type WorkState,
} from "../src/components/workState";
import type { Role } from "../src/types";

const initial = createInitialWorkState();
const seeds = createInitialNotificationState();
const ownPost = "work-volt-electrical";
const foreignPost = "work-casa-cleaning";
const submittedAt = new Date("2032-05-10T09:00:00.000Z");
const reviewedAt = new Date("2032-05-10T09:05:00.000Z");
const withdrawnAt = new Date("2032-05-10T09:10:00.000Z");
const privateIntroduction =
  "PRIVATE_CANDIDATE_NOTE: My experience and background stay inside my application.";
const privateDate = "2032-06-20";
const draft = {
  introduction: privateIntroduction,
  availability: "Choose a date" as const,
  customDate: privateDate,
};
const activity = (state: NotificationState) =>
  state.items.filter((item) => item.workEvent);
const eventOf = (
  state: NotificationState,
  kind: NonNullable<KasaNotification["workEvent"]>["kind"],
) => {
  const event = activity(state).find((item) => item.workEvent?.kind === kind);
  assert.ok(event, `Expected ${kind}`);
  return event;
};
const application = (state: WorkState, id: string) => {
  const record = state.applications.find((item) => item.id === id);
  assert.ok(record);
  return record;
};
function submit(state: WorkState, opportunityId: string, at = submittedAt) {
  const result = submitWorkApplication(
    updateWorkApplicationDraft(state, "tenant", opportunityId, draft),
    "tenant",
    opportunityId,
    at,
  );
  assert.equal(result.issue, null);
  assert.deepEqual(result.errors, {});
  assert.ok(result.applicationId);
  return { state: result.state, id: result.applicationId };
}

// Drafting, copying and publishing an opportunity produce no candidate activity.
assert.equal(reconcileWorkNotifications(seeds, initial), seeds);
const privateDraft = updateWorkApplicationDraft(
  initial,
  "tenant",
  ownPost,
  draft,
);
assert.equal(reconcileWorkNotifications(seeds, privateDraft), seeds);
const copied = copyWorkOpportunityToDraft(
  privateDraft,
  "provider",
  ownPost,
  submittedAt,
);
assert.ok(copied.draftId);
assert.equal(reconcileWorkNotifications(seeds, copied.state), seeds);
const preview = reviewWorkPostDraft(
  copied.state,
  "provider",
  copied.draftId,
  submittedAt,
);
const copyDraft = workPostDrafts(preview.state, "provider").find(
  (item) => item.id === copied.draftId,
)!;
const published = publishWorkPost(
  preview.state,
  "provider",
  copied.draftId,
  copyDraft.revision,
  submittedAt,
);
assert.ok(published.opportunityId);
assert.equal(reconcileWorkNotifications(seeds, published.state), seeds);

// Only an owned business's submitted application reaches the provider workspace.
const submitted = submit(initial, ownPost);
const foreignSubmitted = submit(submitted.state, foreignPost);
const submittedEvents = reconcileWorkNotifications(
  seeds,
  foreignSubmitted.state,
);
assert.equal(activity(submittedEvents).length, 1);
const submission = eventOf(submittedEvents, "application-submitted");
assert.equal(submission.role, "provider");
assert.equal(submission.destination, "services");
assert.equal(submission.serviceMode, "hire");
assert.equal(submission.workEvent!.applicationId, submitted.id);
assert.equal(
  submission.workEvent!.opportunityTitle,
  application(submitted.state, submitted.id).opportunity.title,
);
assert.equal(submission.workEvent!.occurredAt, submittedAt.toISOString());
assert.ok(submission.id.startsWith("work:"));
assert.equal(submission.read, false);
assert.equal(
  unreadNotificationCount(submittedEvents, "provider"),
  unreadNotificationCount(seeds, "provider") + 1,
);
assert.deepEqual(
  notificationsForRole(submittedEvents, "tenant"),
  notificationsForRole(seeds, "tenant"),
);
assert.equal(
  reconcileWorkNotifications(submittedEvents, foreignSubmitted.state),
  submittedEvents,
);
assert.equal(
  reconcileWorkNotifications(seeds, foreignSubmitted.state).items[0].id,
  submission.id,
);
assert.equal(
  seeds.items.some((item) => item.id === submission.id),
  false,
);

// Read receipts survive projection; later real activity is newly unread.
const readSubmission = markNotificationRead(
  submittedEvents,
  "provider",
  submission.id,
);
assert.equal(
  markNotificationRead(readSubmission, "tenant", submission.id),
  readSubmission,
);
assert.equal(
  reconcileWorkNotifications(readSubmission, foreignSubmitted.state),
  readSubmission,
);
const reviewed = markWorkApplicationReviewed(
  foreignSubmitted.state,
  "provider",
  submitted.id,
  reviewedAt,
);
const withReview = reconcileWorkNotifications(readSubmission, reviewed);
const review = eventOf(withReview, "application-reviewed");
assert.equal(review.role, "tenant");
assert.equal(review.serviceMode, "jobs");
assert.equal(review.workEvent!.occurredAt, reviewedAt.toISOString());
assert.equal(review.workEvent!.applicationId, submitted.id);
assert.equal(review.read, false);
assert.equal(eventOf(withReview, "application-submitted").read, true);
assert.equal(
  application(reviewed, submitted.id).status,
  "Submitted",
  "Review records receipt; it is not a hiring or rejection decision",
);
assert.equal(
  application(reviewed, submitted.id).history.at(-1)!.action,
  "reviewed",
);
assert.equal(
  application(reviewed, submitted.id).submission,
  application(submitted.state, submitted.id).submission,
);
assert.equal(
  markWorkApplicationReviewed(reviewed, "provider", submitted.id, withdrawnAt),
  reviewed,
);
const allRead = markAllNotificationsRead(
  markAllNotificationsRead(withReview, "provider"),
  "tenant",
);
assert.equal(unreadNotificationCount(allRead, "provider"), 0);
assert.equal(unreadNotificationCount(allRead, "tenant"), 0);
const withdrawn = withdrawWorkApplication(
  reviewed,
  "tenant",
  submitted.id,
  withdrawnAt,
);
const withWithdrawal = reconcileWorkNotifications(allRead, withdrawn);
const withdrawal = eventOf(withWithdrawal, "application-withdrawn");
assert.equal(withdrawal.role, "provider");
assert.equal(withdrawal.workEvent!.occurredAt, withdrawnAt.toISOString());
assert.equal(withdrawal.read, false);
assert.equal(unreadNotificationCount(withWithdrawal, "provider"), 1);
assert.equal(unreadNotificationCount(withWithdrawal, "tenant"), 0);
assert.equal(
  eventOf(withWithdrawal, "application-submitted").id,
  submission.id,
);
assert.equal(eventOf(withWithdrawal, "application-submitted").read, true);
assert.equal(eventOf(withWithdrawal, "application-reviewed").read, true);
assert.equal(activity(withWithdrawal).length, 3);
assert.deepEqual(
  activity(withWithdrawal).map((item) => item.workEvent!.occurredAt),
  [withdrawnAt, reviewedAt, submittedAt].map((at) => at.toISOString()),
);
assert.equal(
  reconcileWorkNotifications(withWithdrawal, withdrawn),
  withWithdrawal,
);

// Deduplication retains a read receipt and source-history duplicates do not create alerts.
const duplicateHistory: WorkState = {
  ...withdrawn,
  applications: withdrawn.applications.map((record) =>
    record.id === submitted.id
      ? {
          ...record,
          history: [
            ...record.history,
            ...record.history.map((event) => ({ ...event })),
          ],
        }
      : record,
  ),
};
const duplicatedBase: NotificationState = {
  items: [
    ...withWithdrawal.items,
    { ...submission, read: false },
    { ...submission, read: true },
  ],
};
const deduplicated = reconcileWorkNotifications(
  duplicatedBase,
  duplicateHistory,
);
assert.equal(activity(deduplicated).length, 3);
assert.equal(
  new Set(deduplicated.items.map((item) => item.id)).size,
  deduplicated.items.length,
);
assert.equal(eventOf(deduplicated, "application-submitted").read, true);
assert.equal(
  reconcileWorkNotifications(deduplicated, duplicateHistory),
  deduplicated,
);

// The event payload contains only routing/copy facts, never private submitted fields.
for (const item of activity(withWithdrawal)) {
  assert.deepEqual(
    Object.keys(item.workEvent!).sort(),
    ["kind", "applicationId", "opportunityTitle", "occurredAt"].sort(),
  );
  const serialized = JSON.stringify(item);
  for (const privateValue of [
    privateIntroduction,
    privateDate,
    "Choose a date",
    "availableFrom",
    "introduction",
    "submission",
    "applicantName",
  ])
    assert.equal(
      serialized.includes(privateValue),
      false,
      `Notification must omit ${privateValue}`,
    );
}
const afterCopy = copyWorkOpportunityToDraft(
  withdrawn,
  "provider",
  ownPost,
  withdrawnAt,
);
assert.equal(
  reconcileWorkNotifications(withWithdrawal, afterCopy.state),
  withWithdrawal,
);

// Opening either historical provider alert targets the exact withdrawn application in a closed post.
const closed = closeWorkOpportunity(
  withdrawn,
  "provider",
  ownPost,
  withdrawnAt,
);
const obstructed = updateWorkMarketplaceView(
  updateWorkApplicantView(
    updateWorkHiringView(afterCopy.state, "provider", {
      section: "drafts",
      filter: "Open",
      applicationFilter: "Unreviewed",
      query: "unrelated search",
      selectedPostId: published.opportunityId,
      selectedDraftId: afterCopy.draftId,
      selectedApplicationId: foreignSubmitted.id,
    }),
    "tenant",
    { filter: "Submitted", selectedApplicationId: foreignSubmitted.id },
  ),
  "tenant",
  {
    section: "opportunities",
    query: "different opportunity",
    type: "Full time",
    status: "Open",
    selectedOpportunityId: foreignPost,
  },
);
const closedObstructed: WorkState = {
  ...obstructed,
  opportunities: closed.opportunities,
};
for (const item of [submission, withdrawal]) {
  const opened = openWorkNotification(closedObstructed, "provider", item);
  assert.ok(opened);
  assert.equal(opened.serviceMode, "hire");
  assert.deepEqual(workHiringView(opened.state, "provider"), {
    section: "applications",
    filter: "All",
    applicationFilter: "All",
    query: "",
    selectedApplicationId: submitted.id,
    selectedDraftId: null,
    selectedPostId: null,
  });
  assert.equal(opened.state.applications, closedObstructed.applications);
  assert.equal(opened.state.opportunities, closedObstructed.opportunities);
  assert.equal(
    opened.state.applicationDrafts,
    closedObstructed.applicationDrafts,
  );
  assert.equal(opened.state.postDrafts, closedObstructed.postDrafts);
  assert.equal(application(opened.state, submitted.id).status, "Withdrawn");
}
const tenantOpened = openWorkNotification(closedObstructed, "tenant", review);
assert.ok(tenantOpened);
assert.equal(tenantOpened.serviceMode, "jobs");
assert.deepEqual(workApplicantView(tenantOpened.state, "tenant"), {
  filter: "All",
  selectedApplicationId: submitted.id,
});
assert.deepEqual(workMarketplaceView(tenantOpened.state, "tenant"), {
  section: "applications",
  query: "",
  type: "All",
  status: "All",
  selectedOpportunityId: null,
});
assert.equal(tenantOpened.state.applications, closedObstructed.applications);
assert.equal(tenantOpened.state.hiringView, closedObstructed.hiringView);
assert.equal(
  workMarketplaceView(closedObstructed, "tenant").query,
  "different opportunity",
);

// Stale, wrong-role, foreign-business and forged event targets cannot redirect the UI.
for (const role of [
  "tenant",
  "landlord",
  "spaceOperator",
  "admin",
  "guest",
] as unknown as Role[])
  assert.equal(openWorkNotification(closedObstructed, role, submission), null);
for (const role of ["provider", "landlord", "spaceOperator", "admin"] as Role[])
  assert.equal(openWorkNotification(closedObstructed, role, review), null);
assert.equal(openWorkNotification(initial, "provider", submission), null);
assert.equal(
  openWorkNotification(closedObstructed, "tenant", seeds.items[0]),
  null,
);
assert.equal(
  openWorkNotification(closedObstructed, "provider", {
    ...submission,
    id: "work:forged",
  }),
  null,
);
assert.equal(
  openWorkNotification(closedObstructed, "tenant", {
    ...submission,
    role: "tenant",
  }),
  null,
);
const forgedPayload: KasaNotification = {
  ...submission,
  destination: "admin",
  serviceMode: "jobs",
  workEvent: {
    ...submission.workEvent!,
    applicationId: foreignSubmitted.id,
    kind: "application-reviewed",
    opportunityTitle: "Forged target",
    occurredAt: withdrawnAt.toISOString(),
  },
};
const safeOpen = openWorkNotification(
  closedObstructed,
  "provider",
  forgedPayload,
);
assert.ok(safeOpen);
assert.equal(safeOpen.serviceMode, "hire");
assert.equal(
  safeOpen.state.hiringView.selectedApplicationId,
  submitted.id,
  "An existing event ID resolves its source again instead of trusting altered payload fields",
);

const ownApplication = application(withdrawn, submitted.id);
const withApplication = (record: WorkApplication): WorkState => ({
  ...withdrawn,
  applications: [record],
});
for (const record of [
  { ...ownApplication, businessId: "another-business" },
  {
    ...ownApplication,
    opportunity: {
      ...ownApplication.opportunity,
      businessId: "another-business",
    },
  },
  { ...ownApplication, opportunityId: foreignPost },
  {
    ...ownApplication,
    opportunity: { ...ownApplication.opportunity, id: foreignPost },
  },
]) {
  const invalidScope = withApplication(record);
  assert.equal(
    activity(reconcileWorkNotifications(seeds, invalidScope)).length,
    0,
  );
  assert.equal(
    openWorkNotification(invalidScope, "provider", submission),
    null,
  );
  assert.equal(openWorkNotification(invalidScope, "tenant", review), null);
}
const noSourcePost: WorkState = {
  ...withdrawn,
  opportunities: withdrawn.opportunities.filter((item) => item.id !== ownPost),
};
assert.equal(
  activity(reconcileWorkNotifications(seeds, noSourcePost)).length,
  0,
);
const differentApplicant = withApplication({
  ...ownApplication,
  applicantId: "different-tenant",
});
assert.equal(
  activity(reconcileWorkNotifications(seeds, differentApplicant)).some(
    (item) => item.role === "tenant",
  ),
  false,
);
assert.equal(openWorkNotification(differentApplicant, "tenant", review), null);
for (const invalidHistory of [
  ownApplication.history.map((event) => ({
    ...event,
    actor: "admin" as const,
  })),
  ownApplication.history.map((event) => ({ ...event, at: "not-a-date" })),
  ownApplication.history.map((event) => ({
    ...event,
    at: "2032-05-11T09:00:00.000Z",
  })),
  ownApplication.history.map((event) => ({
    ...event,
    at: event.at.replace(".000Z", "Z"),
  })),
  ownApplication.history.map((event) => ({ ...event, id: "" })),
  [],
]) {
  const forgedEvents = withApplication({
    ...ownApplication,
    history: invalidHistory,
  });
  assert.equal(
    activity(reconcileWorkNotifications(seeds, forgedEvents)).length,
    0,
  );
  assert.equal(
    openWorkNotification(forgedEvents, "provider", submission),
    null,
  );
  assert.equal(openWorkNotification(forgedEvents, "tenant", review), null);
}
const flagsOnly = withApplication({ ...ownApplication, history: [] });
assert.equal(
  activity(reconcileWorkNotifications(seeds, flagsOnly)).length,
  0,
  "Status and timestamp flags alone cannot invent recorded activity",
);

// Obsolete local projections disappear without changing sample notifications or their read state.
const oldReadSeeds = withWithdrawal.items.filter((item) => !item.workEvent);
const cleared = reconcileWorkNotifications(withWithdrawal, initial);
assert.deepEqual(cleared.items, oldReadSeeds);
assert.ok(cleared.items.every((item, index) => item === oldReadSeeds[index]));
assert.equal(reconcileWorkNotifications(cleared, initial), cleared);
const oneEventRemoved = withApplication({
  ...ownApplication,
  history: ownApplication.history.filter(
    (event) => event.action !== "reviewed",
  ),
});
const withoutReview = reconcileWorkNotifications(
  withWithdrawal,
  oneEventRemoved,
);
assert.equal(activity(withoutReview).length, 2);
assert.equal(
  activity(withoutReview).some(
    (item) => item.workEvent?.kind === "application-reviewed",
  ),
  false,
);
assert.equal(eventOf(withoutReview, "application-submitted").read, true);
assert.equal(openWorkNotification(oneEventRemoved, "tenant", review), null);

console.log(
  "Work notification checks passed: scoped recorded events, stable IDs/timestamps, private payloads, retained read receipts, deduplication/cleanup, exact closed/withdrawn application links, forged-source guards and no events from drafts/copies.",
);
