"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Calendar,
  CircleAlert,
  Clock,
  Hourglass,
  Keyboard,
  LogIn,
  ScanLine,
  Ticket,
  Users,
} from "lucide-react";

import { AppHeader, ProfileAvatar } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { AppShell } from "@/components/app-shell";
import { ManualEntryModal } from "@/components/manual-entry-modal";
import { QrScannerModal } from "@/components/qr-scanner-modal";
import { cn } from "@/lib/utils";
import { remainingCount, useEvents, isUpcomingEvent } from "@/lib/events";
import {
  gateLabel,
  isScanningAllowed,
  useScannerMember,
} from "@/lib/scanner-member";

export default function HomePage() {
  const router = useRouter();
  const { member } = useScannerMember();
  const { events } = useEvents();
  const allowed = isScanningAllowed(member);
  const waiting = !!member && !allowed;
  const blockedNotice =
    member && !allowed
      ? member.accountStatus?.toLowerCase() === "deactivated"
        ? {
            title: "Account Deactivated",
            body: "Your scanner account is approved but currently deactivated. Please contact the administrator to restore access.",
          }
        : member.approvalStatus?.toLowerCase() === "rejected"
          ? {
              title: "Account Rejected",
              body: "Your scanner account was rejected by the administrator. Please contact the administrator for help.",
            }
          : {
              title: "Waiting for Approval",
              body: "You will be able to scan audience tickets after an administrator approves your account.",
            }
      : null;
  const gate = gateLabel(member);
  const [manualOpen, setManualOpen] = useState(false);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);

  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const upcomingEvents = useMemo(
    () => events.filter(isUpcomingEvent),
    [events],
  );

  const activeEvent = useMemo(
    () =>
      upcomingEvents.find((event) => event.status === "live") ??
      upcomingEvents[0] ??
      null,
    [upcomingEvents],
  );

  const timeText = now ? now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }) : "";

  const totals = upcomingEvents.reduce(
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
        <Link href="/profile" className="outline-none">
          <ProfileAvatar src={member?.profilePhoto} alt={member?.name || "Scanner"} />
        </Link>
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
              {activeEvent?.storyName || "No upcoming event"}
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
          {!member ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/90 p-3.5 shadow-xs">
              <div className="flex items-start gap-2.5">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" />
                <div>
                  <h4 className="text-xs font-bold text-indigo-950">
                    Scanner Sign-In Required
                  </h4>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
                    Sign in with your approved Scanner ID to start admitting tickets.
                  </p>
                </div>
              </div>
              <Link
                href="/login"
                className="shrink-0 flex items-center gap-1 rounded-xl bg-indigo-950 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-900 transition-colors"
              >
                <LogIn className="h-3 w-3" />
                Sign In
              </Link>
            </div>
          ) : null}
        </div>

        {/* Full-screen centred scan action */}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-24">
          {waiting ? (
            <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-5 py-6 text-center shadow-xs">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Hourglass className="h-6 w-6" />
              </span>
              <h4 className="text-sm font-bold text-amber-900">
                {blockedNotice?.title}
              </h4>
              <p className="text-[11px] leading-relaxed text-slate-600">
                {blockedNotice?.body}
              </p>
            </div>
          ) : (
            <>
              {!manualOpen && (
              <button
                type="button"
                aria-label="Scan ticket QR code"
                onClick={() => {
                  if (!member) {
                    router.push("/login");
                  } else if (allowed) {
                    setQrScannerOpen(true);
                  }
                }}
                className="group flex cursor-pointer flex-col items-center gap-6 outline-none transition-transform active:scale-95"
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
                onClick={() => {
                  if (!member) {
                    router.push("/login");
                  } else if (allowed) {
                    setScannedCode(null);
                    setManualOpen(true);
                  }
                }}
                className="mt-5 flex cursor-pointer items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700 transition-colors hover:border-indigo-300 hover:bg-indigo-100"
              >
                <Keyboard className="h-3.5 w-3.5" />
                {!member ? "Sign In to Enter Code" : "Enter Code Manually"}
              </button>
            </>
          )}
        </div>
      </div>

      <ManualEntryModal
        open={manualOpen}
        onClose={() => {
          setManualOpen(false);
          setScannedCode(null);
        }}
        initialCode={scannedCode}
        scannerId={member?.scannerId || ""}
        scannerName={member?.name || "Scanner"}
        memberId={member?.id}
        gate={gate}
      />

      {qrScannerOpen && (
        <QrScannerModal
          onClose={() => setQrScannerOpen(false)}
          onDetected={(code) => {
            setScannedCode(code);
            setQrScannerOpen(false);
            setManualOpen(true);
          }}
          onManualEntry={() => {
            setScannedCode(null);
            setQrScannerOpen(false);
            setManualOpen(true);
          }}
        />
      )}

      <BottomNav active="home" />
    </AppShell>
  );
}
