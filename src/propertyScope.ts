import { properties } from "./data";
import type { Property, Role } from "./types";

export const workspaceLandlordName = "Olivia Martín";

/** Explicit listing ownership for the local property-owner workspace. */
export function ownedProperties(role: Role): Property[] {
  return role === "landlord"
    ? properties.filter(
        (property) => property.landlord === workspaceLandlordName,
      )
    : [];
}

export function ownsProperty(role: Role, id: number): boolean {
  return ownedProperties(role).some((property) => property.id === id);
}

/** Shared-identity self-contact check; this does not grant property-record access. */
export function isWorkspaceListingOwner(role: Role, id: number): boolean {
  return (
    (role === "landlord" || role === "spaceOperator") &&
    ownsProperty("landlord", id)
  );
}
