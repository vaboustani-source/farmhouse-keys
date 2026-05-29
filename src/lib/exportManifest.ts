import type { LbBooking, LbEvent, LbRoomSection } from "@/integrations/supabase/client";

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting booking",
  deposit_paid: "Deposit paid",
  paid: "Paid in full",
  covered: "Covered by another guest",
  payment_failed: "Payment failed",
  refunded: "Refunded",
};

const PAYMENT_STATUS_SORT: Record<string, number> = {
  paid: 0,
  deposit_paid: 1,
  covered: 2,
  pending: 3,
  payment_failed: 4,
  refunded: 5,
};

const PAYMENT_SCHEDULE_LABEL: Record<string, string> = {
  full: "Full payment",
  full_upfront: "Full payment",
  deposit_50_balance_50: "50/50 split",
  split_50_50: "50/50 split",
};

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(cells: Array<string | number | null | undefined>, columns: number): string {
  const padded = [...cells];
  while (padded.length < columns) padded.push("");
  return padded.map(escapeCsv).join(",");
}

function formatMoney(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatBookedAt(iso: string | null | undefined, status: string): string {
  if (!iso || status === "pending") return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${date} at ${time}`;
}

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function todayStamp(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function triggerDownload(content: string, filename: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type BookingWithExtras = LbBooking & {
  payment_schedule?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
  address_country?: string | null;
};

function formatAddress(b: BookingWithExtras): string {
  const parts = [
    b.address_line1,
    b.address_line2,
    b.address_city,
    [b.address_state, b.address_zip].filter(Boolean).join(" ").trim(),
    b.address_country,
  ]
    .map((p) => (p ?? "").toString().trim())
    .filter(Boolean);
  return parts.join(", ");
}

function amountPaid(b: BookingWithExtras): string {
  const total = Number(b.total_amount) || 0;
  switch (b.payment_status) {
    case "paid":
      return formatMoney(total);
    case "deposit_paid":
      return formatMoney(total / 2);
    case "refunded": {
      const r = Number(b.refund_amount) || 0;
      return `($${r.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
    }
    default:
      return "$0.00";
  }
}

function balanceDue(b: BookingWithExtras): string {
  const total = Number(b.total_amount) || 0;
  switch (b.payment_status) {
    case "deposit_paid":
      return formatMoney(total / 2);
    case "pending":
      return formatMoney(total);
    case "paid":
    case "covered":
    case "refunded":
    default:
      return "$0.00";
  }
}

export function exportGuestManifest(
  event: LbEvent,
  sections: LbRoomSection[],
  bookings: LbBooking[],
) {
  const COLUMNS = 15;
  const sectionsById = new Map(sections.map((s) => [s.id, s]));

  const eligible = (bookings as BookingWithExtras[]).filter(
    (b) => !b.removed && b.payment_status !== "refunded",
  );

  eligible.sort((a, b) => {
    const sa = sectionsById.get(a.section_id)?.section_name ?? "";
    const sb = sectionsById.get(b.section_id)?.section_name ?? "";
    if (sa !== sb) return sa.localeCompare(sb);
    const pa = PAYMENT_STATUS_SORT[a.payment_status] ?? 99;
    const pb = PAYMENT_STATUS_SORT[b.payment_status] ?? 99;
    if (pa !== pb) return pa - pb;
    return (a.guest_name ?? "").localeCompare(b.guest_name ?? "");
  });

  const header = [
    "Section",
    "Guest Name",
    "Guest Email",
    "Guest Phone",
    "Address",
    "Payment Status",
    "Payment Schedule",
    "Total Amount",
    "Amount Paid",
    "Balance Due",
    "Cot Requested",
    "Add-ons",
    "Booked At",
    "Room Assignment",
    "Internal Notes",
  ];

  const lines: string[] = [csvRow(header, COLUMNS)];

  // Group by section
  const groups = new Map<string, BookingWithExtras[]>();
  for (const b of eligible) {
    const name = sectionsById.get(b.section_id)?.section_name ?? "Unknown Section";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name)!.push(b);
  }
  const sortedGroups = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  for (const [sectionName, rows] of sortedGroups) {
    lines.push(csvRow([sectionName.toUpperCase()], COLUMNS));
    for (const b of rows) {
      const addons = Array.isArray(b.addons_selected)
        ? (b.addons_selected as Array<{ name?: string }>).map((a) => a?.name).filter(Boolean).join(", ")
        : "";
      const total = Number(b.total_amount) || 0;
      lines.push(
        csvRow(
          [
            sectionName,
            b.guest_name ?? "",
            b.guest_email ?? "",
            b.guest_phone ?? "",
            formatAddress(b),
            PAYMENT_STATUS_LABEL[b.payment_status] ?? b.payment_status,
            PAYMENT_SCHEDULE_LABEL[b.payment_schedule ?? ""] ?? "",
            total > 0 ? formatMoney(total) : "",
            amountPaid(b),
            balanceDue(b),
            b.cot_requested ? "Yes" : "No",
            addons,
            formatBookedAt(b.booked_at, b.payment_status),
            b.room_assignment ?? "",
            b.refund_notes ?? "",
          ],
          COLUMNS,
        ),
      );
    }
    lines.push(csvRow([], COLUMNS));
  }

  // Summary
  const counts = {
    paid: 0,
    deposit_paid: 0,
    pending: 0,
    covered: 0,
    payment_failed: 0,
    refunded: 0,
  } as Record<string, number>;
  let totalCollected = 0;
  let totalOutstanding = 0;
  let cotRequests = 0;
  for (const b of eligible) {
    counts[b.payment_status] = (counts[b.payment_status] ?? 0) + 1;
    const total = Number(b.total_amount) || 0;
    if (b.payment_status === "paid") totalCollected += total;
    else if (b.payment_status === "deposit_paid") {
      totalCollected += total / 2;
      totalOutstanding += total / 2;
    } else if (b.payment_status === "pending") totalOutstanding += total;
    if (b.cot_requested) cotRequests += 1;
  }
  // Include refunded bookings count from full set
  const refundedCount = (bookings as BookingWithExtras[]).filter(
    (b) => !b.removed && b.payment_status === "refunded",
  ).length;

  lines.push(csvRow([], COLUMNS));
  lines.push(csvRow([], COLUMNS));
  lines.push(csvRow(["SUMMARY"], COLUMNS));
  lines.push(csvRow(["Total guests", eligible.length], COLUMNS));
  lines.push(csvRow(["Paid in full", counts.paid ?? 0], COLUMNS));
  lines.push(csvRow(["Deposit paid", counts.deposit_paid ?? 0], COLUMNS));
  lines.push(csvRow(["Awaiting booking", counts.pending ?? 0], COLUMNS));
  lines.push(csvRow(["Covered", counts.covered ?? 0], COLUMNS));
  lines.push(csvRow(["Payment failed", counts.payment_failed ?? 0], COLUMNS));
  lines.push(csvRow(["Refunded", refundedCount], COLUMNS));
  lines.push(csvRow(["Total collected", formatMoney(totalCollected)], COLUMNS));
  lines.push(csvRow(["Total outstanding", formatMoney(totalOutstanding)], COLUMNS));
  lines.push(csvRow(["Cot requests", cotRequests], COLUMNS));

  const filename = `${slugifyName(event.wedding_name || event.couple_names || "event")}-guest-manifest-${todayStamp()}.csv`;
  triggerDownload(lines.join("\r\n"), filename);
}

export function exportRoomAssignments(
  event: LbEvent,
  sections: LbRoomSection[],
  bookings: LbBooking[],
) {
  const sectionsById = new Map(sections.map((s) => [s.id, s]));
  const eligible = (bookings as BookingWithExtras[]).filter(
    (b) => !b.removed && b.payment_status !== "refunded",
  );

  const rows = eligible.map((b) => ({
    room: b.room_assignment?.trim() || "Unassigned",
    section: sectionsById.get(b.section_id)?.section_name ?? "",
    guest: b.guest_name ?? "",
    cot: b.cot_requested ? "Yes" : "No",
    status: PAYMENT_STATUS_LABEL[b.payment_status] ?? b.payment_status,
    notes: b.refund_notes ?? "",
  }));

  rows.sort((a, b) => {
    if (a.section !== b.section) return a.section.localeCompare(b.section);
    return a.room.localeCompare(b.room);
  });

  const header = ["Room Name", "Section", "Guest Name", "Cot", "Payment Status", "Notes"];
  const lines = [header.map(escapeCsv).join(",")];
  for (const r of rows) {
    lines.push([r.room, r.section, r.guest, r.cot, r.status, r.notes].map(escapeCsv).join(","));
  }

  const filename = `${slugifyName(event.wedding_name || event.couple_names || "event")}-room-assignments-${todayStamp()}.csv`;
  triggerDownload(lines.join("\r\n"), filename);
}