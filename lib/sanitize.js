// Sanitization: transform a raw Walmart freight tender into a clean SHV SOR load.
//
// The Walmart Freight Tender API and the SHV SOR Integration API disagree on
// several formats. The SOR docs explicitly reject the raw Walmart values, so
// every field below is normalized to exactly what the SOR expects:
//
//   * dates    Walmart sends MMDDYYYY; the SOR requires DDMMYYYY (day first).
//   * weight   Walmart sends "41,860 lbs" (string); the SOR requires a bare
//              JSON number (no commas, no units).
//   * mode     Walmart sends a temperature/mode code (e.g. "AMBIENT",
//              "FROZEN"); the SOR requires exactly "Reefer 53'" or "Dry Van 53'".
//   * strings  the SOR rejects leading/trailing whitespace and caps length at
//              200 chars.
//
// NOTE: Per Part 2 of the assignment, mode and weight *limits* from Part 1 are
// disregarded — we fetch and load ALL records, we do not filter any out.

const MAX_STR = 200;

/** Trim and clamp a string field to the SOR's 200-char limit. */
function cleanStr(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim().slice(0, MAX_STR);
}

/**
 * Convert a Walmart MMDDYYYY date string into the SOR's DDMMYYYY format.
 * "07152026" (Jul 15 2026) -> "15072026".
 * Returns the digits-only best effort; validation happens downstream.
 */
export function toDDMMYYYY(mmddyyyy) {
  const digits = String(mmddyyyy ?? "").replace(/\D/g, "");
  if (digits.length !== 8) return digits; // let the SOR report a clear error
  const mm = digits.slice(0, 2);
  const dd = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  return `${dd}${mm}${yyyy}`;
}

/**
 * Parse a Walmart weight display string into whole pounds as a number.
 * "41,860 lbs" -> 41860. null / unparseable -> 0.
 */
export function parseWeight(wgt) {
  if (wgt === null || wgt === undefined) return 0;
  const digits = String(wgt).replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

/**
 * Map a Walmart transport-mode / temperature code to an SOR equipment type.
 * Per the SME walkthrough:
 *   Refrigerated OR Freezer  -> "Reefer 53'"
 *   Ambient (room temp)      -> "Dry Van 53'"
 * Only clear cold-chain indicators map to Reefer; everything else (ambient /
 * dry / unknown) defaults to Dry Van, so an ambient load is never mislabeled.
 */
export function toEquipmentType(mode) {
  const m = String(mode ?? "").toLowerCase();
  const reefer = /reefer|refriger|freez|frozen|chill|cold|fresh|produce/;
  return reefer.test(m) ? "Reefer 53'" : "Dry Van 53'";
}

/**
 * Transform one raw Walmart tender into an SOR-ready load object.
 * Returns { load, sourceLoadNo } — `load` is the payload for the SOR POST.
 */
export function sanitizeTender(tender) {
  return {
    load_number: cleanStr(tender.load_no),
    bol_number: cleanStr(tender.frt_ord_no),
    shipper_name: cleanStr(tender.shipper_nm),
    origin_city: cleanStr(tender.orig_city),
    origin_state: cleanStr(tender.orig_st),
    destination_city: cleanStr(tender.dest_city),
    destination_state: cleanStr(tender.dest_st),
    ship_date: toDDMMYYYY(tender.shp_dt),
    delivery_date: toDDMMYYYY(tender.del_dt),
    weight: parseWeight(tender.wgt),
    equipment_type: toEquipmentType(tender.mode),
  };
}

/** Sanitize an array of raw tenders into SOR-ready loads. */
export function sanitizeAll(tenders) {
  return (tenders || []).map(sanitizeTender);
}
