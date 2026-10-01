"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Calendar, ChevronRight, MapPin, ScanLine, Ticket, Users } from "lucide-react";

import { AppHeader, ProfileAvatar } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { AppShell } from "@/components/app-shell";
import { cn } from "@/lib/utils";
import { useScannerMember } from "@/lib/scanner-member";
import {
  STATUS_META,
  bookedCount,
  formatDate,
  remainingCount,
  scannedCount,
  useEvents,
  type TicketEvent,
} from "@/lib/events";

export default function EventsPage() {
  const { member } = useScannerMember();
  const { events: allEvents, loading } = useEvents();
  const [category, setCategory] = useState("All");

  const categories = useMemo(
    () => [
      "All",
      ...Array.from(new Set(allEvents.map((event) => event.category))),
    ],
    [allEvents],
  );

  const events = useMemo(
    () =>
      category === "All"
        ? allEvents
        : allEvents.filter((event) => event.category === category),
    [allEvents, category],
  );

  return (
    <AppShell>
      <AppHeader title="Events">
        <ProfileAvatar
          src={member?.profilePhoto}
          alt={member?.name || "Scanner"}
        />
      </AppHeader>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 pb-24">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              aria-pressed={category === item}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors",
                category === item
                  ? "border-indigo-900 bg-indigo-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-900",
              )}
            >
              {item}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2.5">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="animate-pulse rounded-2xl border border-slate-200/80 bg-white p-3"
              >
                <div className="flex items-start gap-3">
                  <div className="h-[88px] w-[88px] shrink-0 rounded-xl bg-slate-200" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-3 w-16 rounded bg-slate-200" />
                    <div className="h-3 w-3/4 rounded bg-slate-200" />
                    <div className="h-3 w-1/2 rounded bg-slate-200" />
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  {[0, 1, 2].map((stat) => (
                    <div
                      key={stat}
                      className="h-8 flex-1 rounded-xl bg-slate-100"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
            <Ticket className="h-6 w-6 text-slate-300" />
            <p className="text-xs font-semibold text-slate-600">
              {allEvents.length === 0 ? "No events published yet" : "No events in this category"}
            </p>
            <p className="text-[11px] text-slate-400">
              {allEvents.length === 0
                ? "Events added in the admin panel will appear here."
                : "Try another category to see live events."}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>

      <BottomNav active="events" />
    </AppShell>
  );
}

function EventCard({ event }: { event: TicketEvent }) {
  const status = STATUS_META[event.status];
  const booked = bookedCount(event);
  const scanned = scannedCount(event);
  const remaining = remainingCount(event);

  return (
    <Link
      href={`/events/${event.id}`}
      className="block rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
          {event.image ? (
            <Image
              src={event.image}
              alt={event.title}
              fill
              sizes="88px"
              unoptimized
              className="object-cover"
            />
          ) : (
            <Ticket className="h-7 w-7 text-slate-300" />
          )}
          <span
            className={cn(
              "absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold backdrop-blur-sm",
              status.className,
            )}
          >
            <span
              className={cn("h-1 w-1 rounded-full", status.dotClassName)}
            />
            {status.label}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <span className="inline-block rounded-md border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-indigo-700 uppercase">
            {event.category}
          </span>
          <h3 className="mt-1 text-xs font-bold text-slate-900 leading-tight line-clamp-2">
            {event.storyName || event.title}
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
            <Calendar className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{formatDate(event.date)}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
            <MapPin className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">
              {event.committeeAddress || "Location TBA"}
            </span>
          </p>
        </div>

        <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-slate-400" />
      </div>

      <div className="mt-3 flex gap-2">
        <MiniStat
          label="Booked"
          value={booked}
          className="text-blue-600"
          iconClassName="bg-blue-50 text-blue-600"
          cardClassName="border-t-blue-600"
          Icon={Users}
        />
        <MiniStat
          label="Scanned"
          value={scanned}
          className="text-emerald-600"
          iconClassName="bg-emerald-50 text-emerald-600"
          cardClassName="border-t-emerald-600"
          Icon={ScanLine}
        />
        <MiniStat
          label="Remaining"
          value={remaining}
          className="text-amber-600"
          iconClassName="bg-amber-50 text-amber-600"
          cardClassName="border-t-amber-600"
          Icon={Ticket}
        />
      </div>
    </Link>
  );
}

function MiniStat({
  label,
  value,
  className,
  iconClassName,
  cardClassName,
  Icon,
}: {
  label: string;
  value: number;
  className: string;
  iconClassName: string;
  cardClassName?: string;
  Icon: typeof Ticket;
}) {
  return (
    <div className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl border border-slate-200/80 border-t-4 bg-white px-1.5 py-2 shadow-2xs ${cardClassName || ""}`}>
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-md",
          iconClassName,
        )}
      >
        <Icon className="h-2.5 w-2.5" />
      </span>
      <span className={cn("text-lg leading-none font-extrabold", className)}>
        {value.toLocaleString("en-IN")}
      </span>
      <span className="text-[8px] font-medium text-slate-400">{label}</span>
    </div>
  );
}
