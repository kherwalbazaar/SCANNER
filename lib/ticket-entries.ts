"use client";

import { useEffect, useState } from "react";

import {
  insertSupabaseTicketEntry,
  supabase,
  updateSupabaseBookingStatus,
  updateSupabaseScannerMemberScans,
} from "./supabase";

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
  entryStatus?: string;
  scanResult?: string;
  audienceName?: string;
  scannerId: string;
  gate: string;
  block: string;
  scannedAt: string;
  date: string;
  time: string;
};

export type VerifiedTicket = {
  bookingId: string;
  bookingNumber?: string;
  bookingDocId?: string;
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
  customerPhone?: string;
  qrToken?: string;
};

export type VerifyFailure = "not-found" | "cancelled" | "already-used";

export type VerifyResult =
  | { ok: true; ticket: VerifiedTicket }
  | { ok: false; reason: VerifyFailure };

const CANCELLED_STATUSES = ["cancelled", "canceled", "refunded", "failed", "unpaid"];
const ENTERED_STATUSES = ["entered", "used", "scanned", "checked-in", "checkedin"];
const TICKET_CANCELLED = ["CANCELLED", "CANCELED", "REFUNDED", "REVOKED"];

const str = (data: Record<string, unknown>, key: string): string =>
  String(data?.[key] ?? "").trim();

const num = (data: Record<string, unknown>, key: string): number => {
  const value = Number(data?.[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
};

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => String(item).trim()) : [];

function clockTime(date: Date): string {
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function dayKey(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

type RawDoc = { id: string; data: Record<string, unknown> };

function toEntry(id: string, data: Record<string, unknown>): TicketEntry {
  const scannedAt =
    str(data, "scannedAt") || str(data, "scanned_at") || str(data, "createdAt");
  const parsed = scannedAt ? new Date(scannedAt) : new Date();
  const valid = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const entryStatus = str(data, "entryStatus") || str(data, "entry_status");

  return {
    id,
    ticketNumber:
      str(data, "ticketId") ||
      str(data, "ticket_id") ||
      str(data, "ticketNumber") ||
      str(data, "ticket_number"),
    baseTicketNumber:
      str(data, "baseTicketId") ||
      str(data, "baseTicketNumber") ||
      str(data, "bookingId") ||
      str(data, "booking_id") ||
      undefined,
    seat: str(data, "seat") || str(data, "seat_label") || str(data, "seatLabel") || undefined,
    eventId: str(data, "eventId") || str(data, "event_id"),
    eventName: str(data, "eventName") || str(data, "event_name"),
    ticketTypeName:
      str(data, "ticketType") ||
      str(data, "ticketTypeName") ||
      str(data, "ticket_type") ||
      str(data, "ticket_type_name") ||
      "General",
    quantity:
      num(data, "persons") || num(data, "quantity") || num(data, "seatCount") || 1,
    amount: num(data, "amount"),
    status: str(data, "status") || entryStatus || "entered",
    entryStatus: entryStatus || undefined,
    scanResult: str(data, "scanResult") || str(data, "scan_result") || undefined,
    audienceName:
      str(data, "audienceName") || str(data, "audience_name") || undefined,
    scannerId: str(data, "scannerId") || str(data, "scanner_id"),
    gate: str(data, "gateId") || str(data, "gate_id") || str(data, "gate"),
    block: str(data, "block") || str(data, "block_name") || "",
    scannedAt: scannedAt || valid.toISOString(),
    date: str(data, "date") || str(data, "scan_date") || dayKey(valid),
    time: str(data, "time") || str(data, "scan_time") || clockTime(valid),
  };
}

// ─── Lookup helpers ───────────────────────────────────────────────

type SupabaseRow = Record<string, unknown>;

async function findSupabaseTicket(
  code: string,
  token?: string,
): Promise<SupabaseRow | null> {
  const values = Array.from(new Set([code, token].filter(Boolean) as string[]));

  for (const value of values) {
    // Keep user-supplied codes out of the PostgREST filter grammar.
    if (!/^[A-Za-z0-9._-]+$/.test(value)) continue;

    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .or(
        `id.eq.${value},ticket_id.eq.${value},qr_token.eq.${value},serial_number.eq.${value}`,
      )
      .limit(1);

    if (error) {
      console.warn("Supabase ticket lookup warning:", error.message);
      continue;
    }
    if (data && data[0]) return data[0] as SupabaseRow;
  }

  return null;
}

async function findSupabaseBooking(
  candidates: string[],
): Promise<SupabaseRow | null> {
  for (const candidate of Array.from(new Set(candidates.filter(Boolean)))) {
    if (!/^[A-Za-z0-9._-]+$/.test(candidate)) continue;

    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .or(`id.eq.${candidate},ticket_number.eq.${candidate}`)
      .limit(1);

    if (error) {
      console.warn("Supabase booking lookup warning:", error.message);
      continue;
    }
    if (data && data[0]) return data[0] as SupabaseRow;
  }

  return null;
}

async function hasRecordedEntry(ticketId: string): Promise<boolean> {
  if (!/^[A-Za-z0-9._-]+$/.test(ticketId)) return false;

  const { data, error } = await supabase
    .from("ticket_entries")
    .select("id,scan_result,entry_status")
    .or(`ticket_id.eq.${ticketId},ticket_number.eq.${ticketId}`)
    .limit(5);

  if (error || !data) return false;

  return data.some((entry) => {
    const result = str(entry, "scan_result").toUpperCase();
    const entryStatus = str(entry, "entry_status").toLowerCase();
    if (entryStatus === "rejected") return false;
    return !result || result === "SUCCESS";
  });
}

/** Supabase rows use snake_case; the booking/ticket helpers below take camelCase. */
function supabaseTicketDoc(row: SupabaseRow): RawDoc {
  return {
    id: String(row.id ?? row.ticket_id ?? ""),
    data: {
      ticketId: row.ticket_id ?? row.id,
      bookingId: row.booking_id,
      eventId: row.event_id,
      eventName: row.event_name,
      ticketTypeName: row.ticket_type_name,
      seat: row.seat,
      ticketIndex: row.ticket_index,
      totalTickets: row.total_tickets,
      unitPrice: row.unit_price,
      block: row.block,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      qrToken: row.qr_token,
    },
  };
}

function supabaseBookingDoc(row: SupabaseRow): RawDoc {
  return {
    id: String(row.id ?? row.ticket_number ?? ""),
    data: {
      ticketNumber: row.ticket_number,
      bookingId: row.ticket_number,
      eventId: row.event_id,
      eventName: row.event_name,
      status: row.status,
      bookingStatus: row.booking_status,
      seats: row.seats,
      usedSeats: row.used_seats,
      usedTickets: row.used_tickets,
      quantity: row.quantity,
      seatCount: row.seat_count,
      amount: row.amount,
      unitPrice: row.unit_price,
      ticketTypeName: row.ticket_type_name,
      block: row.block,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      seatNumber: row.seat_number,
    },
  };
}

// ─── Ticket payload / verification ────────────────────────────────

export type DecodedTicketPayload = {
  ticketNumber: string;
  bookingId: string;
  qrToken?: string;
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

        const id = findKey([
          "id",
          "ticketnumber",
          "ticketno",
          "code",
          "serial",
          "ticketid",
        ]);
        const bookingId = findKey([
          "bookingid",
          "basebookingid",
          "baseticketnumber",
        ]);
        const qrToken = findKey(["token", "qrtoken", "qr_token", "qrcode"]);
        const seat = findKey(["seat", "seatnumber", "seatname", "seatlabel"]);
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
          qrToken: qrToken || undefined,
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

function ticketFromDoc(ticket: RawDoc, booking?: RawDoc | null): VerifiedTicket {
  const data = ticket.data;
  const ticketNumber = str(data, "ticketId") || ticket.id;
  const bookingNumber = str(data, "bookingId");
  const bookingData = booking?.data;
  const bookingTicketNumber = str(bookingData || {}, "ticketNumber");

  return {
    bookingId: booking?.id || bookingNumber || ticket.id,
    bookingNumber: bookingNumber || bookingTicketNumber || undefined,
    bookingDocId: booking?.id,
    ticketNumber,
    baseTicketNumber: bookingNumber || bookingTicketNumber || undefined,
    seat: str(data, "seat") || undefined,
    seatIndex: num(data, "ticketIndex") || undefined,
    totalSeats: num(data, "totalTickets") || num(bookingData || {}, "quantity") || 1,
    eventId: str(data, "eventId") || str(bookingData || {}, "eventId"),
    eventName: str(data, "eventName") || str(bookingData || {}, "eventName"),
    ticketTypeName:
      str(data, "ticketTypeName") ||
      str(bookingData || {}, "ticketTypeName") ||
      "General",
    quantity: 1,
    amount: num(data, "unitPrice") || num(bookingData || {}, "unitPrice"),
    block: str(data, "block") || str(bookingData || {}, "block"),
    customerName:
      str(data, "customerName") || str(bookingData || {}, "customerName"),
    customerPhone:
      str(data, "customerPhone") || str(bookingData || {}, "customerPhone"),
    qrToken: str(data, "qrToken") || undefined,
  };
}

function ticketFromBooking(
  booking: RawDoc,
  code: string,
  payload: DecodedTicketPayload,
  seatsArray: string[],
  totalSeats: number,
  baseTicketNumber: string,
): VerifyResult {
  const data = booking.data;
  let seatIndex: number | undefined = payload.seatIndex;
  let specificTicketNumber = code;

  // Only treat the code as a numbered ticket when it extends the booking
  // number (e.g. NJ26-00020-2) — "NJ26-00020" itself also ends in digits.
  const suffixRaw = code.startsWith(`${baseTicketNumber}-`)
    ? code.slice(baseTicketNumber.length + 1)
    : "";
  const suffix = /^\d+$/.test(suffixRaw) ? Number(suffixRaw) : 0;

  if (suffix > 0 && suffix <= totalSeats) {
    if (!seatIndex) seatIndex = suffix;
  } else if (totalSeats > 1) {
    const usedTickets = stringList(data.usedTickets).map((s) => s.toUpperCase());
    const usedSeats = stringList(data.usedSeats).map((s) => s.toUpperCase());

    let foundUnusedIndex = -1;
    for (let i = 0; i < totalSeats; i += 1) {
      const candidateTicket = `${baseTicketNumber}-${i + 1}`.toUpperCase();
      const candidateSeat = (seatsArray[i] || "").toUpperCase();
      if (
        !usedTickets.includes(candidateTicket) &&
        (!candidateSeat || !usedSeats.includes(candidateSeat))
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

  const usedTickets = stringList(data.usedTickets).map((s) => s.toUpperCase());
  const usedSeats = stringList(data.usedSeats).map((s) => s.toUpperCase());

  if (usedTickets.includes(specificTicketNumber.toUpperCase())) {
    return { ok: false, reason: "already-used" };
  }

  let seatLabel = payload.seat || "";
  if (!seatLabel && seatIndex && seatsArray[seatIndex - 1]) {
    seatLabel = String(seatsArray[seatIndex - 1]);
  } else if (!seatLabel && str(data, "seatNumber")) {
    seatLabel = str(data, "seatNumber");
  }

  if (seatLabel && usedSeats.includes(seatLabel.toUpperCase())) {
    return { ok: false, reason: "already-used" };
  }

  const totalAmount = num(data, "amount");
  const unitPrice =
    num(data, "unitPrice") ||
    (totalSeats > 0 ? Math.round(totalAmount / totalSeats) : totalAmount);

  return {
    ok: true,
    ticket: {
      bookingId: booking.id,
      bookingNumber: baseTicketNumber,
      bookingDocId: booking.id,
      ticketNumber: specificTicketNumber,
      baseTicketNumber,
      seat: seatLabel || undefined,
      seatIndex,
      totalSeats,
      eventId: str(data, "eventId"),
      eventName: str(data, "eventName"),
      ticketTypeName: str(data, "ticketTypeName") || "General",
      quantity: 1,
      amount: unitPrice,
      block: str(data, "block"),
      customerName: str(data, "customerName") || str(data, "name"),
      customerPhone: str(data, "customerPhone") || str(data, "phone"),
    },
  };
}

export async function verifyTicketNumber(raw: string): Promise<VerifyResult> {
  const payload = extractTicketPayload(raw);
  const code = payload.ticketNumber;
  if (!code) return { ok: false, reason: "not-found" };

  // 1. Per-ticket row (`tickets`), same records ADMIN maintains.
  try {
    const ticketRow = await findSupabaseTicket(code, payload.qrToken);

    if (ticketRow) {
      const status = str(ticketRow, "status").toUpperCase();

      if (ENTERED_STATUSES.includes(status.toLowerCase())) {
        return { ok: false, reason: "already-used" };
      }
      if (TICKET_CANCELLED.includes(status)) {
        return { ok: false, reason: "cancelled" };
      }

      const ticketNumber =
        str(ticketRow, "ticket_id") || String(ticketRow.id ?? code);
      const bookingNumber = str(ticketRow, "booking_id");
      const bookingRow = bookingNumber
        ? await findSupabaseBooking([bookingNumber])
        : null;

      if (bookingRow) {
        const bookingStatus = str(bookingRow, "status").toLowerCase();
        const reservation = str(bookingRow, "booking_status").toLowerCase();
        if (
          CANCELLED_STATUSES.includes(bookingStatus) ||
          CANCELLED_STATUSES.includes(reservation)
        ) {
          return { ok: false, reason: "cancelled" };
        }

        const usedTickets = stringList(bookingRow.used_tickets).map((s) =>
          s.toUpperCase(),
        );
        if (usedTickets.includes(ticketNumber.toUpperCase())) {
          return { ok: false, reason: "already-used" };
        }
      }

      if (await hasRecordedEntry(ticketNumber)) {
        return { ok: false, reason: "already-used" };
      }

      return {
        ok: true,
        ticket: ticketFromDoc(
          supabaseTicketDoc(ticketRow),
          bookingRow ? supabaseBookingDoc(bookingRow) : null,
        ),
      };
    }
  } catch (error) {
    console.warn("Supabase ticket lookup warning:", error);
  }

  // 2. Booking-level rows (legacy data / whole-booking QR).
  try {
    const bookingRow = await findSupabaseBooking([
      ...(payload.bookingId ? [payload.bookingId] : []),
      ...lookupCandidates(code),
    ]);

    if (bookingRow) {
      const bookingDoc = supabaseBookingDoc(bookingRow);
      const data = bookingDoc.data;
      const status = str(data, "status").toLowerCase();
      const reservation = str(data, "bookingStatus").toLowerCase();

      if (
        CANCELLED_STATUSES.includes(status) ||
        CANCELLED_STATUSES.includes(reservation)
      ) {
        return { ok: false, reason: "cancelled" };
      }
      if (status === "checked-in") {
        return { ok: false, reason: "already-used" };
      }

      const seatsArray = stringList(data.seats);
      const totalSeats =
        seatsArray.length ||
        num(data, "quantity") ||
        num(data, "seatCount") ||
        payload.seatCount ||
        1;
      const baseTicketNumber = str(data, "ticketNumber") || code;

      const result = ticketFromBooking(
        bookingDoc,
        code,
        payload,
        seatsArray,
        totalSeats,
        baseTicketNumber,
      );
      if (!result.ok) return result;

      const ticketId = result.ticket.ticketNumber;
      const usedTickets = stringList(data.usedTickets).map((s) => s.toUpperCase());
      if (usedTickets.includes(ticketId.toUpperCase())) {
        return { ok: false, reason: "already-used" };
      }
      if (await hasRecordedEntry(ticketId)) {
        return { ok: false, reason: "already-used" };
      }

      return result;
    }
  } catch (error) {
    console.warn("Supabase booking lookup warning:", error);
  }

  return { ok: false, reason: "not-found" };
}

// ─── Entry recording (Supabase) ───────────────────────────────────

type TicketClaim =
  | {
      ok: true;
      rowId: string;
      created: boolean;
      previousStatus: string | null;
    }
  | { ok: false; reason: "already-used" | "cancelled" };

function ticketScanPatch(
  scannerId: string,
  gate: string,
  scannerName: string,
  memberId: string,
  nowIso: string,
  dateStr: string,
  timeStr: string,
): Record<string, unknown> {
  return {
    status: "ENTERED",
    scanned_at: nowIso,
    scanned_by: scannerId,
    scanner_member_id: memberId || scannerId,
    scanner_member_name: scannerName,
    scan_gate_id: gate,
    scan_date: dateStr,
    scan_time: timeStr,
    updated_at: nowIso,
  };
}

async function claimTicketRow(
  ticket: VerifiedTicket,
  scannerId: string,
  gate: string,
  scannerName: string,
  memberId: string,
  nowIso: string,
  dateStr: string,
  timeStr: string,
): Promise<TicketClaim> {
  const ticketId = ticket.ticketNumber;
  const { data: rows, error } = await supabase
    .from("tickets")
    .select("id,ticket_id,status")
    .or(`id.eq.${ticketId},ticket_id.eq.${ticketId}`)
    .limit(1);

  if (error) throw new Error(error.message);

  const row = (rows?.[0] ?? null) as SupabaseRow | null;
  const patch = ticketScanPatch(
    scannerId,
    gate,
    scannerName,
    memberId,
    nowIso,
    dateStr,
    timeStr,
  );

  if (row) {
    const status = str(row, "status").toUpperCase();
    if (ENTERED_STATUSES.includes(status.toLowerCase())) {
      return { ok: false, reason: "already-used" };
    }
    if (TICKET_CANCELLED.includes(status)) {
      return { ok: false, reason: "cancelled" };
    }

    const previousStatus =
      row.status === null || row.status === undefined ? null : String(row.status);

    // Conditional update: only the first scanner to see the old status wins.
    let update = supabase
      .from("tickets")
      .update(patch)
      .eq("id", row.id)
      .select("id");
    update =
      previousStatus === null
        ? update.is("status", null)
        : update.eq("status", previousStatus);

    const { data: updated, error: updateError } = await update;
    if (updateError) throw new Error(updateError.message);
    if (!updated || updated.length === 0) {
      return { ok: false, reason: "already-used" };
    }

    return {
      ok: true,
      rowId: String(row.id),
      created: false,
      previousStatus,
    };
  }

  // Legacy booking-only tickets: seed the per-ticket row as ENTERED.
  const { error: insertError } = await supabase.from("tickets").insert([
    {
      id: ticketId,
      ticket_id: ticketId,
      booking_id: ticket.bookingNumber || ticket.bookingId,
      event_id: ticket.eventId,
      event_name: ticket.eventName,
      ticket_type_name: ticket.ticketTypeName,
      seat: ticket.seat || "",
      seat_index: ticket.seatIndex ?? null,
      total_tickets: ticket.totalSeats ?? 1,
      block: ticket.block || "",
      customer_name: ticket.customerName || "",
      customer_phone: ticket.customerPhone || "",
      serial_number: ticket.ticketNumber,
      qr_token: ticket.qrToken || ticket.ticketNumber,
      ...patch,
      created_at: nowIso,
    },
  ]);

  if (insertError) {
    if (insertError.code === "23505") {
      return { ok: false, reason: "already-used" };
    }
    throw new Error(insertError.message);
  }

  return { ok: true, rowId: ticketId, created: true, previousStatus: null };
}

async function releaseTicketClaim(
  claim: Extract<TicketClaim, { ok: true }>,
): Promise<void> {
  try {
    if (claim.created) {
      await supabase.from("tickets").delete().eq("id", claim.rowId);
      return;
    }

    await supabase
      .from("tickets")
      .update({
        status: claim.previousStatus ?? "ACTIVE",
        scanned_at: null,
        scanned_by: null,
        scanner_member_id: null,
        scanner_member_name: null,
        scan_gate_id: null,
        scan_date: null,
        scan_time: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claim.rowId)
      .eq("status", "ENTERED");
  } catch (error) {
    console.warn("Ticket claim rollback skipped:", error);
  }
}

export async function recordEntry(
  ticket: VerifiedTicket,
  scannerId: string,
  gate: string,
  scannerName: string = "Scanner",
  memberId: string = "",
): Promise<void> {
  const now = new Date();
  const nowIso = now.toISOString();
  const dateStr = dayKey(now);
  const timeStr = clockTime(now);

  const claim = await claimTicketRow(
    ticket,
    scannerId,
    gate,
    scannerName,
    memberId,
    nowIso,
    dateStr,
    timeStr,
  );
  if (!claim.ok) {
    throw new Error(claim.reason === "already-used" ? "ALREADY_USED" : "CANCELLED");
  }

  const entrySaved = await insertSupabaseTicketEntry({
    id: `${ticket.eventId}__${ticket.ticketNumber}__${now.getTime()}`,
    entry_key: `${ticket.eventId}__${ticket.ticketNumber}__${nowIso}`,
    ticket_id: ticket.ticketNumber,
    ticket_number: ticket.ticketNumber,
    booking_id: ticket.bookingNumber || ticket.bookingId,
    event_id: ticket.eventId,
    scanner_id: scannerId,
    member_id: memberId || null,
    scanner_name: scannerName,
    gate_id: gate,
    entry_status: "entered",
    scan_result: "SUCCESS",
    scanned_at: nowIso,
    scan_date: dateStr,
    scan_time: timeStr,
    audience_name: ticket.customerName || null,
    persons: 1,
    ticket_type: ticket.ticketTypeName || null,
    seat: ticket.seat || null,
    seat_index: ticket.seatIndex ?? null,
  });

  if (!entrySaved) {
    await releaseTicketClaim(claim);
    throw new Error("ENTRY_WRITE_FAILED");
  }

  // Update parent booking counters.
  try {
    const bookingKey = ticket.bookingNumber || ticket.bookingId;
    const bookingRow = bookingKey
      ? await findSupabaseBooking([
          bookingKey,
          ...(ticket.baseTicketNumber ? [ticket.baseTicketNumber] : []),
          ...(ticket.bookingId ? [ticket.bookingId] : []),
        ])
      : null;

    if (bookingRow) {
      const seatsArray = stringList(bookingRow.seats);
      const totalSeats =
        seatsArray.length ||
        Number(bookingRow.quantity ?? 0) ||
        ticket.totalSeats ||
        1;

      await updateSupabaseBookingStatus(
        str(bookingRow, "ticket_number") || bookingKey,
        ticket.ticketNumber,
        ticket.seat,
        totalSeats,
        nowIso,
        scannerName,
      );
    }
  } catch (error) {
    console.warn("Supabase booking status update skipped:", error);
  }

  await updateSupabaseScannerMemberScans(scannerId, nowIso);

  // Best-effort gate counter (gates are ADMIN-owned; skip if none match).
  try {
    const { data: gates } = await supabase
      .from("gates")
      .select("*")
      .eq("event_id", ticket.eventId);

    const match = (gates ?? []).find(
      (item) => String(item.id) === gate || str(item, "name") === gate,
    );

    if (match) {
      const entered = Number(match.entered ?? 0) + 1;
      const capacity = Number(match.capacity ?? 0);
      await supabase
        .from("gates")
        .update({
          entered,
          percentage:
            capacity > 0
              ? Math.min(100, Math.round((entered / capacity) * 100))
              : 0,
          status:
            capacity > 0 && entered >= capacity
              ? "full"
              : capacity > 0 && entered >= capacity * 0.8
                ? "congested"
                : "normal",
        })
        .eq("id", match.id);
    }
  } catch (error) {
    console.warn("Gate counter update skipped:", error);
  }

  try {
    await supabase.from("audit_logs").insert([
      {
        action: "entry.accepted",
        performed_by: scannerId,
        target_id: ticket.ticketNumber,
        timestamp: nowIso,
        metadata: {
          eventId: ticket.eventId,
          gateId: gate,
          bookingId: ticket.bookingNumber || ticket.bookingId,
          scannerName,
        },
      },
    ]);
  } catch (error) {
    console.warn("Audit log write skipped:", error);
  }
}

// ─── History ──────────────────────────────────────────────────────

export function useTicketEntries(): {
  entries: TicketEntry[];
  loading: boolean;
} {
  const [entries, setEntries] = useState<TicketEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("ticket_entries")
          .select("*")
          .order("scanned_at", { ascending: false })
          .limit(100);

        if (!active) return;
        if (error) {
          console.warn("Supabase ticket entries fetch warning:", error.message);
          return;
        }

        const mapped = (data ?? []).map((item) =>
          toEntry(
            String(item.id ?? item.ticket_id ?? ""),
            item as Record<string, unknown>,
          ),
        );
        mapped.sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));
        setEntries(mapped);
      } catch (error) {
        console.warn("Supabase ticket entries fetch warning:", error);
      } finally {
        if (active) setLoading(false);
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
  }, []);

  return { entries, loading };
}
