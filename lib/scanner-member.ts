"use client";

import { useEffect, useState } from "react";

import {
  supabase,
  fetchSupabaseScannerMember,
  fetchAllSupabaseScannerMembers,
  insertSupabaseScannerMember,
  type SupabaseScannerMember,
} from "./supabase";

const STORAGE_ID_KEY = "jatra_scanner_id";
const STORAGE_GATE_KEY = "jatra_scanner_gate";

/** Same shape JATRA BAZAAR ADMIN writes to `scannerMembers` & `scanner_members`. */
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
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_ID_KEY) || "";
  } catch {
    return "";
  }
}

export function setStoredScannerId(scannerId: string): void {
  if (typeof window === "undefined") return;
  try {
    if (scannerId) {
      window.localStorage.setItem(STORAGE_ID_KEY, scannerId);
    } else {
      window.localStorage.removeItem(STORAGE_ID_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function getStoredGate(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_GATE_KEY) || "";
  } catch {
    return "";
  }
}

export function setStoredGate(gate: string): void {
  if (typeof window === "undefined") return;
  try {
    if (gate) {
      window.localStorage.setItem(STORAGE_GATE_KEY, gate);
    } else {
      window.localStorage.removeItem(STORAGE_GATE_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function clearScannerSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_ID_KEY);
    window.localStorage.removeItem(STORAGE_GATE_KEY);
    window.dispatchEvent(new Event("jatra_scanner_auth_changed"));
  } catch {
    /* ignore */
  }
}

function fromSupabaseMember(sb: SupabaseScannerMember): ScannerMember {
  return {
    id: sb.id,
    name: sb.name,
    scannerId: sb.scanner_id,
    mobile: sb.mobile,
    email: sb.email || "",
    profilePhoto: sb.profile_photo || "",
    address: sb.address || "",
    assignedGateId: sb.assigned_gate_id || "",
    approvalStatus: sb.approval_status || "pending",
    accountStatus: sb.account_status || "active",
    createdAt: sb.created_at || "",
    approvedAt: sb.approved_at || "",
    totalScans: Number(sb.total_scans || 0),
  };
}

/**
 * Attempt to log in a scanner member using their Scanner ID (e.g. SCN-001) or Mobile Number.
 */
export async function authenticateScannerMember(
  identifier: string,
  preferredGate?: string,
): Promise<{
  ok: boolean;
  member?: ScannerMember;
  error?: string;
  isPending?: boolean;
}> {
  const trimmed = identifier.trim();
  if (!trimmed) {
    return { ok: false, error: "Please enter your Scanner ID or Mobile Number" };
  }

  let found: ScannerMember | null = null;

  try {
    const sbMember = await fetchSupabaseScannerMember(trimmed);
    if (sbMember) {
      found = fromSupabaseMember(sbMember);
    }
  } catch (err) {
    console.warn("Supabase auth lookup failed:", err);
  }

  if (!found) {
    return {
      ok: false,
      error: `No scanner account found matching "${trimmed}". Please register or check your details.`,
    };
  }

  // Status checks
  const approval = String(found.approvalStatus || "").toLowerCase();
  const account = String(found.accountStatus || "").toLowerCase();

  if (approval === "rejected") {
    return {
      ok: false,
      error: "This scanner account has been rejected by the administrator.",
    };
  }

  if (account === "deactivated") {
    return {
      ok: false,
      error: "This scanner account is currently deactivated. Please contact your administrator.",
    };
  }

  if (approval !== "approved") {
    return {
      ok: false,
      isPending: true,
      member: found,
      error: "Account is pending approval. You can scan tickets once the admin approves your account.",
    };
  }

  // Valid and approved! Save session
  setStoredScannerId(found.scannerId);
  if (preferredGate) {
    setStoredGate(preferredGate);
  } else if (found.assignedGateId) {
    setStoredGate(found.assignedGateId);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("jatra_scanner_auth_changed"));
  }

  return { ok: true, member: found };
}

function normalizeName(value: string): string {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Digits only, last 10 digits, so "+91 98765 43210" and "9876543210" match. */
function normalizeMobile(value: string): string {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/** Read-only check that blocks re-registration with the same name + mobile. */
type DuplicateLookup =
  | { status: "none" }
  | { status: "unavailable" }
  | { status: "found"; member: SupabaseScannerMember };

async function findDuplicateScannerMember(
  name: string,
  mobile: string,
): Promise<DuplicateLookup> {
  const targetName = normalizeName(name);
  const targetMobile = normalizeMobile(mobile);
  if (!targetName || targetMobile.length < 10) return { status: "none" };

  const { data, error } = await supabase.from("scanner_members").select("*");
  // Fail closed: without a successful lookup we cannot rule out a duplicate.
  if (error || !data) return { status: "unavailable" };

  const member = (data as SupabaseScannerMember[]).find(
    (m) =>
      normalizeMobile(m.mobile) === targetMobile &&
      normalizeName(m.name) === targetName,
  );
  return member ? { status: "found", member } : { status: "none" };
}

/**
 * Registers a new scanner member in Supabase.
 */
export async function registerScannerMember(input: {
  name: string;
  mobile: string;
  email: string;
  address?: string;
  assignedGateId?: string;
  profilePhoto?: string;
}): Promise<{ ok: boolean; scannerId: string; error?: string }> {
  try {
    const lookup = await findDuplicateScannerMember(input.name, input.mobile);
    if (lookup.status === "unavailable") {
      return {
        ok: false,
        scannerId: "",
        error:
          "Could not verify existing scanner accounts. Please check your connection and try again.",
      };
    }
    if (lookup.status === "found") {
      return {
        ok: false,
        scannerId: "",
        error:
          lookup.member.approval_status === "pending"
            ? "A scanner account with this name and mobile number already exists and is awaiting admin approval. Please sign in with your existing Scanner ID or contact the administrator."
            : "A scanner account with this name and mobile number already exists. Please sign in with your existing Scanner ID or contact the administrator.",
      };
    }

    const nowIso = new Date().toISOString();

    // Retry on `SCN-###` collisions (two devices registering at once).
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const nextId = await fetchNextScannerId();
      const rowId =
        globalThis.crypto?.randomUUID?.() ??
        `scn_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      const { member, errorCode, errorMessage } = await insertSupabaseScannerMember({
        id: rowId,
        scanner_id: nextId,
        name: input.name.trim(),
        mobile: input.mobile.trim(),
        email: input.email.trim(),
        address: input.address?.trim() || "",
        assigned_gate_id: input.assignedGateId?.trim() || "Not assigned",
        profile_photo: input.profilePhoto || "",
        approval_status: "pending",
        account_status: "active",
        created_at: nowIso,
        total_scans: 0,
      });

      if (member) {
        return { ok: true, scannerId: nextId };
      }
      if (errorCode !== "23505") {
        return {
          ok: false,
          scannerId: "",
          error: errorMessage || "Could not register scanner account.",
        };
      }
    }

    return {
      ok: false,
      scannerId: "",
      error: "Could not allocate a scanner ID. Please try again.",
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("registerScannerMember failed:", err);
    return { ok: false, scannerId: "", error: message };
  }
}

/**
 * Calculates the next free `SCN-###` id from Supabase.
 */
export async function fetchNextScannerId(): Promise<string> {
  let highest = 0;

  try {
    const sbMembers = await fetchAllSupabaseScannerMembers();
    sbMembers.forEach((m) => {
      const match = String(m.scanner_id || "").match(/(\d+)\s*$/);
      if (match) highest = Math.max(highest, Number(match[1]));
    });
  } catch {
    /* ignore */
  }

  return `SCN-${String(highest + 1).padStart(3, "0")}`;
}

export function nextScannerIdFrom(members: ScannerMember[]): string {
  const highest = members.reduce((max, member) => {
    const match = String(member.scannerId || "").match(/(\d+)\s*$/);
    const value = match ? Number(match[1]) : 0;
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  return `SCN-${String(highest + 1).padStart(3, "0")}`;
}

export function useNextScannerId(): string {
  const [nextId, setNextId] = useState("SCN-001");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const members = await fetchAllSupabaseScannerMembers();
        if (active) setNextId(nextScannerIdFrom(members.map(fromSupabaseMember)));
      } catch {
        /* keep the last known id */
      }
    };

    void load();
    const timer = setInterval(load, 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  return nextId;
}

/**
 * Hook to access the currently authenticated scanner member.
 * Returns null if not logged in.
 */
export function useScannerMember(): {
  member: ScannerMember | null;
  loading: boolean;
  logout: () => void;
} {
  const [member, setMember] = useState<ScannerMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadCurrent = async () => {
      const currentScannerId = getStoredScannerId();
      if (!currentScannerId) {
        if (active) {
          setMember(null);
          setLoading(false);
        }
        return;
      }

      try {
        const sb = await fetchSupabaseScannerMember(currentScannerId);
        if (!active) return;
        if (sb) {
          setMember(fromSupabaseMember(sb));
        }
      } catch {
        /* keep the last known member on transient errors */
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadCurrent();

    const handleAuthChange = () => {
      void loadCurrent();
    };
    window.addEventListener("jatra_scanner_auth_changed", handleAuthChange);

    // Poll so admin approval/deactivation reaches the open scanner session.
    const timer = setInterval(loadCurrent, 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadCurrent();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("jatra_scanner_auth_changed", handleAuthChange);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  const logout = () => {
    clearScannerSession();
    setMember(null);
  };

  return { member, loading, logout };
}

/** Formatting helpers */
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
    member.approvalStatus?.toLowerCase() === "approved" &&
    member.accountStatus?.toLowerCase() === "active"
  );
}

export function gateLabel(member: ScannerMember | null): string {
  const storedGate = getStoredGate();
  if (storedGate && storedGate !== "Not assigned") return storedGate;
  const gate = member?.assignedGateId?.trim();
  return gate ? gate : "Gate 1";
}
