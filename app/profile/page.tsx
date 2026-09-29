"use client";

import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  ChevronRight,
  Clock,
  Lock,
  LogOut,
  MapPin,
  Mail,
  Phone,
  QrCode,
  UserPlus,
} from "lucide-react";

import { ProfileAvatar } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { AppShell } from "@/components/app-shell";
import {
  accountLabel,
  approvalLabel,
  formatJoinedDate,
  gateLabel,
  isScanningAllowed,
  useScannerMember,
} from "@/lib/scanner-member";

const ACTIONS: {
  href: string;
  label: string;
  description: string;
  Icon: typeof Phone;
}[] = [
  {
    href: "/history",
    label: "Scan History",
    description: "Review every ticket you have scanned",
    Icon: Clock,
  },
  {
    href: "/create",
    label: "Create Scanner Account",
    description: "Register another scanner for the event",
    Icon: UserPlus,
  },
];

export default function ProfilePage() {
  const { member, loading } = useScannerMember();

  const scannerId = member?.scannerId || "—";
  const gate = gateLabel(member);
  const allowed = isScanningAllowed(member);

  const details: { label: string; value: string; Icon: typeof Phone }[] = [
    { label: "Scanner ID", value: scannerId, Icon: QrCode },
    { label: "Mobile Number", value: member?.mobile || "—", Icon: Phone },
    { label: "Email", value: member?.email || "—", Icon: Mail },
    { label: "Joined Date", value: formatJoinedDate(member?.createdAt), Icon: Calendar },
    { label: "Assigned Gate", value: gate, Icon: MapPin },
  ];

  return (
    <AppShell>
      <header className="flex shrink-0 flex-col items-center gap-3 bg-indigo-950 px-4 pt-6 pb-5 text-white">
        <ProfileAvatar
          size={72}
          src={member?.profilePhoto}
          alt={member?.name || "Scanner profile photo"}
          className="h-[72px] w-[72px] rounded-full border-2 border-indigo-400 object-cover"
        />
        <div className="text-center">
          <h1 className="text-base font-bold leading-tight">
            {loading && !member ? "Loading…" : member?.name || "Scanner"}
          </h1>
          <p className="text-[11px] font-semibold tracking-wider text-indigo-300">
            {scannerId} &bull; {gate}
          </p>
        </div>
        <span
          className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
            allowed
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
              : "border-amber-500/40 bg-amber-500/15 text-amber-300"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              allowed ? "bg-emerald-400" : "bg-amber-400"
            }`}
          />
          {accountLabel(member?.accountStatus)} &bull;{" "}
          {approvalLabel(member?.approvalStatus)}
        </span>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 pb-24">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
            <QrCode className="h-4 w-4 text-indigo-900" />
            <h2 className="text-sm font-bold text-slate-800">Scanner Details</h2>
          </div>

          <dl className="space-y-2.5 text-xs">
            {details.map(({ label, value, Icon }) => (
              <div key={label} className="flex items-center justify-between">
                <dt className="flex items-center gap-2 font-medium text-slate-500">
                  <Icon className="h-3.5 w-3.5 text-slate-400" />
                  {label}
                </dt>
                <dd className="max-w-[60%] truncate text-right font-semibold text-slate-800">
                  {loading && !member ? "…" : value}
                </dd>
              </div>
            ))}

            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2 font-medium text-slate-500">
                <Lock className="h-3.5 w-3.5 text-slate-400" />
                Scanning Access
              </dt>
              <dd
                className={`flex items-center gap-1 font-semibold ${
                  allowed ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {allowed ? (
                  <>Granted</>
                ) : (
                  <>
                    <Lock className="h-2.5 w-2.5" /> Locked
                  </>
                )}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
            <Clock className="h-4 w-4 text-indigo-900" />
            <h2 className="text-sm font-bold text-slate-800">Quick Actions</h2>
          </div>

          <div className="space-y-2">
            {ACTIONS.map(({ href, label, description, Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 transition-colors hover:border-indigo-200 hover:bg-indigo-50"
              >
                <span className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-900">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-left">
                    <span className="block text-xs font-bold text-slate-800">
                      {label}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {description}
                    </span>
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
              </Link>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 py-3 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-100"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>

        <Link
          href="/create"
          className="flex items-center justify-between rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-xs font-medium text-slate-600 transition-colors hover:bg-blue-50"
        >
          <span>Need another scanner? Create a new account</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
        </Link>
      </div>

      <BottomNav active="profile" />
    </AppShell>
  );
}
