import assert from "node:assert/strict";
import { properties } from "../src/data";
import {
  appendLocalMessage,
  createInitialMessageState,
  createInitialWorkspaceMessageState,
  openPropertyConversation,
  unreadMessageCount,
  updateConversation,
  updateWorkspaceMessageState,
} from "../src/components/messageState";
import type { Role } from "../src/types";
import { matchesSearch } from "../src/search";

const initial = createInitialMessageState();
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

let state = updateConversation(initial, initial.selectedId, (conversation) => ({
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
assert.deepEqual(
  thread.messages,
  [],
  "Opening a property must not fabricate an owner reply",
);
assert.equal(thread.unread, 0);
assert.equal(unreadMessageCount(state), initialUnread);
assert.equal(
  state.conversations.find(
    (conversation) => conversation.id === initial.selectedId,
  )?.draft,
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
assert.equal(sentThread.messages.length, 1);
assert.equal(sentThread.messages[0].direction, "sent");
assert.equal(sentThread.messages[0].localOnly, true);
assert.equal(sentThread.messages[0].text, "Is this home still available?");
assert.equal(sentThread.draft, "");
assert.equal(
  sent.conversations.find(
    (conversation) => conversation.id === initial.selectedId,
  )?.draft,
  "Existing inbox draft",
);
assert.equal(
  openPropertyConversation(sent, listing).conversations.find(
    (conversation) => conversation.id === threadId,
  )?.messages.length,
  1,
);

const whitespace = updateConversation(sent, threadId, (conversation) => ({
  ...conversation,
  draft: "   ",
}));
assert.equal(
  appendLocalMessage(whitespace, threadId).conversations.find(
    (conversation) => conversation.id === threadId,
  )?.messages.length,
  1,
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
  1,
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
assert.equal(unreadMessageCount(unreadThread), initialUnread + 3);
assert.equal(
  unreadMessageCount(openPropertyConversation(unreadThread, listing)),
  initialUnread,
  "Opening the contextual thread clears only its own unread count",
);
assert.equal(
  initial.conversations.length,
  3,
  "All changes leave the original seeds untouched",
);

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
  providerProperty.provider.conversations.at(-1)?.name,
  listing.landlord,
);
assert.equal(
  providerProperty.tenant.conversations.at(-1)?.name,
  listing.landlord,
);
assert.equal(providerProperty.provider.conversationOpen, true);
assert.equal(providerProperty.tenant.conversationOpen, true);
const tenantReply = updateWorkspaceMessageState(
  providerProperty,
  "tenant",
  (inbox) =>
    appendLocalMessage(
      updateConversation(inbox, tenantPropertyId, (conversation) => ({
        ...conversation,
        draft: "My property question",
      })),
      tenantPropertyId,
    ),
);
assert.equal(tenantReply.tenant.conversations.at(-1)?.messages.length, 1);
assert.equal(tenantReply.provider.conversations.at(-1)?.messages.length, 0);
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

console.log(
  "Messages checks passed: all five workspace counterparts, isolated drafts/unread/block state, contextual recipient/listing identity, empty new threads, mobile entry, reuse, retained messages and blocked/blank send guards.",
);
