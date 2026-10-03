import type { expenseEn } from "./expense-en";

export type ExpenseDictionary = Record<keyof typeof expenseEn, string>;
