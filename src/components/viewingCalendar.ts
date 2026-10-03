import { properties } from "../data";
import type { Role } from "../types";
import {
  scopedViewingRequests,
  validateViewingRequest,
  type PropertyRequestState,
} from "./propertyRequestState";

export interface ViewingCalendarLabels {
  summary: (propertyTitle: string) => string;
  description: string;
}

const encoder = new TextEncoder();

/** RFC 5545 TEXT escaping keeps supplied labels inside their property value. */
function calendarText(value: string): string {
  return Array.from(value.replace(/\r\n|\r/g, "\n"), (character) => {
    if (character === "\n") return "\\n";
    if (["\\", ";", ","].includes(character)) return `\\${character}`;
    const point = character.codePointAt(0)!;
    if ((point < 32 && point !== 9) || point === 127) return "";
    return point >= 0xd800 && point <= 0xdfff ? "\uFFFD" : character;
  }).join("");
}

/** Count UTF-8 octets, including the continuation space, without splitting a character. */
function foldContentLine(value: string): string {
  const lines: string[] = [];
  let line = "";
  let octets = 0;
  for (const character of value) {
    const size = encoder.encode(character).length;
    if (octets + size > 75) {
      lines.push(line);
      line = " ";
      octets = 1;
    }
    line += character;
    octets += size;
  }
  lines.push(line);
  return lines.join("\r\n");
}

/** A local snapshot of one current agreement; this does not update a calendar or request. */
export function viewingCalendarFile(
  state: PropertyRequestState,
  role: Role,
  requestId: string,
  labels: ViewingCalendarLabels,
  now = new Date(),
): { fileName: string; content: string } | null {
  if (
    !["tenant", "landlord"].includes(role) ||
    typeof requestId !== "string" ||
    !requestId.trim() ||
    Array.from(requestId).some((character) => {
      const point = character.codePointAt(0)!;
      return point >= 0xd800 && point <= 0xdfff;
    }) ||
    !(now instanceof Date) ||
    !Number.isFinite(now.getTime()) ||
    now.getUTCFullYear() < 1 ||
    now.getUTCFullYear() > 9999
  )
    return null;
  const matches = state.viewings.filter((request) => request.id === requestId);
  if (matches.length !== 1) return null;
  const [request] = matches;
  if (
    !scopedViewingRequests({ ...state, viewings: matches }, role).length ||
    !["Agreed", "Proposed"].includes(request.status) ||
    !request.agreedTerms ||
    typeof request.agreedTerms.date !== "string" ||
    typeof request.agreedTerms.time !== "string" ||
    typeof request.createdAt !== "string"
  )
    return null;
  const created = new Date(request.createdAt);
  if (
    !Number.isFinite(created.getTime()) ||
    created.toISOString() !== request.createdAt ||
    Object.keys(
      validateViewingRequest({ ...request.agreedTerms, note: "" }, now),
    ).length
  )
    return null;
  const property = properties.find((item) => item.id === request.propertyId);
  if (!property) return null;

  // Encoding the whole tuple avoids hash collisions and keeps the UID stable after rescheduling.
  const uid = encodeURIComponent(
    JSON.stringify([request.id, property.id, request.createdAt]),
  );
  const start = `${request.agreedTerms.date.replaceAll("-", "")}T${request.agreedTerms.time.replace(":", "")}00`;
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kasa//Local viewing snapshot//EN",
    "BEGIN:VEVENT",
    `UID:kasa-viewing-${uid}@kasa.invalid`,
    `DTSTAMP:${stamp}`,
    // The domain stores a local wall-clock time, with no timezone or agreed end.
    `DTSTART:${start}`,
    `SUMMARY:${calendarText(labels.summary(property.title))}`,
    `LOCATION:${calendarText(property.address)}`,
    `DESCRIPTION:${calendarText(labels.description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return {
    fileName: `kasa-viewing-${encodeURIComponent(request.id)}.ics`,
    content: `${lines.map(foldContentLine).join("\r\n")}\r\n`,
  };
}
