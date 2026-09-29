"use client";

import Link from "next/link";
import {
  Bell,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  QrCode,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AppHeader, ProfileAvatar } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { AppShell } from "@/components/app-shell";
import {
  accountLabel,
  approvalLabel,
  gateLabel,
  isScanningAllowed,
  useScannerMember,
} from "@/lib/scanner-member";

const STATS: {
  label: string;
  value: number;
  Icon: LucideIcon;
  iconClassName: string;
  className: string;
}[] = [
  {
    label: "Today's Entry",
    value: 0,
    Icon: Users,
    iconClassName: "text-blue-600",
    className: "border-blue-100 bg-blue-50/60",
  },
  {
    label: "Valid Entries",
    value: 0,
    Icon: CircleCheck,
    iconClassName: "text-emerald-600",
    className: "border-emerald-100 bg-emerald-50/60",
  },
  {
    label: "Already Used",
    value: 0,
    Icon: CircleX,
    iconClassName: "text-rose-500",
    className: "border-rose-100 bg-rose-50/60",
  },
  {
    label: "Invalid Tickets",
    value: 0,
    Icon: CircleAlert,
    iconClassName: "text-purple-500",
    className: "border-purple-100 bg-purple-50/60",
  },
];

export default function HomePage() {
  const { member, loading } = useScannerMember();
  const allowed = isScanningAllowed(member);
  const gate = gateLabel(member);

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
        {/* Status + stats (member details live on the Profile tab) */}
        <div className="max-h-[42%] shrink-0 space-y-3 overflow-y-auto px-4 pt-3 pb-1">
          {/* Account status banner */}
          <Link
            href="/create"
            className={`flex items-center justify-between rounded-2xl border p-4 shadow-xs transition-shadow hover:shadow-sm ${
              allowed
                ? "border-emerald-200/60 bg-linear-to-r from-emerald-50 to-teal-50"
                : "border-amber-200/60 bg-linear-to-r from-amber-50 to-orange-50"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm ${
                  allowed ? "bg-emerald-500" : "bg-amber-400"
                }`}
              >
                {allowed ? (
                  <CircleCheck className="h-5 w-5" />
                ) : (
                  <Clock className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Account Status
                </p>
                <h2
                  className={`text-base font-bold ${
                    allowed ? "text-emerald-600" : "text-amber-600"
                  }`}
                >
                  {loading && !member
                    ? "Loading…"
                    : allowed
                      ? `${approvalLabel(member?.approvalStatus)} • ${accountLabel(member?.accountStatus)}`
                      : approvalLabel(member?.approvalStatus)}
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                  {allowed
                    ? `Scanner ${member?.scannerId || ""} is approved. You can scan audience tickets at ${gate}.`
                    : "Your scanner account has been created successfully. Please wait for administrator approval."}
                </p>
              </div>
            </div>
            <ChevronRight className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
          </Link>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {STATS.map(({ label, value, Icon, iconClassName, className }) => (
              <div
                key={label}
                className={`rounded-2xl border p-3.5 ${className}`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${iconClassName}`} />
                  <span className="text-xs font-semibold text-slate-600">
                    {label}
                  </span>
                </div>
                <p className="text-2xl font-bold text-slate-800">
                  {value.toLocaleString("en-IN")}
                </p>
              </div>
            ))}
          </div>

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
          <button
            type="button"
            disabled={!allowed}
            aria-disabled={!allowed}
            className={`group flex flex-col items-center gap-6 outline-none transition-transform active:scale-95 ${
              allowed ? "cursor-pointer" : "cursor-not-allowed"
            }`}
          >
            <span
              className={`relative flex h-56 w-56 items-center justify-center rounded-full border-[6px] shadow-xl transition-colors ${
                allowed
                  ? "border-indigo-800 bg-linear-to-br from-indigo-700 to-indigo-950 text-white"
                  : "border-slate-300 bg-slate-200 text-slate-500"
              }`}
            >
              {allowed && (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 animate-ping rounded-full border-2 border-indigo-400/50"
                />
              )}
              <QrCode
                className={`h-24 w-24 ${allowed ? "text-indigo-100" : "text-slate-400"}`}
                strokeWidth={1.5}
              />
            </span>

            <span className="text-center">
              <span
                className={`block text-xl font-extrabold tracking-[0.18em] ${
                  allowed ? "text-slate-900" : "text-slate-500"
                }`}
              >
                SCAN TICKET
              </span>
              <span
                className={`mt-1.5 block text-sm font-semibold ${
                  allowed ? "text-indigo-700" : "text-slate-400"
                }`}
              >
                {allowed ? `Ready • ${gate}` : "Locked until approval"}
              </span>
            </span>
          </button>
        </div>
      </div>

      <BottomNav active="home" />
    </AppShell>
  );
}
