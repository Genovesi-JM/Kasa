import type { viewingEn } from "./viewing-en";

export type ViewingPluralBase =
  | "viewings_requestsShown"
  | "viewings_ownerDecision"
  | "viewings_tenantDecision";
export type ViewingDictionary = Record<keyof typeof viewingEn, string> &
  Partial<
    Record<`${ViewingPluralBase}_${"zero" | "two" | "few" | "many"}`, string>
  >;
