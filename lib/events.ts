"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "./supabase";

export type EventStatus = "live" | "upcoming" | "ended";

export type TicketClass = {
  id: string;
  name: string;
  price: number;
  booked: number;
  scanned: number;
  quota: number;
};

export type TicketEvent = {
  id: string;
  title: string;
  subtitle: string;
  storyName: string;
  category: string;
  image: string;
  date: string;
  showTime: string;
  venue: string;
  city: string;
  committeeAddress: string;
  status: EventStatus;
  gates: number;
  organizer: string;
  description: string;
  total: number;
  booked: number;
  scanned: number;
  ticketClasses: TicketClass[];
};

type Doc = Record<string, unknown> & { id: string };

type CollectionState = {
  shows: Doc[];
  events: Doc[];
  ticketTypes: Doc[];
  bookings: Doc[];
  ticketEntries: Doc[];
};

const SCANNED_STATUSES = [
  "scanned",
  "used",
  "entered",
  "checked-in",
  "checkedin",
  "verified",
  "success",
  "completed",
];

const CANCELLED_STATUSES = ["cancelled", "canceled", "refunded", "failed", "rejected"];

const str = (data: Record<string, unknown>, key: string): string =>
  String(data?.[key] ?? "").trim();

const num = (data: Record<string, unknown>, key: string): number => {
  const value = Number(data?.[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
};

const listOf = (data: Record<string, unknown>, key: string): unknown[] => {
  const value = data?.[key];
  return Array.isArray(value) ? value : [];
};

function timestampOf(value: string): number {
  const parsed = Date.parse(value.replace(/sept/gi, "sep"));
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

export function formatDate(value: string): string {
  if (!value) return "—";
  const parsed = new Date(value.replace(/sept/gi, "sep"));
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatEventDateDots(value?: string): string {
  const rawDate = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const [y, m, d] = rawDate.split("-");
    return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
  }
  const parsed = Date.parse(rawDate.replace(/sept/gi, "sep"));
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  }
  return rawDate || "xx.xx.xxxx";
}

export function getEventExpiryInfo(event?: { date?: string; showTime?: string; status?: string }) {
  if (!event) return { isExpired: false, formattedDate: "", message: "" };

  const rawDate = String(event.date || "").trim();
  const formattedDate = formatEventDateDots(rawDate);
  const rawStatus = String(event.status || "").toLowerCase();
  let isExpired = rawStatus === "ended" || rawStatus === "completed" || rawStatus === "past" || rawStatus === "expired";

  if (!isExpired && rawDate) {
    let d: Date | null = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      const parts = rawDate.split("-");
      d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    } else {
      const parsed = Date.parse(rawDate.replace(/sept/gi, "sep"));
      if (!isNaN(parsed)) d = new Date(parsed);
    }

    if (d && !isNaN(d.getTime())) {
      const timeStr = String(event.showTime || "").trim();
      const match = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (match) {
        let hours = parseInt(match[1], 10);
        const mins = match[2] ? parseInt(match[2], 10) : 0;
        const meridiem = (match[3] || "").toLowerCase();
        if (meridiem === "pm" && hours < 12) hours += 12;
        if (meridiem === "am" && hours === 12) hours = 0;
        d.setHours(hours, mins, 0, 0);
        if (hours >= 18) {
          d.setDate(d.getDate() + 1);
          d.setHours(6, 0, 0, 0);
        }
        isExpired = d.getTime() < Date.now();
      } else {
        d.setHours(23, 59, 59, 999);
        isExpired = d.getTime() < Date.now();
      }
    }
  }

  return {
    isExpired,
    formattedDate,
    message: isExpired ? `This event is expired on date ${formattedDate}` : "",
  };
}

export function normalizeStatus(value: string): EventStatus {
  const status = value.toLowerCase();
  if (["live", "ongoing", "in-progress", "on-sale", "active", "open"].includes(status)) {
    return "live";
  }
  if (["ended", "completed", "closed", "cancelled", "canceled", "past"].includes(status)) {
    return "ended";
  }
  return "upcoming";
}

const MONTH_INDEX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

export function isLikelyLogoUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes("logo") ||
    lower.includes("ramraj%20gayan%20mahal.png") ||
    lower.includes("ramraj gayan mahal.png") ||
    lower.includes("jarpa%20opera.png") ||
    lower.includes("jarpa opera.png") ||
    lower.includes("nahah%20opera%20logo")
  );
}

function partyBanner(partyName: string): string {
  const key = partyName.toUpperCase();
  if (key.includes("JARPA")) {
    return "https://ik.imagekit.io/kherwalbazaar/MANDAWA/JARPA%202026.jpg?updatedAt=1789577829940";
  }
  if (key.includes("RAMRAJ")) {
    return "https://raw.githubusercontent.com/kherwalbazaar/Jatra-bazaar-assest/refs/heads/main/ramaraja.jpeg";
  }
  if (key.includes("NAHAH")) {
    return "https://ik.imagekit.io/kherwalbazaar/Nahah%20Opera.jpeg";
  }
  return "";
}

function pickBanner(doc: Doc, partyName: string): string {
  const candidates = [
    str(doc, "banner"),
    str(doc, "image_url"),
    str(doc, "imageUrl"),
    ...listOf(doc, "banners"),
    ...listOf(doc, "additionalBanners"),
    ...listOf(doc, "additional_banners"),
    str(doc, "poster"),
  ]
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);

  const nonLogos = candidates.filter((url) => !isLikelyLogoUrl(url));
  return nonLogos[0] || partyBanner(partyName) || candidates[0] || "";
}

function resolveDate(doc: Doc): string {
  const direct = str(doc, "date");
  if (direct) return direct;

  const year = str(doc, "year");
  const month = str(doc, "month").slice(0, 3).toLowerCase();
  const day = str(doc, "dayOfMonth") || str(doc, "day");
  const monthIndex = MONTH_INDEX[month];
  if (!year || monthIndex === undefined || !day) return "";
  const date = new Date(Number(year), monthIndex, Number(day));
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function toEvent(doc: Doc): TicketEvent {
  // The ADMIN panel writes `shows` docs where:
  //   title       → story line
  //   eventTitle  → show name
  //   committeeLocation → where the show happens
  // Legacy/customer docs instead use `name`/`subtitle` for the show name.
  const storyName = str(doc, "title");
  const title =
    str(doc, "eventTitle") ||
    str(doc, "name") ||
    str(doc, "subtitle") ||
    "Untitled Event";
  const partyName =
    str(doc, "partyName") || str(doc, "party_name") || str(doc, "organizer");
  const committee =
    str(doc, "committeeName") || str(doc, "committee") || str(doc, "organizationName");

  return {
    id: doc.id,
    title,
    subtitle: committee || str(doc, "subtitle"),
    storyName,
    category: str(doc, "category") || str(doc, "genre") || str(doc, "type") || "Jatra",
    image: pickBanner(doc, partyName),
    date: resolveDate(doc),
    showTime:
      str(doc, "time") ||
      str(doc, "startTime") ||
      str(doc, "start_time") ||
      str(doc, "entryTime"),
    venue:
      str(doc, "committeeLocation") ||
      str(doc, "committee_location") ||
      str(doc, "venue") ||
      str(doc, "location") ||
      str(doc, "address"),
    city: str(doc, "city"),
    committeeAddress:
      str(doc, "committeeLocation") ||
      str(doc, "committee_location") ||
      str(doc, "committeeAddress") ||
      str(doc, "venue") ||
      str(doc, "address"),
    status: normalizeStatus(str(doc, "status")),
    gates: num(doc, "gates"),
    organizer: committee || partyName,
    description: str(doc, "description") || str(doc, "about"),
    total:
      num(doc, "totalCapacity") ||
      num(doc, "total_capacity") ||
      num(doc, "totalTickets") ||
      num(doc, "capacity"),
    booked: num(doc, "ticketsSold") || num(doc, "tickets_sold"),
    scanned: 0,
    ticketClasses: [],
  };
}

/** True when the show is finished — by status or by date/time. */
export function isEventExpired(event: TicketEvent): boolean {
  return getEventExpiryInfo(event).isExpired;
}

/** Shows the scanner is allowed to surface: not ended and not past its date. */
export function isUpcomingEvent(event: TicketEvent): boolean {
  return event.status !== "ended" && !isEventExpired(event);
}

type ClassAgg = {
  id: string;
  name: string;
  price: number;
  quota: number;
  sold: number;
  booked: number;
  scanned: number;
};

function buildEvents(
  eventDocs: Doc[],
  typeDocs: Doc[],
  bookingDocs: Doc[],
  entryDocs: Doc[],
): TicketEvent[] {
  const events = eventDocs.map(toEvent);
  const byId = new Map(events.map((event) => [event.id, event]));
  const buckets = new Map<string, Map<string, ClassAgg>>();

  const ensure = (eventId: string, key: string): ClassAgg | null => {
    if (!byId.has(eventId)) return null;
    let bucket = buckets.get(eventId);
    if (!bucket) {
      bucket = new Map();
      buckets.set(eventId, bucket);
    }
    let agg = bucket.get(key);
    if (!agg) {
      agg = { id: key, name: key, price: 0, quota: 0, sold: 0, booked: 0, scanned: 0 };
      bucket.set(key, agg);
    }
    return agg;
  };

  for (const type of typeDocs) {
    const eventId = str(type, "eventId");
    const name = str(type, "name") || str(type, "ticketTypeName") || type.id;
    const agg = ensure(eventId, name);
    if (!agg) continue;
    agg.id = str(type, "id") || type.id;
    agg.name = name;
    agg.price = num(type, "price");
    agg.quota = num(type, "totalQuota");
    agg.sold = Math.max(agg.sold, num(type, "sold"));
    agg.booked = Math.max(agg.booked, num(type, "sold"));
  }

  for (const booking of bookingDocs) {
    const eventId = str(booking, "eventId");
    if (!eventId) continue;
    const status = str(booking, "status").toLowerCase();
    const name =
      str(booking, "ticketTypeName") ||
      str(booking, "ticketTypeId") ||
      "General";
    const agg = ensure(eventId, name);
    if (!agg) continue;
    if (!agg.price) agg.price = num(booking, "unitPrice");
    if (CANCELLED_STATUSES.includes(status)) continue;
    const quantity = num(booking, "quantity") || num(booking, "seatCount") || 1;
    agg.booked += quantity;
    if (SCANNED_STATUSES.includes(status)) agg.scanned += quantity;
  }

  for (const entry of entryDocs) {
    const eventId = str(entry, "eventId") || str(entry, "event_id");
    if (!eventId) continue;

    // ADMIN ticket entries: scanResult/entryStatus. Legacy scanner entries: status.
    const scanResult = str(entry, "scanResult").toUpperCase();
    const entryStatus = str(entry, "entryStatus").toLowerCase();
    const status = str(entry, "status").toLowerCase();
    if (entryStatus === "rejected") continue;
    if (scanResult && scanResult !== "SUCCESS") continue;
    if (CANCELLED_STATUSES.includes(status)) continue;

    const name =
      str(entry, "ticketType") ||
      str(entry, "ticketTypeName") ||
      str(entry, "ticket_type_name") ||
      str(entry, "ticketTypeId") ||
      "General";
    const agg = ensure(eventId, name);
    if (!agg) continue;
    const quantity =
      num(entry, "persons") ||
      num(entry, "quantity") ||
      num(entry, "seatCount") ||
      1;
    agg.scanned += quantity;
  }

  for (const [eventId, bucket] of buckets) {
    const event = byId.get(eventId);
    if (!event) continue;
    const classes: TicketClass[] = [];
    let booked = 0;
    let scanned = 0;
    let quota = 0;

    for (const agg of bucket.values()) {
      const classBooked = Math.max(agg.booked, agg.sold);
      classes.push({
        id: agg.id,
        name: agg.name,
        price: agg.price,
        booked: classBooked,
        scanned: Math.min(agg.scanned, classBooked),
        quota: agg.quota,
      });
      booked += classBooked;
      scanned += agg.scanned;
      quota += agg.quota;
    }

    event.ticketClasses = classes;
    event.booked = booked || event.booked;
    event.scanned = Math.min(scanned, event.booked);
    if (quota > 0) event.total = quota;

    if (!event.gates) {
      const blocks = new Set<string>();
      for (const type of typeDocs) {
        if (str(type, "eventId") !== eventId) continue;
        for (const block of listOf(type, "blocks")) {
          if (typeof block === "string" && block) blocks.add(block);
        }
      }
      event.gates = blocks.size;
    }
  }

  return [...events].sort(
    (a, b) => timestampOf(a.date) - timestampOf(b.date),
  );
}

/**
 * Maps a Supabase `events` row back to the ADMIN show shape so `toEvent`
 * handles all sources identically.
 */
function fromSupabaseEvent(row: Record<string, unknown>): Doc {
  const text = (key: string) => String(row[key] ?? "").trim();
  const banners = Array.isArray(row.additional_banners)
    ? row.additional_banners.map(String)
    : [];

  return {
    id: String(row.id ?? ""),
    title: text("title"),
    eventTitle: text("event_title"),
    committeeName: text("committee_name"),
    committeeLocation: text("committee_location"),
    partyName: text("party_name"),
    date: text("date"),
    year: text("year"),
    month: text("month"),
    dayOfMonth: text("day_of_month"),
    time: text("start_time") || text("time") || text("event_time") || text("entry_time"),
    startTime: text("start_time"),
    entryTime: text("entry_time"),
    venue: text("venue"),
    address: text("address"),
    city: text("city"),
    status: text("status") || "upcoming",
    totalCapacity: Number(row.total_capacity) || 0,
    ticketsSold: Number(row.tickets_sold) || 0,
    poster: text("poster"),
    banner: text("image_url") || text("banner"),
    banners,
    additionalBanners: banners,
    language: text("language"),
    description: text("description"),
    organizer: text("organizer"),
  };
}

/** `shows` rows carry the ADMIN camelCase fields plus snake_case mirrors. */
function fromSupabaseShow(row: Record<string, unknown>): Doc {
  const text = (key: string) => String(row[key] ?? "").trim();
  const banners = Array.isArray(row.additionalBanners)
    ? row.additionalBanners.map(String)
    : Array.isArray(row.additional_banners)
      ? row.additional_banners.map(String)
      : [];

  return {
    id: String(row.id ?? row.show_id ?? ""),
    title: text("title"),
    eventTitle: text("eventTitle") || text("event_title"),
    committeeName: text("committeeName") || text("committee_name"),
    committeeLocation: text("committeeLocation") || text("committee_location"),
    partyName: text("partyName") || text("party_name"),
    date: text("date"),
    year: text("year"),
    month: text("month"),
    dayOfMonth: text("dayOfMonth") || text("day_of_month"),
    time: text("time"),
    startTime: text("startTime") || text("start_time"),
    entryTime: text("entryTime") || text("entry_time"),
    venue: text("venue"),
    address: text("address"),
    city: text("city"),
    status: text("status") || "upcoming",
    totalCapacity: Number(row.totalCapacity ?? row.total_capacity) || 0,
    ticketsSold: Number(row.ticketsSold ?? row.tickets_sold) || 0,
    poster: text("poster"),
    banner: text("banner") || text("image_url"),
    banners,
    additionalBanners: banners,
    description: text("description"),
    organizer: text("organizer"),
  };
}

function fromSupabaseTicketType(row: Record<string, unknown>): Doc {
  return {
    id: String(row.id ?? ""),
    eventId: String(row.event_id ?? row.eventId ?? ""),
    name: String(row.name ?? ""),
    price: Number(row.price ?? 0) || 0,
    totalQuota: Number(row.total_quota ?? row.totalQuota ?? 0) || 0,
    sold: Number(row.sold ?? 0) || 0,
    blocks: Array.isArray(row.blocks) ? row.blocks : [],
  };
}

function fromSupabaseBooking(row: Record<string, unknown>): Doc {
  return {
    id: String(row.id ?? ""),
    eventId: String(row.event_id ?? row.eventId ?? ""),
    status: String(row.status ?? ""),
    bookingStatus: String(row.booking_status ?? row.bookingStatus ?? ""),
    ticketTypeName: String(row.ticket_type_name ?? row.ticketTypeName ?? ""),
    unitPrice: Number(row.unit_price ?? row.unitPrice ?? 0) || 0,
    quantity: Number(row.quantity ?? 0) || 0,
    seatCount: Number(row.seat_count ?? row.quantity ?? 0) || 0,
  };
}

function fromSupabaseEntry(row: Record<string, unknown>): Doc {
  return {
    id: String(row.id ?? ""),
    eventId: String(row.event_id ?? row.eventId ?? ""),
    scanResult: String(row.scan_result ?? row.scanResult ?? ""),
    entryStatus: String(row.entry_status ?? row.entryStatus ?? ""),
    status: String(row.status ?? ""),
    ticketType: String(row.ticket_type ?? row.ticketType ?? ""),
    persons: Number(row.persons ?? 1) || 1,
  };
}

export function useEvents(): {
  events: TicketEvent[];
  loading: boolean;
} {
  const [data, setData] = useState<CollectionState>({
    shows: [],
    events: [],
    ticketTypes: [],
    bookings: [],
    ticketEntries: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [shows, events, ticketTypes, bookings, entries] =
          await Promise.all([
            supabase.from("shows").select("*"),
            supabase.from("events").select("*"),
            supabase.from("ticket_types").select("*"),
            supabase.from("bookings").select("*"),
            supabase.from("ticket_entries").select("*"),
          ]);

        if (!active) return;

        for (const result of [shows, events, ticketTypes, bookings, entries]) {
          if (result.error) {
            console.warn("Supabase events fetch warning:", result.error.message);
          }
        }

        setData({
          shows: (shows.data ?? []).map((row) =>
            fromSupabaseShow(row as Record<string, unknown>),
          ),
          events: (events.data ?? []).map((row) =>
            fromSupabaseEvent(row as Record<string, unknown>),
          ),
          ticketTypes: (ticketTypes.data ?? []).map((row) =>
            fromSupabaseTicketType(row as Record<string, unknown>),
          ),
          bookings: (bookings.data ?? []).map((row) =>
            fromSupabaseBooking(row as Record<string, unknown>),
          ),
          ticketEntries: (entries.data ?? []).map((row) =>
            fromSupabaseEntry(row as Record<string, unknown>),
          ),
        });
      } catch (err: unknown) {
        console.warn("Supabase events fetch failed:", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    // Supabase tables are mirrored by ADMIN; poll to pick up changes.
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

  const mergedEvents = useMemo(() => {
    const byId = new Map<string, Doc>();
    for (const doc of data.events) byId.set(doc.id, doc);
    // ADMIN writes `shows` as the canonical source; it wins over `events`.
    for (const doc of data.shows) byId.set(doc.id, doc);
    return [...byId.values()];
  }, [data.shows, data.events]);

  const events = useMemo(
    () =>
      buildEvents(
        mergedEvents,
        data.ticketTypes,
        data.bookings,
        data.ticketEntries,
      ),
    [mergedEvents, data.ticketTypes, data.bookings, data.ticketEntries],
  );

  return { events, loading };
}

export function useEvent(id: string): {
  event: TicketEvent | null;
  loading: boolean;
} {
  const { events, loading } = useEvents();
  const event = useMemo(
    () => events.find((item) => item.id === id) ?? null,
    [events, id],
  );

  return { event, loading };
}

export function bookedCount(event: TicketEvent): number {
  return event.booked;
}

export function scannedCount(event: TicketEvent): number {
  return event.scanned;
}

export function remainingCount(event: TicketEvent): number {
  if (event.total > 0) return Math.max(event.total - event.booked, 0);
  return Math.max(event.booked - event.scanned, 0);
}

export function revenue(event: TicketEvent): number {
  return event.ticketClasses.reduce(
    (sum, item) => sum + item.booked * item.price,
    0,
  );
}

export const STATUS_META: Record<
  EventStatus,
  { label: string; className: string; dotClassName: string }
> = {
  live: {
    label: "Live Now",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dotClassName: "bg-emerald-500",
  },
  upcoming: {
    label: "Upcoming",
    className: "border-blue-200 bg-blue-50 text-blue-700",
    dotClassName: "bg-blue-500",
  },
  ended: {
    label: "Completed",
    className: "border-slate-200 bg-slate-100 text-slate-600",
    dotClassName: "bg-slate-400",
  },
};
