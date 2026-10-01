"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
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
  eventId: string;
  eventName: string;
  ticketTypeName: string;
  quantity: number;
  amount: number;
  block: string;
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

/**
 * The customer app (JATRA BAZAAR) and the admin app (JATRA BAZAAR ADMIN)
 * emit QR payloads in a few historical shapes:
 *   - {"id":"NJ26-00001","seat":"A-4","event":"..."}   (current)
 *   - {"ID":"NJ26-00001","SEAT":"A-4","EVENT":"..."}   (same, upper keys)
 *   - NJ26-00001-4                                     (per-seat serial)
 *   - NJ26-00001-RAMESH-TUDU                           (legacy ticket + name)
 *   - NJ26-00001                                       (plain booking id)
 * This pulls the ticket id out of any of them.
 */
const QR_ID_KEYS = [
  "id",
  "ticketnumber",
  "ticketno",
  "code",
  "bookingid",
  "serial",
];

export function extractTicketCode(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  if (trimmed.includes("{") || trimmed.toLowerCase().includes("%7b")) {
    let payload = trimmed;
    if (!payload.trimStart().startsWith("{")) {
      try {
        payload = decodeURIComponent(payload);
      } catch {
        /* keep the original string */
      }
    }

    try {
      const parsed: unknown = JSON.parse(payload);
      const record =
        parsed && typeof parsed === "object"
          ? (parsed as Record<string, unknown>)
          : null;
      if (record) {
        const key = Object.keys(record).find((name) =>
          QR_ID_KEYS.includes(name.toLowerCase()),
        );
        const value = key ? String(record[key] ?? "").trim() : "";
        if (value) return value.toUpperCase();
      }
    } catch {
      /* not JSON — treat it as a plain code */
    }
  }

  return trimmed.toUpperCase();
}

/**
 * Booking ids are `NJ26-00001`, but QRs may append segments
 * (`-4` seat serial, `-RAMESH-TUDU` holder name). Try the code as-is first,
 * then progressively drop trailing segments so a per-seat QR still resolves
 * to its booking — mirroring JATRA BAZAAR ADMIN's `findBookingByTicketNumber`.
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
  const code = extractTicketCode(raw);
  if (!code) return { ok: false, reason: "not-found" };

  try {
    let bookingDoc: Awaited<ReturnType<typeof findByTicketNumber>>["docs"][number] | null =
      null;

    for (const candidate of lookupCandidates(code)) {
      const snapshot = await findByTicketNumber("bookings", candidate);
      if (!snapshot.empty) {
        bookingDoc = snapshot.docs[0];
        break;
      }
    }

    if (!bookingDoc) return { ok: false, reason: "not-found" };

    const data = bookingDoc.data() as Record<string, unknown>;
    const status = str(data, "status").toLowerCase();
    if (CANCELLED_STATUSES.includes(status)) {
      return { ok: false, reason: "cancelled" };
    }

    const ticketNumber = str(data, "ticketNumber") || code;
    const entries = await findByTicketNumber("ticketEntries", ticketNumber);
    if (!entries.empty) return { ok: false, reason: "already-used" };

    return {
      ok: true,
      ticket: {
        bookingId: bookingDoc.id,
        ticketNumber,
        eventId: str(data, "eventId"),
        eventName: str(data, "eventName"),
        ticketTypeName: str(data, "ticketTypeName") || "General",
        quantity: num(data, "quantity") || num(data, "seatCount") || 1,
        amount: num(data, "amount"),
        block: str(data, "block"),
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
    eventId: ticket.eventId,
    eventName: ticket.eventName,
    ticketTypeName: ticket.ticketTypeName,
    quantity: ticket.quantity,
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
      await updateDoc(doc(firestore, "bookings", ticket.bookingId), {
        status: "Used",
        usedAt: now.toISOString(),
      });
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
