import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { createInstance } from "i18next";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import {
  operationsLocales,
  operationsResources,
  operationText,
} from "../src/locales/operations";
import { viewingEn } from "../src/locales/operations/viewing-en";
import { viewingPhraseKeys } from "../src/locales/operations/viewingPhraseKeys";
import type {
  OperationsKey,
  OperationsValues,
} from "../src/locales/operations/types";
import {
  actOnViewingRequest,
  createInitialPropertyRequestState,
  createViewingRequest,
  saveViewingProposal,
  selectViewingRequest,
  updateViewingActionDraft,
  updateViewingDraft,
  type PropertyRequestState,
} from "../src/components/propertyRequestState";

const languages = ["en", "pt", "es", "fr", "ar", "zh"] as const;
const pluralBases = [
  "viewings_requestsShown",
  "viewings_ownerDecision",
  "viewings_tenantDecision",
] as const;
const instance = createInstance();
await instance.init({
  resources: Object.fromEntries(
    languages.map((language) => [
      language,
      { operations: operationsResources[language] },
    ]),
  ),
  lng: "en",
  fallbackLng: "en",
  defaultNS: "operations",
  interpolation: { escapeValue: false },
});
const placeholders = (value: string) =>
  [...value.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1]).sort();
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#x27;",
      })[character]!,
  );
const keys = Object.keys(viewingEn) as (keyof typeof viewingEn)[];
for (const language of languages) {
  const dictionary: Record<string, string> = operationsResources[language];
  for (const key of keys) {
    assert.ok(Object.hasOwn(dictionary, key), `${language}: missing ${key}`);
    assert.ok(dictionary[key].trim(), `${language}: empty ${key}`);
    assert.deepEqual(
      placeholders(dictionary[key]),
      placeholders(viewingEn[key]),
      `${language}: ${key} placeholders`,
    );
  }
  for (const key of Object.keys(dictionary).filter((key) =>
    key.startsWith("viewings_"),
  )) {
    if (Object.hasOwn(viewingEn, key)) continue;
    assert.ok(
      pluralBases.some((base) =>
        new RegExp(`^${base}_(zero|two|few|many)$`).test(key),
      ),
      `${language}: unexpected ${key}`,
    );
    assert.deepEqual(placeholders(dictionary[key]), ["shownCount"]);
  }
  for (const base of pluralBases) {
    for (const category of new Intl.PluralRules(
      operationsLocales[language],
    ).resolvedOptions().pluralCategories)
      assert.ok(
        dictionary[`${base}_${category}`]?.trim(),
        `${language}: missing ${base}_${category}`,
      );
    for (const count of [0, 1, 2, 3, 11, 100, 1_000_000]) {
      const shownCount = new Intl.NumberFormat(
        operationsLocales[language],
      ).format(count);
      const values = { count, shownCount };
      const text = operationText(instance, language, base, values);
      assert.ok(
        text.includes(shownCount),
        `${language}/${base}: localized count missing`,
      );
      assert.equal(text.includes("{{"), false);
      assert.equal(text.includes(base), false);
      const category = new Intl.PluralRules(operationsLocales[language]).select(
        count,
      );
      assert.ok(
        text.startsWith(
          dictionary[`${base}_${category}`].replace(
            "{{shownCount}}",
            shownCount,
          ),
        ),
      );
      if (language === "ar" || language === "zh")
        assert.ok(
          text.endsWith(`(${operationText(instance, "en", base, values)})`),
        );
    }
  }
  for (const key of keys.filter((key) => !/_(one|other)$/.test(key))) {
    const values = { shown: "SHOWN_SENTINEL", total: "TOTAL_SENTINEL" };
    const text = operationText(
      instance,
      language,
      key as OperationsKey,
      values,
    );
    assert.ok(text.trim());
    assert.equal(text.includes("{{"), false);
    for (const name of placeholders(viewingEn[key]))
      assert.ok(text.includes(`${name.toUpperCase()}_SENTINEL`));
    if (
      (language === "ar" || language === "zh") &&
      dictionary[key] !== viewingEn[key]
    )
      assert.ok(
        text.endsWith(
          `(${operationText(instance, "en", key as OperationsKey, values)})`,
        ),
      );
  }
}

const documentDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "document",
);
const cssHook = registerHooks({
  load(url, context, nextLoad) {
    return url.endsWith(".css")
      ? { format: "module", source: "export {};", shortCircuit: true }
      : nextLoad(url, context);
  },
});
if (!documentDescriptor)
  Object.defineProperty(globalThis, "document", {
    value: { documentElement: {} },
    configurable: true,
  });
const modules = await Promise.all([
  import("../src/components/ViewingRequests"),
  import("../src/components/PropertyViewingsSummary"),
  import("../src/components/viewingCopy"),
]).finally(() => {
  cssHook.deregister();
  if (documentDescriptor)
    Object.defineProperty(globalThis, "document", documentDescriptor);
  else Reflect.deleteProperty(globalThis, "document");
});
const [{ ViewingRequests }, { PropertyViewingsSummary }, { useViewingCopy }] =
  modules;
let renders = 0;
let writes = 0;
const noAction = () => {
  writes++;
};
function render(element: React.ReactElement) {
  const reactDescriptor = Object.getOwnPropertyDescriptor(globalThis, "React");
  Object.defineProperty(globalThis, "React", {
    value: React,
    configurable: true,
  });
  try {
    const html = renderToStaticMarkup(
      createElement(I18nextProvider, { i18n: instance }, element),
    );
    assert.equal(
      html.includes("viewings_"),
      false,
      "No unresolved translation key reaches the UI",
    );
    for (const [, attrs, contents] of html.matchAll(
      /<button\b([^>]*)>([\s\S]*?)<\/button>/g,
    )) {
      const text = contents
        .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/g, "")
        .replace(/<[^>]*>/g, "")
        .trim();
      assert.ok(
        text || /aria-label="[^"]+"/.test(attrs),
        "Every button has a nonempty accessible name",
      );
    }
    renders++;
    return html;
  } finally {
    if (reactDescriptor)
      Object.defineProperty(globalThis, "React", reactDescriptor);
    else Reflect.deleteProperty(globalThis, "React");
  }
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
const now = new Date("2032-05-10T12:00:00.000Z");
const rawNote =
  'RAW Cancelled / Recusado / 已取消 / ملغى "<&>"\nKeep this note unchanged.';
const privateDraft = 'RAW private response "<&>"\nملاحظة 未发送';
const initial = createInitialPropertyRequestState();
const created = createViewingRequest(
  updateViewingDraft(initial, "tenant", 1, {
    date: "2032-05-15",
    time: "10:00",
    note: rawNote,
  }),
  "tenant",
  1,
  now,
);
assert.ok(created.requestId);
const id = created.requestId;
const accepted = actOnViewingRequest(
  created.state,
  "landlord",
  id,
  { type: "accept-request" },
  now,
);
function propose(state: PropertyRequestState, time: string) {
  const result = saveViewingProposal(
    updateViewingActionDraft(state, "landlord", id, {
      date: "2032-05-16",
      time,
      note: rawNote,
    }),
    "landlord",
    id,
    now,
  );
  assert.ok(result.proposalId);
  assert.deepEqual(result.errors, {});
  return result;
}
const proposal1 = propose(accepted, "11:00");
const proposal2 = propose(proposal1.state, "12:00");
const declinedChange = actOnViewingRequest(
  proposal2.state,
  "tenant",
  id,
  { type: "decline-proposal", proposalId: proposal2.proposalId! },
  now,
);
const proposal3 = propose(declinedChange, "13:00");
const acceptedChange = actOnViewingRequest(
  proposal3.state,
  "tenant",
  id,
  { type: "accept-proposal", proposalId: proposal3.proposalId! },
  now,
);
const proposal4 = propose(acceptedChange, "14:00");
let privateResponses = updateViewingActionDraft(
  proposal4.state,
  "landlord",
  id,
  { note: privateDraft },
);
privateResponses = updateViewingActionDraft(privateResponses, "tenant", id, {
  note: "Tenant-only private draft",
});
const cancelled = actOnViewingRequest(
  privateResponses,
  "tenant",
  id,
  { type: "cancel" },
  now,
);
const declined = actOnViewingRequest(
  updateViewingActionDraft(created.state, "landlord", id, { note: rawNote }),
  "landlord",
  id,
  { type: "decline-request" },
  now,
);
const scenarios = [
  created.state,
  accepted,
  proposal2.state,
  declinedChange,
  acceptedChange,
  proposal4.state,
  cancelled,
  declined,
];
const historyKeys: Record<string, OperationsKey> = {
  requested: "viewings_historyRequested",
  accepted: "viewings_historyAccepted",
  declined: "viewings_historyDeclined",
  proposed: "viewings_historyProposed",
  "proposal-accepted": "viewings_historyProposalAccepted",
  "proposal-declined": "viewings_historyProposalDeclined",
  cancelled: "viewings_historyCancelled",
};
const statusKeys: Record<string, OperationsKey> = {
  All: "viewings_filterAll",
  Pending: "viewings_statusPending",
  Proposed: "viewings_statusProposed",
  Agreed: "viewings_statusAgreed",
  Declined: "viewings_statusDeclined",
  Cancelled: "viewings_statusCancelled",
  History: "viewings_filterHistory",
};
const proposalKeys: Record<string, OperationsKey> = {
  Pending: "viewings_proposalPending",
  Accepted: "viewings_proposalAccepted",
  Declined: "viewings_proposalDeclined",
  Superseded: "viewings_proposalSuperseded",
  Withdrawn: "viewings_proposalWithdrawn",
};
const issueKeys: Record<string, OperationsKey> = {
  unavailable: "viewings_errorUnavailable",
  role: "viewings_errorRole",
  invalidProperty: "viewings_errorProperty",
  invalidDate: "viewings_errorDate",
  invalidTime: "viewings_errorTime",
  noteTooLong: "viewings_errorNoteLong",
  noteRequired: "viewings_errorNoteRequired",
  duplicate: "viewings_errorDuplicate",
  status: "viewings_errorStatus",
  staleProposal: "viewings_errorStaleProposal",
  noChanges: "viewings_errorNoChanges",
  pastTime: "viewings_errorPastTime",
};
function Probe({
  inspect,
}: {
  inspect: (copy: ReturnType<typeof useViewingCopy>) => void;
}) {
  inspect(useViewingCopy());
  return null;
}

for (const language of languages) {
  await instance.changeLanguage(language);
  const tr = (key: OperationsKey, values?: OperationsValues) =>
    operationText(instance, language, key, values);
  render(
    createElement(Probe, {
      inspect: (copy) => {
        assert.equal(copy.locale, operationsLocales[language]);
        assert.equal(
          copy.number(1000),
          new Intl.NumberFormat(operationsLocales[language]).format(1000),
        );
        for (const [phrase, key] of Object.entries(viewingPhraseKeys))
          assert.equal(
            copy.text(phrase as keyof typeof viewingPhraseKeys),
            tr(key),
          );
        for (const [value, key] of Object.entries(statusKeys))
          assert.equal(copy.status(value), tr(key));
        for (const [value, key] of Object.entries(proposalKeys))
          assert.equal(copy.proposalStatus(value), tr(key));
        for (const [value, key] of Object.entries(historyKeys))
          assert.equal(copy.history(value), tr(key));
        for (const [value, key] of Object.entries(issueKeys))
          assert.equal(copy.issueText(value), tr(key));
        assert.equal(
          copy.issueText("unknown-issue"),
          tr("viewings_errorFallback"),
        );
        assert.equal(copy.status("RAW UNKNOWN"), "RAW UNKNOWN");
        assert.equal(copy.date("RAW INVALID DATE"), "RAW INVALID DATE");
        assert.equal(
          copy.date("2032-05-15"),
          new Intl.DateTimeFormat(operationsLocales[language], {
            day: "numeric",
            month: "short",
            year: "numeric",
          }).format(new Date("2032-05-15T12:00:00")),
        );
        assert.equal(
          copy.date(now.toISOString(), true),
          new Intl.DateTimeFormat(operationsLocales[language], {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }).format(now),
        );
        assert.equal(
          copy.legacyText("Rental scope", "Âmbito do arrendamento"),
          language === "pt" ? "Âmbito do arrendamento" : "Rental scope",
        );
        assert.equal(copy.calendar.download, tr("viewings_calendarDownload"));
        assert.equal(
          copy.calendar.description,
          tr("viewings_calendarDescription"),
        );
      },
    }),
  );
  for (const role of ["tenant", "landlord"] as const) {
    for (const scenario of [initial, ...scenarios]) {
      const state = freeze(
        structuredClone(
          scenario === initial
            ? initial
            : selectViewingRequest(scenario, role, id),
        ),
      );
      const before = JSON.stringify(state);
      const html = render(
        createElement(ViewingRequests, {
          role,
          state,
          setState: noAction,
          onOpenProperty: noAction,
          onBrowseHomes: noAction,
        }),
      );
      assert.ok(html.includes(escapeHtml(tr("viewings_title"))));
      assert.ok(
        html.includes(
          `aria-label="${escapeHtml(tr("viewings_filterRequests"))}"`,
        ),
      );
      assert.ok(
        html.includes(
          escapeHtml(
            tr(
              role === "tenant"
                ? "viewings_tenantIntro"
                : "viewings_ownerIntro",
            ),
          ),
        ),
      );
      const record = state.viewings[0];
      const count = record ? 1 : 0;
      assert.ok(
        html.includes(
          escapeHtml(
            tr("viewings_requestsShown", {
              count,
              shownCount: new Intl.NumberFormat(
                operationsLocales[language],
              ).format(count),
            }),
          ),
        ),
        "Visible result count follows the current records and locale",
      );
      if (record) {
        assert.ok(html.includes(`data-viewing-id="${id}"`));
        assert.ok(html.includes(escapeHtml(tr(statusKeys[record.status]))));
        assert.ok(
          html.includes(escapeHtml(rawNote)),
          "Stored user note remains verbatim",
        );
        for (const event of record.history)
          assert.ok(html.includes(escapeHtml(tr(historyKeys[event.action]))));
        for (const proposal of record.proposals)
          assert.ok(
            html.includes(escapeHtml(tr(proposalKeys[proposal.status]))),
          );
        if (scenario === cancelled && role === "landlord")
          assert.ok(
            html.includes(escapeHtml(privateDraft)),
            "Closed private response is retained",
          );
      } else assert.ok(html.includes(escapeHtml(tr("viewings_noRequests"))));
      const summary = render(
        createElement(PropertyViewingsSummary, {
          role,
          state,
          onOpenRequest: noAction,
          onOpenViewings: noAction,
          onOpenDecisions: noAction,
        }),
      );
      assert.ok(summary.includes(escapeHtml(tr("viewings_summaryTitle"))));
      assert.ok(summary.includes(escapeHtml(tr("viewings_openRequests"))));
      if (!record)
        assert.ok(
          summary.includes(escapeHtml(tr("viewings_summaryNoRequests"))),
        );
      const needsDecision =
        (role === "landlord" && record?.status === "Pending") ||
        (role === "tenant" && record?.status === "Proposed");
      assert.ok(
        summary.includes(
          escapeHtml(
            needsDecision
              ? tr(
                  role === "landlord"
                    ? "viewings_ownerDecision"
                    : "viewings_tenantDecision",
                  {
                    count: 1,
                    shownCount: new Intl.NumberFormat(
                      operationsLocales[language],
                    ).format(1),
                  },
                )
              : tr("viewings_noDecisions"),
          ),
        ),
        "Decision summary follows the role and current lifecycle state",
      );
      assert.equal(
        JSON.stringify(state),
        before,
        "Language/render changes preserve all records, drafts and selection",
      );
    }
  }
  for (const role of ["provider", "spaceOperator", "admin"] as const) {
    const state = freeze(structuredClone(accepted));
    const html = render(
      createElement(ViewingRequests, {
        role,
        state,
        setState: noAction,
        onOpenProperty: noAction,
      }),
    );
    assert.ok(html.includes(escapeHtml(tr("viewings_workspaceScope"))));
    assert.equal(html.includes(escapeHtml(rawNote)), false);
    assert.equal(
      render(
        createElement(PropertyViewingsSummary, {
          role,
          state,
          onOpenRequest: noAction,
          onOpenViewings: noAction,
        }),
      ),
      "",
    );
  }
}
assert.equal(
  writes,
  0,
  "Reading translations cannot submit, discard or update any state",
);
console.log(
  `Viewing localization checks passed: six dictionaries, localized plurals/dates, semantic labels, and ${renders} real component renders with unchanged private/domain state.`,
);
