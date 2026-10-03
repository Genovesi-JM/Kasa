import assert from "node:assert/strict";
import { properties } from "../src/data";
import {
  isWorkspaceListingOwner,
  ownedProperties,
  ownsProperty,
} from "../src/propertyScope";
import {
  appendLocalMessage,
  createInitialMessageState,
  createInitialWorkspaceMessageState,
  openPropertyConversation,
  unreadMessageCount,
  updateConversation,
  updateWorkspaceMessageState,
  type MessageState,
} from "../src/components/messageState";
import type { Role } from "../src/types";
import { matchesSearch } from "../src/search";

const initial = createInitialMessageState("tenant");
const initialJson = JSON.stringify(initial);
const catalogueJson = JSON.stringify(properties);
const selectedConversation = (inbox: MessageState) => {
  const conversation = inbox.conversations.find(
    (item) => item.id === inbox.selectedId,
  );
  assert.ok(conversation);
  return conversation;
};
assert.equal(
  new Set(
    initial.conversations.map((conversation) =>
      conversation.messages.map((message) => message.text).join("|"),
    ),
  ).size,
  initial.conversations.length,
);
assert.equal(initial.conversationOpen, false);
const initialUnread = unreadMessageCount(initial);
const listing = properties[0];
const otherListing = { ...listing, id: 987, title: "A different home" };
const differentOwner = { ...listing, landlord: "A different owner" };
const seededThread = initial.conversations[0];
const unrelatedId = initial.conversations[2].id;
const unreadOutsideThread = initialUnread - seededThread.unread;

let state = updateConversation(initial, unrelatedId, (conversation) => ({
  ...conversation,
  draft: "Existing inbox draft",
}));
state = openPropertyConversation(
  state,
  listing,
  new Date("2026-10-02T12:00:00Z"),
);
const threadId = state.selectedId;
const thread = state.conversations.find(
  (conversation) => conversation.id === threadId,
)!;
assert.equal(
  state.conversationOpen,
  true,
  "Contextual entry opens the thread on mobile",
);
assert.equal(thread.name, listing.landlord);
assert.equal(thread.property, listing.title);
assert.deepEqual(thread.propertyContext, {
  propertyId: listing.id,
  landlord: listing.landlord,
});
assert.equal(threadId, "tenant:conversation-1");
assert.equal(state.conversations.length, initial.conversations.length);
assert.equal(
  thread.messages,
  seededThread.messages,
  "Opening the seeded property retains its existing messages without adding a reply",
);
assert.equal(thread.unread, 0);
assert.equal(unreadMessageCount(state), unreadOutsideThread);
assert.equal(
  state.conversations.find((conversation) => conversation.id === unrelatedId)
    ?.draft,
  "Existing inbox draft",
);

state = updateConversation(state, threadId, (conversation) => ({
  ...conversation,
  draft: "Is this home still available?",
}));
const withSecondListing = openPropertyConversation(state, otherListing);
assert.notEqual(
  withSecondListing.selectedId,
  threadId,
  "Different listings owned by one person need separate contexts",
);
const withAnotherOwner = openPropertyConversation(
  withSecondListing,
  differentOwner,
);
assert.notEqual(
  withAnotherOwner.selectedId,
  threadId,
  "A changed owner must not receive the previous owner's draft",
);
assert.notEqual(withAnotherOwner.selectedId, withSecondListing.selectedId);
assert.equal(
  new Set(withAnotherOwner.conversations.map((conversation) => conversation.id))
    .size,
  withAnotherOwner.conversations.length,
);
assert.equal(
  withAnotherOwner.conversations.find(
    (conversation) => conversation.id === withAnotherOwner.selectedId,
  )?.draft,
  "",
);

const reopened = openPropertyConversation(withAnotherOwner, {
  ...listing,
  title: "Updated listing title",
});
assert.equal(reopened.selectedId, threadId);
assert.equal(
  reopened.conversations.length,
  withAnotherOwner.conversations.length,
  "Reopening the same listing and owner reuses the thread",
);
assert.equal(
  reopened.conversations.find((conversation) => conversation.id === threadId)
    ?.draft,
  "Is this home still available?",
);
assert.equal(
  reopened.conversations.find((conversation) => conversation.id === threadId)
    ?.property,
  "Updated listing title",
);

const sent = appendLocalMessage(
  reopened,
  threadId,
  new Date("2026-10-02T12:10:00Z"),
);
const sentThread = sent.conversations.find(
  (conversation) => conversation.id === threadId,
)!;
const sentCount = seededThread.messages.length + 1;
assert.equal(sentThread.messages.length, sentCount);
assert.deepEqual(sentThread.messages.slice(0, -1), seededThread.messages);
assert.equal(sentThread.messages.at(-1)?.direction, "sent");
assert.equal(sentThread.messages.at(-1)?.localOnly, true);
assert.equal(sentThread.messages.at(-1)?.text, "Is this home still available?");
assert.equal(sentThread.draft, "");
assert.equal(
  sent.conversations.find((conversation) => conversation.id === unrelatedId)
    ?.draft,
  "Existing inbox draft",
);
assert.equal(
  openPropertyConversation(sent, listing).conversations.find(
    (conversation) => conversation.id === threadId,
  )?.messages.length,
  sentCount,
);

const whitespace = updateConversation(sent, threadId, (conversation) => ({
  ...conversation,
  draft: "   ",
}));
assert.equal(
  appendLocalMessage(whitespace, threadId).conversations.find(
    (conversation) => conversation.id === threadId,
  )?.messages.length,
  sentCount,
);
const blocked = updateConversation(sent, threadId, (conversation) => ({
  ...conversation,
  blocked: true,
  draft: "Keep this draft",
}));
assert.equal(
  appendLocalMessage(blocked, threadId).conversations.find(
    (conversation) => conversation.id === threadId,
  )?.messages.length,
  sentCount,
);
assert.equal(
  openPropertyConversation(blocked, listing).conversations.find(
    (conversation) => conversation.id === threadId,
  )?.draft,
  "Keep this draft",
);
assert.equal(
  openPropertyConversation(blocked, listing).conversations.find(
    (conversation) => conversation.id === threadId,
  )?.blocked,
  true,
);
const unreadThread = updateConversation(sent, threadId, (conversation) => ({
  ...conversation,
  unread: 3,
}));
assert.equal(unreadMessageCount(unreadThread), unreadOutsideThread + 3);
assert.equal(
  unreadMessageCount(openPropertyConversation(unreadThread, listing)),
  unreadOutsideThread,
  "Opening the contextual thread clears only its own unread count",
);
assert.equal(
  initial.conversations.length,
  3,
  "All changes leave the original seeds untouched",
);

for (const [index, property] of properties.slice(0, 2).entries()) {
  const seed = initial.conversations[index];
  assert.equal(seed.id, `tenant:conversation-${index + 1}`);
  assert.deepEqual(seed.propertyContext, {
    propertyId: property.id,
    landlord: property.landlord,
  });
  const privateState = updateConversation(initial, seed.id, (conversation) => ({
    ...conversation,
    draft: `Unsent question for ${property.landlord}`,
    blocked: true,
    unread: 4,
  }));
  const privateJson = JSON.stringify(privateState);
  const opened = openPropertyConversation(privateState, property);
  const selected = selectedConversation(opened);
  assert.equal(opened.selectedId, seed.id);
  assert.equal(opened.conversationOpen, true);
  assert.equal(opened.conversations.length, privateState.conversations.length);
  assert.equal(selected.messages, seed.messages);
  assert.equal(selected.draft, `Unsent question for ${property.landlord}`);
  assert.equal(selected.blocked, true);
  assert.equal(selected.unread, 0);
  assert.equal(
    unreadMessageCount(opened),
    unreadMessageCount(privateState) - 4,
  );
  for (const other of privateState.conversations.filter(
    (item) => item.id !== seed.id,
  )) {
    assert.equal(
      opened.conversations.find((item) => item.id === other.id),
      other,
    );
  }
  const retitled = openPropertyConversation(opened, {
    ...property,
    title: `Edited title ${index + 1}`,
  });
  assert.equal(retitled.selectedId, seed.id);
  assert.equal(retitled.conversations.length, opened.conversations.length);
  assert.equal(
    selectedConversation(retitled).property,
    `Edited title ${index + 1}`,
  );
  assert.equal(selectedConversation(retitled).messages, seed.messages);
  assert.equal(selectedConversation(retitled).draft, selected.draft);
  assert.equal(selectedConversation(retitled).blocked, true);
  assert.equal(JSON.stringify(privateState), privateJson);
}

const unseenListing = properties[2];
assert.ok(
  initial.conversations.every(
    (conversation) =>
      conversation.propertyContext?.propertyId !== unseenListing.id,
  ),
);
const unseenInbox = openPropertyConversation(initial, unseenListing);
const unseenThread = selectedConversation(unseenInbox);
assert.equal(
  unseenInbox.conversations.length,
  initial.conversations.length + 1,
);
assert.deepEqual(unseenThread.propertyContext, {
  propertyId: unseenListing.id,
  landlord: unseenListing.landlord,
});
assert.equal(unseenThread.name, unseenListing.landlord);
assert.deepEqual(
  unseenThread.messages,
  [],
  "A genuinely unseen property starts empty without a fabricated reply",
);
assert.equal(unseenThread.draft, "");
assert.equal(unseenThread.unread, 0);
assert.equal(unreadMessageCount(unseenInbox), initialUnread);
for (const seed of initial.conversations)
  assert.ok(unseenInbox.conversations.includes(seed));
const unseenSent = appendLocalMessage(
  updateConversation(unseenInbox, unseenThread.id, (conversation) => ({
    ...conversation,
    draft: "First local question",
  })),
  unseenThread.id,
);
assert.equal(selectedConversation(unseenSent).messages.length, 1);
assert.equal(selectedConversation(unseenSent).messages[0].localOnly, true);
assert.equal(
  selectedConversation(openPropertyConversation(unseenSent, unseenListing))
    .messages,
  selectedConversation(unseenSent).messages,
);

const freshTenant = createInitialMessageState("tenant");
for (const index of [0, 1]) {
  const context = freshTenant.conversations[index].propertyContext!;
  assert.notEqual(context, initial.conversations[index].propertyContext);
  assert.deepEqual(context, initial.conversations[index].propertyContext);
  context.propertyId = 999;
  context.landlord = "Changed in a separate session";
}
assert.equal(
  JSON.stringify(createInitialMessageState("tenant")),
  initialJson,
  "Fresh context objects cannot mutate the source seeds",
);
assert.equal(JSON.stringify(initial), initialJson);
assert.equal(JSON.stringify(properties), catalogueJson);

const workspaces = createInitialWorkspaceMessageState();
const roles: Role[] = [
  "tenant",
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
];
const expectedCounterpart: Record<Role, string> = {
  tenant: "Olivia Martín",
  landlord: "Inês Duarte",
  provider: "Olivia Martín",
  spaceOperator: "Leo Bernard",
  admin: "Olivia Martín",
};
const workspaceIdentity: Record<Role, string[]> = {
  tenant: ["Inês Duarte"],
  landlord: ["Olivia Martín"],
  provider: ["Adrián Ruiz", "Volt & Co."],
  spaceOperator: ["Olivia Martín", "Poblenou MultiSport Club"],
  admin: ["Kasa Trust"],
};
for (const role of roles) {
  const inbox = workspaces[role];
  assert.equal(inbox.role, role);
  assert.equal(inbox.conversations[0].name, expectedCounterpart[role]);
  assert.ok(
    inbox.conversations.every(
      (conversation) => !workspaceIdentity[role].includes(conversation.name),
    ),
    `${role} seed recipients must be counterparts, not the current identity`,
  );
  assert.ok(
    inbox.conversations.every((conversation) =>
      conversation.id.startsWith(`${role}:`),
    ),
  );
}
assert.match(
  workspaces.tenant.conversations[0].messages[0].text,
  /I made the rent transfer/,
);
assert.equal(workspaces.tenant.conversations[0].messages[0].direction, "sent");
assert.match(
  workspaces.landlord.conversations[0].messages[1].text,
  /I made the rent transfer/,
);
assert.equal(
  workspaces.landlord.conversations[0].messages[1].direction,
  "received",
);
assert.ok(
  workspaces.provider.conversations.some(
    (conversation) => conversation.category === "Services",
  ),
);
assert.ok(
  workspaces.spaceOperator.conversations.some(
    (conversation) => conversation.category === "Spaces",
  ),
);
assert.ok(
  workspaces.admin.conversations.every(
    (conversation) => conversation.category === "Platform",
  ),
);
assert.ok(matchesSearch("  ines  ", workspaces.landlord.conversations[0].name));
assert.ok(
  matchesSearch(
    " EIXAMPLE  olivia ",
    workspaces.tenant.conversations[0].name,
    workspaces.tenant.conversations[0].property,
  ),
);

const tenantId = workspaces.tenant.selectedId;
const editedWorkspace = updateWorkspaceMessageState(
  workspaces,
  "tenant",
  (inbox) => ({
    ...updateConversation(inbox, tenantId, (conversation) => ({
      ...conversation,
      draft: "Tenant-only draft",
      blocked: true,
      unread: 0,
    })),
    conversationOpen: true,
  }),
);
assert.equal(
  editedWorkspace.tenant.conversations[0].draft,
  "Tenant-only draft",
);
assert.equal(editedWorkspace.tenant.conversations[0].blocked, true);
assert.equal(editedWorkspace.tenant.conversationOpen, true);
assert.equal(unreadMessageCount(editedWorkspace.tenant), 0);
assert.equal(unreadMessageCount(editedWorkspace.landlord), 2);
for (const role of roles.filter((role) => role !== "tenant")) {
  assert.equal(
    editedWorkspace[role],
    workspaces[role],
    `Updating tenant must not replace ${role} state`,
  );
  assert.ok(
    editedWorkspace[role].conversations.every(
      (conversation) => conversation.draft === "" && !conversation.blocked,
    ),
  );
}
const landlordEdited = updateWorkspaceMessageState(
  editedWorkspace,
  "landlord",
  (inbox) =>
    updateConversation(inbox, inbox.selectedId, (conversation) => ({
      ...conversation,
      draft: "Owner-only draft",
    })),
);
assert.equal(
  landlordEdited.tenant,
  editedWorkspace.tenant,
  "Switching and editing another workspace keeps the tenant draft, unread and block state",
);
assert.equal(
  landlordEdited.landlord.conversations[0].draft,
  "Owner-only draft",
);
assert.equal(
  openPropertyConversation(landlordEdited.landlord, listing),
  landlordEdited.landlord,
  "An owned listing must not create a self-conversation or change the current inbox state",
);
assert.equal(
  openPropertyConversation(landlordEdited.landlord, differentOwner),
  landlordEdited.landlord,
  "Stable listing ownership cannot be bypassed by a changed display name",
);
const foreignListing = properties[1];
for (const role of ["landlord", "spaceOperator"] as const) {
  assert.equal(isWorkspaceListingOwner(role, listing.id), true);
  assert.equal(isWorkspaceListingOwner(role, foreignListing.id), false);
  assert.equal(isWorkspaceListingOwner(role, 987), false);
  assert.equal(
    openPropertyConversation(workspaces[role], listing),
    workspaces[role],
    "Olivia must not contact herself through either of her workspaces",
  );
  const foreignInbox = openPropertyConversation(
    workspaces[role],
    foreignListing,
  );
  assert.equal(
    selectedConversation(foreignInbox).name,
    foreignListing.landlord,
  );
  assert.equal(foreignInbox.conversationOpen, true);
}
assert.deepEqual(
  ownedProperties("spaceOperator"),
  [],
  "Shared identity does not grant property operations to the venue workspace",
);
assert.equal(ownsProperty("spaceOperator", listing.id), false);
for (const role of ["tenant", "provider", "admin"] as const) {
  assert.equal(isWorkspaceListingOwner(role, listing.id), false);
}
const ownerForeignConversation = openPropertyConversation(
  landlordEdited.landlord,
  foreignListing,
);
const ownerForeignThread = ownerForeignConversation.conversations.find(
  (conversation) => conversation.id === ownerForeignConversation.selectedId,
)!;
assert.equal(ownerForeignConversation.conversationOpen, true);
assert.equal(ownerForeignThread.name, foreignListing.landlord);
assert.deepEqual(ownerForeignThread.propertyContext, {
  propertyId: foreignListing.id,
  landlord: foreignListing.landlord,
});
assert.deepEqual(ownerForeignThread.messages, []);
assert.equal(
  ownerForeignConversation.conversations.length,
  landlordEdited.landlord.conversations.length + 1,
  "An owner can still start a conversation about another owner's listing",
);
assert.equal(
  ownerForeignConversation.conversations[0].draft,
  "Owner-only draft",
);
assert.equal(
  openPropertyConversation(ownerForeignConversation, foreignListing)
    .conversations.length,
  ownerForeignConversation.conversations.length,
  "Reopening a foreign listing reuses its existing conversation",
);
assert.equal(
  updateWorkspaceMessageState(
    landlordEdited,
    "provider",
    landlordEdited.tenant,
  ),
  landlordEdited,
  "A setter must not place a differently tagged inbox under another workspace",
);

const tenantProperty = updateWorkspaceMessageState(
  landlordEdited,
  "tenant",
  (inbox) => openPropertyConversation(inbox, listing),
);
const tenantPropertyId = tenantProperty.tenant.selectedId;
const providerProperty = updateWorkspaceMessageState(
  tenantProperty,
  "provider",
  (inbox) => openPropertyConversation(inbox, listing),
);
assert.notEqual(
  providerProperty.provider.selectedId,
  tenantPropertyId,
  "Even the same listing has separate conversation IDs in different workspaces",
);
assert.equal(providerProperty.tenant, tenantProperty.tenant);
assert.equal(
  selectedConversation(providerProperty.provider).name,
  listing.landlord,
);
assert.equal(
  selectedConversation(providerProperty.tenant).name,
  listing.landlord,
);
assert.equal(providerProperty.provider.conversationOpen, true);
assert.equal(providerProperty.tenant.conversationOpen, true);
assert.equal(tenantPropertyId, tenantId);
assert.equal(
  tenantProperty.tenant.conversations.length,
  landlordEdited.tenant.conversations.length,
);
assert.equal(
  selectedConversation(tenantProperty.tenant).draft,
  "Tenant-only draft",
);
assert.equal(selectedConversation(tenantProperty.tenant).blocked, true);
const tenantReply = updateWorkspaceMessageState(
  providerProperty,
  "tenant",
  (inbox) =>
    appendLocalMessage(
      updateConversation(inbox, tenantPropertyId, (conversation) => ({
        ...conversation,
        blocked: false,
        draft: "My property question",
      })),
      tenantPropertyId,
    ),
);
assert.equal(
  selectedConversation(tenantReply.tenant).messages.length,
  selectedConversation(tenantProperty.tenant).messages.length + 1,
);
assert.equal(
  selectedConversation(tenantReply.tenant).messages.at(-1)?.text,
  "My property question",
);
assert.equal(selectedConversation(tenantReply.provider).messages.length, 0);
assert.equal(tenantReply.landlord.conversations.length, 3);
assert.equal(
  workspaces.tenant.conversations.length,
  3,
  "Workspace operations never modify the seed store",
);
assert.notEqual(
  createInitialWorkspaceMessageState().tenant.conversations[0],
  workspaces.tenant.conversations[0],
  "A new session receives fresh objects",
);
for (const index of [0, 1]) {
  assert.notEqual(
    createInitialWorkspaceMessageState().tenant.conversations[index]
      .propertyContext,
    workspaces.tenant.conversations[index].propertyContext,
  );
}
assert.equal(JSON.stringify(initial), initialJson);

console.log(
  "Messages checks passed: all five workspace counterparts, isolated drafts/unread/block state, exact property seed reuse, detached contexts, self-conversation guard, foreign owner conversations, empty unseen threads, mobile entry, retained messages and blocked/blank send guards.",
);
