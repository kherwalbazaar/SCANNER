"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Calendar,
  CircleAlert,
  Clock,
  Keyboard,
  ScanLine,
  Ticket,
  Users,
} from "lucide-react";

import { AppHeader, ProfileAvatar } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { AppShell } from "@/components/app-shell";
import { ManualEntryModal } from "@/components/manual-entry-modal";
import { cn } from "@/lib/utils";
import { remainingCount, useEvents } from "@/lib/events";
import {
  gateLabel,
  isScanningAllowed,
  useScannerMember,
} from "@/lib/scanner-member";

export default function HomePage() {
  const { member } = useScannerMember();
  const { events } = useEvents();
  const allowed = isScanningAllowed(member);
  const gate = gateLabel(member);
  const [manualOpen, setManualOpen] = useState(false);

  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const activeEvent = useMemo(
    () =>
      events.find((event) => event.status === "live") ??
      events.find((event) => event.status === "upcoming") ??
      events[0] ??
      null,
    [events],
  );

  const timeText = now ? now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }) : "";

  const storyText = activeEvent?.storyName;

  const totals = events.reduce(
    (acc, event) => ({
      booked: acc.booked + event.booked,
      scanned: acc.scanned + event.scanned,
      remaining: acc.remaining + remainingCount(event),
    }),
    { booked: 0, scanned: 0, remaining: 0 },
  );

  const stats = [
    {
      label: "BOOKED",
      value: totals.booked,
      Icon: Users,
      valueClassName: "text-blue-600",
      iconClassName: "bg-blue-50 text-blue-600",
      cardClassName: "border-t-blue-600 border-slate-200/80",
    },
    {
      label: "SCANNED",
      value: totals.scanned,
      Icon: ScanLine,
      valueClassName: "text-emerald-600",
      iconClassName: "bg-emerald-50 text-emerald-600",
      cardClassName: "border-t-emerald-600 border-slate-200/80",
    },
    {
      label: "REMAINING",
      value: totals.remaining,
      Icon: Ticket,
      valueClassName: "text-amber-600",
      iconClassName: "bg-amber-50 text-amber-600",
      cardClassName: "border-t-amber-600 border-slate-200/80",
    },
  ];

  return (
    <AppShell>
      <AppHeader>
        <span className="relative" aria-hidden="true">
          <Bell className="h-5 w-5 text-white" />
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" />
        </span>
        <ProfileAvatar src={member?.profilePhoto} alt={member?.name || "Scanner"} />
      </AppHeader>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Totals right below the header */}
        <div className="shrink-0 px-4 pt-3">
          <div className="flex gap-2">
            {stats.map(({ label, value, Icon, valueClassName, iconClassName, cardClassName }) => (
              <div
                key={label}
                className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl border border-slate-200/80 border-t-4 bg-white px-2 py-2.5 shadow-2xs ${cardClassName}`}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-md",
                    iconClassName,
                  )}
                >
                  <Icon className="h-3 w-3" />
                </span>
                <span
                  className={cn(
                    "text-lg leading-none font-extrabold",
                    valueClassName,
                  )}
                >
                  {value.toLocaleString("en-IN")}
                </span>
                <span className="text-[8px] font-semibold tracking-wide text-slate-400">
                  {label}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-2.5 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-center shadow-[0_-10px_26px_-16px_rgba(15,23,42,0.55)]">
            <p className="text-sm font-extrabold text-indigo-900 leading-tight">
              {activeEvent?.storyName || "No event published"}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-slate-700 leading-tight">
              {activeEvent?.title || "—"}
            </p>
            <p className="mt-1 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-[11px] font-medium text-slate-500">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3 text-indigo-900" />
                {activeEvent?.date || "—"}
              </span>
              {timeText && (
                <>
                  <span className="text-slate-300">|</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-indigo-900" />
                    <span className="font-bold text-indigo-900">{timeText}</span>
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Status + stats (member details live on the Profile tab) */}
        <div className="max-h-[42%] shrink-0 space-y-3 overflow-y-auto px-4 pt-3 pb-1">
          {!allowed && (
            <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/80 p-3.5">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
              <div>
                <h4 className="text-xs font-bold text-blue-900">
                  Waiting for Approval
                </h4>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
                  You will be able to scan audience tickets after an
                  administrator approves your account and assigns a gate.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Full-screen centred scan action */}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-24">
          {!manualOpen && (
          <button
            type="button"
            disabled={!allowed}
            aria-disabled={!allowed}
            className={`group flex flex-col items-center gap-6 outline-none transition-transform active:scale-95 ${
              allowed ? "cursor-pointer" : "cursor-not-allowed"
            }`}
          >
            <span
              className={`relative flex h-56 w-56 items-center justify-center overflow-hidden rounded-[44px] shadow-xl transition-colors ${
                allowed
                  ? "bg-white text-slate-900"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {(
                [
                  "top-5 left-5 rounded-tl-2xl border-t-[7px] border-l-[7px]",
                  "top-5 right-5 rounded-tr-2xl border-t-[7px] border-r-[7px]",
                  "bottom-5 left-5 rounded-bl-2xl border-b-[7px] border-l-[7px]",
                  "bottom-5 right-5 rounded-br-2xl border-b-[7px] border-r-[7px]",
                ] as const
              ).map((position) => (
                <span
                  key={position}
                  aria-hidden="true"
                  className={`absolute h-11 w-11 ${position} ${
                    allowed
                      ? "animate-bracket-pulse border-indigo-500"
                      : "border-slate-300"
                  }`}
                />
              ))}

              <span
                aria-hidden="true"
                className={`absolute h-40 w-40 rounded-full blur-2xl ${
                  allowed ? "animate-qr-glow bg-indigo-400/30" : "bg-transparent"
                }`}
              />

              <ScanLine
                className={`relative h-36 w-36 ${allowed ? "text-slate-900" : "text-slate-400"}`}
                strokeWidth={1.75}
              />

              <span
                aria-hidden="true"
                className={`absolute inset-x-8 top-1/2 h-0.5 ${
                  allowed
                    ? "animate-scan-sweep bg-indigo-500 shadow-[0_0_10px_2px_rgba(79,70,229,0.65)]"
                    : "bg-slate-400"
                }`}
              />
            </span>
          </button>
          )}

          <button
            type="button"
            disabled={!allowed}
            aria-disabled={!allowed}
            onClick={() => setManualOpen(true)}
            className={`mt-5 flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
              allowed
                ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-300 hover:bg-indigo-100"
                : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
            }`}
          >
            <Keyboard className="h-3.5 w-3.5" />
            Enter Code Manually
          </button>
        </div>
      </div>

      <ManualEntryModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        scannerId={member?.scannerId || ""}
        gate={gate}
      />

      <BottomNav active="home" />
    </AppShell>
  );
}
