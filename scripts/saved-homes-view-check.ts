import assert from "node:assert/strict";
import type { Role } from "../src/types";
import {
  createInitialSavedHomesViewState,
  resetSavedHomesView,
  savedHomesIntents,
  savedHomesSorts,
  savedHomesView,
  updateSavedHomesView,
} from "../src/components/savedHomesViewState";

const roles: Role[] = [
  "tenant",
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
];
const initial = createInitialSavedHomesViewState();
const second = createInitialSavedHomesViewState();
const defaultView = { intent: "All", sort: "Recently saved" };

for (const role of roles) {
  assert.deepEqual(savedHomesView(initial, role), defaultView);
  assert.notEqual(initial[role], second[role]);
  for (const other of roles.filter((value) => value !== role)) {
    assert.notEqual(initial[role], initial[other]);
  }
}

const patch = { intent: "Buy", sort: "Price: low to high" };
const tenant = updateSavedHomesView(initial, "tenant", patch);
assert.notEqual(tenant, initial);
assert.notEqual(tenant.tenant, initial.tenant);
assert.deepEqual(initial.tenant, defaultView);
patch.intent = "Rent";
assert.equal(
  tenant.tenant.intent,
  "Buy",
  "The input patch is not retained by reference",
);
for (const role of roles.filter((value) => value !== "tenant")) {
  assert.equal(tenant[role], initial[role]);
  assert.deepEqual(tenant[role], defaultView);
}

const snapshot = savedHomesView(tenant, "tenant");
snapshot.intent = "All";
snapshot.sort = "Recently saved";
assert.deepEqual(
  savedHomesView(tenant, "tenant"),
  {
    intent: "Buy",
    sort: "Price: low to high",
  },
  "A caller cannot mutate retained controls through a selected view",
);

const landlord = updateSavedHomesView(tenant, "landlord", {
  intent: "Rent",
  sort: "Price: high to low",
});
assert.equal(landlord.tenant, tenant.tenant);
assert.deepEqual(savedHomesView(landlord, "landlord"), {
  intent: "Rent",
  sort: "Price: high to low",
});
assert.deepEqual(
  savedHomesView(landlord, "tenant"),
  {
    intent: "Buy",
    sort: "Price: low to high",
  },
  "Returning from another workspace preserves the tenant's controls",
);

for (const role of roles) {
  for (const intent of savedHomesIntents) {
    for (const sort of savedHomesSorts) {
      const changed = updateSavedHomesView(initial, role, { intent, sort });
      assert.deepEqual(savedHomesView(changed, role), { intent, sort });
      for (const other of roles.filter((value) => value !== role)) {
        assert.equal(changed[other], initial[other]);
      }
      assert.equal(
        updateSavedHomesView(changed, role, { intent, sort }),
        changed,
      );
    }
  }
}

for (const value of [
  "",
  "all",
  "Sale",
  "Buy ",
  "Recommended",
  "oldest",
  "__proto__",
  12,
  null,
  {},
  [],
]) {
  assert.equal(
    updateSavedHomesView(landlord, "tenant", {
      intent: value as string,
      sort: value as string,
    }),
    landlord,
    `Unsupported value ${String(value)} must not replace retained controls`,
  );
}
assert.equal(updateSavedHomesView(landlord, "tenant", {}), landlord);
assert.equal(
  updateSavedHomesView(landlord, "tenant", {
    intent: undefined,
    sort: undefined,
  }),
  landlord,
);
const partial = updateSavedHomesView(landlord, "tenant", {
  intent: "unsupported",
  sort: "Newest listing",
});
assert.deepEqual(partial.tenant, { intent: "Buy", sort: "Newest listing" });
assert.equal(partial.landlord, landlord.landlord);

const reset = resetSavedHomesView(partial, "tenant");
assert.deepEqual(reset.tenant, defaultView);
assert.equal(reset.landlord, landlord.landlord);
assert.equal(resetSavedHomesView(reset, "tenant"), reset);
assert.deepEqual(second.tenant, defaultView);

for (const value of ["guest", "constructor", "__proto__"]) {
  const role = value as Role;
  assert.equal(
    updateSavedHomesView(landlord, role, { intent: "All" }),
    landlord,
  );
  assert.equal(resetSavedHomesView(landlord, role), landlord);
  assert.deepEqual(savedHomesView(landlord, role), defaultView);
}

console.log(
  "Saved Homes view checks passed: role-isolated retention, valid controls, defaults/reset, cloned snapshots and invalid-value guards.",
);
