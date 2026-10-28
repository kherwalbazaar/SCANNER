import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

export const supabase = createClient(supabaseUrl, supabaseKey);

export type SupabaseScannerMember = {
  id: string;
  scanner_id: string;
  user_id?: string | null;
  name: string;
  email?: string | null;
  mobile: string;
  profile_photo?: string | null;
  approval_status: "pending" | "approved" | "rejected";
  account_status: "active" | "deactivated";
  assigned_gate_id?: string | null;
  assigned_event_id?: string | null;
  address?: string | null;
  id_proof?: string | null;
  notes?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  total_scans?: number;
  last_scan_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type SupabaseTicketEntry = {
  id?: string;
  entry_key?: string;
  ticket_id: string;
  ticket_number?: string;
  booking_id?: string | null;
  event_id: string;
  scanner_id: string;
  member_id?: string | null;
  scanner_name: string;
  gate_id?: string | null;
  entry_status: "entered" | "rejected";
  scan_result:
    | "SUCCESS"
    | "ALREADY_USED"
    | "INVALID"
    | "CANCELLED"
    | "UNPAID"
    | "WRONG_EVENT"
    | "SCANNER_DENIED";
  scanned_at: string;
  audience_name?: string | null;
  persons?: number | null;
  ticket_type?: string | null;
  seat?: string | null;
  seat_index?: number | null;
  scan_date?: string | null;
  scan_time?: string | null;
  previous_entry_time?: string | null;
  previous_scanner_id?: string | null;
  previous_scanner_name?: string | null;
  previous_gate_id?: string | null;
  booking_source?: string | null;
};

export async function fetchSupabaseScannerMember(
  identifier: string,
): Promise<SupabaseScannerMember | null> {
  if (!identifier) return null;
  const clean = identifier.trim();

  // Try matching scanner_id (case insensitive) or mobile number
  const { data, error } = await supabase
    .from("scanner_members")
    .select("*")
    .or(`scanner_id.ilike.${clean},mobile.eq.${clean}`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

  return data[0] as SupabaseScannerMember;
}

export async function fetchAllSupabaseScannerMembers(): Promise<
  SupabaseScannerMember[]
> {
  const { data, error } = await supabase
    .from("scanner_members")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as SupabaseScannerMember[];
}

export async function insertSupabaseScannerMember(
  member: Partial<SupabaseScannerMember>,
): Promise<{
  member: SupabaseScannerMember | null;
  errorCode?: string;
  errorMessage?: string;
}> {
  const { data, error } = await supabase
    .from("scanner_members")
    .insert([member])
    .select()
    .single();

  if (error) {
    return { member: null, errorCode: error.code, errorMessage: error.message };
  }
  return { member: data as SupabaseScannerMember };
}

export async function updateSupabaseScannerMemberScans(
  scannerId: string,
  nowIso: string,
): Promise<void> {
  try {
    // Increment total_scans and set last_scan_at
    const { data } = await supabase
      .from("scanner_members")
      .select("id, total_scans")
      .eq("scanner_id", scannerId)
      .limit(1);

    if (data && data[0]) {
      const current = Number(data[0].total_scans || 0);
      await supabase
        .from("scanner_members")
        .update({
          total_scans: current + 1,
          last_scan_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", data[0].id);
    }
  } catch (err) {
    console.warn("updateSupabaseScannerMemberScans failed:", err);
  }
}

export async function insertSupabaseTicketEntry(
  entry: SupabaseTicketEntry,
): Promise<boolean> {
  try {
    const { error } = await supabase.from("ticket_entries").insert([entry]);
    if (error) {
      console.warn("insertSupabaseTicketEntry error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("insertSupabaseTicketEntry exception:", err);
    return false;
  }
}

export async function updateSupabaseBookingStatus(
  bookingKey: string,
  ticketNumber: string,
  seatLabel?: string,
  totalSeats: number = 1,
  nowIso: string = new Date().toISOString(),
  scannerName: string = "Scanner",
): Promise<void> {
  try {
    const { data: bData } = await supabase
      .from("bookings")
      .select("*")
      .or(`ticket_number.eq.${bookingKey},id.eq.${bookingKey}`)
      .limit(1);

    if (bData && bData[0]) {
      const bRow = bData[0];
      const existingUsedTickets = (Array.isArray(bRow.used_tickets) ? bRow.used_tickets : []).map(String);
      const nextUsedTickets = Array.from(new Set([...existingUsedTickets, ticketNumber]));
      const existingUsedSeats = (Array.isArray(bRow.used_seats) ? bRow.used_seats : []).map(String);
      const nextUsedSeats = seatLabel ? Array.from(new Set([...existingUsedSeats, seatLabel])) : existingUsedSeats;

      const seatsCount = totalSeats || bRow.quantity || (Array.isArray(bRow.seats) ? bRow.seats.length : 1);
      const isFullyUsed = nextUsedTickets.length >= seatsCount;

      const updatePayload: Record<string, unknown> = {
        used_tickets: nextUsedTickets,
        used_seats: nextUsedSeats,
        used_count: nextUsedTickets.length,
        entered_count: nextUsedTickets.length,
        remaining_count: Math.max(0, seatsCount - nextUsedTickets.length),
        updated_at: nowIso,
      };

      if (isFullyUsed) {
        updatePayload.status = "Checked-in";
        // booking_status stays 'Confirmed' — the reservation never changes.
        updatePayload.used_at = nowIso;
      }

      const { error: updateError } = await supabase
        .from("bookings")
        .update(updatePayload)
        .eq("id", bRow.id);

      if (updateError) {
        console.warn("updateSupabaseBookingStatus error:", updateError.message);
      }
    }
  } catch (err) {
    console.warn("updateSupabaseBookingStatus error:", err);
  }
}
