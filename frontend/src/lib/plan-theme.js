/**
 * EverGro eMart — 8-Level Compensation Plan (single source of truth)
 * All landing, compensation-plan, and admin displays MUST import from here.
 * Colors are hand-picked for AA contrast on both dark (#064E3B) and light (#FAFAF9) backgrounds.
 */

export const LEVEL_COLORS = {
  1: "#84CC16", // lime — brand primary
  2: "#22D3EE", // cyan
  3: "#60A5FA", // blue
  4: "#A78BFA", // violet
  5: "#F59E0B", // amber
  6: "#EF4444", // red
  7: "#0EA5E9", // sky
  8: "#FBBF24", // amber-yellow (readable on dark & light)
};

/** Full 8-level income table matching the infographic. */
export const INCOME_LEVELS = [
  { l: 1, per: 1200, members: 6,       total: 7200 },
  { l: 2, per: 400,  members: 36,      total: 14400 },
  { l: 3, per: 50,   members: 216,     total: 10800 },
  { l: 4, per: 300,  members: 1296,    total: 388800 },
  { l: 5, per: 50,   members: 7776,    total: 388800 },
  { l: 6, per: 200,  members: 46656,   total: 9331200 },
  { l: 7, per: 50,   members: 279936,  total: 13996800 },
  { l: 8, per: 100,  members: 1679616, total: 167961600 },
].map((r) => ({ ...r, color: LEVEL_COLORS[r.l] }));

export const TOTAL_POTENTIAL = 203699600; // ₹20,36,99,600
export const TOTAL_POTENTIAL_WORDS = "Twenty Crore Thirty Six Lakh Ninety Nine Thousand Six Hundred";

export const KIT_PRICE = 7200;
export const MAX_DIRECT_REFS = 6;
export const MIN_PAID_DIRECTS_FOR_INCOME = 3;

/**
 * Official infographic (downloadable JPEG). Admin can override via site settings later
 * by setting settings.compensation_infographic_url.
 */
export const COMPENSATION_INFOGRAPHIC_URL =
  "https://customer-assets.emergentagent.com/job_hamper-mlm-hub/artifacts/c6s9zlxp_WhatsApp%20Image%202026-06-23%20at%207.25.42%20PM%20%281%29.jpeg";
