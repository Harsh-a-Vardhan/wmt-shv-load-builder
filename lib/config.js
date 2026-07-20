// Central configuration for the Walmart -> SHV load builder.
//
// Per the assignment, the account email is used as the bearer token for BOTH
// the Walmart Freight Tender API and the SHV SOR Integration API, and must be
// hardcoded as an input in the web app. The UI seeds its email input from this
// value; the server API routes also fall back to it.
export const ACCOUNT_EMAIL = "imharsh9@gmail.com";

// Walmart Freight Tender API (read-only, open tenders).
export const WMT_LOADS_URL = "https://wmt-freight-portal.vercel.app/api/sap/loads";

// SHV Logistics SOR Integration API (create/upsert loads).
export const SHV_LOADS_URL = "https://shv-logistics-tms.vercel.app/api/sor/loads";

// SHV accepts up to 50 loads per POST; batch accordingly.
export const SHV_MAX_BATCH = 50;
