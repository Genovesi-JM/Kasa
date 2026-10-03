import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { createInstance } from "i18next";
import { createElement } from "react";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { properties } from "../src/data";
import type { Role } from "../src/types";
import {
  appendLocalMessage,
  createInitialWorkspaceMessageState,
  messageView,
  openPropertyConversation,
  updateConversation,
  updateMessageView,
  type MessageState,
} from "../src/components/messageState";
import {
  operationsLocales,
  operationsResources,
  operationText,
} from "../src/locales/operations";
import { messagesEn } from "../src/locales/operations/messages-en";
import {
  messageCategoryKeys,
  messageContextKeys,
  messageSortKeys,
  messageTimeLabel,
  messageWorkspaceKeys,
} from "../src/locales/operations/messagesLabels";
import type {
  OperationsKey,
  OperationsValues,
} from "../src/locales/operations/types";

const languages = ["pt", "en", "es", "fr", "ar", "zh"] as const;
const roles: Role[] = [
  "tenant",
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
];
const instance = createInstance();
await instance.init({
  resources: Object.fromEntries(
    languages.map((language) => [
      language,
      { operations: operationsResources[language] },
    ]),
  ),
  lng: "pt",
  fallbackLng: "en",
  defaultNS: "operations",
  interpolation: { escapeValue: false },
});
const englishKeys = Object.keys(messagesEn) as Array<keyof typeof messagesEn>;
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
assert.deepEqual(Object.keys(messageCategoryKeys), [
  "Property",
  "Maintenance",
  "Services",
  "Spaces",
  "Platform",
]);
assert.deepEqual(Object.keys(messageContextKeys), [
  "All conversations",
  "Unread",
  ...Object.keys(messageCategoryKeys),
]);
assert.deepEqual(Object.keys(messageSortKeys), ["Most recent", "Unread first"]);
assert.deepEqual(Object.keys(messageWorkspaceKeys), roles);

for (const language of languages) {
  const dictionary: Record<string, string> = operationsResources[language];
  const tr = (key: OperationsKey, values?: OperationsValues) =>
    operationText(instance, language, key, values);
  for (const key of englishKeys) {
    assert.ok(Object.hasOwn(dictionary, key), `${language}: missing ${key}`);
    assert.ok(dictionary[key].trim(), `${language}: empty ${key}`);
    assert.deepEqual(
      placeholders(dictionary[key]),
      placeholders(messagesEn[key]),
      `${language}: ${key} placeholders`,
    );
  }
  for (const key of Object.keys(dictionary).filter((key) =>
    key.startsWith("messages_"),
  )) {
    assert.ok(
      Object.hasOwn(messagesEn, key) ||
        /^messages_unreadCount_(zero|two|few|many)$/.test(key),
      `${language}: unexpected message key ${key}`,
    );
  }
  for (const plural of new Intl.PluralRules(
    operationsLocales[language],
  ).resolvedOptions().pluralCategories) {
    const key = `messages_unreadCount_${plural}`;
    assert.ok(
      dictionary[key]?.trim(),
      `${language}: missing ${plural} unread form`,
    );
    assert.deepEqual(placeholders(dictionary[key]), ["count"]);
  }
  for (const count of [0, 1, 2, 3, 11, 100, 1_000_000]) {
    const text = tr("messages_unreadCount", { count });
    assert.ok(
      text.includes(String(count)),
      `${language}: lost unread count ${count}`,
    );
    assert.ok(!text.includes("{{") && !text.includes("messages_"));
    if (language === "ar" || language === "zh") {
      assert.ok(
        text.endsWith(
          `(${operationText(instance, "en", "messages_unreadCount", { count })})`,
        ),
      );
    }
  }
  for (const key of englishKeys.filter(
    (key) => !key.startsWith("messages_unreadCount_"),
  )) {
    const text = tr(key as OperationsKey, {
      name: "NAME_SENTINEL",
      property: "PROPERTY_SENTINEL",
    });
    assert.ok(
      !text.includes("{{") && !text.includes("messages_"),
      `${language}: unresolved ${key}`,
    );
    for (const placeholder of placeholders(messagesEn[key])) {
      assert.ok(text.includes(`${placeholder.toUpperCase()}_SENTINEL`));
    }
    if (
      (language === "ar" || language === "zh") &&
      dictionary[key] !== messagesEn[key]
    ) {
      const english = operationText(instance, "en", key as OperationsKey, {
        name: "NAME_SENTINEL",
        property: "PROPERTY_SENTINEL",
      });
      assert.ok(text.endsWith(`(${english})`), `${language}: bilingual ${key}`);
    }
  }
  assert.equal(messageTimeLabel("New", tr), tr("messages_new"));
  assert.equal(messageTimeLabel("Yesterday", tr), tr("messages_yesterday"));
  for (const clock of [
    "09:42",
    "14:18",
    "23:59",
    "2026-10-03",
    "Yesterday at noon",
    "New York",
    "",
  ]) {
    assert.equal(
      messageTimeLabel(clock, tr),
      clock,
      "Only explicit display markers may be translated",
    );
  }
}

// SSR imports the real component. Styles need no runtime evaluation, and the
// app i18n module only needs documentElement while registering its language.
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
const { Messages } = await import("../src/components/Messages").finally(() => {
  cssHook.deregister();
  if (documentDescriptor)
    Object.defineProperty(globalThis, "document", documentDescriptor);
  else Reflect.deleteProperty(globalThis, "document");
});
let stateWrites = 0;
let notifications = 0;
let renders = 0;
const render = (state: MessageState) => {
  const before = JSON.stringify(state);
  // tsx reads the root config rather than the app's automatic-JSX config.
  // Supply classic JSX's React binding only during the synchronous render.
  const reactDescriptor = Object.getOwnPropertyDescriptor(globalThis, "React");
  Object.defineProperty(globalThis, "React", {
    value: React,
    configurable: true,
  });
  let html: string;
  try {
    html = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n: instance },
        createElement(Messages, {
          state,
          setState: () => {
            stateWrites += 1;
          },
          notify: () => {
            notifications += 1;
          },
        }),
      ),
    );
  } finally {
    if (reactDescriptor)
      Object.defineProperty(globalThis, "React", reactDescriptor);
    else Reflect.deleteProperty(globalThis, "React");
  }
  assert.equal(JSON.stringify(state), before);
  assert.ok(
    !html.includes("messages_"),
    "No unresolved message key reaches the screen",
  );
  renders += 1;
  return html;
};
const assertLabel = (html: string, text: string) =>
  assert.ok(
    html.includes(`aria-label="${escapeHtml(text)}"`),
    `Missing accessible label: ${text}`,
  );
const rowNames = (html: string) =>
  [
    ...html
      .match(/<aside\b[^>]*>([\s\S]*?)<\/aside>/)![1]
      .matchAll(/<strong\b[^>]*>([\s\S]*?)<\/strong>/g),
  ].map((match) => match[1]);
const workspaces = createInitialWorkspaceMessageState();
const originalWorkspaces = JSON.stringify(workspaces);
const now = new Date("2026-10-03T12:10:00.000Z");

for (const language of languages) {
  await instance.changeLanguage(language);
  const tr = (key: OperationsKey, values?: OperationsValues) =>
    operationText(instance, language, key, values);
  for (const role of roles) {
    const rawDraft = `RAW ${role} "<&>" nota بالعربية`;
    const initial = updateConversation(
      workspaces[role],
      workspaces[role].selectedId,
      (conversation) => ({ ...conversation, draft: rawDraft, unread: 3 }),
    );
    const selected = initial.conversations.find(
      (conversation) => conversation.id === initial.selectedId,
    )!;
    const html = render(initial);
    for (const key of [
      "messages_title",
      "messages_conversations",
      "messages_search",
      "messages_filterContext",
      "messages_sort",
      "messages_resetFiltersLabel",
      "messages_back",
      "messages_attachDocumentUnavailable",
      "messages_sendLocal",
    ] as const)
      assertLabel(html, tr(key));
    assertLabel(html, tr("messages_conversationWith", { name: selected.name }));
    assertLabel(html, tr("messages_messageName", { name: selected.name }));
    assertLabel(html, tr("messages_unreadCount", { count: 3 }));
    for (const key of [
      "messages_report",
      "messages_block",
      "messages_resetFilters",
      "messages_sampleInbox",
      "messages_sessionScope",
      "messages_sampleHistory",
      "messages_example",
      "messages_draftPrefix",
    ] as const)
      assert.ok(
        html.includes(escapeHtml(tr(key))),
        `${language}/${role}: ${key}`,
      );
    assert.ok(html.includes(escapeHtml(tr(messageWorkspaceKeys[role]))));
    assert.ok(
      html.includes(
        `placeholder="${escapeHtml(tr("messages_composePlaceholder"))}"`,
      ),
    );
    assert.ok(html.includes(`value="${escapeHtml(rawDraft)}"`));
    for (const message of selected.messages) {
      assert.ok(html.includes(`>${escapeHtml(message.text)}</p>`));
      assert.ok(
        html.includes(escapeHtml(message.time)),
        "Stored clocks remain unchanged",
      );
    }
    assert.ok(html.includes(escapeHtml(tr("messages_yesterday"))));

    const categories = [
      ...new Set(
        initial.conversations.map((conversation) => conversation.category),
      ),
    ];
    const options = [
      ...html.matchAll(
        /<option\b[^>]*value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/g,
      ),
    ];
    assert.deepEqual(
      options.map((match) => match[1]),
      [
        "All conversations",
        "Unread",
        ...categories,
        "Most recent",
        "Unread first",
      ],
    );
    for (const [, value, label] of options) {
      const key =
        value in messageContextKeys
          ? messageContextKeys[value as keyof typeof messageContextKeys]
          : messageSortKeys[value as keyof typeof messageSortKeys];
      assert.equal(label, escapeHtml(tr(key)));
    }
    const canonical = updateMessageView(initial, {
      context: categories[0],
      sort: "Unread first",
    });
    const filteredHtml = render(canonical);
    assert.ok(
      filteredHtml.includes(`<option value="${categories[0]}" selected="">`),
    );
    assert.ok(
      filteredHtml.includes('<option value="Unread first" selected="">'),
    );
    assert.deepEqual(messageView(canonical), {
      query: "",
      context: categories[0],
      sort: "Unread first",
    });
    for (const category of categories) {
      for (const query of [category, tr(messageCategoryKeys[category])]) {
        const searching = updateMessageView(initial, { query });
        const names = rowNames(render(searching));
        for (const conversation of initial.conversations.filter(
          (item) => item.category === category,
        )) {
          assert.ok(
            names.includes(escapeHtml(conversation.name)),
            `${language}/${role}: category search ${query}`,
          );
        }
        assert.equal(
          messageView(searching).query,
          query,
          "Translated search text remains raw state input",
        );
      }
    }
    const blocked = updateConversation(
      initial,
      initial.selectedId,
      (conversation) => ({ ...conversation, blocked: true }),
    );
    const blockedHtml = render(blocked);
    assert.ok(blockedHtml.includes(escapeHtml(tr("messages_unblock"))));
    assert.ok(
      blockedHtml.includes(
        `placeholder="${escapeHtml(tr("messages_blockedPlaceholder"))}"`,
      ),
    );
    assert.ok(blockedHtml.includes(`value="${escapeHtml(rawDraft)}"`));
    const unmatched = render(
      updateMessageView(initial, {
        query: "unmatched-unique-conversation-9837",
      }),
    );
    assert.ok(unmatched.includes(escapeHtml(tr("messages_noMatches"))));

    const empty = openPropertyConversation(initial, properties[2], now);
    const emptyThread = empty.conversations.find(
      (conversation) => conversation.id === empty.selectedId,
    )!;
    assert.equal(emptyThread.messages.length, 0);
    const emptyHtml = render(empty);
    assert.ok(emptyHtml.includes(escapeHtml(tr("messages_new"))));
    assert.ok(emptyHtml.includes(escapeHtml(tr("messages_noMessages"))));
    assert.ok(
      emptyHtml.includes(
        escapeHtml(
          tr("messages_startConversation", { name: emptyThread.name }),
        ),
      ),
    );
    assert.ok(
      emptyHtml.includes(
        escapeHtml(
          tr("messages_startHint", { property: emptyThread.property }),
        ),
      ),
    );
    const local = appendLocalMessage(
      updateConversation(empty, empty.selectedId, (conversation) => ({
        ...conversation,
        draft: rawDraft,
      })),
      empty.selectedId,
      now,
    );
    const localHtml = render(local);
    assert.ok(localHtml.includes(escapeHtml(tr("messages_localHistory"))));
    assert.ok(localHtml.includes(escapeHtml(tr("messages_notDelivered"))));
    assert.ok(localHtml.includes(`>${escapeHtml(rawDraft)}</p>`));
    assert.equal(
      local.conversations.find(
        (conversation) => conversation.id === local.selectedId,
      )!.messages[0].text,
      rawDraft,
    );
    const noSelection = render({ ...initial, selectedId: "missing" });
    assert.ok(noSelection.includes(escapeHtml(tr("messages_noSelection"))));
    assert.ok(
      noSelection.includes(escapeHtml(tr("messages_selectConversation"))),
    );
  }
}
assert.equal(JSON.stringify(workspaces), originalWorkspaces);
assert.equal(stateWrites, 0, "Translation/rendering cannot write domain state");
assert.equal(
  notifications,
  0,
  "Translation/rendering cannot emit action feedback",
);
console.log(
  `Message localization checks passed: six-language keys/plurals, ${renders} workspace renders, canonical filters/search, literal content, and render purity.`,
);
