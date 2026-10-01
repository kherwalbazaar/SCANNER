"use client";

import { useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

/**
 * Registers the PWA service worker (`public/sw.js`) so SCANNER can be
 * installed to the home screen and keep working offline at the gate.
 */
export function PwaRegister() {
  const [installPromptAvailable, setInstallPromptAvailable] = useState(false);
  const [installing, setInstalling] = useState(false);
  const installPromptRef = useRef<InstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      installPromptRef.current = event as InstallPromptEvent;
      setInstallPromptAvailable(true);
    };

    const onAppInstalled = () => {
      installPromptRef.current = null;
      setInstallPromptAvailable(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    const register = () => {
      if (!("serviceWorker" in navigator)) return;
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          registration.addEventListener("updatefound", () => {
            const installing = registration.installing;
            installing?.addEventListener("statechange", () => {
              if (
                installing.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                console.info("SCANNER: new version available — reload to update.");
              }
            });
          });
        })
        .catch((error) => {
          console.warn("SCANNER: service worker registration failed", error);
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      window.removeEventListener("load", register);
    };
  }, []);

  const installApp = async () => {
    const promptEvent = installPromptRef.current;
    if (!promptEvent || installing) return;

    setInstalling(true);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      installPromptRef.current = null;
      setInstallPromptAvailable(false);
      if (choice.outcome === "accepted") {
        console.info("SCANNER: app installation accepted.");
      }
    } catch (error) {
      console.warn("SCANNER: app installation prompt failed", error);
    } finally {
      setInstalling(false);
    }
  };

  if (!installPromptAvailable) return null;

  return (
    <aside
      role="status"
      className="fixed inset-x-3 bottom-24 z-[70] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
        <Download className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-900">Install SCANNER</p>
        <p className="text-xs text-slate-500">Add the app to your device</p>
      </div>
      <button
        type="button"
        onClick={() => void installApp()}
        disabled={installing}
        className="rounded-lg bg-indigo-900 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-indigo-800 disabled:opacity-60"
      >
        {installing ? "Opening…" : "Install"}
      </button>
      <button
        type="button"
        aria-label="Dismiss install prompt"
        onClick={() => setInstallPromptAvailable(false)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
      >
        <X className="h-4 w-4" />
      </button>
    </aside>
  );
}
