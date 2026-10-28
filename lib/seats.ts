"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "./supabase";

type Doc = Record<string, unknown> & { id: string };

export type SeatChip = {
  label: string;
  number: string;
  entered: boolean;
  ticketType: string;
};

export type SeatRow = {
  row: string;
  seats: SeatChip[];
};

export type SeatBlock = {
  block: string;
  total: number;
  entered: number;
  rows: SeatRow[];
};

const CANCELLED_STATUSES = [
  "cancelled",
  "canceled",
  "refunded",
  "revoked",
  "failed",
  "rejected",
  "expired",
];

const ENTERED_STATUSES = [
  "entered",
  "used",
  "scanned",
  "checked-in",
  "checkedin",
];

const str = (data: Record<string, unknown>, key: string): string =>
  String(data?.[key] ?? "").trim();

const listOf = (data: Record<string, unknown>, key: string): unknown[] => {
  const value = data?.[key];
  return Array.isArray(value) ? value : [];
};

const collator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

function eventIdOf(doc: Doc): string {
  return (
    str(doc, "eventId") ||
    str(doc, "event_id") ||
    str(doc, "showId") ||
    str(doc, "show_id")
  );
}

function isCancelled(status: string): boolean {
  return CANCELLED_STATUSES.includes(status.toLowerCase());
}

function isEntered(status: string): boolean {
  return ENTERED_STATUSES.includes(status.toLowerCase());
}

/** Splits `B1-A-1` / `B1-1` / `A1` into block, row and seat number. */
function parseSeat(
  label: string,
  fallbackBlock: string,
): { block: string; row: string; number: string } {
  const clean = String(label || "").trim();
  const parts = clean.split("-").map((part) => part.trim()).filter(Boolean);
  const block = fallbackBlock || "General";

  if (parts.length >= 3) {
    return { block: parts[0] || block, row: parts[1], number: parts.slice(2).join("-") };
  }

  if (parts.length === 2) {
    return { block: parts[0] || block, row: "", number: parts[1] };
  }

  const match = clean.match(/^([A-Za-z]+)[\s]*(\d+)$/);
  if (match) {
    return { block, row: match[1].toUpperCase(), number: match[2] };
  }

  return { block, row: "", number: clean };
}

function compareSeatNumbers(a: string, b: string): number {
  const numA = Number(a);
  const numB = Number(b);
  if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) {
    return numA - numB;
  }
  return collator.compare(a, b);
}

function buildBlocks(
  bookings: Doc[],
  tickets: Doc[],
  eventId: string,
): SeatBlock[] {
  const seats = new Map<string, SeatChip & { block: string; row: string }>();
  const enteredLabels = new Set<string>();

  const addSeat = (
    rawLabel: string,
    blockFallback: string,
    ticketType: string,
    entered: boolean,
  ) => {
    const label = String(rawLabel || "").trim();
    if (!label) return;
    const key = label.toUpperCase();
    const parsed = parseSeat(label, blockFallback);
    const existing = seats.get(key);

    if (existing) {
      if (entered) existing.entered = true;
      if (!existing.ticketType && ticketType) existing.ticketType = ticketType;
      return;
    }

    seats.set(key, {
      label,
      number: parsed.number,
      entered,
      ticketType,
      block: parsed.block,
      row: parsed.row,
    });
  };

  for (const booking of bookings) {
    if (eventIdOf(booking) !== eventId) continue;
    if (isCancelled(str(booking, "status") || str(booking, "bookingStatus"))) {
      continue;
    }

    const block = str(booking, "block");
    const ticketType = str(booking, "ticketTypeName") || str(booking, "ticketType");

    for (const label of listOf(booking, "usedSeats")) {
      enteredLabels.add(String(label).trim().toUpperCase());
    }

    for (const label of listOf(booking, "seats")) {
      addSeat(String(label), block, ticketType, false);
    }
  }

  for (const ticket of tickets) {
    if (eventIdOf(ticket) !== eventId) continue;
    const status = str(ticket, "status");
    if (isCancelled(status)) continue;

    const label =
      str(ticket, "seat") || str(ticket, "seatLabel") || str(ticket, "seatNumber");
    addSeat(
      label,
      str(ticket, "block"),
      str(ticket, "ticketTypeName") || str(ticket, "ticketType"),
      isEntered(status),
    );
  }

  for (const seat of seats.values()) {
    if (enteredLabels.has(seat.label.toUpperCase())) seat.entered = true;
  }

  const blocks = new Map<string, Map<string, SeatChip[]>>();

  for (const seat of seats.values()) {
    let rows = blocks.get(seat.block);
    if (!rows) {
      rows = new Map();
      blocks.set(seat.block, rows);
    }
    const rowKey = seat.row || "";
    const rowSeats = rows.get(rowKey) ?? [];
    rowSeats.push({
      label: seat.label,
      number: seat.number,
      entered: seat.entered,
      ticketType: seat.ticketType,
    });
    rows.set(rowKey, rowSeats);
  }

  return [...blocks.entries()]
    .sort(([a], [b]) => collator.compare(a, b))
    .map(([block, rows]) => {
      const seatRows: SeatRow[] = [...rows.entries()]
        .sort(([a], [b]) => collator.compare(a, b))
        .map(([row, rowSeats]) => ({
          row,
          seats: rowSeats.sort((a, b) => compareSeatNumbers(a.number, b.number)),
        }));

      const allSeats = seatRows.flatMap((row) => row.seats);

      return {
        block,
        total: allSeats.length,
        entered: allSeats.filter((seat) => seat.entered).length,
        rows: seatRows,
      };
    });
}

function bookingRow(row: Record<string, unknown>): Doc {
  return {
    id: String(row.id ?? ""),
    eventId: String(row.event_id ?? row.eventId ?? ""),
    status: String(row.status ?? ""),
    bookingStatus: String(row.booking_status ?? row.bookingStatus ?? ""),
    block: String(row.block ?? ""),
    ticketTypeName: String(row.ticket_type_name ?? row.ticketTypeName ?? ""),
    seats: Array.isArray(row.seats) ? row.seats : [],
    usedSeats: Array.isArray(row.used_seats)
      ? row.used_seats
      : Array.isArray(row.usedSeats)
        ? row.usedSeats
        : [],
  };
}

function ticketRow(row: Record<string, unknown>): Doc {
  return {
    id: String(row.id ?? ""),
    eventId: String(row.event_id ?? row.eventId ?? ""),
    status: String(row.status ?? ""),
    seat: String(row.seat ?? row.seat_label ?? ""),
    block: String(row.block ?? ""),
    ticketTypeName: String(row.ticket_type_name ?? row.ticketTypeName ?? ""),
  };
}

export function useBookedSeats(eventId: string | null): {
  blocks: SeatBlock[];
  total: number;
  entered: number;
  loading: boolean;
} {
  const [bookings, setBookings] = useState<Doc[]>([]);
  const [tickets, setTickets] = useState<Doc[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!eventId) {
      setBookings([]);
      setTickets([]);
      setLoaded(true);
      return;
    }

    let active = true;
    setLoaded(false);

    const load = async () => {
      try {
        const [bookingResult, ticketResult] = await Promise.all([
          supabase.from("bookings").select("*").eq("event_id", eventId),
          supabase.from("tickets").select("*").eq("event_id", eventId),
        ]);

        if (!active) return;

        if (bookingResult.error) {
          console.warn("Supabase seats booking fetch warning:", bookingResult.error.message);
        }
        if (ticketResult.error) {
          console.warn("Supabase seats ticket fetch warning:", ticketResult.error.message);
        }

        setBookings(
          (bookingResult.data ?? []).map((row) =>
            bookingRow(row as Record<string, unknown>),
          ),
        );
        setTickets(
          (ticketResult.data ?? []).map((row) =>
            ticketRow(row as Record<string, unknown>),
          ),
        );
      } catch (err: unknown) {
        console.warn("Supabase seats fetch failed:", err);
      } finally {
        if (active) setLoaded(true);
      }
    };

    void load();
    const timer = setInterval(load, 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [eventId]);

  const blocks = useMemo(
    () => (eventId ? buildBlocks(bookings, tickets, eventId) : []),
    [bookings, tickets, eventId],
  );

  const total = useMemo(
    () => blocks.reduce((sum, block) => sum + block.total, 0),
    [blocks],
  );

  const entered = useMemo(
    () => blocks.reduce((sum, block) => sum + block.entered, 0),
    [blocks],
  );

  return {
    blocks,
    total,
    entered,
    loading: eventId ? !loaded : false,
  };
}
