import assert from "node:assert/strict";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DeviceSimulator } from "../src/components/DeviceSimulator";
import { appRouteUrl, readAppRoute } from "../src/navigation";
import {
  connectedShellCopy,
  connectedShellTranslations,
} from "../src/components/connectedShellCopy";
import {
  buildConnectedUrl,
  readConnectedSection,
  type ConnectedAccountState,
  type ConnectedSection,
} from "../src/platform/connectedNavigation";

const sections: ConnectedSection[] = [
  "profile",
  "listings",
  "messages",
  "properties",
  "maintenance",
  "documents",
  "rent",
  "notifications",
];
const locales = ["pt", "en", "es", "fr", "ar", "zh"] as const;
assert.deepEqual(
  Object.keys(connectedShellTranslations).sort(),
  [...locales].sort(),
  "The connected shell must cover all six supported languages",
);
const copyKeys = Object.keys(connectedShellTranslations.en).sort();
for (const locale of locales) {
  const copy = connectedShellCopy(locale);
  assert.equal(copy, connectedShellTranslations[locale]);
  assert.deepEqual(
    Object.keys(copy).sort(),
    copyKeys,
    `${locale}: complete shell key coverage`,
  );
  for (const [key, value] of Object.entries(copy)) {
    assert.equal(typeof value, "string");
    assert.ok(
      value.trim().length > 0,
      `${locale}.${key}: nonempty translated text`,
    );
    assert.equal(
      value,
      value.trim(),
      `${locale}.${key}: no accidental outer whitespace`,
    );
    if (locale === "ar" || locale === "zh") {
      const bilingual = /^(.+?)\s*\(([A-Za-z][^()]*)\)$/.exec(value);
      assert.ok(
        bilingual,
        `${locale}.${key}: keep the requested English wording in parentheses`,
      );
      assert.ok(
        (locale === "ar" ? /\p{Script=Arabic}/u : /\p{Script=Han}/u).test(
          bilingual[1],
        ),
        `${locale}.${key}: retain native-language text before the English translation`,
      );
    }
  }
}
for (const section of sections)
  assert.ok(
    Object.hasOwn(connectedShellTranslations.en, section),
    `Every saved destination has a translated shell label: ${section}`,
  );
for (const key of [
  "previewNote",
  "localNote",
  "exampleIdentity",
  "previewShared",
  "drafts",
  "checking",
  "unavailable",
])
  assert.ok(
    copyKeys.includes(key),
    `Keep the saved/demo identity, local-only and state guidance: ${key}`,
  );
for (const section of sections) {
  assert.equal(readConnectedSection(`?saved=${section}`), section);
  assert.equal(readConnectedSection(`saved=${section}`), section);
  assert.equal(readConnectedSection(`?account=1&saved=${section}`), section);
  assert.equal(
    readConnectedSection(`?role=admin&saved=${section}&view=diagnostics`),
    section,
  );
}
// Match the main shell's composition: keep its public-route serializer and layer
// saved navigation on top. Example-role switches must never create authentication.
for (const role of [
  "tenant",
  "landlord",
  "provider",
  "spaceOperator",
  "admin",
]) {
  const href = `https://example.test/Kasa/?role=${role}&view=services&service=jobs&intent=Buy&device=android&simulator=1&app=1`;
  const publicRoute = readAppRoute(new URL(href).search);
  for (const section of sections) {
    const entered = new URL(buildConnectedUrl(href, section), href);
    assert.deepEqual(readAppRoute(entered.search), publicRoute);
    const publicTarget = appRouteUrl(publicRoute, entered.search);
    const composed = new URL(
      buildConnectedUrl(new URL(publicTarget, entered).href, section),
      entered,
    );
    assert.deepEqual(readAppRoute(composed.search), publicRoute);
    assert.equal(readConnectedSection(composed.search), section);
    assert.equal(composed.searchParams.get("device"), "android");
    assert.equal(composed.searchParams.get("simulator"), "1");
    const exited = new URL(buildConnectedUrl(composed.href, null), composed);
    assert.deepEqual(readAppRoute(exited.search), publicRoute);
    assert.equal(readConnectedSection(exited.search), null);
  }
}
assert.equal(readConnectedSection("?account=1"), "profile");
assert.equal(readConnectedSection("?role=admin&account=1"), "profile");
assert.equal(readConnectedSection("?saved=r%65nt"), "rent");
for (const search of [
  "",
  "?app=1",
  "?role=admin",
  "?view=rent",
  "?account=0",
  "?account=true",
  "?account=",
  "?account=1&account=1",
  "?account=1&account=0",
  "?saved=rent&saved=rent",
  "?saved=rent&saved=profile",
  "?saved=&account=1",
  "?saved=admin&account=1",
  "?saved=Rent",
  "?saved=rent%20",
  "?saved=%20rent",
  "?saved=rent/",
  "?saved=../profile",
  "?saved=%252fprofile",
  "?saved=%00rent",
  "?Saved=rent",
  "?saved[]=rent",
  "?saved=%E0%A4%A",
  "?saved=__proto__",
  "?saved=https://other.invalid",
  "?saved=javascript:alert(1)",
])
  assert.equal(readConnectedSection(search), null, `Reject ${search}`);

const original =
  "https://example.test/Kasa/nested/?role=landlord&view=portfolio&intent=Buy&device=ios&simulator=1&app=1&q=Talatona%20%26%20Maianga&campaign=phone#details";
const baseline = new URL(original);
for (const section of sections) {
  const target = buildConnectedUrl(original, section);
  const entered = new URL(target, original);
  assert.equal(entered.origin, baseline.origin);
  assert.equal(entered.pathname, baseline.pathname);
  assert.equal(entered.hash, baseline.hash);
  for (const [key, value] of baseline.searchParams)
    assert.equal(entered.searchParams.get(key), value);
  assert.deepEqual(entered.searchParams.getAll("saved"), [section]);
  assert.equal(readConnectedSection(entered.search), section);
  const exited = new URL(buildConnectedUrl(entered.href, null), original);
  assert.equal(exited.origin, baseline.origin);
  assert.equal(exited.pathname, baseline.pathname);
  assert.equal(exited.hash, baseline.hash);
  assert.deepEqual([...exited.searchParams], [...baseline.searchParams]);
  assert.equal(readConnectedSection(exited.search), null);
}

const polluted =
  "http://127.0.0.1:5174/base/?account=1&account=0&saved=rent&saved=admin&role=tenant&present=1&present=2&device=android&simulator=1&redirect=https%3A%2F%2Fevil.invalid#preview";
const entered = new URL(buildConnectedUrl(polluted, "documents"), polluted);
assert.equal(entered.origin, "http://127.0.0.1:5174");
assert.equal(entered.pathname, "/base/");
assert.deepEqual(entered.searchParams.getAll("saved"), ["documents"]);
assert.equal(entered.searchParams.has("account"), false);
assert.equal(entered.searchParams.has("present"), false);
assert.equal(entered.searchParams.get("device"), "android");
assert.equal(entered.searchParams.get("simulator"), "1");
assert.equal(entered.searchParams.get("role"), "tenant");
const exitOnly = new URL(buildConnectedUrl(polluted, null), polluted);
assert.equal(exitOnly.searchParams.has("saved"), false);
assert.equal(exitOnly.searchParams.has("account"), false);
assert.deepEqual(exitOnly.searchParams.getAll("present"), ["1", "2"]);
assert.equal(exitOnly.searchParams.get("redirect"), "https://evil.invalid");
assert.equal(
  exitOnly.origin,
  entered.origin,
  "A query value is never a redirect target",
);

for (const path of [
  "/",
  "/Kasa/",
  "/a%20b/",
  "//unusual/path/",
  "/%2F%2Fevil.invalid/",
]) {
  const original = `https://example.test${path}?view=services`;
  const target = new URL(buildConnectedUrl(original, "profile"), original);
  assert.equal(target.origin, "https://example.test");
  assert.equal(target.pathname, new URL(original).pathname);
}
for (const input of [
  "javascript:alert(1)",
  "data:text/html,test",
  "file:///tmp/test",
  "//other.invalid/app",
  "/relative/",
  "not a URL",
])
  assert.throws(() => buildConnectedUrl(input, "profile"), TypeError);
for (const section of ["admin", "", "Profile", undefined])
  assert.throws(
    () => buildConnectedUrl(original, section as ConnectedSection),
    TypeError,
  );

const initialState: ConnectedAccountState = {
  account: null,
  phase: "checking",
  unreadCount: 0,
  busy: false,
  dirty: false,
};
assert.equal(
  initialState.account,
  null,
  "Navigation state does not manufacture authenticated identities",
);
assert.equal(initialState.phase, "checking");

const labels = {
  title: "Devices",
  subtitle: "Preview",
  compare: "Both",
  ios: "iOS",
  android: "Android",
  close: "Close",
};
function renderSimulator(
  savedSection: ConnectedSection | undefined,
  discoveryIntent?: "Rent" | "Buy",
  language: (typeof locales)[number] = "pt",
) {
  // The repository's bare tsx scripts use the classic JSX runtime; app builds
  // use react-jsx. Scope the SSR test shim and restore any existing binding.
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "React");
  Object.defineProperty(globalThis, "React", {
    value: React,
    configurable: true,
  });
  try {
    return renderToStaticMarkup(
      createElement(DeviceSimulator, {
        role: "tenant",
        view: "services",
        savedSection,
        discoveryIntent,
        language,
        onClose: () => {},
        labels,
      }),
    );
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "React", descriptor);
    else Reflect.deleteProperty(globalThis, "React");
  }
}
for (const section of [undefined, ...sections]) {
  const html = renderSimulator(section);
  const sources = [...html.matchAll(/<iframe[^>]+src="([^"]+)"/g)].map(
    (match) => match[1].replaceAll("&amp;", "&"),
  );
  assert.equal(sources.length, 2);
  for (const [index, source] of sources.entries()) {
    const frame = new URL(source, original);
    assert.equal(frame.origin, baseline.origin);
    assert.equal(frame.pathname, baseline.pathname);
    assert.equal(
      frame.searchParams.get("device"),
      index === 0 ? "ios" : "android",
    );
    assert.equal(frame.searchParams.get("role"), "tenant");
    assert.equal(frame.searchParams.get("view"), "services");
    assert.equal(
      frame.searchParams.has("simulator"),
      false,
      "Iframe cannot recursively reopen the simulator",
    );
    assert.equal(readConnectedSection(frame.search), section ?? null);
    if (section) assert.equal(frame.searchParams.get("app"), "1");
    else
      assert.equal(
        source,
        `?device=${index === 0 ? "ios" : "android"}&role=tenant&view=services`,
        "Existing simulator links remain unchanged",
      );
  }
}
for (const language of locales) {
  const expectedNotice = renderToStaticMarkup(
    createElement("span", null, connectedShellCopy(language).previewShared),
  ).replace(/^<span>|<\/span>$/g, "");
  for (const discoveryIntent of ["Rent", "Buy"] as const) {
    for (const savedSection of [undefined, "profile"] as const) {
      const html = renderSimulator(savedSection, discoveryIntent, language);
      assert.equal(
        html.includes('class="device-account-notice"'),
        savedSection !== undefined,
      );
      assert.equal(
        html.includes(expectedNotice),
        savedSection !== undefined,
        `${language}: shared-account guidance appears only for connected previews`,
      );
      if (savedSection && language === "ar")
        assert.match(
          html,
          /class="device-account-notice" role="note" dir="rtl"/,
        );
      const sources = [...html.matchAll(/<iframe[^>]+src="([^"]+)"/g)].map(
        (match) => match[1].replaceAll("&amp;", "&"),
      );
      assert.equal(sources.length, 2);
      for (const source of sources) {
        const frame = new URL(source, original);
        assert.equal(frame.searchParams.get("intent"), discoveryIntent);
        assert.equal(
          readAppRoute(frame.search).intent,
          discoveryIntent,
          "Buy/Rent discovery context survives simulator entry",
        );
        assert.equal(readConnectedSection(frame.search), savedSection ?? null);
        const exit = new URL(buildConnectedUrl(frame.href, null), frame);
        assert.equal(
          readAppRoute(exit.search).intent,
          discoveryIntent,
          "Leaving saved preview preserves the discovery intent",
        );
      }
    }
  }
}
console.log(
  "Connected navigation checks passed: six-language shell coverage with Arabic/Chinese English parentheses, strict destinations, legacy links, origin/base-path preservation, safe exit and both device frames.",
);
