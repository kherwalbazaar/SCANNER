"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";

import { firestore } from "./firebase";

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

function toEvent(doc: Doc): TicketEvent {
  const banners = listOf(doc, "banners").filter(
    (item): item is string => typeof item === "string",
  );

  // Based on Firestore structure:
  // - title field contains the story name
  // - subtitle field contains the event name
  const storyName = str(doc, "title") || "";
  const title = str(doc, "subtitle") || str(doc, "name") || "Untitled Event";
  const subtitle = str(doc, "name") || "";

  const event = {
    id: doc.id,
    title,
    subtitle,
    storyName,
    category:
      str(doc, "category") || str(doc, "genre") || str(doc, "type") || "Jatra",
    image: str(doc, "poster") || str(doc, "banner") || banners[0] || "",
    date: str(doc, "date"),
    showTime: str(doc, "time") || str(doc, "startTime"),
    venue: str(doc, "venue") || str(doc, "location") || str(doc, "address"),
    city: str(doc, "city"),
    committeeAddress: str(doc, "committeeAddress") || str(doc, "committeeLocation") || "",
    status: normalizeStatus(str(doc, "status")),
    gates: num(doc, "gates"),
    organizer:
      str(doc, "organizationName") ||
      str(doc, "committeeName") ||
      str(doc, "partyName") ||
      str(doc, "organizer"),
    description: str(doc, "about") || str(doc, "description"),
    total: num(doc, "totalTickets") || num(doc, "capacity"),
    booked: num(doc, "ticketsSold"),
    scanned: 0,
    ticketClasses: [],
  };

  // Debug: Log the mapping
  console.log("✅ Mapped Event:", {
    id: event.id,
    title: event.title,
    storyName: event.storyName,
    subtitle: event.subtitle,
  });

  return event;
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
    const eventId = str(entry, "eventId");
    if (!eventId) continue;
    const status = str(entry, "status").toLowerCase();
    if (CANCELLED_STATUSES.includes(status)) continue;
    const name =
      str(entry, "ticketTypeName") ||
      str(entry, "ticketTypeId") ||
      str(entry, "ticketClass") ||
      "General";
    const agg = ensure(eventId, name);
    if (!agg) continue;
    const quantity = num(entry, "quantity") || num(entry, "seatCount") || 1;
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

function watch(
  name: string,
  callback: (docs: Doc[]) => void,
): () => void {
  try {
    console.log(`🔍 Subscribing to collection: ${name}`);
    return onSnapshot(
      collection(firestore, name),
      (snapshot) => {
        const docs = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as Doc,
        );
        console.log(`📥 Received ${docs.length} docs from ${name}:`, docs);
        callback(docs);
      },
      (error) => {
        console.error(`❌ subscribe ${name} error:`, error);
        callback([]);
      },
    );
  } catch (error) {
    console.error(`❌ subscribe ${name} setup failed:`, error);
    callback([]);
    return () => {};
  }
}

export function useEvents(): {
  events: TicketEvent[];
  loading: boolean;
} {
  const [data, setData] = useState<CollectionState>({
    events: [],
    ticketTypes: [],
    bookings: [],
    ticketEntries: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("🚀 Setting up Firestore subscriptions...");
    const unsubs = [
      watch("events", (docs) => {
        console.log("📥 Events updated:", docs.length, "docs");
        setData((prev) => ({ ...prev, events: docs }));
        setLoading(false);
      }),
      watch("ticketTypes", (docs) =>
        setData((prev) => ({ ...prev, ticketTypes: docs })),
      ),
      watch("bookings", (docs) =>
        setData((prev) => ({ ...prev, bookings: docs })),
      ),
      watch("ticketEntries", (docs) =>
        setData((prev) => ({ ...prev, ticketEntries: docs })),
      ),
    ];

    return () => {
      for (const unsubscribe of unsubs) {
        try {
          unsubscribe();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  const events = useMemo(
    () =>
      buildEvents(
        data.events,
        data.ticketTypes,
        data.bookings,
        data.ticketEntries,
      ),
    [data],
  );

  console.log("📊 Final events array:", events);

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
