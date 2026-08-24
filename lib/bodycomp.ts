/**
 * Body composition and fat distribution.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 * ----------------------------------
 * It does not assign anyone a somatotype and hand them a macro ratio. The
 * ectomorph / mesomorph / endomorph scheme comes from William Sheldon's 1940s
 * constitutional psychology and has never been shown to predict what anyone
 * should eat. The strongest direct test is DIETFITS (Gardner et al., JAMA 2018,
 * n = 609, 12 months): neither genotype pattern (p = 0.20) nor baseline insulin
 * secretion (p = 0.47) predicted whether someone did better on a low-fat or a
 * low-carbohydrate diet. Personalising macro *ratios* by body type is not
 * supported.
 *
 * WHAT IT DOES INSTEAD
 * --------------------
 * Fat distribution is real, measurable with a tape, and changes the numbers in
 * two defensible ways:
 *
 *   1. Protein is prescribed per kg of LEAN mass rather than total weight.
 *      Fat tissue has almost no protein requirement, so g/kg-bodyweight
 *      systematically overshoots for anyone carrying more fat.
 *   2. Waist-to-height ratio and waist circumference drive a risk read and the
 *      goal advice — not the macro split.
 *
 * Everything here is an estimate from a tape measure. Estimates are labelled as
 * such wherever they surface in the UI.
 */

import type { Sex } from "./nutrition";

/* ------------------------------------------------------------ measurements */

export interface Measurements {
  /** Narrowest point between the lowest rib and the top of the hip bone, cm. */
  waist?: number | null;
  /** Widest point around the buttocks, cm. Optional — only used for the ratio. */
  hip?: number | null;
}

/** Where a person carries fat. Observed, not inferred from a physique archetype. */
export type FatPattern = "central" | "lower" | "even" | "thinfat" | "unset";

/**
 * Self-reported build. Kept because how easily someone gains is a usable proxy
 * for their non-exercise activity and appetite — both of which really do move
 * energy balance. It nudges the size of the starting surplus by ±5% and nothing
 * else, and two weeks of weigh-ins overrule it. It is NOT a somatotype and it
 * never touches the macro split.
 */
export type BuildType = "hardgainer" | "balanced" | "gains-fat" | "unset";

export const FAT_PATTERNS: { v: FatPattern; label: string; blurb: string }[] = [
  { v: "central", label: "Mostly around the belly",
    blurb: "Waist as wide as or wider than hips. The apple or android pattern — the one that carries the most metabolic risk, and the most common pattern in Indian men." },
  { v: "lower", label: "Hips and thighs",
    blurb: "Hips clearly wider than waist. The pear or gynoid pattern. At the same body-fat percentage this carries meaningfully less metabolic risk than belly fat." },
  { v: "even", label: "Spread fairly evenly",
    blurb: "No strong pattern either way — arms, legs and midsection roughly in proportion." },
  { v: "thinfat", label: "Slim, but soft around the middle",
    blurb: "Normal weight on the scale, low muscle, soft midsection. Known as thin-fat or TOFI, and easy to miss because BMI looks fine. Especially common in South Asians." },
];

export const BUILD_TYPES: { v: BuildType; label: string; blurb: string }[] = [
  { v: "hardgainer", label: "Struggle to gain weight",
    blurb: "Weight has stayed flat for years even when eating more. Usually means high non-exercise activity and a quick-filling appetite. Starts you with a slightly larger surplus." },
  { v: "balanced", label: "Gain and lose fairly easily",
    blurb: "Weight responds predictably when you change how much you eat. Standard surplus." },
  { v: "gains-fat", label: "Put on fat easily",
    blurb: "Weight climbs quickly when eating relaxes. Starts you with a slightly smaller surplus so more of the gain is muscle." },
];

/* ------------------------------------------------------------- estimators */

/**
 * Relative Fat Mass — body fat % from height and waist alone.
 * Woolcott & Bergman, Scientific Reports 2018. Validated against DXA in NHANES:
 * R² 0.75 in men and 0.69 in women, against 0.61 and 0.65 for BMI, and it
 * misclassifies far less often in women (12.7% vs 56.5%).
 *
 * Both measurements in the SAME unit; the ratio is what matters.
 */
export function relativeFatMass(sex: Sex, heightCm: number, waistCm: number): number | null {
  if (!(heightCm > 0) || !(waistCm > 0)) return null;
  const bf = 64 - 20 * (heightCm / waistCm) + (sex === "f" ? 12 : 0);
  // Outside this range the equation is extrapolating past its validation data.
  if (bf < 3 || bf > 70) return null;
  return Math.round(bf * 10) / 10;
}

export const leanMass = (weightKg: number, bodyFatPct: number): number =>
  Math.round(weightKg * (1 - bodyFatPct / 100) * 10) / 10;

/**
 * Katch-McArdle BMR, which works from lean mass rather than total weight and so
 * does not penalise a muscular person or flatter a soft one. Shown alongside
 * Mifflin-St Jeor as a cross-check — see the note in calc() for why Mifflin
 * still drives the calorie target.
 */
export const katchMcArdle = (lbmKg: number): number => Math.round(370 + 21.6 * lbmKg);

export const waistToHeight = (waistCm: number, heightCm: number): number =>
  Math.round((waistCm / heightCm) * 1000) / 1000;

export const waistToHip = (waistCm: number, hipCm: number): number =>
  Math.round((waistCm / hipCm) * 100) / 100;

/* ----------------------------------------------------------- classification */

export type RiskBand = "healthy" | "increased" | "high";

/**
 * NICE NG246 waist-to-height bands. Valid for both sexes and all ethnicities at
 * BMI under 35; above that, NICE says stop using it. The public version of the
 * advice is simply "keep your waist under half your height".
 */
export function whtrBand(whtr: number): RiskBand {
  if (whtr < 0.5) return "healthy";
  if (whtr < 0.6) return "increased";
  return "high";
}

export const WHTR_LABEL: Record<RiskBand, string> = {
  healthy: "Healthy central adiposity",
  increased: "Increased central adiposity",
  high: "High central adiposity",
};

/**
 * Asian Indian BMI bands from the 2025 revised national definition (Kalra et al.,
 * Journal of Clinical & Experimental Endocrinology / JAPI). These sit well below
 * the WHO international cutoffs because South Asians carry more fat, and more of
 * it viscerally, at any given BMI — see THIN_FAT below.
 */
export interface BmiBand { label: string; risk: RiskBand; from: number; to: number | null }
export const INDIAN_BMI_BANDS: BmiBand[] = [
  { label: "Underweight",             risk: "increased", from: 0,    to: 18.5 },
  { label: "Normal",                  risk: "healthy",   from: 18.5, to: 23 },
  { label: "Grade I — overweight",    risk: "increased", from: 23,   to: 25 },
  { label: "Grade II",                risk: "increased", from: 25,   to: 27.6 },
  { label: "Grade III",               risk: "high",      from: 27.6, to: 32.5 },
  { label: "Grade IV — obesity",      risk: "high",      from: 32.5, to: null },
];

export function indianBmiBand(bmi: number): BmiBand {
  return INDIAN_BMI_BANDS.find((b) => bmi >= b.from && (b.to === null || bmi < b.to))
    ?? INDIAN_BMI_BANDS[1];
}

/** Abdominal obesity cutoffs for Asian Indians: 90 cm men, 80 cm women. */
export const waistCutoff = (sex: Sex): number => (sex === "f" ? 80 : 90);
export const waistFlagged = (sex: Sex, waistCm: number): boolean => waistCm >= waistCutoff(sex);

export const THIN_FAT =
  "At an identical BMI of 22.3, a study of two doctors — one Indian, one European — measured 21.2% body fat against 9.1%. South Asians store less fat subcutaneously, so the surplus overflows into the viscera, liver and pancreas. That is why the Indian cutoffs are lower, and why the tape around your waist tells you more than the number on the scale.";

/* ------------------------------------------------------------ the full read */

export interface BodyRead {
  bodyFat: number | null;
  lbm: number | null;
  kmBmr: number | null;
  whtr: number | null;
  whtrBand: RiskBand | null;
  whr: number | null;
  bmi: number;
  bmiBand: BmiBand;
  waistFlag: boolean | null;
  /** Pattern the person selected, or one inferred from waist-to-hip if they didn't. */
  pattern: FatPattern;
  patternInferred: boolean;
  /** Plain-language headline for the panel. */
  headline: string;
  /** The one thing most worth acting on. */
  advice: string;
}

export function readBody(
  sex: Sex, heightCm: number, weightKg: number,
  m: Measurements, declaredPattern: FatPattern = "unset"
): BodyRead {
  const bmi = weightKg / Math.pow(heightCm / 100, 2);
  const band = indianBmiBand(bmi);
  const waist = m.waist && m.waist > 0 ? m.waist : null;
  const hip = m.hip && m.hip > 0 ? m.hip : null;

  const bodyFat = waist ? relativeFatMass(sex, heightCm, waist) : null;
  const lbm = bodyFat !== null ? leanMass(weightKg, bodyFat) : null;
  const kmBmr = lbm !== null ? katchMcArdle(lbm) : null;
  const whtr = waist ? waistToHeight(waist, heightCm) : null;
  const whr = waist && hip ? waistToHip(waist, hip) : null;

  // If they gave a waist and a hip but didn't pick a pattern, the tape answers it.
  let pattern = declaredPattern;
  let patternInferred = false;
  if (pattern === "unset" && whr !== null) {
    const central = sex === "f" ? whr >= 0.85 : whr >= 0.9;
    pattern = central ? "central" : whr <= (sex === "f" ? 0.75 : 0.85) ? "lower" : "even";
    patternInferred = true;
  }

  const wBand = whtr !== null ? whtrBand(whtr) : null;
  const flag = waist !== null ? waistFlagged(sex, waist) : null;

  let headline: string;
  let advice: string;

  if (whtr === null) {
    headline = `BMI ${bmi.toFixed(1)} — ${band.label.toLowerCase()} on the Indian scale`;
    advice = "Add a waist measurement and this panel gets far more useful. Waist-to-height ratio predicts metabolic risk better than BMI, and it lets the app estimate your lean mass and set protein from that instead of total weight.";
  } else if (wBand === "healthy" && !flag) {
    headline = `Waist is ${(whtr * 100).toFixed(0)}% of your height — inside the healthy band`;
    advice = "Central adiposity is not a concern at this measurement. Keep the tape under half your height as you gain, and re-measure monthly rather than weekly.";
  } else if (wBand === "high") {
    headline = `Waist is ${(whtr * 100).toFixed(0)}% of your height — high central adiposity`;
    advice = "This is the fat distribution that carries real metabolic risk, and a bulk will add to it. Losing fat first, then building, is the better order — and worth a conversation with a doctor before you change anything, since this band is associated with insulin resistance.";
  } else {
    headline = `Waist is ${(whtr * 100).toFixed(0)}% of your height — increased central adiposity`;
    advice = flag
      ? `Your waist is at or past the ${waistCutoff(sex)} cm Asian Indian threshold for abdominal obesity. A surplus will land disproportionately here. Consider recomposition — training hard at maintenance calories — before a bulk.`
      : "Just over the halfway line. Not alarming, but worth watching the tape as much as the scale while you gain.";
  }

  if (pattern === "thinfat") {
    advice = `Thin-fat is exactly the pattern BMI misses — the scale looks fine while body fat sits high and muscle sits low. ${
      bodyFat !== null ? `Your estimate is ${bodyFat}% body fat at BMI ${bmi.toFixed(1)}. ` : ""
    }The fix is resistance training and protein, not a smaller calorie number. Recomposition, not a cut.`;
  }

  return { bodyFat, lbm, kmBmr, whtr, whtrBand: wBand, whr, bmi, bmiBand: band,
           waistFlag: flag, pattern, patternInferred, headline, advice };
}

/**
 * Protein target, per kg of LEAN mass when we can estimate it.
 *
 * Fat tissue is metabolically almost protein-free, so the usual g/kg-bodyweight
 * figures overshoot badly for anyone carrying more fat — an 88 kg person at 32%
 * body fat gets 211 g/day at 2.4 g/kg bodyweight, which no vegetarian day can
 * deliver. Against lean mass the same person gets 156 g, which is both
 * achievable and better supported: Helms et al. put the requirement at
 * 2.3–3.1 g/kg fat-free mass for lean athletes in a deficit, and the ISSN
 * position stand at 1.4–2.0 g/kg bodyweight generally.
 *
 * Falls back to bodyweight-based figures when no waist measurement exists.
 */
export function proteinTarget(
  goalDir: number, weightKg: number, lbm: number | null
): { grams: number; basis: "lean" | "bodyweight"; perKg: number } {
  if (lbm !== null && lbm > 0) {
    // deficit needs the most, surplus the least — muscle is being spared vs built
    const perKg = goalDir < 0 ? 2.6 : goalDir > 0 ? 2.2 : 2.0;
    // Floor and ceiling expressed against TOTAL bodyweight. At very high body
    // fat the lean-mass figure can dip under the 1.2 g/kg-bodyweight minimum
    // that the obesity literature uses for preserving lean tissue, and at very
    // low body fat it can drift past any sensible ceiling. Both are rare; the
    // guards exist so neither extreme produces a number nobody should follow.
    const grams = Math.min(
      Math.max(Math.round(lbm * perKg), Math.round(weightKg * 1.2)),
      Math.round(weightKg * 2.6)
    );
    return { grams, basis: "lean", perKg };
  }
  const perKg = goalDir < 0 ? 2.2 : goalDir > 0 ? 2.0 : 1.8;
  return { grams: Math.round(weightKg * perKg), basis: "bodyweight", perKg };
}

/**
 * Build type nudges only the size of the surplus, by ±5% of maintenance, and
 * only when gaining. Someone who has genuinely never gained weight is usually
 * burning more through fidgeting and walking than any formula credits; someone
 * who gains easily is usually the reverse. The weekly weigh-in overrules this
 * within a fortnight either way.
 */
export function buildAdjustment(build: BuildType, goalDir: number): number {
  if (goalDir <= 0 || build === "unset") return 0;
  if (build === "hardgainer") return 0.05;
  if (build === "gains-fat") return -0.05;
  return 0;
}
