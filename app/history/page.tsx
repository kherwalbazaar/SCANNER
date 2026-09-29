"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import {
  Calendar,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  MapPin,
  QrCode,
  Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AppHeader, ProfileAvatar } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { AppShell } from "@/components/app-shell";
import { cn } from "@/lib/utils";
import { gateLabel, useScannerMember } from "@/lib/scanner-member";

type Status = "valid" | "used" | "invalid";

type ScanRecord = {
  id: string;
  ticketType: string;
  booking: string;
  name: string;
  status: Status;
  time: string;
};

const HISTORY: ScanRecord[] = [
  { id: "JT-0001248", ticketType: "General Ticket", booking: "BK-7852", name: "Ramesh Tudu", status: "valid", time: "07:42 PM" },
  { id: "JT-0001247", ticketType: "VIP Ticket", booking: "BK-7851", name: "Anita Murmu", status: "used", time: "07:41 PM" },
  { id: "JT-0001246", ticketType: "General Ticket", booking: "BK-7850", name: "Sagen Tudu", status: "valid", time: "07:40 PM" },
  { id: "JT-0001245", ticketType: "Balcony Ticket", booking: "BK-7849", name: "--", status: "invalid", time: "07:38 PM" },
  { id: "JT-0001244", ticketType: "General Ticket", booking: "BK-7848", name: "Babul Hansda", status: "valid", time: "07:37 PM" },
  { id: "JT-0001243", ticketType: "VIP Ticket", booking: "BK-7847", name: "Sunita Kisku", status: "used", time: "07:35 PM" },
  { id: "JT-0001242", ticketType: "General Ticket", booking: "BK-7846", name: "Lembaram Marandi", status: "valid", time: "07:33 PM" },
  { id: "JT-0001241", ticketType: "General Ticket", booking: "BK-7845", name: "Mangal Soren", status: "valid", time: "07:31 PM" },
  { id: "JT-0001240", ticketType: "Balcony Ticket", booking: "BK-7844", name: "Payal Oraon", status: "valid", time: "07:29 PM" },
  { id: "JT-0001239", ticketType: "VIP Ticket", booking: "BK-7843", name: "Dilip Hembram", status: "used", time: "07:27 PM" },
  { id: "JT-0001238", ticketType: "General Ticket", booking: "BK-7842", name: "--", status: "invalid", time: "07:25 PM" },
  { id: "JT-0001237", ticketType: "General Ticket", booking: "BK-7841", name: "Suni Murmu", status: "valid", time: "07:22 PM" },
];

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
  count: "total" | Status;
  Icon: LucideIcon;
  iconClassName: string;
  className: string;
}[] = [
  {
    label: "Total Scans",
    count: "total",
    Icon: Clock,
    iconClassName: "text-blue-600",
    className: "border-blue-100 bg-blue-50/70",
  },
  {
    label: "Valid Entries",
    count: "valid",
    Icon: CircleCheck,
    iconClassName: "text-emerald-600",
    className: "border-emerald-100 bg-emerald-50/70",
  },
  {
    label: "Already Used",
    count: "used",
    Icon: CircleX,
    iconClassName: "text-rose-500",
    className: "border-rose-100 bg-rose-50/70",
  },
  {
    label: "Invalid Tickets",
    count: "invalid",
    Icon: CircleAlert,
    iconClassName: "text-purple-500",
    className: "border-purple-100 bg-purple-50/70",
  },
];

export default function HistoryPage() {
  const [tab, setTab] = useState<Status | "all">("all");
  const { member } = useScannerMember();
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("2026-09-24");

  const stats = useMemo(() => {
    const counts: Record<Status, number> = { valid: 0, used: 0, invalid: 0 };
    for (const item of HISTORY) counts[item.status] += 1;
    return { ...counts, total: HISTORY.length };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return HISTORY.filter((item) => {
      const matchesTab = tab === "all" || item.status === tab;
      const matchesQuery =
        q.length === 0 ||
        item.id.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.booking.toLowerCase().includes(q);
      return matchesTab && matchesQuery;
    });
  }, [tab, query]);

  const formattedDate = formatDate(date);

  const handleDate = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.value) setDate(event.target.value);
  };

  return (
    <AppShell>
      <AppHeader>
        <div className="text-right">
          <p className="text-[11px] font-semibold text-indigo-100">
            Santali Night Jatra
          </p>
          <p className="flex items-center justify-end gap-1 text-[10px] font-medium text-amber-400">
            <MapPin className="h-2.5 w-2.5" /> {gateLabel(member)}
          </p>
        </div>
        <ProfileAvatar src={member?.profilePhoto} alt={member?.name || "Scanner"} />
      </AppHeader>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 pb-24">
        {/* Title + date */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-900">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm leading-tight font-bold text-slate-800">
                Scan History
              </h2>
              <p className="text-[10px] text-slate-500">
                View all scanned tickets and entry details
              </p>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs">
            <Calendar className="h-3 w-3 text-slate-500" />
            <span>{formattedDate}</span>
            <ChevronDown className="h-2.5 w-2.5 text-slate-400" />
            <input
              type="date"
              value={date}
              onChange={handleDate}
              aria-label="Select date"
              className="sr-only"
            />
          </label>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-1.5">
          {STAT_META.map(({ label, count, Icon, iconClassName, className }) => (
            <div
              key={label}
              className={`rounded-xl border p-2.5 text-center ${className}`}
            >
              <div className={`mb-0.5 ${iconClassName}`}>
                <Icon className="mx-auto h-3 w-3" />
              </div>
              <span className="block text-[10px] leading-tight font-medium text-slate-500">
                {label}
              </span>
              <p className="mt-0.5 text-sm font-bold text-slate-800">
                {count === "total" ? stats.total : stats[count]}
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
        {filtered.length === 0 ? (
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
                        {item.ticketType} &bull; Booking: {item.booking}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-700">
                        Name: {item.name}
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

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Select date";

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
