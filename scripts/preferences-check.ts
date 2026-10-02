import assert from "node:assert/strict";
import { readPreference, writePreference } from "../src/platform/preferences";

const values = new Map<string, string>();
const store = () => ({
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => {
    values.set(key, value);
  },
});
assert.equal(readPreference("language", store), null);
assert.equal(writePreference("language", "pt", store), true);
assert.equal(readPreference("language", store), "pt");

const unavailable = () => {
  throw new Error("Storage access denied");
};
assert.equal(readPreference("language", unavailable), null);
assert.equal(writePreference("language", "en", unavailable), false);
const blocked = () => ({
  getItem: () => {
    throw new Error("Blocked");
  },
  setItem: () => {
    throw new Error("Quota exceeded");
  },
});
assert.equal(readPreference("language", blocked), null);
assert.equal(writePreference("language", "en", blocked), false);
console.log(
  "Browser preferences passed: missing values, stored values, denied storage and quota failures.",
);
