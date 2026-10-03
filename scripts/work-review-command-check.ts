import assert from "node:assert/strict";
import type { Role } from "../src/types";
import {
  createInitialNotificationState,
  markAllNotificationsRead,
} from "../src/components/notificationState";
import { reconcileWorkNotifications } from "../src/components/workNotifications";
import {
  applyWorkReviewCommand,
  closeWorkOpportunity,
  copyWorkOpportunityToDraft,
  createInitialWorkState,
  createWorkPostDraft,
  discardWorkPostDraft,
  markWorkApplicationReviewed,
  publishWorkPost,
  reviewWorkPostDraft,
  submitWorkApplication,
  updateWorkApplicantView,
  updateWorkApplicationDraft,
  updateWorkHiringView,
  updateWorkMarketplaceView,
  updateWorkPostDraft,
  withdrawWorkApplication,
  type WorkReviewCommand,
  type WorkState,
} from "../src/components/workState";

const ownPost = "work-volt-electrical";
const foreignPost = "work-casa-cleaning";
const privateIntroduction = "PRIVATE applicant experience and availability.";
const privateDraft = "PRIVATE unsent employer plan";
const privateDate = "2032-06-20";
const submittedAt = new Date("2032-05-10T12:00:00.000Z");
const capturedAt = new Date("2032-05-10T12:30:59.999Z");
const later = new Date("2032-05-10T12:31:00.000Z");
let passed = 0;

function submit(state: WorkState, opportunityId: string) {
  const result = submitWorkApplication(
    updateWorkApplicationDraft(state, "tenant", opportunityId, {
      introduction: privateIntroduction,
      availability: "Choose a date",
      customDate: privateDate,
    }),
    "tenant",
    opportunityId,
    submittedAt,
  );
  assert.equal(result.issue, null);
  assert.deepEqual(result.errors, {});
  assert.ok(result.applicationId);
  return { state: result.state, id: result.applicationId };
}

// Two genuine owned submissions, one foreign submission and private work that
// must survive every attempted review, including a retained removed-post draft.
const copied = copyWorkOpportunityToDraft(
  createInitialWorkState(),
  "provider",
  ownPost,
  submittedAt,
);
assert.ok(copied.draftId);
const preview = reviewWorkPostDraft(
  copied.state,
  "provider",
  copied.draftId,
  submittedAt,
);
assert.equal(preview.issue, null);
assert.deepEqual(preview.errors, {});
const publish = publishWorkPost(
  preview.state,
  "provider",
  copied.draftId,
  preview.state.postDrafts[0].revision,
  submittedAt,
);
assert.ok(publish.opportunityId);
const first = submit(publish.state, ownPost);
const second = submit(first.state, publish.opportunityId);
const foreign = submit(second.state, foreignPost);
const removedDraft = createWorkPostDraft(
  foreign.state,
  "provider",
  submittedAt,
);
assert.ok(removedDraft.draftId);
const removed = discardWorkPostDraft(
  removedDraft.state,
  "provider",
  removedDraft.draftId,
);
const keptDraft = createWorkPostDraft(removed, "provider", submittedAt);
assert.ok(keptDraft.draftId);
let base = updateWorkPostDraft(keptDraft.state, "provider", keptDraft.draftId, {
  title: privateDraft,
  pay: "unfinished compensation",
});
base = updateWorkApplicationDraft(base, "tenant", "work-habitat-maintenance", {
  introduction: "PRIVATE incomplete applicant draft",
  availability: "",
  customDate: "unfinished date",
});
base = updateWorkHiringView(base, "provider", {
  section: "applications",
  filter: "Closed",
  applicationFilter: "Unreviewed",
  query: "private retained query",
  selectedApplicationId: first.id,
});
base = updateWorkApplicantView(base, "tenant", {
  filter: "Withdrawn",
  selectedApplicationId: second.id,
});
for (const role of [
  "tenant",
  "provider",
  "landlord",
  "spaceOperator",
  "admin",
] as const)
  base = updateWorkMarketplaceView(base, role, {
    query: `retained ${role} search`,
    type: "Project",
    status: "All",
  });

const application = (state: WorkState, id = first.id) => {
  const item = state.applications.find((record) => record.id === id);
  assert.ok(item);
  return item;
};
function command(
  token: string,
  applicationId = first.id,
  role: Role = "provider",
  at = capturedAt.getTime(),
): WorkReviewCommand {
  return { token, role, applicationId, at };
}
function unchangedWork(before: WorkState, after: WorkState, success: boolean) {
  for (const key of Object.keys(before) as (keyof WorkState)[])
    if (key !== "reviewReceipt" && (!success || key !== "applications"))
      assert.equal(after[key], before[key], `${key} must remain unchanged`);
}
function receipt(
  state: WorkState,
  cmd: WorkReviewCommand,
  eventId: string | null,
) {
  assert.deepEqual(state.reviewReceipt, {
    token: cmd.token,
    role: cmd.role,
    applicationId: cmd.applicationId,
    issue: eventId ? null : "unavailable",
    eventId,
  });
  const text = JSON.stringify(state.reviewReceipt);
  for (const privateValue of [privateIntroduction, privateDraft, privateDate])
    assert.equal(text.includes(privateValue), false);
}
function rejected(state: WorkState, cmd: WorkReviewCommand) {
  const before = JSON.stringify(state);
  let feed = reconcileWorkNotifications(
    createInitialNotificationState(),
    state,
  );
  feed = markAllNotificationsRead(feed, "provider");
  feed = markAllNotificationsRead(feed, "tenant");
  const result = applyWorkReviewCommand(state, cmd);
  receipt(result, cmd, null);
  unchangedWork(state, result, false);
  assert.equal(reconcileWorkNotifications(feed, result), feed);
  assert.equal(JSON.stringify(state), before);
  assert.equal(applyWorkReviewCommand(result, cmd), result);
  assert.deepEqual(applyWorkReviewCommand(state, cmd), result);
  passed++;
  return result;
}
function accepted(state: WorkState, cmd: WorkReviewCommand) {
  const before = JSON.stringify(state);
  const previous = application(state, cmd.applicationId);
  const feed = reconcileWorkNotifications(
    createInitialNotificationState(),
    state,
  );
  const result = applyWorkReviewCommand(state, cmd);
  const current = application(result, cmd.applicationId);
  const event = current.history.at(-1)!;
  receipt(result, cmd, event.id);
  assert.equal(current.status, "Submitted", "Review is no employment decision");
  assert.equal(current.reviewedAt, new Date(cmd.at).toISOString());
  assert.deepEqual(event, {
    id: `${current.id}-event-${previous.history.length + 1}`,
    action: "reviewed",
    actor: "provider",
    at: new Date(cmd.at).toISOString(),
  });
  assert.equal(current.history.length, previous.history.length + 1);
  for (const [index, entry] of previous.history.entries())
    assert.equal(current.history[index], entry);
  assert.equal(current.submission, previous.submission);
  assert.equal(current.opportunity, previous.opportunity);
  assert.equal(current.withdrawnAt, previous.withdrawnAt);
  for (const item of state.applications)
    if (item.id !== cmd.applicationId)
      assert.equal(application(result, item.id), item);
  unchangedWork(state, result, true);
  const nextFeed = reconcileWorkNotifications(feed, result);
  const added = nextFeed.items.filter(
    (item) => !feed.items.some((old) => old.id === item.id),
  );
  assert.equal(added.length, 1);
  assert.equal(added[0].role, "tenant");
  assert.equal(
    added[0].id,
    `work:${JSON.stringify(["tenant", current.id, event.id])}`,
  );
  assert.deepEqual(added[0].workEvent, {
    kind: "application-reviewed",
    applicationId: current.id,
    opportunityTitle: previous.opportunity.title,
    occurredAt: event.at,
  });
  for (const privateValue of [privateIntroduction, privateDraft, privateDate])
    assert.equal(JSON.stringify(added).includes(privateValue), false);
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(applyWorkReviewCommand(state, cmd), result);
  assert.equal(applyWorkReviewCommand(result, cmd), result);
  passed++;
  return result;
}

// Reproduce the UI queue race: the rendered record was reviewable, but a tenant
// withdrawal commits before the captured provider updater is evaluated.
const queued = command("queued-before-withdrawal");
assert.equal(application(base).status, "Submitted");
assert.equal(application(base).reviewedAt, undefined);
const withdrawn = withdrawWorkApplication(base, "tenant", first.id, later);
const staleResult = rejected(withdrawn, queued);
assert.equal(application(staleResult).status, "Withdrawn");
assert.equal(application(staleResult).reviewedAt, undefined);
assert.equal(application(staleResult).history.at(-1)!.action, "withdrawn");

// The captured instant, not commit time or the current clock, identifies success.
const firstCommand = command("review-first");
const reviewed = accepted(base, firstCommand);
assert.equal(application(reviewed).reviewedAt, capturedAt.toISOString());
assert.notEqual(application(reviewed).reviewedAt, later.toISOString());
rejected(reviewed, command("new-token-already-reviewed"));
const earlierDirectReview = markWorkApplicationReviewed(
  base,
  "provider",
  first.id,
  capturedAt,
);
rejected(earlierDirectReview, command("cannot-claim-existing-event"));
const eventIdCollision: WorkState = {
  ...base,
  applications: base.applications.map((item) =>
    item.id === first.id
      ? {
          ...item,
          history: item.history.map((event) => ({
            ...event,
            id: `${item.id}-event-${item.history.length + 1}`,
          })),
        }
      : item,
  ),
};
rejected(eventIdCollision, command("must-prove-a-new-history-event"));

// Retaining unrelated changes must not make latest-token replay run again.
const unrelated = updateWorkPostDraft(
  updateWorkHiringView(reviewed, "provider", { query: "newer private filter" }),
  "provider",
  keptDraft.draftId,
  { description: "PRIVATE newer post draft" },
);
assert.equal(unrelated.reviewReceipt, reviewed.reviewReceipt);
assert.equal(applyWorkReviewCommand(unrelated, firstCommand), unrelated);
assert.equal(
  applyWorkReviewCommand(unrelated, {
    ...firstCommand,
    applicationId: second.id,
    role: "tenant",
    at: Number.NaN,
  }),
  unrelated,
  "Replaying the latest token cannot reinterpret its target or outcome",
);
passed++;

// Receipts identify each queued intent. A previous success cannot stand in for
// a later request, even when targets differ or an old token is applied again.
const secondCommand = command(
  "review-second",
  second.id,
  "provider",
  later.getTime(),
);
const reviewedSecond = accepted(reviewed, secondCommand);
assert.notEqual(reviewedSecond.reviewReceipt!.token, firstCommand.token);
assert.equal(reviewedSecond.reviewReceipt!.applicationId, second.id);
const oldReplay = rejected(reviewedSecond, firstCommand);
assert.equal(oldReplay.reviewReceipt!.eventId, null);
assert.notEqual(oldReplay.reviewReceipt!.token, secondCommand.token);
assert.equal(application(oldReplay, second.id).reviewedAt, later.toISOString());
const afterFailure = accepted(staleResult, secondCommand);
assert.equal(afterFailure.reviewReceipt!.applicationId, second.id);
assert.equal(application(afterFailure).status, "Withdrawn");

for (const role of ["tenant", "landlord", "spaceOperator", "admin"] as const)
  rejected(base, command(`wrong-role-${role}`, first.id, role));
rejected(base, command("foreign-business", foreign.id));
rejected(base, command("missing-record", "missing-application"));
for (const at of [
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  capturedAt.getTime() + 0.5,
  -0.5,
  Number.MAX_SAFE_INTEGER + 1,
  Number.MIN_SAFE_INTEGER - 1,
  8_640_000_000_000_001,
  -8_640_000_000_000_001,
  "2032-05-10" as unknown as number,
  null as unknown as number,
])
  rejected(
    base,
    command(`invalid-time-${String(at)}`, first.id, "provider", at),
  );

for (const state of [
  { ...base, applications: [] },
  {
    ...base,
    applications: base.applications.map((item) =>
      item.id === first.id ? { ...item, businessId: "other-business" } : item,
    ),
  },
  {
    ...base,
    applications: base.applications.map((item) =>
      item.id === first.id
        ? {
            ...item,
            opportunity: { ...item.opportunity, businessId: "other-business" },
          }
        : item,
    ),
  },
  {
    ...base,
    opportunities: base.opportunities.filter((item) => item.id !== ownPost),
  },
])
  rejected(state, command("scope-changed-before-commit"));

// Closing an owned post stops new applications, not factual review of existing ones.
const closed = closeWorkOpportunity(base, "provider", ownPost, later);
assert.equal(
  closed.opportunities.find((post) => post.id === ownPost)!.status,
  "Closed",
);
accepted(closed, command("closed-post-review"));

// Frozen inputs expose mutation; repeated evaluation is deterministic and does
// not duplicate events or receipts in the source objects.
function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
const frozen = freeze(structuredClone(base));
const frozenCommand = freeze(command("frozen-review"));
accepted(frozen, frozenCommand);
rejected(
  freeze(structuredClone(withdrawn)),
  freeze(command("frozen-withdrawal")),
);

console.log(`${passed} Work review command checks passed.`);
