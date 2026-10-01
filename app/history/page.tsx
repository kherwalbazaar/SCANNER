"use client";

import { useMemo, useState } from "react";
import {
  CircleAlert,
  CircleCheck,
  CircleX,
  MapPin,
  QrCode,
  ScanLine,
  Search,
  Ticket,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AppHeader, ProfileAvatar } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { AppShell } from "@/components/app-shell";
import { cn } from "@/lib/utils";
import { bookedCount, remainingCount, scannedCount, useEvents } from "@/lib/events";
import { gateLabel, useScannerMember } from "@/lib/scanner-member";
import { useTicketEntries, type TicketEntry } from "@/lib/ticket-entries";

type Status = "valid" | "used" | "invalid";

type ScanRecord = {
  id: string;
  ticketType: string;
  eventName: string;
  quantity: number;
  gate: string;
  status: Status;
  time: string;
};

function toRecord(
  entry: TicketEntry,
  eventNames: Map<string, string>,
): ScanRecord {
  const value = entry.status.toLowerCase();
  const status: Status = ["invalid", "rejected", "failed"].includes(value)
    ? "invalid"
    : ["used", "duplicate"].includes(value)
      ? "used"
      : "valid";

  return {
    id: entry.ticketNumber || "—",
    ticketType: entry.ticketTypeName || "General",
    eventName:
      (entry.eventId ? eventNames.get(entry.eventId) : undefined) ||
      entry.eventName,
    quantity: entry.quantity,
    gate: entry.gate,
    status,
    time: entry.time,
  };
}

const TABS: { key: Status | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "valid", label: "Valid" },
  { key: "used", label: "Used" },
  { key: "invalid", label: "Invalid" },
];

const STATUS_META: Record<
  Status,
  { label: string; Icon: LucideIcon; badgeClassName: string; tileClassName: string }
> = {
  valid: {
    label: "Entry Allowed",
    Icon: CircleCheck,
    badgeClassName:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
    tileClassName: "border-emerald-200 bg-emerald-50 text-emerald-600",
  },
  used: {
    label: "Already Used",
    Icon: CircleX,
    badgeClassName: "border-rose-200 bg-rose-50 text-rose-600",
    tileClassName: "border-rose-200 bg-rose-50 text-rose-500",
  },
  invalid: {
    label: "Invalid Ticket",
    Icon: CircleAlert,
    badgeClassName: "border-purple-200 bg-purple-50 text-purple-700",
    tileClassName: "border-purple-200 bg-purple-50 text-purple-600",
  },
};

const STAT_META: {
  label: string;
  value: "booked" | "scanned" | "remaining";
  Icon: LucideIcon;
  iconClassName: string;
  className: string;
}[] = [
  {
    label: "BOOKED",
    value: "booked",
    Icon: Users,
    iconClassName: "text-blue-600",
    className: "border-t-blue-600 border-slate-200/80 bg-blue-50/70",
  },
  {
    label: "SCANNED",
    value: "scanned",
    Icon: ScanLine,
    iconClassName: "text-emerald-600",
    className: "border-t-emerald-600 border-slate-200/80 bg-emerald-50/70",
  },
  {
    label: "REMAINING",
    value: "remaining",
    Icon: Ticket,
    iconClassName: "text-amber-600",
    className: "border-t-amber-600 border-slate-200/80 bg-amber-50/70",
  },
];

export default function HistoryPage() {
  const [tab, setTab] = useState<Status | "all">("all");
  const { member } = useScannerMember();
  const { entries, loading } = useTicketEntries();
  const { events } = useEvents();
  const [query, setQuery] = useState("");

  const eventNames = useMemo(
    () => new Map(events.map((event) => [event.id, event.storyName || event.title])),
    [events],
  );

  const records = useMemo(
    () => entries.map((entry) => toRecord(entry, eventNames)),
    [entries, eventNames],
  );

  const totals = useMemo(() => {
    return events.reduce(
      (acc, event) => ({
        booked: acc.booked + bookedCount(event),
        scanned: acc.scanned + scannedCount(event),
        remaining: acc.remaining + remainingCount(event),
      }),
      { booked: 0, scanned: 0, remaining: 0 },
    );
  }, [events]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((item) => {
      const matchesTab = tab === "all" || item.status === tab;
      const matchesQuery =
        q.length === 0 ||
        item.id.toLowerCase().includes(q) ||
        item.eventName.toLowerCase().includes(q) ||
        item.ticketType.toLowerCase().includes(q);
      return matchesTab && matchesQuery;
    });
  }, [records, tab, query]);

  return (
    <AppShell>
      <AppHeader title="History">
        <div className="text-right">
          <p className="flex items-center justify-end gap-1 text-[10px] font-medium text-amber-400">
            <MapPin className="h-2.5 w-2.5" /> {gateLabel(member)}
          </p>
        </div>
        <ProfileAvatar src={member?.profilePhoto} alt={member?.name || "Scanner"} />
      </AppHeader>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 pb-24">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-1.5">
          {STAT_META.map(({ label, value, Icon, iconClassName, className }) => (
            <div
              key={label}
              className={`rounded-xl border border-slate-200/80 border-t-4 p-2.5 text-center ${className}`}
            >
              <div className={`mb-0.5 ${iconClassName}`}>
                <Icon className="mx-auto h-3 w-3" />
              </div>
              <span className="block text-[10px] leading-tight font-medium text-slate-500">
                {label}
              </span>
              <p className="mt-0.5 text-sm font-bold text-slate-800">
                {totals[value].toLocaleString("en-IN")}
              </p>
            </div>
          ))}
        </div>

        {/* Tabs + search */}
        <div className="space-y-2 pt-1">
          <div className="flex rounded-xl bg-slate-200/70 p-1 text-xs font-semibold">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-pressed={tab === key}
                className={cn(
                  "flex-1 rounded-lg py-1.5 text-center transition-colors",
                  tab === key
                    ? "bg-indigo-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative flex items-center">
            <span className="pointer-events-none absolute left-3 text-slate-400">
              <Search className="h-3.5 w-3.5" />
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by Ticket ID / Name"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-3 pl-9 text-xs text-slate-800 shadow-2xs placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none"
            />
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-16 animate-pulse rounded-xl bg-slate-200"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
            <QrCode className="h-6 w-6 text-slate-300" />
            <p className="text-xs font-semibold text-slate-600">
              No scans found
            </p>
            <p className="text-[11px] text-slate-400">
              Try a different filter or search term.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => {
              const meta = STATUS_META[item.status];

              return (
                <article
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${meta.tileClassName}`}
                    >
                      <QrCode className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">
                        {item.id}
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        {item.eventName || "—"}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-700">
                        {item.ticketType} &bull; Qty {item.quantity}
                        {item.gate ? ` • ${item.gate}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={cn(
                        "flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold",
                        meta.badgeClassName,
                      )}
                    >
                      <meta.Icon className="h-2.5 w-2.5" />
                      {meta.label}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {item.time}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav active="history" />
    </AppShell>
  );
}
