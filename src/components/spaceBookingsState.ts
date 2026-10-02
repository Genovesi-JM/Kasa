import { spaceBookings } from "../data";
import type { SpaceBooking } from "../types";

export type SpaceBookingFilter = "All" | SpaceBooking["status"];
export interface SpaceBookingProposal {
  originalTime: string;
  proposedTime: string;
  status: "pending" | "accepted" | "declined";
}
export interface ManagedSpaceBooking extends SpaceBooking {
  proposal?: SpaceBookingProposal;
  cancellationReason?: string;
}
export interface SpaceBookingsState {
  bookings: ManagedSpaceBooking[];
  filter: SpaceBookingFilter;
  selectedId: string | null;
}

export function createInitialSpaceBookingsState(): SpaceBookingsState {
  return {
    filter: "Upcoming",
    selectedId:
      spaceBookings.find((booking) => booking.status === "Upcoming")?.id ??
      null,
    bookings: spaceBookings.map((booking) => ({
      ...booking,
      ...(booking.id === "KS-9H31C" && booking.status === "Requested"
        ? {
            proposal: {
              originalTime: booking.time,
              proposedTime: "18:30–23:30",
              status: "pending" as const,
            },
          }
        : {}),
    })),
  };
}

export function visibleSpaceBookings(state: SpaceBookingsState) {
  return state.bookings.filter(
    (booking) => state.filter === "All" || booking.status === state.filter,
  );
}

export function selectedSpaceBooking(state: SpaceBookingsState) {
  const visible = visibleSpaceBookings(state);
  return (
    visible.find((booking) => booking.id === state.selectedId) ?? visible[0]
  );
}

export function filterSpaceBookings(
  state: SpaceBookingsState,
  filter: SpaceBookingFilter,
): SpaceBookingsState {
  const next = { ...state, filter };
  return { ...next, selectedId: selectedSpaceBooking(next)?.id ?? null };
}

export function selectSpaceBooking(
  state: SpaceBookingsState,
  id: string,
): SpaceBookingsState {
  return visibleSpaceBookings(state).some((booking) => booking.id === id)
    ? { ...state, selectedId: id }
    : state;
}

export function acceptSpaceBookingProposal(
  state: SpaceBookingsState,
  id: string,
): SpaceBookingsState {
  const booking = state.bookings.find((item) => item.id === id);
  if (booking?.status !== "Requested" || booking.proposal?.status !== "pending")
    return state;
  return {
    ...state,
    filter: state.filter === "All" ? "All" : "Upcoming",
    selectedId: id,
    bookings: state.bookings.map((item) =>
      item.id === id
        ? {
            ...item,
            status: "Upcoming",
            time: booking.proposal!.proposedTime,
            proposal: { ...booking.proposal!, status: "accepted" },
          }
        : item,
    ),
  };
}

export function keepOriginalSpaceBookingRequest(
  state: SpaceBookingsState,
  id: string,
): SpaceBookingsState {
  return {
    ...state,
    bookings: state.bookings.map((booking) =>
      booking.id === id &&
      booking.status === "Requested" &&
      booking.proposal?.status === "pending"
        ? {
            ...booking,
            time: booking.proposal.originalTime,
            proposal: { ...booking.proposal, status: "declined" },
          }
        : booking,
    ),
  };
}

export function cancelSpaceBooking(
  state: SpaceBookingsState,
  id: string,
  reason: string,
): SpaceBookingsState {
  const booking = state.bookings.find((item) => item.id === id);
  if (!booking || !["Upcoming", "Requested"].includes(booking.status))
    return state;
  return {
    ...state,
    filter: state.filter === "All" ? "All" : "Cancelled",
    selectedId: id,
    bookings: state.bookings.map((item) =>
      item.id === id
        ? {
            ...item,
            status: "Cancelled",
            cancellationReason: reason.trim().slice(0, 500),
          }
        : item,
    ),
  };
}
