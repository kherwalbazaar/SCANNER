"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker (`public/sw.js`) so SCANNER can be
 * installed to the home screen and keep working offline at the gate.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
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
      return;
    }

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
