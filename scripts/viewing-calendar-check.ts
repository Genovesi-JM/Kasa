import assert from "node:assert/strict";
import { properties } from "../src/data";
import type { Role } from "../src/types";
import {
  actOnViewingRequest,
  createInitialPropertyRequestState,
  createViewingRequest,
  saveViewingProposal,
  setViewingFilter,
  updateViewingActionDraft,
  updateViewingDraft,
  type PropertyRequestState,
  type ViewingRequest,
} from "../src/components/propertyRequestState";
import {
  viewingCalendarFile,
  type ViewingCalendarLabels,
} from "../src/components/viewingCalendar";

const now = new Date("2032-05-10T12:00:00.321Z");
const later = new Date("2032-05-10T12:01:05.987Z");
const privateNote = "PRIVATE access details, contact and personal arrangements";
const privateDraft = "PRIVATE unsent reschedule and cancellation explanation";
const labels: ViewingCalendarLabels = {
  summary: (title) => `Property viewing · ${title}`,
  description:
    "Viewing agreement recorded in this tab. Times use the device’s local clock.",
};
let passed = 0;
const property = properties.find((item) => item.id === 1)!;

function request(state: PropertyRequestState) {
  const result = createViewingRequest(
    updateViewingDraft(state, "tenant", 1, {
      date: "2032-05-15",
      time: "10:00",
      note: privateNote,
    }),
    "tenant",
    1,
    now,
  );
  assert.equal(result.issue, null);
  assert.deepEqual(result.errors, {});
  assert.ok(result.requestId);
  return { state: result.state, id: result.requestId };
}
function record(state: PropertyRequestState, id: string) {
  const item = state.viewings.find((entry) => entry.id === id);
  assert.ok(item);
  return item;
}
const initial = createInitialPropertyRequestState();
const first = request(initial);
const agreed = actOnViewingRequest(
  first.state,
  "landlord",
  first.id,
  { type: "accept-request" },
  later,
);
assert.equal(record(agreed, first.id).status, "Agreed");
let retained = updateViewingDraft(agreed, "tenant", 2, {
  date: "2032-12-31",
  time: "22:59",
  note: privateDraft,
});
retained = updateViewingActionDraft(retained, "tenant", first.id, {
  note: privateDraft,
});
retained = updateViewingActionDraft(retained, "landlord", first.id, {
  date: "2032-12-30",
  time: "21:58",
  note: privateDraft,
});
retained = setViewingFilter(retained, "tenant", "History");
retained = setViewingFilter(retained, "landlord", "Pending");

// Unfold independently of the serializer, preserving encoded TEXT for later
// inspection. Physical lines include the continuation space in their byte limit.
function parse(content: string) {
  assert.ok(content.endsWith("\r\n"));
  assert.equal(content.replaceAll("\r\n", "").includes("\n"), false);
  assert.equal(content.replaceAll("\r\n", "").includes("\r"), false);
  const physical = content.slice(0, -2).split("\r\n");
  const logical: string[] = [];
  for (const line of physical) {
    assert.ok(
      Buffer.byteLength(line, "utf8") <= 75,
      "Every physical line is <=75 UTF-8 octets",
    );
    assert.equal(
      new TextDecoder("utf8", { fatal: true }).decode(
        new TextEncoder().encode(line),
      ),
      line,
    );
    if (/^[ \t]/.test(line)) {
      assert.ok(logical.length);
      logical[logical.length - 1] += line.slice(1);
    } else logical.push(line);
  }
  assert.equal(logical.filter((line) => line === "BEGIN:VCALENDAR").length, 1);
  assert.equal(logical.filter((line) => line === "END:VCALENDAR").length, 1);
  assert.equal(logical.filter((line) => line === "BEGIN:VEVENT").length, 1);
  assert.equal(logical.filter((line) => line === "END:VEVENT").length, 1);
  assert.equal(logical[0], "BEGIN:VCALENDAR");
  assert.equal(logical.at(-1), "END:VCALENDAR");
  assert.ok(logical.includes("VERSION:2.0"));
  const eventStart = logical.indexOf("BEGIN:VEVENT");
  const eventEnd = logical.indexOf("END:VEVENT");
  const event = new Map<string, string>();
  for (const line of logical.slice(eventStart + 1, eventEnd)) {
    const colon = line.indexOf(":");
    assert.ok(colon > 0);
    const key = line.slice(0, colon);
    assert.equal(event.has(key), false, `Duplicate event field ${key}`);
    event.set(key, line.slice(colon + 1));
  }
  assert.match(event.get("UID") ?? "", /\S/);
  assert.match(event.get("DTSTAMP") ?? "", /^\d{8}T\d{6}Z$/);
  assert.match(event.get("DTSTART") ?? "", /^\d{8}T\d{6}$/);
  for (const key of ["SUMMARY", "LOCATION", "DESCRIPTION"]) {
    const text = event.get(key);
    assert.ok(text);
    for (let index = 0; index < text.length; index++) {
      if (text[index] === "\\") {
        assert.ok(
          ["n", "N", "\\", ",", ";"].includes(text[++index]),
          "Valid TEXT escape",
        );
      } else
        assert.equal(
          [",", ";"].includes(text[index]),
          false,
          "TEXT delimiters must be escaped",
        );
    }
  }
  for (const key of [
    "DTEND",
    "DURATION",
    "ATTENDEE",
    "ORGANIZER",
    "ATTACH",
    "URL",
  ])
    assert.equal(event.has(key), false, `No inferred or private ${key}`);
  assert.equal(
    logical.some((line) => line.startsWith("METHOD:")),
    false,
  );
  return { event, physical, logical };
}
const decodeText = (value: string) =>
  value.replace(/\\([nN\\,;])/g, (_, escaped: string) =>
    escaped === "n" || escaped === "N" ? "\n" : escaped,
  );
function exported(
  state: PropertyRequestState,
  role: Role = "tenant",
  id = first.id,
  copy = labels,
  clock = now,
) {
  const before = JSON.stringify(state);
  const result = viewingCalendarFile(state, role, id, copy, clock);
  assert.ok(result);
  assert.match(result.fileName, /^kasa-viewing-.+\.ics$/);
  assert.equal(/[\r\n/\\]/.test(result.fileName), false);
  assert.equal(JSON.stringify(state), before);
  const parsed = parse(result.content);
  for (const privateValue of [
    privateNote,
    privateDraft,
    "tenant-ines",
    "Inês Duarte",
    "2032-12-31",
    "2032-12-30",
  ])
    assert.equal(result.content.includes(privateValue), false);
  passed++;
  return { ...result, ...parsed };
}
function unavailable(
  state: PropertyRequestState,
  role: Role = "tenant",
  id = first.id,
  clock = now,
) {
  const before = JSON.stringify(state);
  let titleReads = 0;
  assert.equal(
    viewingCalendarFile(
      state,
      role,
      id,
      {
        summary: () => {
          titleReads++;
          return "Not eligible";
        },
        description: "Not eligible",
      },
      clock,
    ),
    null,
  );
  assert.equal(
    titleReads,
    0,
    "Rejected exports must not disclose a property title",
  );
  assert.equal(JSON.stringify(state), before);
  passed++;
}
function changed(patch: Partial<ViewingRequest>): PropertyRequestState {
  return {
    ...retained,
    viewings: retained.viewings.map((item) =>
      item.id === first.id ? { ...item, ...patch } : item,
    ),
  };
}

const tenantFile = exported(retained);
const ownerFile = exported(retained, "landlord");
assert.equal(tenantFile.content, ownerFile.content);
assert.equal(tenantFile.event.get("DTSTART"), "20320515T100000");
assert.equal(tenantFile.event.get("DTSTAMP"), "20320510T120000Z");
assert.equal(
  decodeText(tenantFile.event.get("SUMMARY")!),
  labels.summary(property.title),
);
assert.equal(decodeText(tenantFile.event.get("LOCATION")!), property.address);
assert.equal(
  decodeText(tenantFile.event.get("DESCRIPTION")!),
  labels.description,
);
const repeated = exported(retained, "tenant", first.id, labels, later);
assert.equal(repeated.event.get("UID"), tenantFile.event.get("UID"));
assert.equal(repeated.fileName, tenantFile.fileName);
assert.equal(repeated.event.get("DTSTAMP"), "20320510T120105Z");

// A pending proposed reschedule retains the accepted appointment in the export.
const proposal = saveViewingProposal(
  updateViewingActionDraft(retained, "landlord", first.id, {
    date: "2032-05-16",
    time: "11:30",
    note: privateNote,
  }),
  "landlord",
  first.id,
  later,
);
assert.ok(proposal.proposalId);
assert.equal(proposal.issue, null);
assert.deepEqual(proposal.errors, {});
assert.equal(record(proposal.state, first.id).status, "Proposed");
const pendingExport = exported(proposal.state);
assert.equal(pendingExport.event.get("DTSTART"), "20320515T100000");
assert.equal(pendingExport.event.get("UID"), tenantFile.event.get("UID"));
const acceptedProposal = actOnViewingRequest(
  proposal.state,
  "tenant",
  first.id,
  {
    type: "accept-proposal",
    proposalId: proposal.proposalId,
  },
  later,
);
const movedExport = exported(acceptedProposal);
assert.equal(movedExport.event.get("DTSTART"), "20320516T113000");
assert.equal(movedExport.event.get("UID"), tenantFile.event.get("UID"));
const declinedProposal = actOnViewingRequest(
  proposal.state,
  "tenant",
  first.id,
  {
    type: "decline-proposal",
    proposalId: proposal.proposalId,
  },
  later,
);
assert.equal(
  exported(declinedProposal).event.get("DTSTART"),
  "20320515T100000",
);

const cancelled = actOnViewingRequest(
  retained,
  "tenant",
  first.id,
  { type: "cancel" },
  later,
);
unavailable(cancelled);
const refused = actOnViewingRequest(
  updateViewingActionDraft(first.state, "landlord", first.id, {
    note: privateNote,
  }),
  "landlord",
  first.id,
  { type: "decline-request" },
  later,
);
assert.equal(record(refused, first.id).status, "Declined");
unavailable(refused);
unavailable(first.state);
const pendingOnly = saveViewingProposal(
  updateViewingActionDraft(first.state, "landlord", first.id, {
    date: "2032-05-16",
    time: "11:30",
    note: privateNote,
  }),
  "landlord",
  first.id,
  later,
);
assert.ok(pendingOnly.proposalId);
unavailable(pendingOnly.state);

const next = request(cancelled);
assert.notEqual(next.id, first.id);
const nextAgreed = actOnViewingRequest(
  next.state,
  "landlord",
  next.id,
  { type: "accept-request" },
  later,
);
const nextFile = exported(nextAgreed, "tenant", next.id);
assert.notEqual(nextFile.event.get("UID"), tenantFile.event.get("UID"));
assert.notEqual(nextFile.fileName, tenantFile.fileName);

for (const role of ["provider", "spaceOperator", "admin"] as const)
  unavailable(retained, role);
unavailable(initial);
unavailable(retained, "tenant", "missing-request");
unavailable(retained, "tenant", "");
unavailable(changed({ id: "" }), "tenant", "");
for (const malformedId of ["viewing-\ud800", "viewing-\udfff"])
  unavailable(changed({ id: malformedId }), "tenant", malformedId);
unavailable(changed({ tenantId: "foreign-tenant" }));
unavailable(changed({ role: "landlord" }));
unavailable(changed({ propertyId: 999999 }));
unavailable(changed({ propertyId: 2 }), "landlord");
const otherProperty = properties.find((item) => item.id === 2)!;
const tenantOtherProperty = exported(changed({ propertyId: 2 }));
assert.equal(
  decodeText(tenantOtherProperty.event.get("LOCATION")!),
  otherProperty.address,
);
assert.notEqual(
  tenantOtherProperty.event.get("UID"),
  tenantFile.event.get("UID"),
);
unavailable({
  ...retained,
  viewings: [record(retained, first.id), { ...record(retained, first.id) }],
});
for (const createdAt of [
  "",
  "not a timestamp",
  "2032-05-10T12:00:00Z",
  "2032-05-10T13:00:00.321+01:00",
])
  unavailable(changed({ createdAt }));
for (const clock of [
  new Date(Number.NaN),
  new Date("0000-01-01T00:00:00.000Z"),
  new Date("+010000-01-01T00:00:00.000Z"),
  null,
  "2032-05-10",
  0,
] as unknown as Date[])
  unavailable(retained, "tenant", first.id, clock);

// Current agreed fields and canonical metadata control the event; forged display
// properties and obsolete requested fields cannot redirect its time or location.
const canonicalState = changed({
  date: "2032-11-11",
  time: "23:55",
  tenantName: "PRIVATE different display name",
  ...{ propertyTitle: "FAKE TITLE", address: "FAKE ADDRESS" },
});
const canonicalFile = exported(canonicalState);
assert.equal(canonicalFile.event.get("DTSTART"), "20320515T100000");
assert.equal(
  decodeText(canonicalFile.event.get("LOCATION")!),
  property.address,
);
assert.equal(canonicalFile.content.includes("FAKE"), false);
assert.equal(
  canonicalFile.content.includes("PRIVATE different display name"),
  false,
);
const createdElsewhere = exported(
  changed({ createdAt: "2032-05-10T12:00:01.321Z" }),
);
assert.notEqual(createdElsewhere.event.get("UID"), tenantFile.event.get("UID"));

for (const terms of [
  undefined,
  { date: "2032-02-30", time: "10:00" },
  { date: "2032-13-01", time: "10:00" },
  { date: "2032-5-15", time: "10:00" },
  { date: "0000-05-15", time: "10:00" },
  { date: "2032-05-15", time: "24:00" },
  { date: "2032-05-15", time: "10:60" },
  { date: "2032-05-15", time: "10:00:01" },
  { date: "2032-05-15", time: "10:00\nBEGIN:VEVENT" },
])
  unavailable(changed({ agreedTerms: terms }));
const start = new Date(2032, 4, 15, 10, 0);
exported(retained, "tenant", first.id, labels, new Date(start.getTime() - 1));
unavailable(retained, "tenant", first.id, start);
unavailable(retained, "tenant", first.id, new Date(start.getTime() + 1));
unavailable(proposal.state, "tenant", first.id, new Date(2032, 4, 15, 10, 1));

// TEXT escaping prevents labels from becoming calendar protocol lines. Long
// multilingual values exercise UTF-8 folding rather than JavaScript char count.
const attack =
  "Comma, semicolon; slash\\ literal\\n\r\nBEGIN:VEVENT\nATTENDEE:mailto:secret@example.test\rEND:VEVENT";
const unicode = "视察 العربية Português 😀🏠é".repeat(18);
const longLabels: ViewingCalendarLabels = {
  summary: (title) => `${title} ${unicode} ${attack}`,
  description: `${attack} ${unicode}`,
};
const escaped = exported(retained, "tenant", first.id, longLabels);
assert.equal(
  decodeText(escaped.event.get("SUMMARY")!),
  longLabels.summary(property.title).replace(/\r\n|\r/g, "\n"),
);
assert.equal(
  decodeText(escaped.event.get("DESCRIPTION")!),
  longLabels.description.replace(/\r\n|\r/g, "\n"),
);
assert.ok(escaped.physical.some((line) => line.startsWith(" ")));
assert.equal(escaped.event.get("UID"), tenantFile.event.get("UID"));
const unsafeId = "viewing/../😀,;\\\r\nBEGIN:VEVENT:".repeat(4);
const unsafeFile = exported(changed({ id: unsafeId }), "tenant", unsafeId);
assert.notEqual(unsafeFile.fileName, tenantFile.fileName);
assert.equal(
  unsafeFile.event.get("UID") === tenantFile.event.get("UID"),
  false,
);
const sanitized = exported(retained, "tenant", first.id, {
  summary: labels.summary,
  description: "Left\u0000\t\u0001Right\u007f\ud800",
});
assert.equal(
  decodeText(sanitized.event.get("DESCRIPTION")!),
  "Left\tRight\uFFFD",
);

// Device-local spring-forward gaps cannot silently shift an appointment by an
// hour. Restore TZ synchronously so other suites retain their own environment.
const previousTz = process.env.TZ;
try {
  process.env.TZ = "Europe/Madrid";
  assert.equal(new Date(2032, 2, 28, 2, 30).getHours(), 3);
  unavailable(
    changed({ agreedTerms: { date: "2032-03-28", time: "02:30" } }),
    "tenant",
    first.id,
    new Date(2032, 2, 27, 12),
  );
  const validAfterGap = exported(
    changed({ agreedTerms: { date: "2032-03-28", time: "03:30" } }),
    "tenant",
    first.id,
    labels,
    new Date(2032, 2, 27, 12),
  );
  assert.equal(validAfterGap.event.get("DTSTART"), "20320328T033000");
} finally {
  if (previousTz === undefined) delete process.env.TZ;
  else process.env.TZ = previousTz;
}
assert.equal(process.env.TZ, previousTz);

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
const frozen = freeze(structuredClone(retained));
const immutableFile = exported(
  frozen,
  "tenant",
  first.id,
  Object.freeze(labels),
);
assert.equal(immutableFile.content, tenantFile.content);
assert.deepEqual(viewingCalendarFile(frozen, "tenant", first.id, labels, now), {
  fileName: immutableFile.fileName,
  content: immutableFile.content,
});

console.log(`${passed} viewing calendar checks passed.`);
