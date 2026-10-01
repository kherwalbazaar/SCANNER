"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

import { firestore } from "./firebase";

export type TicketEntry = {
  id: string;
  ticketNumber: string;
  baseTicketNumber?: string;
  seat?: string;
  eventId: string;
  eventName: string;
  ticketTypeName: string;
  quantity: number;
  amount: number;
  status: string;
  scannerId: string;
  gate: string;
  block: string;
  scannedAt: string;
  date: string;
  time: string;
};

export type VerifiedTicket = {
  bookingId: string;
  ticketNumber: string;
  baseTicketNumber?: string;
  seat?: string;
  seatIndex?: number;
  totalSeats?: number;
  eventId: string;
  eventName: string;
  ticketTypeName: string;
  quantity: number;
  amount: number;
  block: string;
  customerName?: string;
};

export type VerifyFailure = "not-found" | "cancelled" | "already-used";

export type VerifyResult =
  | { ok: true; ticket: VerifiedTicket }
  | { ok: false; reason: VerifyFailure };

const CANCELLED_STATUSES = ["cancelled", "canceled", "refunded", "failed"];

const str = (data: Record<string, unknown>, key: string): string =>
  String(data?.[key] ?? "").trim();

const num = (data: Record<string, unknown>, key: string): number => {
  const value = Number(data?.[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
};

function clockTime(date: Date): string {
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function dayKey(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function toEntry(id: string, data: Record<string, unknown>): TicketEntry {
  const scannedAt = str(data, "scannedAt") || str(data, "createdAt");
  const parsed = scannedAt ? new Date(scannedAt) : new Date();
  const valid = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  return {
    id,
    ticketNumber: str(data, "ticketNumber"),
    baseTicketNumber: str(data, "baseTicketNumber") || undefined,
    seat: str(data, "seat") || undefined,
    eventId: str(data, "eventId"),
    eventName: str(data, "eventName"),
    ticketTypeName: str(data, "ticketTypeName") || "General",
    quantity: num(data, "quantity") || num(data, "seatCount") || 1,
    amount: num(data, "amount"),
    status: str(data, "status"),
    scannerId: str(data, "scannerId"),
    gate: str(data, "gate"),
    block: str(data, "block"),
    scannedAt: scannedAt || valid.toISOString(),
    date: str(data, "date") || dayKey(valid),
    time: str(data, "time") || clockTime(valid),
  };
}

async function findByTicketNumber(
  collectionName: string,
  ticketNumber: string,
) {
  const snapshot = await getDocs(
    query(
      collection(firestore, collectionName),
      where("ticketNumber", "==", ticketNumber),
    ),
  );
  return snapshot;
}

export type DecodedTicketPayload = {
  ticketNumber: string;
  bookingId: string;
  seat?: string;
  seatIndex?: number;
  seatCount?: number;
};

export function extractTicketPayload(raw: string): DecodedTicketPayload {
  const trimmed = String(raw || "").trim();
  if (!trimmed) {
    return { ticketNumber: "", bookingId: "" };
  }

  let jsonStr = trimmed;
  if (jsonStr.includes("{") || jsonStr.toLowerCase().includes("%7b")) {
    if (!jsonStr.trimStart().startsWith("{")) {
      try {
        jsonStr = decodeURIComponent(jsonStr);
      } catch {
        /* keep original */
      }
    }

    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed === "object") {
        const record = parsed as Record<string, unknown>;
        const findKey = (candidates: string[]) => {
          const k = Object.keys(record).find((name) =>
            candidates.includes(name.toLowerCase()),
          );
          return k ? String(record[k] ?? "").trim() : "";
        };

        const id = findKey(["id", "ticketnumber", "ticketno", "code", "serial"]);
        const bookingId = findKey([
          "bookingid",
          "basebookingid",
          "baseticketnumber",
        ]);
        const seat = findKey(["seat", "seatnumber", "seatname"]);
        const seatIndexVal = record["seatIndex"] ?? record["seatindex"];
        const seatCountVal =
          record["seatCount"] ?? record["seatcount"] ?? record["quantity"];

        const resolvedTicketNumber = (id || bookingId || "").toUpperCase();
        const resolvedBookingId = (bookingId || id || "").toUpperCase();
        const seatIndex = Number.isFinite(Number(seatIndexVal))
          ? Number(seatIndexVal)
          : undefined;
        const seatCount = Number.isFinite(Number(seatCountVal))
          ? Number(seatCountVal)
          : undefined;

        return {
          ticketNumber: resolvedTicketNumber,
          bookingId: resolvedBookingId,
          seat: seat || undefined,
          seatIndex,
          seatCount,
        };
      }
    } catch {
      /* not JSON — treat as plain code */
    }
  }

  const upper = trimmed.toUpperCase();
  return {
    ticketNumber: upper,
    bookingId: upper,
  };
}

export function extractTicketCode(raw: string): string {
  return extractTicketPayload(raw).ticketNumber;
}

/**
 * Booking ids are `NJ26-00001`, but QRs may append segments
 * (`-4` seat serial, `-RAMESH-TUDU` holder name). Try the code as-is first,
 * then progressively drop trailing segments so a per-seat QR still resolves
 * to its booking.
 */
function lookupCandidates(code: string): string[] {
  const candidates: string[] = [code];
  let candidate = code;

  for (let i = 0; i < 3; i++) {
    const cut = candidate.lastIndexOf("-");
    if (cut <= 0) break;
    candidate = candidate.slice(0, cut);
    if (!candidates.includes(candidate)) candidates.push(candidate);
  }

  return candidates;
}

export async function verifyTicketNumber(raw: string): Promise<VerifyResult> {
  const payload = extractTicketPayload(raw);
  const code = payload.ticketNumber;
  if (!code) return { ok: false, reason: "not-found" };

  try {
    let bookingDoc:
      | Awaited<ReturnType<typeof findByTicketNumber>>["docs"][number]
      | null = null;

    const candidates = Array.from(
      new Set([
        ...(payload.bookingId ? [payload.bookingId] : []),
        ...lookupCandidates(code),
      ]),
    );

    for (const candidate of candidates) {
      const snapshot = await findByTicketNumber("bookings", candidate);
      if (!snapshot.empty) {
        bookingDoc = snapshot.docs[0];
        break;
      }
      try {
        const directSnap = await getDoc(doc(firestore, "bookings", candidate));
        if (directSnap.exists()) {
          bookingDoc = directSnap as unknown as typeof bookingDoc;
          break;
        }
      } catch {
        /* ignore invalid doc ID */
      }
    }

    if (!bookingDoc) return { ok: false, reason: "not-found" };

    const data = bookingDoc.data() as Record<string, unknown>;
    const status = str(data, "status").toLowerCase();
    if (CANCELLED_STATUSES.includes(status)) {
      return { ok: false, reason: "cancelled" };
    }

    const baseTicketNumber =
      str(data, "ticketNumber") || payload.bookingId || code;
    const seatsArray = Array.isArray(data.seats) ? (data.seats as string[]) : [];
    const totalSeats =
      seatsArray.length ||
      num(data, "quantity") ||
      num(data, "seatCount") ||
      payload.seatCount ||
      1;

    // Determine seat index and specific ticket code
    let seatIndex: number | undefined = payload.seatIndex;
    let specificTicketNumber = code;

    const seatMatch = code.match(/-([0-9]+)$/);
    if (
      seatMatch &&
      Number(seatMatch[1]) > 0 &&
      Number(seatMatch[1]) <= totalSeats
    ) {
      if (!seatIndex) seatIndex = Number(seatMatch[1]);
    } else if (totalSeats > 1 && !code.includes("-", baseTicketNumber.length)) {
      // If scanned code was just the parent booking e.g. "NJ26-00001", resolve to first unused seat
      const usedTickets = (
        Array.isArray(data.usedTickets) ? data.usedTickets : []
      ).map((s) => String(s).trim().toUpperCase());
      const usedSeats = (
        Array.isArray(data.usedSeats) ? data.usedSeats : []
      ).map((s) => String(s).trim().toUpperCase());

      let foundUnusedIndex = -1;
      for (let i = 0; i < totalSeats; i++) {
        const candTicket = `${baseTicketNumber}-${i + 1}`.toUpperCase();
        const candSeat = (seatsArray[i] || "").toUpperCase();
        if (
          !usedTickets.includes(candTicket) &&
          (!candSeat || !usedSeats.includes(candSeat))
        ) {
          foundUnusedIndex = i + 1;
          break;
        }
      }
      if (foundUnusedIndex > 0) {
        seatIndex = foundUnusedIndex;
        specificTicketNumber = `${baseTicketNumber}-${seatIndex}`;
      } else {
        return { ok: false, reason: "already-used" };
      }
    }

    let seatLabel = payload.seat || "";
    if (!seatLabel && seatIndex && seatsArray[seatIndex - 1]) {
      seatLabel = String(seatsArray[seatIndex - 1]);
    } else if (!seatLabel && str(data, "seatNumber")) {
      seatLabel = str(data, "seatNumber");
    }

    // Check whether this specific ticket or seat is already used
    const usedTickets = (
      Array.isArray(data.usedTickets) ? data.usedTickets : []
    ).map((s) => String(s).trim().toUpperCase());
    const usedSeats = (
      Array.isArray(data.usedSeats) ? data.usedSeats : []
    ).map((s) => String(s).trim().toUpperCase());
    const usedCount = num(data, "usedCount");

    if (usedTickets.includes(specificTicketNumber.toUpperCase())) {
      return { ok: false, reason: "already-used" };
    }

    if (seatLabel && usedSeats.includes(seatLabel.toUpperCase())) {
      return { ok: false, reason: "already-used" };
    }

    // Check ticketEntries collection for this specific ticket
    const specificEntries = await findByTicketNumber(
      "ticketEntries",
      specificTicketNumber,
    );
    const hasActiveEntry = specificEntries.docs.some((d) => {
      const eData = d.data();
      const eStatus = str(eData, "status").toLowerCase();
      const eResult = str(eData, "scanResult").toLowerCase();
      return (
        !["cancelled", "rejected", "failed"].includes(eStatus) &&
        eResult !== "rejected"
      );
    });
    if (hasActiveEntry) {
      return { ok: false, reason: "already-used" };
    }

    if (totalSeats <= 1) {
      const baseEntries = await findByTicketNumber(
        "ticketEntries",
        baseTicketNumber,
      );
      const hasBaseEntry = baseEntries.docs.some((d) => {
        const eData = d.data();
        const eStatus = str(eData, "status").toLowerCase();
        const eResult = str(eData, "scanResult").toLowerCase();
        return (
          !["cancelled", "rejected", "failed"].includes(eStatus) &&
          eResult !== "rejected"
        );
      });
      if (hasBaseEntry || status === "used" || usedCount >= 1) {
        return { ok: false, reason: "already-used" };
      }
    } else {
      const isAllUsed =
        (usedTickets.length >= totalSeats && totalSeats > 0) ||
        (usedSeats.length >= totalSeats && totalSeats > 0) ||
        (usedCount >= totalSeats && totalSeats > 0);
      if (isAllUsed) {
        return { ok: false, reason: "already-used" };
      }
    }

    const totalAmount = num(data, "amount");
    const unitPrice =
      num(data, "unitPrice") ||
      (totalSeats > 0 ? Math.round(totalAmount / totalSeats) : totalAmount);

    return {
      ok: true,
      ticket: {
        bookingId: bookingDoc.id,
        ticketNumber: specificTicketNumber,
        baseTicketNumber,
        seat: seatLabel || undefined,
        seatIndex,
        totalSeats,
        eventId: str(data, "eventId"),
        eventName: str(data, "eventName"),
        ticketTypeName: str(data, "ticketTypeName") || "General",
        quantity: 1, // each scanned seat is 1 entry
        amount: unitPrice,
        block: str(data, "block"),
        customerName: str(data, "customerName") || str(data, "name"),
      },
    };
  } catch (error) {
    console.error("verifyTicketNumber error:", error);
    return { ok: false, reason: "not-found" };
  }
}

export async function recordEntry(
  ticket: VerifiedTicket,
  scannerId: string,
  gate: string,
): Promise<void> {
  const now = new Date();

  await addDoc(collection(firestore, "ticketEntries"), {
    ticketNumber: ticket.ticketNumber,
    baseTicketNumber: ticket.baseTicketNumber || ticket.ticketNumber,
    seat: ticket.seat || "",
    seatIndex: ticket.seatIndex ?? null,
    eventId: ticket.eventId,
    eventName: ticket.eventName,
    ticketTypeName: ticket.ticketTypeName,
    quantity: 1,
    amount: ticket.amount,
    block: ticket.block,
    bookingId: ticket.bookingId,
    scannerId,
    gate,
    status: "entered",
    source: "scanner",
    scannedAt: now.toISOString(),
    date: dayKey(now),
    time: clockTime(now),
  });

  if (ticket.bookingId) {
    try {
      const bookingRef = doc(firestore, "bookings", ticket.bookingId);
      const bookingSnap = await getDoc(bookingRef);
      if (bookingSnap.exists()) {
        const bData = bookingSnap.data() as Record<string, unknown>;
        const existingUsedTickets = (
          Array.isArray(bData.usedTickets) ? bData.usedTickets : []
        ).map((s) => String(s).trim());
        const existingUsedSeats = (
          Array.isArray(bData.usedSeats) ? bData.usedSeats : []
        ).map((s) => String(s).trim());

        const nextUsedTickets = Array.from(
          new Set([...existingUsedTickets, ticket.ticketNumber]),
        );
        const nextUsedSeats = ticket.seat
          ? Array.from(new Set([...existingUsedSeats, ticket.seat]))
          : existingUsedSeats;

        const seatsArray = Array.isArray(bData.seats) ? bData.seats : [];
        const totalSeats =
          seatsArray.length ||
          num(bData, "quantity") ||
          num(bData, "seatCount") ||
          ticket.totalSeats ||
          1;

        const isFullyUsed = nextUsedTickets.length >= totalSeats;

        const updatePayload: Record<string, unknown> = {
          usedTickets: nextUsedTickets,
          usedSeats: nextUsedSeats,
          usedCount: nextUsedTickets.length,
          lastScannedAt: now.toISOString(),
        };

        if (isFullyUsed) {
          updatePayload.status = "Used";
          updatePayload.usedAt = now.toISOString();
        } else {
          // If not all tickets are checked in, booking remains active (Confirmed)
          updatePayload.status = "Confirmed";
        }

        await updateDoc(bookingRef, updatePayload);
      }
    } catch (error) {
      console.error("booking status update skipped:", error);
    }
  }
}

export function subscribeTicketEntries(
  callback: (entries: TicketEntry[]) => void,
): () => void {
  try {
    return onSnapshot(
      collection(firestore, "ticketEntries"),
      (snapshot) => {
        const entries = snapshot.docs.map((item) =>
          toEntry(item.id, item.data() as Record<string, unknown>),
        );
        entries.sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));
        callback(entries);
      },
      (error) => {
        console.error("subscribeTicketEntries error:", error);
        callback([]);
      },
    );
  } catch (error) {
    console.error("subscribeTicketEntries setup failed:", error);
    callback([]);
    return () => {};
  }
}

export function useTicketEntries(): {
  entries: TicketEntry[];
  loading: boolean;
} {
  const [entries, setEntries] = useState<TicketEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeTicketEntries((next) => {
      if (!active) return;
      setEntries(next);
      setLoading(false);
    });

    return () => {
      active = false;
      try {
        unsubscribe();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return { entries, loading };
}
