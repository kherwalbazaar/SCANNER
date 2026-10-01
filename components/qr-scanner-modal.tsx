"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CircleAlert, LoaderCircle, RefreshCw, X } from "lucide-react";
import {
  Html5Qrcode,
  Html5QrcodeScannerState,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";

export function QrScannerModal({
  onClose,
  onDetected,
  onManualEntry,
}: {
  onClose: () => void;
  onDetected: (code: string) => void;
  onManualEntry: () => void;
}) {
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(true);
  const [closing, setClosing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const onDetectedRef = useRef(onDetected);
  const onCloseRef = useRef(onClose);
  const onManualEntryRef = useRef(onManualEntry);
  const closeScannerRef = useRef<() => Promise<void>>(async () => undefined);
  onDetectedRef.current = onDetected;
  onCloseRef.current = onClose;
  onManualEntryRef.current = onManualEntry;

  useEffect(() => {
    let active = true;
    let detected = false;
    let startTimer: ReturnType<typeof setTimeout> | undefined;
    let startPromise: Promise<unknown> | undefined;
    let closePromise: Promise<void> | undefined;
    const scanner = new Html5Qrcode("ticket-qr-reader", {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false,
    });

    const waitForPlayback = async () => {
      if (
        scanner.isScanning ||
        scanner.getState() !== Html5QrcodeScannerState.SCANNING
      ) {
        return;
      }

      const video = document.querySelector<HTMLVideoElement>(
        "#ticket-qr-reader video",
      );
      if (!video || (!video.paused && video.readyState >= 2)) return;

      await new Promise<void>((resolve) => {
        video.addEventListener("playing", () => resolve(), { once: true });
      });
    };

    const stopScanner = () => {
      if (closePromise) return closePromise;
      if (startTimer) clearTimeout(startTimer);

      closePromise = (async () => {
        if (startPromise) await startPromise;
        await waitForPlayback();
        if (scanner.isScanning) await scanner.stop();
        scanner.clear();
      })();

      return closePromise;
    };
    closeScannerRef.current = stopScanner;

    startTimer = setTimeout(() => {
      startTimer = undefined;
      startPromise = scanner
        .start(
          { facingMode: "environment" },
          {
            fps: 10,
            aspectRatio: 1,
            qrbox: (width, height) => {
              const edge = Math.floor(Math.min(width, height) * 0.78);
              return { width: edge, height: edge };
            },
          },
          async (decodedText) => {
            if (!active || detected) return;
            detected = true;
            try {
              await stopScanner();
            } finally {
              if (active) onDetectedRef.current(decodedText.trim());
            }
          },
          () => undefined,
        )
        .then(() => {
          if (active) setStarting(false);
        })
        .catch((cause: unknown) => {
          if (!active) return;
          const details = String(cause).toLowerCase();
          setError(
            details.includes("permission") || details.includes("denied")
              ? "Camera access was denied. Allow camera access in your browser settings and try again."
              : "Could not start the camera. Check that your device has a camera and try again.",
          );
          setStarting(false);
        });
    }, 0);

    return () => {
      active = false;
      if (startTimer) clearTimeout(startTimer);
      void stopScanner().catch(() => undefined);
    };
  }, [attempt]);

  const closeAfterStop = (callback: () => void) => {
    if (closing) return;
    setClosing(true);
    void closeScannerRef.current()
      .catch(() => undefined)
      .finally(callback);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-slate-950 px-4 pt-5 pb-6 text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Scan ticket QR code"
    >
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-emerald-300">
            <Camera className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-bold">Scan ticket QR</h2>
            <p className="text-xs text-slate-400">
              {closing ? "Closing camera…" : "Position the code inside the frame"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => closeAfterStop(() => onCloseRef.current())}
          disabled={closing}
          aria-label="Close scanner"
          className="flex h-10 w-10 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-6">
        <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded-[28px] border border-white/15 bg-black">
          <div
            id="ticket-qr-reader"
            className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
          />
          {!error && (
            <div className="pointer-events-none absolute inset-[11%] rounded-2xl border-2 border-emerald-300/80 shadow-[0_0_24px_rgba(110,231,183,0.3)]" />
          )}
          {starting && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/80 text-center">
              <LoaderCircle className="h-7 w-7 animate-spin text-emerald-300" />
              <p className="text-sm font-medium">Starting camera…</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center">
              <CircleAlert className="h-8 w-8 text-amber-300" />
              <p className="text-sm leading-relaxed text-slate-200">{error}</p>
            </div>
          )}
        </div>

        {error ? (
          <div className="flex w-full max-w-sm gap-2">
            <button
              type="button"
              onClick={() => {
                setError("");
                setStarting(true);
                setAttempt((value) => value + 1);
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-emerald-300"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
            <button
              type="button"
              onClick={() =>
                closeAfterStop(() => onManualEntryRef.current())
              }
              disabled={closing}
              className="rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              Enter code
            </button>
          </div>
        ) : (
          <p className="max-w-xs text-center text-xs leading-relaxed text-slate-400">
            Hold the ticket steady. Verification will start as soon as the QR code is read.
          </p>
        )}
      </div>
    </div>
  );
}