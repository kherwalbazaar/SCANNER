"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  ScanLine,
  Ticket,
  Users,
} from "lucide-react";

import { BottomNav } from "@/components/bottom-nav";
import { AppShell } from "@/components/app-shell";
import { cn } from "@/lib/utils";
import {
  STATUS_META,
  bookedCount,
  formatDate,
  remainingCount,
  revenue,
  scannedCount,
  useEvent,
} from "@/lib/events";

function PageHeader({ subtitle }: { subtitle?: string }) {
  return (
    <header className="flex shrink-0 items-center gap-3 bg-indigo-950 px-4 pt-6 pb-4 text-white">
      <Link
        href="/events"
        aria-label="Back to events"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div>
        <h1 className="text-sm font-bold tracking-wide">Event Details</h1>
        {subtitle ? (
          <p className="text-[10px] font-semibold text-indigo-300">
            {subtitle}
          </p>
        ) : null}
      </div>
    </header>
  );
}

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id ?? "");
  const { event, loading } = useEvent(id);

  if (loading) {
    return (
      <AppShell>
        <PageHeader />
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 pb-24">
          <div className="h-40 w-full animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-16 w-full animate-pulse rounded-2xl bg-slate-200" />
          <div className="flex gap-1.5">
            {[0, 1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-8 flex-1 animate-pulse rounded-xl bg-slate-200"
              />
            ))}
          </div>
          <div className="h-32 w-full animate-pulse rounded-2xl bg-slate-200" />
        </div>
        <BottomNav active="events" />
      </AppShell>
    );
  }

  if (!event) {
    return (
      <AppShell>
        <PageHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 pb-24">
          <Ticket className="h-8 w-8 text-slate-300" />
          <p className="text-sm font-semibold text-slate-600">
            Event not found
          </p>
          <Link
            href="/events"
            className="mt-1 rounded-full bg-indigo-900 px-4 py-2 text-xs font-semibold text-white"
          >
            Back to Events
          </Link>
        </div>
        <BottomNav active="events" />
      </AppShell>
    );
  }

  const status = STATUS_META[event.status];
  const booked = bookedCount(event);
  const scanned = scannedCount(event);
  const remaining = remainingCount(event);
  const soldPercent =
    event.total > 0 ? Math.round((booked / event.total) * 100) : 0;
  const entryPercent = booked > 0 ? Math.round((scanned / booked) * 100) : 0;
  const venueLine = [event.venue, event.city].filter(Boolean).join(", ");

  const stats = [
    { label: "Booked", value: booked, className: "border-t-blue-600 border-slate-200/80 bg-blue-50/70 text-blue-600", Icon: Users },
    { label: "Scanned", value: scanned, className: "border-t-emerald-600 border-slate-200/80 bg-emerald-50/70 text-emerald-600", Icon: ScanLine },
    { label: "Remaining", value: remaining, className: "border-t-amber-600 border-slate-200/80 bg-amber-50/70 text-amber-600", Icon: Ticket },
    { label: "Total", value: event.total, className: "border-t-purple-600 border-slate-200/80 bg-purple-50/70 text-purple-600", Icon: Ticket },
  ];

  const info = [
    { label: "Date", value: formatDate(event.date), Icon: Calendar },
    { label: "Show Time", value: event.showTime || "To be announced", Icon: Clock },
    { label: "Venue", value: event.committeeAddress || venueLine || "To be announced", Icon: MapPin },
    { label: "Entry Gates", value: event.gates > 0 ? `${event.gates} gates` : "Not set", Icon: Users },
  ];

  return (
    <AppShell>
      <PageHeader subtitle={event.storyName || event.subtitle || event.title} />

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 pb-24">
        <div className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-100 shadow-xs">
          {event.image ? (
            <Image
              src={event.image}
              alt={event.title}
              fill
              sizes="(max-width: 640px) 100vw, 640px"
              unoptimized
              className="object-cover"
            />
          ) : (
            <Ticket className="h-10 w-10 text-slate-300" />
          )}
          <div className="absolute inset-0 bg-linear-to-t from-slate-900/75 via-slate-900/10 to-transparent" />
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
            <span
              className={cn(
                "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm",
                status.className,
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", status.dotClassName)} />
              {status.label}
            </span>
            <span className="rounded-full border border-white/25 bg-white/15 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
              {event.category}
            </span>
          </div>
          <div className="absolute right-3 bottom-3 left-3">
            <h2 className="text-base font-extrabold text-white drop-shadow-sm line-clamp-2 leading-tight">
              {event.storyName || event.title}
            </h2>
            {event.storyName && (
              <p className="text-[11px] font-semibold text-white/90 line-clamp-1">
                {event.title}
              </p>
            )}
            <p className="text-[11px] font-medium text-white/85">
              {formatDate(event.date)}
              {event.showTime ? ` • ${event.showTime}` : ""}
            </p>
          </div>
        </div>

        {event.storyName ? (
          <p className="rounded-2xl border border-slate-200/80 bg-white p-3.5 text-[11px] leading-relaxed text-slate-600 shadow-xs">
            <span className="mb-1 block font-bold text-slate-800">
              {event.storyName}
            </span>
            <span className="font-semibold text-slate-700">
              {event.title}
            </span>
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          {info.map(({ label, value, Icon }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-2xs"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-900">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[9px] font-medium text-slate-400">
                  {label}
                </span>
                <span className="block truncate text-[11px] font-bold text-slate-800">
                  {value}
                </span>
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-1.5">
          {stats.map(({ label, value, className, Icon }) => (
            <div
              key={label}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl border border-slate-200/80 border-t-4 px-1.5 py-2 ${className}`}
            >
              <span className="text-lg leading-none font-extrabold text-slate-800">
                {value.toLocaleString("en-IN")}
              </span>
              <span className="text-[8px] font-medium text-slate-500">
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-700">
                Ticket Sales
              </span>
              <span className="font-bold text-blue-600">{soldPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${soldPercent}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              {booked.toLocaleString("en-IN")} of{" "}
              {event.total.toLocaleString("en-IN")} tickets booked
            </p>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-700">
                Entry Scanning
              </span>
              <span className="font-bold text-emerald-600">{entryPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${entryPercent}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              {scanned.toLocaleString("en-IN")} of{" "}
              {booked.toLocaleString("en-IN")} booked entries scanned
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-indigo-900" />
              <h3 className="text-sm font-bold text-slate-800">
                Ticket Categories
              </h3>
            </div>
            <span className="text-[10px] font-semibold text-slate-400">
              Revenue&nbsp;
              <span className="text-slate-700">
                ₹{revenue(event).toLocaleString("en-IN")}
              </span>
            </span>
          </div>

          {event.ticketClasses.length === 0 ? (
            <p className="py-4 text-center text-[11px] text-slate-400">
              No ticket categories published for this event yet.
            </p>
          ) : (
            <div className="space-y-2">
              {event.ticketClasses.map((type) => (
                <div
                  key={type.id || type.name}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      {type.name}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      ₹{type.price.toLocaleString("en-IN")} per ticket
                      {type.quota > 0
                        ? ` • ${type.quota.toLocaleString("en-IN")} seats`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <p className="text-[9px] font-medium text-slate-400">
                        Booked
                      </p>
                      <p className="text-xs font-bold text-blue-600">
                        {type.booked.toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-medium text-slate-400">
                        Scanned
                      </p>
                      <p className="text-xs font-bold text-emerald-600">
                        {type.scanned.toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3">
          <span className="text-[11px] font-semibold text-indigo-900">
            Unscanned entries left
          </span>
          <span className="text-sm font-extrabold text-indigo-900">
            {Math.max(booked - scanned, 0).toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      <BottomNav active="events" />
    </AppShell>
  );
}
