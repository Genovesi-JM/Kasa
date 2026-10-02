import assert from "node:assert/strict";
import {
  allScenes,
  demoJourneys,
  journeys,
  isPresentationEntry,
  overviewTour,
  presentationUrl,
  readPresentationLocation,
} from "../src/presentation/journeys";
import { properties } from "../src/data";

assert.equal(isPresentationEntry(""), true);
assert.equal(isPresentationEntry("?present=1&journey=my-home"), true);
for (const query of [
  "?app=1",
  "?role=tenant&view=overview",
  "?device=ios&present=1",
  "?simulator=1",
]) {
  assert.equal(
    isPresentationEntry(query),
    false,
    "Original app and device links must stay outside the presentation shell",
  );
}

assert.equal(
  new Set(allScenes.map((scene) => scene.id)).size,
  allScenes.length,
  "Every screen needs a unique link target",
);
assert.equal(
  new Set(demoJourneys.map((journey) => journey.id)).size,
  demoJourneys.length,
  "Every journey needs a unique URL",
);
assert.deepEqual(
  new Set(allScenes.map((scene) => scene.target.role)),
  new Set(["tenant", "landlord", "provider", "spaceOperator", "admin"]),
);
for (const journey of demoJourneys) {
  assert.ok(journey.scenes.length > 0);
  for (const [step, scene] of journey.scenes.entries()) {
    assert.ok(scene.title && scene.detail && scene.tryIt);
    const parsed = readPresentationLocation(presentationUrl(journey, step));
    assert.equal(parsed.journey?.id, journey.id);
    assert.equal(parsed.step, step);
    assert.equal(parsed.finished, false);
    if (scene.target.intent)
      assert.ok(
        properties.some(
          (property) => property.listingType === scene.target.intent,
        ),
        "Property scenes must have a matching sample listing",
      );
    if (scene.target.service) assert.equal(scene.target.view, "services");
  }
  assert.equal(
    readPresentationLocation(
      presentationUrl(journey, journey.scenes.length - 1, true),
    ).finished,
    true,
  );
}
assert.equal(
  readPresentationLocation("?journey=does-not-exist&finished=1").journey,
  undefined,
);
assert.equal(
  readPresentationLocation("?journey=does-not-exist&finished=1").finished,
  false,
);
for (const step of ["-3", "NaN", "Infinity", "1.2", "garbage"]) {
  assert.equal(
    readPresentationLocation(`?journey=find-home&step=${step}`).step,
    0,
  );
}
assert.equal(
  readPresentationLocation("?journey=find-home&step=999").step,
  journeys[0].scenes.length - 1,
);
assert.equal(readPresentationLocation("?present=1").journey, undefined);
assert.ok(overviewTour.scenes.every((scene) => allScenes.includes(scene)));
console.log(
  `Prototype navigation passed: ${journeys.length} journeys, ${allScenes.length} entry points, ${overviewTour.scenes.length} tour stops; all deep links and malformed URL cases verified.`,
);
