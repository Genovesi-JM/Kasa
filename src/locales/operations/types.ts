import type { en } from "./en";

type PluralKey = Extract<keyof typeof en, `${string}_one`>;
type PluralBase = PluralKey extends `${infer Base}_one` ? Base : never;
type PluralSuffix = "zero" | "one" | "two" | "few" | "many" | "other";

export type OperationsKey =
  Exclude<keyof typeof en, `${PluralBase}_${PluralSuffix}`> | PluralBase;
export type OperationsDictionary = Record<keyof typeof en, string> &
  Partial<Record<`${PluralBase}_${PluralSuffix}`, string>>;
export type OperationsValues = Record<string, string | number>;
export interface OperationsMessage {
  key: OperationsKey;
  values?: OperationsValues;
}
