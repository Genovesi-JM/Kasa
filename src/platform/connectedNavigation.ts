import type { PrivateAccount } from "./accountClient";

/** Navigation destinations only. A saved URL never authenticates an account or grants a role. */
export type ConnectedSection =
  | "profile"
  | "listings"
  | "messages"
  | "properties"
  | "maintenance"
  | "documents"
  | "rent"
  | "notifications";

export interface ConnectedAccountState {
  account: PrivateAccount | null;
  phase: "checking" | "ready" | "unavailable";
  unreadCount: number;
  busy: boolean;
  dirty: boolean;
}

const connectedSections: ReadonlySet<string> = new Set<ConnectedSection>([
  "profile",
  "listings",
  "messages",
  "properties",
  "maintenance",
  "documents",
  "rent",
  "notifications",
]);

/** Ambiguous or unsupported routing parameters fail closed, including duplicate values. */
export function readConnectedSection(search: string): ConnectedSection | null {
  const parameters = new URLSearchParams(search);
  const saved = parameters.getAll("saved");
  if (saved.length > 0) {
    return saved.length === 1 && connectedSections.has(saved[0])
      ? (saved[0] as ConnectedSection)
      : null;
  }
  const legacy = parameters.getAll("account");
  return legacy.length === 1 && legacy[0] === "1" ? "profile" : null;
}

/**
 * Build a same-origin navigation target from the current absolute HTTP(S) URL.
 * Keep the existing discovery route, base path, hash and device context untouched.
 * A section is a UI destination, not an account ID, membership or permission.
 */
export function buildConnectedUrl(
  currentHref: string,
  section: ConnectedSection | null,
): string {
  if (section !== null && !connectedSections.has(section)) {
    throw new TypeError("Unknown connected account destination.");
  }
  const location = new URL(currentHref);
  if (!["http:", "https:"].includes(location.protocol)) {
    throw new TypeError(
      "Connected navigation requires the current HTTP(S) URL.",
    );
  }
  location.searchParams.delete("account");
  location.searchParams.delete("saved");
  if (section !== null) {
    location.searchParams.delete("present");
    location.searchParams.set("saved", section);
  }
  // A leading double slash would be interpreted as a different host by history/navigation.
  // Keep unusual server paths as same-origin absolute URLs instead of protocol-relative URLs.
  if (location.pathname.startsWith("//")) return location.href;
  return `${location.pathname}${location.search}${location.hash}`;
}
