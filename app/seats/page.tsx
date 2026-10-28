"use client";

import { useMemo, useState } from "react";
import { Armchair, Calendar, CheckCircle2, MapPin, Ticket } from "lucide-react";

import { AppHeader, ProfileAvatar } from "@/components/app-header";
import { AppShell } from "@/components/app-shell";
import { BottomNav } from "@/components/bottom-nav";
import { cn } from "@/lib/utils";
import { formatDate, isUpcomingEvent, useEvents } from "@/lib/events";
import { gateLabel, useScannerMember } from "@/lib/scanner-member";
import { useBookedSeats, type SeatBlock, type SeatChip } from "@/lib/seats";

export default function SeatsPage() {
  const { member } = useScannerMember();
  const { events, loading: eventsLoading } = useEvents();
  const [selectedId, setSelectedId] = useState("");

  const upcomingEvents = useMemo(
    () => events.filter(isUpcomingEvent),
    [events],
  );

  const activeEvent = useMemo(() => {
    const selected = upcomingEvents.find((event) => event.id === selectedId);
    if (selected) return selected;
    return (
      upcomingEvents.find((event) => event.status === "live") ??
      upcomingEvents[0] ??
      null
    );
  }, [upcomingEvents, selectedId]);

  const { blocks, total, entered, loading } = useBookedSeats(
    activeEvent?.id ?? null,
  );

  return (
    <AppShell>
      <AppHeader title="Seats">
        <div className="text-right">
          <p className="flex items-center justify-end gap-1 text-[10px] font-medium text-amber-400">
            <MapPin className="h-2.5 w-2.5" /> {gateLabel(member)}
          </p>
        </div>
        <ProfileAvatar
          src={member?.profilePhoto}
          alt={member?.name || "Scanner"}
        />
      </AppHeader>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 pb-24">
        {eventsLoading ? (
          <SeatsSkeleton />
        ) : !activeEvent ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
            <Armchair className="h-6 w-6 text-slate-300" />
            <p className="text-xs font-semibold text-slate-600">
              No upcoming event
            </p>
            <p className="text-[11px] text-slate-400">
              Booked seats will appear once an upcoming event is published.
            </p>
          </div>
        ) : (
          <>
            {upcomingEvents.length > 1 ? (
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {upcomingEvents.map((event) => {
                  const isActive = event.id === activeEvent.id;
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setSelectedId(event.id)}
                      aria-pressed={isActive}
                      className={cn(
                        "max-w-[180px] shrink-0 truncate rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors",
                        isActive
                          ? "border-indigo-900 bg-indigo-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-900",
                      )}
                    >
                      {event.storyName || event.title}
                    </button>
                  );
                })}
              </div>
            ) : null}

            <EventSummary
              storyName={activeEvent.storyName || activeEvent.title}
              showName={
                activeEvent.storyName && activeEvent.title !== activeEvent.storyName
                  ? activeEvent.title
                  : ""
              }
              date={activeEvent.date}
              showTime={activeEvent.showTime}
              venue={activeEvent.committeeAddress}
              total={total}
              entered={entered}
            />

            {loading ? (
              <SeatsSkeleton count={2} />
            ) : blocks.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
                <Ticket className="h-6 w-6 text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">
                  No seats booked yet
                </p>
                <p className="text-[11px] text-slate-400">
                  Seats appear here as soon as tickets are booked.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-0.5">
                  <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    Booked Seats
                  </p>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-[3px] border border-indigo-200 bg-indigo-50" />
                      Booked
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-[3px] border border-emerald-200 bg-emerald-50" />
                      Entered
                    </span>
                  </div>
                </div>

                {blocks.map((block) => (
                  <BlockCard key={block.block} block={block} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav active="seats" />
    </AppShell>
  );
}

function EventSummary({
  storyName,
  showName,
  date,
  showTime,
  venue,
  total,
  entered,
}: {
  storyName: string;
  showName: string;
  date: string;
  showTime: string;
  venue: string;
  total: number;
  entered: number;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-block rounded-md border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-indigo-700 uppercase">
            Current Show
          </span>
          <h2 className="mt-1 text-sm leading-tight font-bold text-slate-900">
            {storyName}
          </h2>
          {showName ? (
            <p className="mt-0.5 text-[11px] font-semibold text-slate-600">
              {showName}
            </p>
          ) : null}
          <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
            <Calendar className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">
              {formatDate(date)}
              {showTime ? ` • ${showTime}` : ""}
            </span>
          </p>
          {venue ? (
            <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
              <MapPin className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{venue}</span>
            </p>
          ) : null}
        </div>

        <div className="shrink-0 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-center">
          <p className="text-2xl leading-none font-extrabold text-indigo-900">
            {total.toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-[9px] font-bold tracking-wide text-indigo-500 uppercase">
            Seats
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <div className="flex items-center justify-center gap-1.5 rounded-xl border border-t-4 border-slate-200/80 border-t-indigo-600 bg-indigo-50/60 py-2">
          <Armchair className="h-3 w-3 text-indigo-600" />
          <span className="text-sm font-extrabold text-indigo-700">
            {total.toLocaleString("en-IN")}
          </span>
          <span className="text-[10px] font-medium text-slate-500">Booked</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 rounded-xl border border-t-4 border-slate-200/80 border-t-emerald-600 bg-emerald-50/60 py-2">
          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          <span className="text-sm font-extrabold text-emerald-700">
            {entered.toLocaleString("en-IN")}
          </span>
          <span className="text-[10px] font-medium text-slate-500">Entered</span>
        </div>
      </div>
    </section>
  );
}

function BlockCard({ block }: { block: SeatBlock }) {
  const multiRow = block.rows.length > 1;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
      <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-indigo-900 px-1.5 text-[11px] font-bold text-white">
            {block.block}
          </span>
          <span className="text-[11px] font-semibold text-slate-700">
            Block {block.block}
          </span>
        </div>
        <span className="text-[10px] font-medium text-slate-500">
          {block.total.toLocaleString("en-IN")} seats
        </span>
      </header>

      <div className="space-y-2 p-3">
        {block.rows.map((row) => (
          <div
            key={row.row || "all"}
            className="flex items-start gap-2"
          >
            {multiRow && row.row ? (
              <span className="mt-2 w-9 shrink-0 text-[9px] font-bold tracking-wide text-slate-400 uppercase">
                Row {row.row}
              </span>
            ) : null}
            <div className="flex flex-1 flex-wrap gap-1.5">
              {row.seats.map((seat) => (
                <SeatPill key={seat.label} seat={seat} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SeatPill({ seat }: { seat: SeatChip }) {
  return (
    <span
      title={`${seat.label}${seat.ticketType ? ` • ${seat.ticketType}` : ""}${
        seat.entered ? " • Entered" : " • Booked"
      }`}
      className={cn(
        "flex h-8 min-w-8 items-center justify-center rounded-lg border px-1.5 text-[11px] font-bold tabular-nums",
        seat.entered
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-indigo-200 bg-indigo-50/60 text-indigo-900",
      )}
    >
      {seat.number}
    </span>
  );
}

function SeatsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="h-24 animate-pulse rounded-2xl border border-slate-200/80 bg-white"
        />
      ))}
    </div>
  );
}
