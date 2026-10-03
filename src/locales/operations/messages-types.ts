import type { messagesEn } from "./messages-en";

export type MessagesDictionary = Record<keyof typeof messagesEn, string> &
  Partial<
    Record<`messages_unreadCount_${"zero" | "two" | "few" | "many"}`, string>
  >;
