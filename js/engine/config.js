/**
 * Tunable travel and scoring assumptions.
 * Every value here is an assumption to be calibrated — not measured ground truth.
 */

export const CONFIG = Object.freeze({
  /** Road distance ≈ haversine × this factor (winding roads). Assumption to be calibrated. */
  roadFactor: 1.35,
  /** Average overland speed in km/h. Assumption to be calibrated. */
  avgSpeedKmh: 45,
  /** Round-trip cost in BDT per road kilometre. Assumption to be calibrated. */
  costPerKmBdt: 3,
  /** Max one-way travel hours allowed per trip day. Assumption to be calibrated. */
  hoursPerDayLimit: 3.5,
  /** Reject when estCost > budget × this. Assumption to be calibrated. */
  budgetTolerance: 1.15,
  /** Score budget factor stays 1 up to this fraction of budget. Assumption to be calibrated. */
  budgetComfortRatio: 0.8,
  /** Score time factor stays 1 up to this fraction of the hours limit. Assumption to be calibrated. */
  timeComfortRatio: 0.5,
  /** Default scoring weights (re-normalized when overridden). Assumption to be calibrated. */
  defaultWeights: Object.freeze({
    tag: 0.45,
    budget: 0.2,
    time: 0.15,
    season: 0.1,
    offbeat: 0.1,
  }),
  /** Origin city coordinates (WGS84). */
  origins: Object.freeze({
    dhaka: Object.freeze({ lat: 23.81, lng: 90.41 }),
    chattogram: Object.freeze({ lat: 22.36, lng: 91.78 }),
    sylhet: Object.freeze({ lat: 24.9, lng: 91.87 }),
    rajshahi: Object.freeze({ lat: 24.37, lng: 88.6 }),
    khulna: Object.freeze({ lat: 22.82, lng: 89.55 }),
  }),
  /** Machine codes for permit types (numeric values for UI translation). */
  permitCode: Object.freeze({
    none: 0,
    travel_pass: 1,
    permission_required: 2,
  }),
});
