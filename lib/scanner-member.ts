"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";

import { firestore } from "./firebase";

const SCANNER_MEMBERS = "scannerMembers";

const STORAGE_KEY = "jatra_scanner_id";
const DEFAULT_SCANNER_ID = "SCN-001";

/** Same shape JATRA BAZAAR ADMIN writes to `scannerMembers`. */
export type ScannerMember = {
  id: string;
  name: string;
  scannerId: string;
  mobile: string;
  email: string;
  profilePhoto?: string;
  address?: string;
  assignedGateId?: string;
  approvalStatus?: string;
  accountStatus?: string;
  createdAt?: string;
  approvedAt?: string;
  totalScans?: number;
};

export function getStoredScannerId(): string {
  if (typeof window === "undefined") return DEFAULT_SCANNER_ID;
  try {
    return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_SCANNER_ID;
  } catch {
    return DEFAULT_SCANNER_ID;
  }
}

export function setStoredScannerId(scannerId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, scannerId);
  } catch {
    /* ignore */
  }
}

function toMember(id: string, data: Record<string, unknown>): ScannerMember {
  const pick = (key: string) => String(data[key] ?? "");
  return {
    id,
    name: pick("name"),
    scannerId: pick("scannerId"),
    mobile: pick("mobile"),
    email: pick("email"),
    profilePhoto: pick("profilePhoto"),
    address: pick("address"),
    assignedGateId: pick("assignedGateId"),
    approvalStatus: pick("approvalStatus"),
    accountStatus: pick("accountStatus"),
    createdAt: pick("createdAt"),
    approvedAt: pick("approvedAt"),
    totalScans: Number(data.totalScans ?? 0),
  };
}

function pickMember(members: ScannerMember[]): ScannerMember | null {
  if (!members.length) return null;

  const wanted = getStoredScannerId();
  const exact = members.find((m) => m.scannerId === wanted);
  if (exact) return exact;

  const active = members.filter(
    (m) => m.approvalStatus === "approved" && m.accountStatus === "active",
  );
  const pool = active.length ? active : members;
  return [...pool].sort((a, b) =>
    (b.createdAt || "").localeCompare(a.createdAt || ""),
  )[0];
}

/**
 * Live link to the admin panel's `scannerMembers` collection.
 * The device profile always mirrors whichever member the admin approved.
 */
export function subscribeScannerMember(
  callback: (member: ScannerMember | null) => void,
): () => void {
  try {
    return onSnapshot(
      collection(firestore, SCANNER_MEMBERS),
      (snap) => {
        const members = snap.docs.map((d) =>
          toMember(d.id, d.data() as Record<string, unknown>),
        );
        const member = pickMember(members);
        if (member) setStoredScannerId(member.scannerId);
        callback(member);
      },
      (error) => {
        console.error("subscribeScannerMember error:", error);
        callback(null);
      },
    );
  } catch (error) {
    console.error("subscribeScannerMember setup failed:", error);
    return () => {};
  }
}

/** "24 Sept 2026" — identical formatting to the admin panel's Joined Date. */
export function formatJoinedDate(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function approvalLabel(status?: string): string {
  const value = String(status || "").toLowerCase();
  if (value === "approved") return "Approved";
  if (value === "rejected") return "Rejected";
  return "Pending Approval";
}

export function accountLabel(status?: string): string {
  const value = String(status || "").toLowerCase();
  if (value === "active") return "Active";
  if (value === "inactive" || value === "deactivated") return "Deactivated";
  return "Inactive";
}

export function isScanningAllowed(member: ScannerMember | null): boolean {
  return (
    !!member &&
    member.approvalStatus === "approved" &&
    member.accountStatus === "active"
  );
}

export function gateLabel(member: ScannerMember | null): string {
  const gate = member?.assignedGateId?.trim();
  return gate ? gate : "Not assigned";
}

/** Next free `SCN-###` id, derived from the ids the admin already issued. */
export function nextScannerIdFrom(members: ScannerMember[]): string {
  const highest = members.reduce((max, member) => {
    const match = String(member.scannerId || "").match(/(\d+)\s*$/);
    const value = match ? Number(match[1]) : 0;
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  return `SCN-${String(highest + 1).padStart(3, "0")}`;
}

export function useNextScannerId(): string {
  const [nextId, setNextId] = useState(() => nextScannerIdFrom([]));

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = onSnapshot(
        collection(firestore, SCANNER_MEMBERS),
        (snap) => {
          if (!active) return;
          const members = snap.docs.map((d) =>
            toMember(d.id, d.data() as Record<string, unknown>),
          );
          setNextId(nextScannerIdFrom(members));
        },
        (error) => {
          console.error("useNextScannerId error:", error);
        },
      );
    } catch (error) {
      console.error("useNextScannerId setup failed:", error);
    }
    return () => {
      active = false;
      try {
        unsubscribe?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return nextId;
}

export function useScannerMember(): {
  member: ScannerMember | null;
  loading: boolean;
} {
  const [member, setMember] = useState<ScannerMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeScannerMember((next) => {
      if (!active) return;
      setMember(next);
      setLoading(false);
    });
    return () => {
      active = false;
      try {
        unsubscribe?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return { member, loading };
}
