import assert from "node:assert/strict";
import { properties } from "../src/data";
import type { Role } from "../src/types";
import {
  appendLocalMessage,
  createInitialMessageState,
  createInitialWorkspaceMessageState,
  messageView,
  openPropertyConversation,
  resetMessageView,
  updateConversation,
  updateMessageView,
  updateWorkspaceMessageState,
  type ConversationCategory,
  type MessageState,
  type MessageView,
} from "../src/components/messageState";

const roles: Role[] = [
  "tenant",
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
];
const categories: ConversationCategory[] = [
  "Property",
  "Maintenance",
  "Services",
  "Spaces",
  "Platform",
];
const defaults: MessageView = {
  query: "",
  context: "All conversations",
  sort: "Most recent",
};
const initial = createInitialWorkspaceMessageState();
const initialJson = JSON.stringify(initial);
const now = new Date("2026-10-03T12:00:00.000Z");
assert.equal(
  new Set(roles.map((role) => initial[role].view)).size,
  roles.length,
);

for (const role of roles) {
  const inbox = initial[role];
  const legacy: MessageState = {
    role,
    conversations: inbox.conversations,
    selectedId: inbox.selectedId,
    conversationOpen: inbox.conversationOpen,
  };
  for (const state of [inbox, legacy]) {
    const detached: MessageView = messageView(state);
    assert.deepEqual(detached, defaults);
    assert.notEqual(detached, messageView(state));
    assert.notEqual(detached, state.view);
    detached.query = "Changed returned copy";
    detached.context = "Unread";
    detached.sort = "Unread first";
    assert.deepEqual(messageView(state), defaults);
    assert.equal(updateMessageView(state, {}), state);
    assert.equal(updateMessageView(state, defaults), state);
    assert.equal(resetMessageView(state), state);
  }
  assert.equal(legacy.view, undefined);
  const retainedLegacy = updateMessageView(legacy, {
    query: `  ${role} draft  `,
  });
  assert.equal(messageView(retainedLegacy).query, `  ${role} draft  `);
  assert.equal(retainedLegacy.conversations, legacy.conversations);
  assert.equal(legacy.view, undefined);
  assert.deepEqual(messageView(createInitialMessageState(role)), defaults);
  assert.notEqual(createInitialMessageState(role).view, inbox.view);

  for (const context of [
    "All conversations",
    "Unread",
    ...categories,
  ] as const) {
    const changed = updateMessageView(inbox, { context });
    if (
      context === "All conversations" ||
      context === "Unread" ||
      inbox.conversations.some(
        (conversation) => conversation.category === context,
      )
    ) {
      assert.equal(messageView(changed).context, context);
      assert.equal(updateMessageView(changed, { context }), changed);
    } else {
      assert.equal(
        changed,
        inbox,
        `${role}: unavailable category cannot hide the inbox`,
      );
    }
  }
  for (const sort of ["Most recent", "Unread first"] as const) {
    const changed = updateMessageView(inbox, { sort });
    assert.equal(messageView(changed).sort, sort);
    assert.equal(updateMessageView(changed, { sort }), changed);
  }
  const query = `  ${"q".repeat(195)}  extra characters`;
  const bounded = updateMessageView(inbox, { query });
  assert.equal(messageView(bounded).query, query.slice(0, 200));
  assert.equal(messageView(bounded).query.length, 200);
  assert.equal(
    updateMessageView(bounded, { query: `${query.slice(0, 200)}other suffix` }),
    bounded,
  );
  assert.equal(
    messageView(updateMessageView(inbox, { query: "   " })).query,
    "   ",
  );
  for (const field of ["query", "context", "sort"] as const) {
    for (const value of [null, undefined, 1, true, {}, []]) {
      assert.equal(
        updateMessageView(inbox, { [field]: value } as Partial<MessageView>),
        inbox,
      );
    }
  }
  for (const patch of [
    { context: "Unread " },
    { context: "property" },
    { sort: "Newest first" },
    { unknown: "ignored" },
    null,
    undefined,
    "not a patch",
  ]) {
    assert.equal(
      updateMessageView(inbox, patch as Partial<MessageView>),
      inbox,
    );
  }
  const unavailable = categories.find(
    (category) =>
      !inbox.conversations.some(
        (conversation) => conversation.category === category,
      ),
  )!;
  const patch: Partial<MessageView> = {
    query: `  retained ${role} search  `,
    context: unavailable,
    sort: "Unread first",
  };
  const mixed = updateMessageView(inbox, patch);
  assert.deepEqual(messageView(mixed), {
    query: `  retained ${role} search  `,
    context: "All conversations",
    sort: "Unread first",
  });
  patch.query = "Later caller edit";
  assert.equal(messageView(mixed).query, `  retained ${role} search  `);
}

for (const role of [
  "",
  "invalid",
  "constructor",
  "__proto__",
  null,
] as unknown as Role[]) {
  const invalid: MessageState = {
    ...initial.tenant,
    role,
    view: {
      query: "hidden saved search",
      context: "Property",
      sort: "Unread first",
    },
  };
  const detached = messageView(invalid);
  assert.deepEqual(detached, defaults);
  detached.query = "Mutated invalid-role default";
  assert.deepEqual(messageView(invalid), defaults);
  assert.equal(
    updateMessageView(invalid, { query: "changed", context: "Unread" }),
    invalid,
  );
  assert.equal(resetMessageView(invalid), invalid);
}

let configured = initial;
for (const role of roles) {
  const before = configured;
  configured = updateWorkspaceMessageState(configured, role, (inbox) => {
    const withDraft = updateConversation(
      inbox,
      inbox.selectedId,
      (conversation) => ({
        ...conversation,
        draft: `Private ${role} message`,
        blocked: true,
        unread: 7,
      }),
    );
    const retained = updateMessageView(withDraft, {
      query: `  ${role} search  `,
      context: "Unread",
      sort: "Unread first",
    });
    assert.equal(retained.conversations, withDraft.conversations);
    assert.equal(retained.selectedId, withDraft.selectedId);
    assert.equal(retained.conversationOpen, withDraft.conversationOpen);
    return retained;
  });
  for (const other of roles.filter((item) => item !== role))
    assert.equal(configured[other], before[other]);
}
const configuredJson = JSON.stringify(configured);
for (const role of roles) {
  const inbox = configured[role];
  const reset = resetMessageView(inbox);
  assert.deepEqual(messageView(reset), defaults);
  assert.equal(resetMessageView(reset), reset);
  assert.equal(reset.conversations, inbox.conversations);
  assert.equal(reset.selectedId, inbox.selectedId);
  assert.equal(reset.conversationOpen, inbox.conversationOpen);
  const workspaceReset = updateWorkspaceMessageState(
    configured,
    role,
    resetMessageView,
  );
  for (const other of roles.filter((item) => item !== role))
    assert.equal(workspaceReset[other], configured[other]);

  const read = updateConversation(inbox, inbox.selectedId, (conversation) => ({
    ...conversation,
    unread: 0,
  }));
  assert.equal(read.view, inbox.view);
  assert.deepEqual(messageView(read), messageView(inbox));
  const unblocked = updateConversation(
    read,
    read.selectedId,
    (conversation) => ({ ...conversation, blocked: false }),
  );
  const sent = appendLocalMessage(unblocked, unblocked.selectedId, now);
  assert.equal(sent.view, inbox.view);
  assert.equal(
    sent.conversations
      .find((conversation) => conversation.id === sent.selectedId)!
      .messages.at(-1)?.text,
    `Private ${role} message`,
  );
  assert.equal(
    appendLocalMessage(inbox, inbox.selectedId, now).view,
    inbox.view,
  );
}

// Contact entry deliberately reveals the exact target, including a newly added
// Property category in workspaces that initially have no property conversations.
for (const role of roles) {
  const property =
    role === "landlord" || role === "spaceOperator"
      ? properties[1]
      : properties[0];
  const before = configured[role];
  const existing = before.conversations.find(
    (conversation) =>
      conversation.propertyContext?.propertyId === property.id &&
      conversation.propertyContext.landlord === property.landlord,
  );
  const opened = updateWorkspaceMessageState(configured, role, (inbox) =>
    openPropertyConversation(inbox, property, now),
  );
  const target = opened[role].conversations.find(
    (conversation) => conversation.id === opened[role].selectedId,
  )!;
  assert.deepEqual(target.propertyContext, {
    propertyId: property.id,
    landlord: property.landlord,
  });
  assert.equal(opened[role].conversationOpen, true);
  assert.deepEqual(messageView(opened[role]), {
    ...defaults,
    sort: "Unread first",
  });
  assert.equal(
    opened[role].conversations.length,
    before.conversations.length + (existing ? 0 : 1),
  );
  if (existing) {
    assert.equal(target.id, existing.id);
    assert.equal(target.messages, existing.messages);
    assert.equal(target.draft, existing.draft);
    assert.equal(target.blocked, existing.blocked);
  } else {
    assert.deepEqual(target.messages, []);
  }
  for (const other of roles.filter((item) => item !== role))
    assert.equal(opened[other], configured[other]);
  assert.equal(
    messageView(updateMessageView(opened[role], { context: "Property" }))
      .context,
    "Property",
  );
  const rehidden = updateMessageView(opened[role], {
    query: "hide this target",
    context: "Unread",
    sort: "Most recent",
  });
  const reopened = openPropertyConversation(
    rehidden,
    { ...property, title: "Updated property title" },
    now,
  );
  assert.equal(reopened.selectedId, target.id);
  assert.equal(reopened.conversations.length, rehidden.conversations.length);
  assert.deepEqual(messageView(reopened), defaults);
}

const nuno = openPropertyConversation(configured.tenant, properties[1], now);
assert.equal(nuno.selectedId, "tenant:conversation-2");
assert.deepEqual(messageView(nuno), { ...defaults, sort: "Unread first" });
const unseen = openPropertyConversation(configured.tenant, properties[2], now);
assert.equal(
  unseen.conversations.length,
  configured.tenant.conversations.length + 1,
);
assert.deepEqual(messageView(unseen), { ...defaults, sort: "Unread first" });
for (const role of ["landlord", "spaceOperator"] as const) {
  const inbox = configured[role];
  assert.equal(openPropertyConversation(inbox, properties[0], now), inbox);
  assert.equal(
    openPropertyConversation(
      inbox,
      { ...properties[0], landlord: "Changed owner label" },
      now,
    ),
    inbox,
  );
  assert.equal(
    updateWorkspaceMessageState(configured, role, (state) =>
      openPropertyConversation(state, properties[0], now),
    ),
    configured,
    "A denied self-contact must not reset filters or another workspace",
  );
}
assert.equal(
  updateWorkspaceMessageState(configured, "provider", configured.tenant),
  configured,
);
assert.equal(JSON.stringify(configured), configuredJson);
assert.equal(JSON.stringify(initial), initialJson);

console.log(
  "Message view checks passed: retained workspace preferences, dynamic categories, guarded updates, and exact property-contact reveal.",
);
