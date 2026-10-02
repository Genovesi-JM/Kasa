import assert from "node:assert/strict";
import { properties } from "../src/data";
import {
  appendLocalMessage,
  createInitialMessageState,
  openPropertyConversation,
  unreadMessageCount,
  updateConversation,
} from "../src/components/messageState";

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

console.log(
  "Messages checks passed: separate transcripts, contextual recipient/listing identity, empty new threads, mobile entry, reuse, retained drafts/messages, unread counts and blocked/blank send guards.",
);
