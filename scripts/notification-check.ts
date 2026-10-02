import assert from "node:assert/strict";
import {
  createInitialNotificationState,
  markAllNotificationsRead,
  markNotificationRead,
  notificationsForRole,
  unreadNotificationCount,
} from "../src/components/notificationState";
import type { Role } from "../src/types";

const initial = createInitialNotificationState();
const tenantItems = notificationsForRole(initial, "tenant");
assert.equal(tenantItems.length, 4);
assert.equal(unreadNotificationCount(initial, "tenant"), 2);
assert.equal(
  new Set(initial.items.map((item) => item.id)).size,
  initial.items.length,
);

const first = tenantItems.find((item) => !item.read)!;
const readOne = markNotificationRead(initial, "tenant", first.id);
assert.equal(unreadNotificationCount(readOne, "tenant"), 1);
assert.equal(
  unreadNotificationCount(initial, "tenant"),
  2,
  "Updates must not mutate the original state",
);
assert.equal(
  markNotificationRead(readOne, "tenant", first.id),
  readOne,
  "Repeated marking is idempotent",
);
assert.equal(
  markNotificationRead(initial, "landlord", first.id),
  initial,
  "Another workspace cannot change this notification",
);
assert.equal(markNotificationRead(initial, "tenant", "missing"), initial);

const allRead = markAllNotificationsRead(readOne, "tenant");
assert.equal(unreadNotificationCount(allRead, "tenant"), 0);
assert.equal(markAllNotificationsRead(allRead, "tenant"), allRead);
assert.equal(unreadNotificationCount(allRead, "landlord"), 1);
for (const role of [
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
] as Role[]) {
  assert.deepEqual(
    notificationsForRole(allRead, role),
    notificationsForRole(initial, role),
    "Reading tenant notifications must preserve other workspaces",
  );
  assert.equal(
    unreadNotificationCount(markAllNotificationsRead(initial, role), role),
    0,
  );
}

assert.equal(
  tenantItems.find((item) => item.icon === "message")?.destination,
  "messages",
);
assert.equal(
  tenantItems.find((item) => item.icon === "repair")?.destination,
  "maintenance",
);
assert.equal(
  tenantItems.find((item) => item.icon === "calendar")?.destination,
  "spaceBookings",
);
assert.equal(first.destination, "services");
assert.equal(first.serviceMode, "jobs");
assert.equal(
  unreadNotificationCount(createInitialNotificationState(), "tenant"),
  2,
  "A new app instance must receive fresh sample data",
);
console.log(
  "Notification state checks passed: shared unread counts, individual/all read, idempotence, workspace isolation, navigation targets and fresh reset.",
);
