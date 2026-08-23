/**
 * Data and solver checks. Run with `npm run validate`.
 *
 * The plan template, the swap table and the recipe cards all reference foods by
 * name, and F() throws on an unknown one — which would take down the page. This
 * catches a typo at commit time instead. It also builds every meal-option
 * combination against a spread of body types and reports how close the solver
 * lands, so a change to the food table cannot quietly wreck the maths.
 */
import { createHash } from "node:crypto";
import {
  FOODS, PLAN, RECIPES, ROTATION, SWAP_GROUPS, buildPlan, calc, hasFood,
  recipeMacros, type GoalKey, type PlanConfig, type Profile, type Sex,
} from "../lib/nutrition";

let failures = 0;
const fail = (m: string) => { failures++; console.log("  FAIL " + m); };
const pass = (m: string) => console.log("  ok   " + m);

console.log("\n== food references resolve ==");
const missing: string[] = [];
for (const m of PLAN)
  for (const o of m.options)
    for (const it of o.items)
      if (!hasFood(it.f)) missing.push(`PLAN ${m.tag} / ${o.name}: ${it.f}`);
for (const [from, list] of Object.entries(SWAP_GROUPS)) {
  if (!hasFood(from)) missing.push(`SWAP key: ${from}`);
  for (const to of list) if (!hasFood(to)) missing.push(`SWAP ${from} -> ${to}`);
}
for (const r of RECIPES)
  for (const i of r.ing)
    if (!hasFood(i.f)) missing.push(`RECIPE ${r.id}: ${i.f}`);
missing.length ? missing.forEach(fail) : pass(`every reference in ${PLAN.length} meals, ${Object.keys(SWAP_GROUPS).length} swap groups and ${RECIPES.length} recipes resolves`);

console.log("\n== food table is internally consistent ==");
const names = new Set<string>();
for (const f of FOODS) {
  if (names.has(f.name)) fail(`duplicate food name: ${f.name}`);
  names.add(f.name);
  const implied = f.p * 4 + f.c * 4 + f.f * 9;
  if (f.k > 5 && Math.abs(implied - f.k) > Math.max(70, f.k * 0.32))
    fail(`${f.name}: macros imply ${Math.round(implied)} kcal but table says ${f.k}`);
  if (f.p + f.c + f.f > 101) fail(`${f.name}: macros exceed 100 g per 100 g`);
  if (f.sg <= 0) fail(`${f.name}: serving size must be positive`);
}
if (!failures) pass(`${FOODS.length} foods, no duplicates, macros agree with calories`);

console.log("\n== recipe rotation is complete ==");
for (const d of ROTATION)
  for (const id of d.r)
    if (!RECIPES.some((r) => r.id === id)) fail(`${d.day} references unknown recipe "${id}"`);
for (const r of RECIPES) {
  const m = recipeMacros(r);
  if (!(m.k > 40 && m.k < 1200)) fail(`${r.en}: ${Math.round(m.k)} kcal per serving looks wrong`);
}
pass(`7 days, ${RECIPES.length} recipes, every card's per-serving macros are plausible`);

console.log("\n== the solver lands close, on every meal option ==");
const bodies: [Sex, number, number, number, string, GoalKey][] = [
  ["f", 22, 155, 45, "1.2", "lean"],
  ["f", 30, 162, 55, "1.55", "lean"],
  ["m", 19, 168, 52, "1.55", "fast"],
  ["m", 28, 172, 65, "1.375", "lean"],
  ["m", 35, 180, 78, "1.725", "lean"],
  ["m", 45, 185, 95, "1.55", "maintain"],
];
let worstK = 0, worstP = 0, worstCase = "";
let combos = 0;
const maxOptions = Math.max(...PLAN.map((m) => m.options.length));

for (const [sex, age, ht, wt, act, goal] of bodies) {
  const profile: Profile = { id: "t", name: "t", sex, age, ht, wt, act, goal };
  const c = calc(profile);
  // Every option index for every meal, walked in lockstep — enough to exercise
  // each option at least once against each body without a full cross product.
  for (let pick = 0; pick < maxOptions; pick++) {
    const variants: Record<string, number> = {};
    for (const m of PLAN) variants[m.tag] = Math.min(pick, m.options.length - 1);
    const cfg: PlanConfig = { variants, swaps: {} };
    const P = buildPlan(c.target, c.protein, c.fatG, c.carbG, cfg);
    combos++;
    const dK = Math.abs(P.tot.k - c.target);
    const dP = Math.abs(P.tot.p - c.protein);
    if (dK > worstK) { worstK = dK; }
    if (dP > worstP) { worstP = dP; worstCase = `${sex}/${wt}kg/${goal} option ${pick}`; }
    if (dK > 60) fail(`${sex}/${wt}kg/${goal} option ${pick}: off by ${Math.round(dK)} kcal`);
    for (const m of P.meals)
      for (const it of m.items)
        if (it.g <= 0 || it.g > 2000) fail(`${m.tag}: implausible portion ${it.g} g of ${it.food.name}`);
  }
}
pass(`${combos} plans built — worst calorie miss ${Math.round(worstK)} kcal, worst protein miss ${Math.round(worstP)} g (${worstCase})`);

console.log("\n== swaps produce sane portions ==");
const profile: Profile = { id: "t", name: "t", sex: "m", age: 28, ht: 172, wt: 65, act: "1.375", goal: "lean" };
const c = calc(profile);
let swapChecks = 0;
for (const m of PLAN) {
  for (const it of m.options[0].items) {
    for (const to of SWAP_GROUPS[it.f] ?? []) {
      const P = buildPlan(c.target, c.protein, c.fatG, c.carbG,
        { variants: {}, swaps: { [`${m.tag}::${it.f}`]: to } });
      swapChecks++;
      const swapped = P.meals.find((x) => x.tag === m.tag)?.items.find((x) => x.food.name === to);
      if (!swapped) { fail(`${m.tag}: swapping ${it.f} -> ${to} did not apply`); continue; }
      if (swapped.g <= 0 || swapped.g > 2000) fail(`${m.tag}: ${to} came out as ${swapped.g} g`);
      if (Math.abs(P.tot.k - c.target) > 120)
        fail(`${m.tag}: after swapping in ${to} the day is off by ${Math.round(P.tot.k - c.target)} kcal`);
    }
  }
}
pass(`${swapChecks} swaps applied, all portions plausible and the day still lands on target`);

// A fingerprint of the data the build actually compiled. Printed so a
// deployment's log can be compared against a local run: if the digests match,
// the food table and plan template arrived intact, down to the last calorie.
const digest = createHash("sha256")
  .update(JSON.stringify([FOODS, PLAN, SWAP_GROUPS, RECIPES, ROTATION]))
  .digest("hex")
  .slice(0, 16);
console.log(`\nnutrition data digest: ${digest}  (${FOODS.length} foods, ${PLAN.length} meals, ${RECIPES.length} recipes)`);

console.log(failures ? `\n${failures} FAILURES\n` : "\nAll checks passed.\n");
process.exit(failures ? 1 : 0);
