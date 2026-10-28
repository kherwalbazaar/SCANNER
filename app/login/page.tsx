"use client";

import { useEffect, useState, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock,
  DoorOpen,
  KeyRound,
  LoaderCircle,
  MapPin,
  QrCode,
  ShieldCheck,
  Smartphone,
  UserCheck,
  UserPlus,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import {
  authenticateScannerMember,
  getStoredGate,
  getStoredScannerId,
  isScanningAllowed,
  type ScannerMember,
} from "@/lib/scanner-member";

const POPULAR_GATES = [
  "Gate 1",
  "Gate 2",
  "Gate 3",
  "Main Gate",
  "VIP Gate",
  "Gallery Gate",
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const prefillId = searchParams.get("id") || "";
  const returnUrl = searchParams.get("returnUrl") || "/";

  const [identifier, setIdentifier] = useState(prefillId || "");
  const [gate, setGate] = useState(getStoredGate() || "Gate 1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingMember, setPendingMember] = useState<ScannerMember | null>(null);
  const [successMember, setSuccessMember] = useState<ScannerMember | null>(null);

  useEffect(() => {
    if (!identifier) {
      const stored = getStoredScannerId();
      if (stored) setIdentifier(stored);
    }
  }, [identifier]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    setPendingMember(null);

    const result = await authenticateScannerMember(identifier, gate);

    setIsSubmitting(false);

    if (result.ok && result.member) {
      setSuccessMember(result.member);
      setTimeout(() => {
        router.push(returnUrl);
      }, 700);
    } else if (result.isPending && result.member) {
      setPendingMember(result.member);
      setError(result.error || "Account is awaiting Administrator approval.");
    } else {
      setError(result.error || "Invalid Scanner ID or Mobile number.");
    }
  };

  return (
    <div className="flex flex-1 flex-col justify-between overflow-y-auto px-5 pt-8 pb-6">
      <div className="w-full max-w-sm mx-auto">
        {/* Brand Header */}
        <div className="text-center">
          <div className="relative mx-auto inline-flex items-center justify-center">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 opacity-30 blur-md" />
            <Image
              src="/apple.icon.png"
              alt="Jatra Bazaar Scanner"
              width={64}
              height={64}
              priority
              className="relative h-16 w-16 rounded-2xl border-2 border-indigo-400/40 object-cover shadow-xl"
            />
          </div>

          <h1 className="mt-4 text-xl font-extrabold tracking-tight text-slate-900">
            JATRA BAZAAR
          </h1>
          <div className="mt-1 flex items-center justify-center gap-1.5">
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-indigo-800">
              GATE SCANNER PORTAL
            </span>
            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Sign in with your approved Scanner ID or verified Mobile Number to
            start validating admission tickets.
          </p>
        </div>

        {/* Login Form Card */}
        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xl shadow-slate-200/50"
        >
          {/* Success banner */}
          {successMember && (
            <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-3 text-emerald-800">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div className="text-left">
                <p className="text-xs font-bold">Authentication Verified!</p>
                <p className="text-[10px] text-emerald-700">
                  Welcome back, {successMember.name} ({successMember.scannerId}). Entering scanner…
                </p>
              </div>
            </div>
          )}

          {/* Pending Admin Approval Banner */}
          {pendingMember && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-left">
              <div className="flex items-start gap-2.5">
                <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-900">
                    Awaiting Admin Approval
                  </h4>
                  <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
                    Your account is registered, but is currently in{" "}
                    <span className="font-semibold underline">Pending</span>{" "}
                    status.
                  </p>
                  <p className="mt-1.5 text-[10px] text-slate-600">
                    Please ask the festival administrator to approve your
                    account in the <strong>Admin Panel &gt; Ticket Scanner</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Standard Error Banner */}
          {error && !pendingMember && (
            <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-left">
              <CircleAlert className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-rose-700">{error}</p>
            </div>
          )}

          {/* Scanner ID / Mobile Input */}
          <div>
            <label
              htmlFor="identifier"
              className="mb-1.5 block text-xs font-bold text-slate-700 text-left"
            >
              Scanner ID or Mobile Number
            </label>
            <div className="relative flex items-center">
              <span className="pointer-events-none absolute left-3.5 text-slate-400">
                <QrCode className="h-4 w-4" />
              </span>
              <input
                id="identifier"
                type="text"
                autoComplete="username"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. SCN-001 or 9876543210"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pr-3 pl-10 text-xs font-semibold text-slate-800 uppercase placeholder:normal-case placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-none transition-all"
              />
            </div>
            <p className="mt-1 text-[10px] text-slate-400 text-left">
              Issued by Admin or created during registration
            </p>
          </div>

          {/* Gate Selection */}
          <div className="mt-4">
            <label
              htmlFor="gate"
              className="mb-1.5 block text-xs font-bold text-slate-700 text-left"
            >
              Assigned Gate / Entry Point
            </label>
            <div className="relative flex items-center">
              <span className="pointer-events-none absolute left-3.5 text-slate-400">
                <DoorOpen className="h-4 w-4" />
              </span>
              <select
                id="gate"
                value={gate}
                onChange={(e) => setGate(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pr-8 pl-10 text-xs font-semibold text-slate-800 focus:border-indigo-600 focus:bg-white focus:outline-none transition-all appearance-none"
              >
                {POPULAR_GATES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3.5 text-slate-400 text-xs">
                ▼
              </span>
            </div>
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={isSubmitting || !identifier.trim() || !!successMember}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-950 py-3.5 text-xs font-bold text-white shadow-lg shadow-indigo-950/20 transition-all hover:bg-indigo-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                <span>Verifying Scanner Identity…</span>
              </>
            ) : successMember ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Redirecting…</span>
              </>
            ) : (
              <>
                <span>Sign In & Start Scanning</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick Links */}
        <div className="mt-5 space-y-2">
          <Link
            href="/create"
            className="flex items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-xs font-semibold text-indigo-900 transition-colors hover:bg-indigo-100/80"
          >
            <span className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-indigo-600" />
              <span>Register New Scanner Account</span>
            </span>
            <span className="text-[10px] text-indigo-600 bg-white/80 px-2 py-0.5 rounded-full border border-indigo-200">
              Apply
            </span>
          </Link>
        </div>
      </div>

      {/* Security & Admin Footer */}
      <div className="mt-8 text-center text-[10px] text-slate-400">
        <p className="flex items-center justify-center gap-1 font-medium">
          <ShieldCheck className="h-3 w-3 text-slate-400" />
          Synchronized with Jatra Bazaar Admin & Supabase Cloud
        </p>
        <p className="mt-0.5">
          Only approved gate personnel can validate festival tickets.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AppShell className="bg-slate-50">
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center">
            <LoaderCircle className="h-6 w-6 animate-spin text-indigo-900" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </AppShell>
  );
}
