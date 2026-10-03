import { workOpportunities } from "../data";
import type { Role, WorkArrangement, WorkOpportunity } from "../types";
import {
  futureLocalDate,
  isCurrentOrFutureDate,
  localDateValue,
} from "./propertyRequestState";

export type { WorkArrangement, WorkOpportunity } from "../types";
export const workArrangements: readonly WorkArrangement[] = [
  "Freelance",
  "Project",
  "Part time",
  "Full time",
];
export const workspaceWorkBusiness = {
  id: "volt-co",
  name: "Volt & Co.",
} as const;
export const workspaceWorkApplicant = {
  id: "tenant-ines",
  name: "Inês Duarte",
} as const;
export type WorkIssueCode =
  | "required"
  | "tooShort"
  | "tooLong"
  | "invalidType"
  | "invalidAvailability"
  | "invalidDate"
  | "unavailable"
  | "closed"
  | "duplicate"
  | "staleDraft"
  | "notReviewed"
  | "nothingToRestore";
export interface WorkIssue {
  code: WorkIssueCode;
}
export interface WorkPostFields {
  title: string;
  type: "" | WorkArrangement;
  location: string;
  pay: string;
  description: string;
  skills: string;
}
export interface WorkPostDraft extends WorkPostFields {
  id: string;
  businessId: string;
  revision: number;
  stage: "editing" | "review";
  reviewedRevision: number | null;
  createdAt: string;
  updatedAt: string;
}
export type WorkPostErrors = Partial<
  Record<keyof WorkPostFields, WorkIssueCode>
>;
export type WorkAvailability =
  "Immediately" | "Within 2 weeks" | "Choose a date";
export interface WorkApplicationDraft {
  introduction: string;
  availability: "" | WorkAvailability;
  customDate: string;
}
export type WorkApplicationErrors = Partial<
  Record<keyof WorkApplicationDraft, WorkIssueCode>
>;
export type WorkOpportunitySnapshot = Omit<
  WorkOpportunity,
  "status" | "closedAt"
>;
export interface WorkApplication {
  id: string;
  opportunityId: string;
  businessId: string;
  applicantId: string;
  applicantName: string;
  status: "Submitted" | "Withdrawn";
  submission: {
    introduction: string;
    availability: WorkAvailability;
    availableFrom: string;
  };
  opportunity: WorkOpportunitySnapshot;
  submittedAt: string;
  withdrawnAt?: string;
  reviewedAt?: string;
  history: {
    id: string;
    action: "submitted" | "reviewed" | "withdrawn";
    actor: Role;
    at: string;
  }[];
}
export interface WorkHiringView {
  section: "posts" | "drafts" | "applications";
  filter: "All" | "Open" | "Closed";
  applicationFilter: "All" | "Submitted" | "Withdrawn" | "Unreviewed";
  query: string;
  selectedPostId: string | null;
  selectedDraftId: string | null;
  selectedApplicationId: string | null;
}
export interface WorkApplicantView {
  filter: "All" | "Submitted" | "Reviewed" | "Withdrawn";
  selectedApplicationId: string | null;
}
export interface WorkMarketplaceView {
  section: "opportunities" | "applications";
  query: string;
  type: "All" | WorkArrangement;
  status: "Open" | "All";
  selectedOpportunityId: string | null;
}
export interface WorkState {
  opportunities: WorkOpportunity[];
  postDrafts: WorkPostDraft[];
  removedPostDraft: WorkPostDraft | null;
  applications: WorkApplication[];
  applicationDrafts: Record<string, WorkApplicationDraft>;
  hiringView: WorkHiringView;
  applicantView: WorkApplicantView;
  marketplaceViews: Partial<Record<Role, WorkMarketplaceView>>;
  nextPostId: number;
  nextDraftId: number;
  nextApplicationId: number;
}

const defaultHiringView = (): WorkHiringView => ({
  section: "posts",
  filter: "All",
  applicationFilter: "All",
  query: "",
  selectedPostId: null,
  selectedDraftId: null,
  selectedApplicationId: null,
});
const defaultApplicantView = (): WorkApplicantView => ({
  filter: "All",
  selectedApplicationId: null,
});
const defaultMarketplaceView = (): WorkMarketplaceView => ({
  section: "opportunities",
  query: "",
  type: "All",
  status: "Open",
  selectedOpportunityId: null,
});
const emptyApplicationDraft = (): WorkApplicationDraft => ({
  introduction: "",
  availability: "",
  customDate: "",
});

export function createInitialWorkState(): WorkState {
  return {
    opportunities: workOpportunities.map((seed) => ({
      ...seed,
      skills: [...seed.skills],
      posted: "Sample opportunity",
      source: "sample",
      status: "Open",
      createdAt: "2026-10-02T09:00:00.000Z",
    })),
    postDrafts: [],
    removedPostDraft: null,
    applications: [],
    applicationDrafts: {},
    hiringView: defaultHiringView(),
    applicantView: defaultApplicantView(),
    marketplaceViews: {},
    nextPostId: 1,
    nextDraftId: 1,
    nextApplicationId: 1,
  };
}

export function openWorkOpportunities(state: WorkState): WorkOpportunity[] {
  return state.opportunities.filter((post) => post.status === "Open");
}
export function ownedWorkOpportunities(
  state: WorkState,
  role: Role,
): WorkOpportunity[] {
  return role === "provider"
    ? state.opportunities.filter(
        (post) => post.businessId === workspaceWorkBusiness.id,
      )
    : [];
}
export function workPostDrafts(state: WorkState, role: Role): WorkPostDraft[] {
  return role === "provider"
    ? state.postDrafts.filter(
        (draft) => draft.businessId === workspaceWorkBusiness.id,
      )
    : [];
}
export function removedWorkPostDraft(
  state: WorkState,
  role: Role,
): WorkPostDraft | null {
  return role === "provider" &&
    state.removedPostDraft?.businessId === workspaceWorkBusiness.id
    ? state.removedPostDraft
    : null;
}

export function createWorkPostDraft(
  state: WorkState,
  role: Role,
  now = new Date(),
): { state: WorkState; draftId: string | null; issue: WorkIssue | null } {
  if (role !== "provider")
    return { state, draftId: null, issue: { code: "unavailable" } };
  let nextId = state.nextDraftId;
  while (
    state.postDrafts.some((draft) => draft.id === `work-draft-${nextId}`) ||
    state.removedPostDraft?.id === `work-draft-${nextId}`
  )
    nextId++;
  const at = now.toISOString();
  const draft: WorkPostDraft = {
    id: `work-draft-${nextId}`,
    businessId: workspaceWorkBusiness.id,
    revision: 0,
    stage: "editing",
    reviewedRevision: null,
    title: "",
    type: "",
    location: "",
    pay: "",
    description: "",
    skills: "",
    createdAt: at,
    updatedAt: at,
  };
  return {
    state: {
      ...state,
      postDrafts: [...state.postDrafts, draft],
      nextDraftId: nextId + 1,
      hiringView: {
        ...state.hiringView,
        section: "drafts",
        selectedDraftId: draft.id,
        selectedPostId: null,
        selectedApplicationId: null,
      },
    },
    draftId: draft.id,
    issue: null,
  };
}

export function copyWorkOpportunityToDraft(
  state: WorkState,
  role: Role,
  opportunityId: string,
  now = new Date(),
): { state: WorkState; draftId: string | null; issue: WorkIssue | null } {
  const opportunity = ownedWorkOpportunities(state, role).find(
    (post) => post.id === opportunityId,
  );
  if (!opportunity)
    return { state, draftId: null, issue: { code: "unavailable" } };
  const result = createWorkPostDraft(state, role, now);
  if (!result.draftId) return result;
  return {
    ...result,
    state: {
      ...result.state,
      postDrafts: result.state.postDrafts.map((draft) =>
        draft.id === result.draftId
          ? {
              ...draft,
              title: opportunity.title,
              type: opportunity.type,
              location: opportunity.location,
              pay: opportunity.pay,
              description: opportunity.description,
              skills: opportunity.skills.join(", "),
            }
          : draft,
      ),
    },
  };
}

export function updateWorkPostDraft(
  state: WorkState,
  role: Role,
  id: string,
  patch: Partial<WorkPostFields>,
  now = new Date(),
): WorkState {
  const draft = workPostDrafts(state, role).find((item) => item.id === id);
  if (!draft) return state;
  const fields: WorkPostFields = {
    title: patch.title ?? draft.title,
    type: patch.type ?? draft.type,
    location: patch.location ?? draft.location,
    pay: patch.pay ?? draft.pay,
    description: patch.description ?? draft.description,
    skills: patch.skills ?? draft.skills,
  };
  if (
    Object.entries(fields).every(
      ([key, value]) => draft[key as keyof WorkPostFields] === value,
    )
  )
    return state;
  const updated: WorkPostDraft = {
    ...draft,
    ...fields,
    revision: draft.revision + 1,
    stage: "editing",
    reviewedRevision: null,
    updatedAt: now.toISOString(),
  };
  return {
    ...state,
    postDrafts: state.postDrafts.map((item) =>
      item.id === id ? updated : item,
    ),
  };
}
export function editWorkPostDraft(
  state: WorkState,
  role: Role,
  id: string,
): WorkState {
  const draft = workPostDrafts(state, role).find((item) => item.id === id);
  if (!draft || draft.stage === "editing") return state;
  return {
    ...state,
    postDrafts: state.postDrafts.map((item) =>
      item.id === id
        ? { ...item, stage: "editing", reviewedRevision: null }
        : item,
    ),
  };
}

function normalizedSkills(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(",")
    .map((skill) => skill.trim())
    .filter((skill) => {
      const key = skill.toLocaleLowerCase();
      if (!skill || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
function textIssue(
  value: string,
  minimum: number,
  maximum: number,
): WorkIssueCode | undefined {
  const length = value.trim().length;
  return !length
    ? "required"
    : length < minimum
      ? "tooShort"
      : length > maximum
        ? "tooLong"
        : undefined;
}
export function validateWorkPostDraft(draft: WorkPostFields): WorkPostErrors {
  const errors: WorkPostErrors = {};
  for (const [field, min, max] of [
    ["title", 3, 100],
    ["location", 2, 140],
    ["pay", 3, 160],
    ["description", 20, 4000],
  ] as const) {
    const issue = textIssue(draft[field], min, max);
    if (issue) errors[field] = issue;
  }
  if (!workArrangements.includes(draft.type as WorkArrangement))
    errors.type = "invalidType";
  const skills = normalizedSkills(draft.skills);
  if (
    skills.length > 10 ||
    skills.some((skill) => skill.length > 40) ||
    draft.skills.length > 500
  )
    errors.skills = "tooLong";
  return errors;
}

export function reviewWorkPostDraft(
  state: WorkState,
  role: Role,
  id: string,
  now = new Date(),
): { state: WorkState; errors: WorkPostErrors; issue: WorkIssue | null } {
  const draft = workPostDrafts(state, role).find((item) => item.id === id);
  if (!draft) return { state, errors: {}, issue: { code: "unavailable" } };
  const errors = validateWorkPostDraft(draft);
  if (Object.keys(errors).length) return { state, errors, issue: null };
  return {
    state: {
      ...state,
      postDrafts: state.postDrafts.map((item) =>
        item.id === id
          ? {
              ...item,
              stage: "review",
              reviewedRevision: item.revision,
              updatedAt: now.toISOString(),
            }
          : item,
      ),
    },
    errors: {},
    issue: null,
  };
}

export function publishWorkPost(
  state: WorkState,
  role: Role,
  id: string,
  expectedRevision: number,
  now = new Date(),
): {
  state: WorkState;
  opportunityId: string | null;
  errors: WorkPostErrors;
  issue: WorkIssue | null;
} {
  const failure = (code: WorkIssueCode) => ({
    state,
    opportunityId: null,
    errors: {},
    issue: { code },
  });
  const draft = workPostDrafts(state, role).find((item) => item.id === id);
  if (!draft) return failure("unavailable");
  if (draft.revision !== expectedRevision) return failure("staleDraft");
  if (draft.stage !== "review" || draft.reviewedRevision !== draft.revision)
    return failure("notReviewed");
  const errors = validateWorkPostDraft(draft);
  if (Object.keys(errors).length)
    return { state, opportunityId: null, errors, issue: null };
  let nextId = state.nextPostId;
  while (state.opportunities.some((post) => post.id === `work-local-${nextId}`))
    nextId++;
  const opportunity: WorkOpportunity = {
    id: `work-local-${nextId}`,
    businessId: workspaceWorkBusiness.id,
    business: workspaceWorkBusiness.name,
    title: draft.title.trim(),
    type: draft.type as WorkArrangement,
    location: draft.location.trim(),
    pay: draft.pay.trim(),
    description: draft.description.trim(),
    skills: normalizedSkills(draft.skills),
    posted: "Saved in this tab",
    source: "local",
    status: "Open",
    createdAt: now.toISOString(),
  };
  return {
    state: {
      ...state,
      opportunities: [...state.opportunities, opportunity],
      postDrafts: state.postDrafts.filter((item) => item.id !== id),
      nextPostId: nextId + 1,
      hiringView: {
        ...state.hiringView,
        section: "posts",
        filter: "All",
        selectedPostId: opportunity.id,
        selectedDraftId: null,
        selectedApplicationId: null,
      },
    },
    opportunityId: opportunity.id,
    errors: {},
    issue: null,
  };
}

export function discardWorkPostDraft(
  state: WorkState,
  role: Role,
  id: string,
): WorkState {
  const draft = workPostDrafts(state, role).find((item) => item.id === id);
  if (!draft) return state;
  return {
    ...state,
    postDrafts: state.postDrafts.filter((item) => item.id !== id),
    removedPostDraft: draft,
    hiringView: {
      ...state.hiringView,
      selectedDraftId:
        state.hiringView.selectedDraftId === id
          ? null
          : state.hiringView.selectedDraftId,
    },
  };
}
export function restoreWorkPostDraft(
  state: WorkState,
  role: Role,
): { state: WorkState; issue: WorkIssue | null } {
  const draft = removedWorkPostDraft(state, role);
  if (!draft)
    return {
      state,
      issue: { code: role === "provider" ? "nothingToRestore" : "unavailable" },
    };
  if (state.postDrafts.some((item) => item.id === draft.id))
    return { state, issue: { code: "duplicate" } };
  return {
    state: {
      ...state,
      postDrafts: [...state.postDrafts, draft],
      removedPostDraft: null,
      hiringView: {
        ...state.hiringView,
        section: "drafts",
        selectedDraftId: draft.id,
        selectedPostId: null,
        selectedApplicationId: null,
      },
    },
    issue: null,
  };
}
export function closeWorkOpportunity(
  state: WorkState,
  role: Role,
  id: string,
  now = new Date(),
): WorkState {
  const post = ownedWorkOpportunities(state, role).find(
    (item) => item.id === id,
  );
  if (!post || post.status !== "Open") return state;
  return {
    ...state,
    opportunities: state.opportunities.map((item) =>
      item.id === id
        ? { ...item, status: "Closed", closedAt: now.toISOString() }
        : item,
    ),
  };
}

export function workApplicationDraft(
  state: WorkState,
  role: Role,
  opportunityId: string,
): WorkApplicationDraft | null {
  if (
    role !== "tenant" ||
    !state.opportunities.some((post) => post.id === opportunityId)
  )
    return null;
  return state.applicationDrafts[opportunityId] ?? emptyApplicationDraft();
}
export function workApplicationDrafts(
  state: WorkState,
  role: Role,
): { opportunityId: string; draft: WorkApplicationDraft }[] {
  return role === "tenant"
    ? Object.entries(state.applicationDrafts).flatMap(
        ([opportunityId, draft]) =>
          state.opportunities.some((post) => post.id === opportunityId)
            ? [{ opportunityId, draft }]
            : [],
      )
    : [];
}
export function activeWorkApplication(
  state: WorkState,
  role: Role,
  opportunityId: string,
): WorkApplication | undefined {
  if (role !== "tenant") return undefined;
  return state.applications.find(
    (application) =>
      application.opportunityId === opportunityId &&
      application.applicantId === workspaceWorkApplicant.id &&
      application.status === "Submitted",
  );
}
export function updateWorkApplicationDraft(
  state: WorkState,
  role: Role,
  opportunityId: string,
  patch: Partial<WorkApplicationDraft>,
): WorkState {
  const draft = workApplicationDraft(state, role, opportunityId);
  const post = state.opportunities.find((item) => item.id === opportunityId);
  if (
    !draft ||
    post?.status !== "Open" ||
    activeWorkApplication(state, role, opportunityId)
  )
    return state;
  const updated = {
    introduction: patch.introduction ?? draft.introduction,
    availability: patch.availability ?? draft.availability,
    customDate: patch.customDate ?? draft.customDate,
  };
  return {
    ...state,
    applicationDrafts: { ...state.applicationDrafts, [opportunityId]: updated },
  };
}
export function discardWorkApplicationDraft(
  state: WorkState,
  role: Role,
  opportunityId: string,
): WorkState {
  if (
    !workApplicationDraft(state, role, opportunityId) ||
    !Object.hasOwn(state.applicationDrafts, opportunityId)
  )
    return state;
  const drafts = { ...state.applicationDrafts };
  delete drafts[opportunityId];
  return { ...state, applicationDrafts: drafts };
}
export function validateWorkApplicationDraft(
  draft: WorkApplicationDraft,
  now = new Date(),
): WorkApplicationErrors {
  const errors: WorkApplicationErrors = {};
  const introduction = textIssue(draft.introduction, 10, 2000);
  if (introduction) errors.introduction = introduction;
  if (
    !["Immediately", "Within 2 weeks", "Choose a date"].includes(
      draft.availability,
    )
  )
    errors.availability = "invalidAvailability";
  if (
    draft.availability === "Choose a date" &&
    !isCurrentOrFutureDate(draft.customDate, now)
  )
    errors.customDate = "invalidDate";
  return errors;
}
export function submitWorkApplication(
  state: WorkState,
  role: Role,
  opportunityId: string,
  now = new Date(),
): {
  state: WorkState;
  applicationId: string | null;
  errors: WorkApplicationErrors;
  issue: WorkIssue | null;
} {
  const failure = (code: WorkIssueCode) => ({
    state,
    applicationId: null,
    errors: {},
    issue: { code },
  });
  if (role !== "tenant") return failure("unavailable");
  const post = state.opportunities.find((item) => item.id === opportunityId);
  if (!post) return failure("unavailable");
  if (post.status !== "Open") return failure("closed");
  if (activeWorkApplication(state, role, opportunityId))
    return failure("duplicate");
  const draft = workApplicationDraft(state, role, opportunityId)!;
  const errors = validateWorkApplicationDraft(draft, now);
  if (Object.keys(errors).length)
    return { state, applicationId: null, errors, issue: null };
  let nextId = state.nextApplicationId;
  while (
    state.applications.some(
      (application) => application.id === `work-application-${nextId}`,
    )
  )
    nextId++;
  const id = `work-application-${nextId}`;
  const at = now.toISOString();
  const opportunity: WorkOpportunitySnapshot = {
    id: post.id,
    businessId: post.businessId,
    business: post.business,
    title: post.title,
    location: post.location,
    type: post.type,
    pay: post.pay,
    skills: [...post.skills],
    description: post.description,
    posted: post.posted,
    source: post.source,
    createdAt: post.createdAt,
  };
  const application: WorkApplication = {
    id,
    opportunityId,
    businessId: post.businessId,
    applicantId: workspaceWorkApplicant.id,
    applicantName: workspaceWorkApplicant.name,
    status: "Submitted",
    submission: {
      introduction: draft.introduction.trim(),
      availability: draft.availability as WorkAvailability,
      availableFrom:
        draft.availability === "Immediately"
          ? localDateValue(now)
          : draft.availability === "Within 2 weeks"
            ? futureLocalDate(14, now)
            : draft.customDate,
    },
    opportunity,
    submittedAt: at,
    history: [{ id: `${id}-event-1`, action: "submitted", actor: role, at }],
  };
  const cleared = discardWorkApplicationDraft(state, role, opportunityId);
  return {
    state: {
      ...cleared,
      applications: [...state.applications, application],
      nextApplicationId: nextId + 1,
      applicantView: { filter: "Submitted", selectedApplicationId: id },
    },
    applicationId: id,
    errors: {},
    issue: null,
  };
}

export function visibleWorkApplications(
  state: WorkState,
  role: Role,
): WorkApplication[] {
  if (role === "tenant")
    return state.applications.filter(
      (application) => application.applicantId === workspaceWorkApplicant.id,
    );
  if (role !== "provider") return [];
  const ownedIds = new Set(
    ownedWorkOpportunities(state, role).map((post) => post.id),
  );
  return state.applications.filter(
    (application) =>
      application.businessId === workspaceWorkBusiness.id &&
      application.opportunity.businessId === workspaceWorkBusiness.id &&
      application.opportunity.id === application.opportunityId &&
      ownedIds.has(application.opportunityId),
  );
}
export function withdrawWorkApplication(
  state: WorkState,
  role: Role,
  id: string,
  now = new Date(),
): WorkState {
  if (role !== "tenant") return state;
  const application = visibleWorkApplications(state, role).find(
    (item) => item.id === id,
  );
  if (!application || application.status !== "Submitted") return state;
  const at = now.toISOString();
  return {
    ...state,
    applications: state.applications.map((item) =>
      item.id === id
        ? {
            ...item,
            status: "Withdrawn",
            withdrawnAt: at,
            history: [
              ...item.history,
              {
                id: `${id}-event-${item.history.length + 1}`,
                action: "withdrawn",
                actor: role,
                at,
              },
            ],
          }
        : item,
    ),
  };
}
export function markWorkApplicationReviewed(
  state: WorkState,
  role: Role,
  id: string,
  now = new Date(),
): WorkState {
  if (role !== "provider") return state;
  const application = visibleWorkApplications(state, role).find(
    (item) => item.id === id,
  );
  if (
    !application ||
    application.status !== "Submitted" ||
    application.reviewedAt
  )
    return state;
  const at = now.toISOString();
  return {
    ...state,
    applications: state.applications.map((item) =>
      item.id === id
        ? {
            ...item,
            reviewedAt: at,
            history: [
              ...item.history,
              {
                id: `${id}-event-${item.history.length + 1}`,
                action: "reviewed",
                actor: role,
                at,
              },
            ],
          }
        : item,
    ),
  };
}

export function workHiringView(state: WorkState, role: Role): WorkHiringView {
  return role === "provider" ? state.hiringView : defaultHiringView();
}
export function updateWorkHiringView(
  state: WorkState,
  role: Role,
  patch: Partial<WorkHiringView>,
): WorkState {
  if (role !== "provider") return state;
  const view = state.hiringView;
  const next = { ...view };
  if (
    patch.section &&
    ["posts", "drafts", "applications"].includes(patch.section)
  )
    next.section = patch.section;
  if (patch.filter && ["All", "Open", "Closed"].includes(patch.filter))
    next.filter = patch.filter;
  if (
    patch.applicationFilter &&
    ["All", "Submitted", "Withdrawn", "Unreviewed"].includes(
      patch.applicationFilter,
    )
  )
    next.applicationFilter = patch.applicationFilter;
  if (patch.query !== undefined) next.query = patch.query.slice(0, 200);
  if (
    patch.selectedPostId === null ||
    ownedWorkOpportunities(state, role).some(
      (post) => post.id === patch.selectedPostId,
    )
  )
    next.selectedPostId = patch.selectedPostId!;
  if (
    patch.selectedDraftId === null ||
    workPostDrafts(state, role).some(
      (draft) => draft.id === patch.selectedDraftId,
    )
  )
    next.selectedDraftId = patch.selectedDraftId!;
  if (
    patch.selectedApplicationId === null ||
    visibleWorkApplications(state, role).some(
      (application) => application.id === patch.selectedApplicationId,
    )
  )
    next.selectedApplicationId = patch.selectedApplicationId!;
  return { ...state, hiringView: next };
}
export function workApplicantView(
  state: WorkState,
  role: Role,
): WorkApplicantView {
  return role === "tenant" ? state.applicantView : defaultApplicantView();
}
export function updateWorkApplicantView(
  state: WorkState,
  role: Role,
  patch: Partial<WorkApplicantView>,
): WorkState {
  if (role !== "tenant") return state;
  const next = { ...state.applicantView };
  if (
    patch.filter &&
    ["All", "Submitted", "Reviewed", "Withdrawn"].includes(patch.filter)
  )
    next.filter = patch.filter;
  if (
    patch.selectedApplicationId === null ||
    visibleWorkApplications(state, role).some(
      (application) => application.id === patch.selectedApplicationId,
    )
  )
    next.selectedApplicationId = patch.selectedApplicationId!;
  return { ...state, applicantView: next };
}
export function workMarketplaceView(
  state: WorkState,
  role: Role,
): WorkMarketplaceView {
  return state.marketplaceViews[role] ?? defaultMarketplaceView();
}
export function updateWorkMarketplaceView(
  state: WorkState,
  role: Role,
  patch: Partial<WorkMarketplaceView>,
): WorkState {
  const next = { ...workMarketplaceView(state, role) };
  if (
    patch.section &&
    ["opportunities", "applications"].includes(patch.section)
  )
    next.section = patch.section;
  if (patch.query !== undefined) next.query = patch.query.slice(0, 200);
  if (
    patch.type === "All" ||
    workArrangements.includes(patch.type as WorkArrangement)
  )
    next.type = patch.type!;
  if (patch.status && ["Open", "All"].includes(patch.status))
    next.status = patch.status;
  if (
    patch.selectedOpportunityId === null ||
    state.opportunities.some((post) => post.id === patch.selectedOpportunityId)
  )
    next.selectedOpportunityId = patch.selectedOpportunityId!;
  return {
    ...state,
    marketplaceViews: { ...state.marketplaceViews, [role]: next },
  };
}
