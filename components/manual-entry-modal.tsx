"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Loader,
  Ticket,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useEvents } from "@/lib/events";
import {
  recordEntry,
  verifyTicketNumber,
  type VerifyFailure,
  type VerifiedTicket,
} from "@/lib/ticket-entries";

type Stage = "input" | "verified" | "saved" | VerifyFailure | "error";

const FAILURE_COPY: Record<VerifyFailure | "error", { title: string; hint: string }> = {
  "not-found": {
    title: "Ticket Not Found",
    hint: "No booking matches this ID. Check the code and try again.",
  },
  "already-used": {
    title: "Already Used",
    hint: "This ticket has already been scanned and recorded an entry.",
  },
  cancelled: {
    title: "Booking Cancelled",
    hint: "This booking was cancelled or refunded, entry is not allowed.",
  },
  error: {
    title: "Could Not Save Entry",
    hint: "Something went wrong while saving. Please try again.",
  },
};

export function ManualEntryModal({
  open,
  onClose,
  scannerId,
  gate,
  initialCode,
}: {
  open: boolean;
  onClose: () => void;
  scannerId: string;
  gate: string;
  initialCode?: string | null;
}) {
  const [stage, setStage] = useState<Stage>("input");
  const [code, setCode] = useState("");
  const [ticket, setTicket] = useState<VerifiedTicket | null>(null);
  const [busy, setBusy] = useState(false);
  const { events } = useEvents();

  useEffect(() => {
    if (!open || !initialCode) return;

    let active = true;
    setStage("input");
    setCode(initialCode);
    setTicket(null);
    setBusy(true);

    void verifyTicketNumber(initialCode)
      .then((result) => {
        if (!active) return;
        if (result.ok) {
          setTicket(result.ticket);
          setStage("verified");
        } else {
          setStage(result.reason);
        }
      })
      .finally(() => {
        if (active) setBusy(false);
      });

    return () => {
      active = false;
    };
  }, [initialCode, open]);

  if (!open) return null;

  const reset = () => {
    setStage("input");
    setCode("");
    setTicket(null);
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const handleVerify = async () => {
    if (busy || !code.trim()) return;
    setBusy(true);
    const result = await verifyTicketNumber(code);
    setBusy(false);
    if (result.ok) {
      setTicket(result.ticket);
      setStage("verified");
    } else {
      setStage(result.reason);
    }
  };

  const handleEntry = async () => {
    if (busy || !ticket) return;
    setBusy(true);
    try {
      await recordEntry(ticket, scannerId, gate);
      setStage("saved");
    } catch (error) {
      console.error("recordEntry error:", error);
      setStage("error");
    } finally {
      setBusy(false);
    }
  };

  const failure =
    stage === "not-found" ||
    stage === "already-used" ||
    stage === "cancelled" ||
    stage === "error"
      ? FAILURE_COPY[stage]
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Enter ticket id manually"
    >
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-900">
              <Ticket className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Enter Code Manually
              </h2>
              <p className="text-[10px] text-slate-500">
                Type the ticket or QR id printed on the pass
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {stage === "input" && (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-slate-600">
                Ticket / QR ID
              </span>
              <input
                autoFocus
                value={code}
                onChange={(event) => setCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleVerify();
                }}
                placeholder="e.g. NJ26-00001"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold tracking-wide text-slate-800 uppercase placeholder:font-medium placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-none"
              />
            </label>

            <button
              type="button"
              onClick={() => void handleVerify()}
              disabled={busy || !code.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-900 py-3 text-xs font-bold text-white shadow-md shadow-indigo-900/20 transition-colors hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <>
                  <Loader className="h-3.5 w-3.5 animate-spin" />
                  Verifying…
                </>
              ) : (
                <>
                  VERIFY
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        )}

        {stage === "verified" && ticket && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
              <CircleCheck className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="text-xs font-bold text-emerald-700">
                Ticket Verified
              </span>
            </div>

            <dl className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px]">
              <Row label="Ticket ID" value={ticket.ticketNumber} />
              <Row
                label="Event"
                value={
                  (ticket.eventId
                    ? events.find((event) => event.id === ticket.eventId)
                        ?.storyName || events.find((event) => event.id === ticket.eventId)?.title
                    : undefined) || ticket.eventName || "—"
                }
              />
              <Row label="Ticket Type" value={ticket.ticketTypeName} />
              <Row label="Quantity" value={String(ticket.quantity)} />
              <Row
                label="Amount"
                value={ticket.amount ? `₹${ticket.amount}` : "—"}
              />
            </dl>

            <button
              type="button"
              onClick={() => void handleEntry()}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-md shadow-emerald-600/25 transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <>
                  <Loader className="h-3.5 w-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  ENTRY
                  <CircleCheck className="h-3.5 w-3.5" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={reset}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
            >
              Check Another Ticket
            </button>
          </div>
        )}

        {stage === "saved" && ticket && (
          <div className="space-y-3 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <CircleCheck className="h-7 w-7 text-emerald-600" />
            </span>
            <div>
              <p className="text-sm font-bold text-slate-900">
                Entry Recorded
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {ticket.ticketNumber} &bull; {ticket.quantity} ticket
                {ticket.quantity > 1 ? "s" : ""} &bull; {gate}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                Saved to history for scanner {scannerId || "—"}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={reset}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
              >
                Next Ticket
              </button>
              <button
                type="button"
                onClick={close}
                className="flex-1 rounded-xl bg-indigo-900 py-2.5 text-xs font-bold text-white transition-colors hover:bg-indigo-800"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {failure && (
          <div className="space-y-3 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100">
              <CircleAlert className="h-7 w-7 text-rose-600" />
            </span>
            <div>
              <p className="text-sm font-bold text-slate-900">{failure.title}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{failure.hint}</p>
              {code ? (
                <p className="mt-1 text-[10px] font-semibold text-slate-400 uppercase">
                  {code}
                </p>
              ) : null}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={close}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={reset}
                className="flex-1 rounded-xl bg-indigo-900 py-2.5 text-xs font-bold text-white transition-colors hover:bg-indigo-800"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className={cn("max-w-[65%] truncate font-semibold text-slate-800")}>
        {value}
      </dd>
    </div>
  );
}
