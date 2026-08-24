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
  FOODS, MONTH_DAYS, PLAN, RECIPES, ROTATION, SWAP_GROUPS, buildPlan, calc, coprimeStride,
  dayConfig, hasFood, mealVideoUrl, parseYouTubeUrl, recipeMacros, recipesForDay,
  youtubeSearchUrl,
  type GoalKey, type PlanConfig, type Profile, type Sex,
} from "../lib/nutrition";
import {
  ADDONS, OPTIONS_PER_SLOT, POOLS, SLOTS, cleanMenuConfig, dayMenu, fitToPerson, monthMenu,
  optionsFor, proteinFloor, strideFor,
} from "../lib/lifestyle";

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

console.log("\n== the lifestyle calendar covers a real month ==");
{
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const ids = new Set<string>();
  for (const slot of SLOTS) {
    const pool = POOLS[slot.k];

    // A stride that shares a factor with the pool closes into a short cycle,
    // and the same fortnight repeats for ever. This is the check that the
    // comment in lifestyle.ts is telling the truth.
    const stride = strideFor(slot.k);
    if (gcd(stride, pool.length) !== 1)
      fail(`${slot.k}: stride ${stride} is not coprime with a pool of ${pool.length} — the walk will repeat`);
    if (stride < OPTIONS_PER_SLOT)
      fail(`${slot.k}: stride ${stride} is below ${OPTIONS_PER_SLOT}, so consecutive days would share a dish`);
    if (pool.length < MONTH_DAYS / 2)
      fail(`${slot.k}: only ${pool.length} dishes for ${MONTH_DAYS} days`);

    for (const d of pool) {
      if (ids.has(d.id)) fail(`duplicate dish id: ${d.id}`);
      ids.add(d.id);
      if (!d.en || !d.hi || !d.serve || !d.serveHi || !d.why) fail(`${d.id}: a field is empty`);
      if (!/[\u0900-\u097F]/.test(d.hi)) fail(`${d.id}: Hindi name "${d.hi}" has no Devanagari in it`);
      if (d.k < 80 || d.k > 600) fail(`${d.id}: ${d.k} kcal is outside anything this app should suggest`);
      // Protein has to be physically possible for the calories claimed.
      if (d.p * 4 > d.k) fail(`${d.id}: ${d.p} g protein cannot fit in ${d.k} kcal`);
      const u = youtubeSearchUrl(d.en, d.hi);
      if (!u.startsWith("https://www.youtube.com/results?search_query=")) fail(`${d.id}: bad video URL`);
    }
  }
  pass(`${ids.size} dishes across ${SLOTS.length} slots, every stride coprime with its pool`);

  // Walk the whole month and prove the properties the UI silently relies on.
  const start = new Date(2026, 0, 1);
  const menu = monthMenu(start, {});
  if (menu.length !== MONTH_DAYS) fail(`month is ${menu.length} days, wanted ${MONTH_DAYS}`);
  let repeats = 0;
  const lows: string[] = [];
  for (let d = 0; d < MONTH_DAYS; d++) {
    for (const slot of SLOTS) {
      const opts = optionsFor(slot.k, d);
      if (new Set(opts.map((o) => o.id)).size !== OPTIONS_PER_SLOT)
        fail(`day ${d} ${slot.k}: the same dish appears twice in one day's options`);
      if (d > 0) {
        const prev = new Set(optionsFor(slot.k, d - 1).map((o) => o.id));
        if (opts.some((o) => prev.has(o.id))) repeats++;
      }
    }
    const day = menu[d];
    if (day.k < 900 || day.k > 1900) lows.push(`day ${d + 1} is ${day.k} kcal`);
    if (day.p < 35) lows.push(`day ${d + 1} has only ${day.p} g protein`);
  }
  if (repeats) fail(`${repeats} slots repeat a dish offered the day before`);
  lows.forEach(fail);
  const ks = menu.map((m) => m.k);
  pass(`${MONTH_DAYS} days walked: ${Math.min(...ks)}–${Math.max(...ks)} kcal, no dish offered two days running`);

  // Every dish must actually come round, or it is dead weight in the file.
  for (const slot of SLOTS) {
    const seen = new Set<string>();
    for (let d = 0; d < POOLS[slot.k].length; d++)
      for (const o of optionsFor(slot.k, d)) seen.add(o.id);
    if (seen.size !== POOLS[slot.k].length)
      fail(`${slot.k}: only ${seen.size} of ${POOLS[slot.k].length} dishes are ever offered`);
  }
  pass("every dish in every pool is reachable");

  // A picked option has to survive the round trip through the sanitiser, and
  // junk has to not.
  const cleaned = cleanMenuConfig({
    picks: { "0:breakfast": 2, "29:dinner": 1, "30:dinner": 1, "3:brunch": 1, "4:lunch": 9, "5:lunch": -1 },
    start: "2026-01-01",
  });
  const keys = Object.keys(cleaned.picks).sort();
  if (keys.join(",") !== "0:breakfast,29:dinner")
    fail(`cleanMenuConfig kept the wrong picks: ${keys.join(",")}`);
  if (cleanMenuConfig({ start: "yesterday" }).start !== "") fail("a junk start date was stored");
  const picked = dayMenu(0, start, { "0:lunch": 2 });
  if (picked.slots[1].chosen.id !== optionsFor("lunch", 0)[2].id) fail("a pick did not select the third option");
  pass("out-of-range days, unknown slots and junk dates are dropped rather than stored");
}

console.log("\n== the light menu is corrected up to the person, not left short ==");
{
  // The menu alone is deliberately light so one calendar serves everybody. What
  // must never happen is a real person being handed it as a whole day when it
  // leaves them hundreds of calories down — that is a crash diet by omission.
  const bodies: [string, number, number][] = [
    // label, TDEE, weight
    ["small sedentary woman", 1500, 48],
    ["average woman", 1850, 60],
    ["average man", 2200, 72],
    ["large active man", 2900, 92],
  ];
  const menu = monthMenu(new Date(2026, 0, 1), {});
  for (const [label, tdee, wt] of bodies) {
    for (const day of menu) {
      const fit = fitToPerson(day.k, day.p, tdee, wt, day.day);
      const finalK = day.k + fit.adds.reduce((s, a) => s + a.addon.k * a.n, 0);
      const finalP = day.p + fit.adds.reduce((s, a) => s + a.addon.p * a.n, 0);
      if (finalK < tdee - 260)
        fail(`${label}, day ${day.day + 1}: still ${tdee - finalK} kcal short after the additions`);
      if (finalK > tdee + 260)
        fail(`${label}, day ${day.day + 1}: the additions overshoot to ${finalK} against ${tdee}`);
      // Nobody is ever told to eat below the floor that keeps muscle on.
      if (finalP < proteinFloor(wt) - 12)
        fail(`${label}, day ${day.day + 1}: ${finalP} g protein against a ${proteinFloor(wt)} g floor`);
      if (fit.verdict === "short" && !fit.note.includes("lighter than you burn"))
        fail(`${label}: a short day did not say so`);
    }
  }
  pass(`${bodies.length} body types x ${menu.length} days: every day lands within 260 kcal of maintenance once corrected`);

  // The corrections must vary too, or the printed week says "milk" thirty times.
  const shapes = new Set(
    menu.map((day) =>
      fitToPerson(day.k, day.p, 2200, 72, day.day).adds
        .map((a) => `${a.addon.one}x${a.n}`).sort().join("+"))
  );
  if (shapes.size < 4) fail(`only ${shapes.size} different sets of additions across the month`);
  pass(`${shapes.size} different combinations of additions across ${menu.length} days`);

  // A day that is already enough must not be padded.
  const tiny = fitToPerson(1400, 60, 1450, 45);
  if (tiny.adds.length) fail("a day that already fits was padded anyway");
  if (tiny.verdict !== "right") fail(`a day that fits was called "${tiny.verdict}"`);
  // And one that is too big must say so rather than adding more.
  const big = fitToPerson(2100, 80, 1500, 50);
  if (big.verdict !== "over" || big.adds.length) fail("an over-target day was not flagged");
  for (const a of ADDONS) {
    if (a.k < 30 || a.k > 300) fail(`addon ${a.one}: ${a.k} kcal is not a household serving`);
    if (a.p * 4 > a.k) fail(`addon ${a.one}: ${a.p} g protein cannot fit in ${a.k} kcal`);
    if (!/[\u0900-\u097F]/.test(a.hi)) fail(`addon ${a.one}: no Hindi`);
    if (!a.many || a.many === a.one) fail(`addon ${a.one}: no plural form`);
  }
  pass(`${ADDONS.length} additions are real household servings; a day that fits is left alone`);
}

console.log("\n== the 30-day fitness schedule varies without drifting ==");
{
  const who: Profile = {
    id: "m", name: "M", sex: "m", age: 30, ht: 174, wt: 72, act: "1.55", goal: "lean",
    waist: 84, hip: null, pattern: "central", build: "balanced",
  };
  const c = calc(who);
  let worstK = 0, worstP = 0;
  const breakfasts: string[] = [];
  const t0 = Date.now();
  for (let d = 0; d < MONTH_DAYS; d++) {
    const built = buildPlan(c.target, c.protein, c.fatG, c.carbG, dayConfig(d, { variants: {}, swaps: {} }));
    worstK = Math.max(worstK, Math.abs(built.tot.k - c.target));
    worstP = Math.max(worstP, Math.abs(built.tot.p - c.protein));
    breakfasts.push(built.meals[1].name);
    if (recipesForDay(d).length !== 3) fail(`day ${d}: wrong number of recipe cards`);
    for (const id of recipesForDay(d))
      if (!RECIPES.some((r) => r.id === id)) fail(`day ${d}: unknown recipe ${id}`);
  }
  const ms = Date.now() - t0;
  // Thirty days must not all be the same breakfast, and must not repeat daily.
  const distinct = new Set(breakfasts).size;
  if (distinct < 3) fail(`only ${distinct} distinct breakfasts across the month`);
  for (let d = 1; d < breakfasts.length; d++)
    if (breakfasts[d] === breakfasts[d - 1]) fail(`day ${d}: same breakfast as the day before`);
  if (worstK > 60) fail(`a day in the month missed its calorie target by ${Math.round(worstK)}`);
  pass(`${MONTH_DAYS} days built in ${ms} ms — ${distinct} distinct breakfasts, worst miss ${Math.round(worstK)} kcal / ${Math.round(worstP)} g protein`);

  // A pinned meal must stay pinned for the whole month.
  const pinned = PLAN[1]!.tag;
  for (let d = 0; d < MONTH_DAYS; d++)
    if (dayConfig(d, { variants: { [pinned]: 2 }, swaps: {} }).variants?.[pinned] !== 2)
      fail(`day ${d}: a pinned meal option was rotated away`);
  pass("a meal you pin stays pinned on all 30 days");

  // The stride helper is the load-bearing piece; check it directly.
  for (let len = 1; len <= 8; len++)
    for (let want = 1; want <= 10; want++) {
      const s = coprimeStride(len, want);
      const seen = new Set<number>();
      for (let i = 0; i < len; i++) seen.add((i * s) % len);
      if (seen.size !== len) fail(`coprimeStride(${len}, ${want}) = ${s} visits only ${seen.size}/${len}`);
    }
  pass("coprimeStride walks every option for every option count");

  // The video chip must appear on cookable meals and stay off assemblies.
  let cookable = 0, assemblies = 0;
  for (const m of PLAN)
    for (let i = 0; i < m.options.length; i++) {
      const built = buildPlan(c.target, c.protein, c.fatG, c.carbG, { variants: { [m.tag]: i }, swaps: {} });
      const meal = built.meals.find((x) => x.tag === m.tag)!;
      const url = mealVideoUrl(meal);
      if (url) {
        cookable++;
        if (!url.startsWith("https://www.youtube.com/results?search_query=")) fail(`${meal.name}: bad video URL`);
      } else {
        assemblies++;
        // Anything with a cooked dish or a grain in it must have got a link.
        if (meal.items.some((it) => it.food.cat === "dish" || it.food.cat === "grain"))
          fail(`${meal.name}: has something to cook but offers no video`);
      }
    }
  if (cookable < 15) fail(`only ${cookable} meal options offer a recipe video`);
  pass(`${cookable} meal options link to a recipe video, ${assemblies} correctly offer none`);
}

console.log("\n== YouTube links are parsed, not trusted ==");
const WATCH = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const urlCases: [string, string | null][] = [
  ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", WATCH],
  ["https://youtu.be/dQw4w9WgXcQ", WATCH],
  ["youtube.com/watch?v=dQw4w9WgXcQ", WATCH],
  ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", WATCH],
  ["https://www.youtube.com/shorts/dQw4w9WgXcQ", WATCH],
  ["https://www.youtube.com/embed/dQw4w9WgXcQ", WATCH],
  // tracking junk from a share sheet must be stripped, not stored
  ["https://youtu.be/dQw4w9WgXcQ?si=AbCdEf123456", WATCH],
  ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&index=4", WATCH],
  // a timestamp is meaningful, so it survives
  ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90s", WATCH + "&t=90s"],
  // and everything that is not a YouTube video is refused
  ["https://vimeo.com/12345", null],
  ["https://example.com/watch?v=dQw4w9WgXcQ", null],
  ["javascript:alert(1)", null],
  ["not a url at all", null],
  ["", null],
  ["https://www.youtube.com/watch?v=short", null],
];
for (const [input, want] of urlCases) {
  const got = parseYouTubeUrl(input);
  if (got !== want) fail(`parseYouTubeUrl(${JSON.stringify(input)}) gave ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);
}
// every shipped recipe must produce a usable search link
for (const r of RECIPES) {
  const u = youtubeSearchUrl(r.en, r.hi);
  if (!u.startsWith("https://www.youtube.com/results?search_query=") || u.length < 50)
    fail(`${r.en}: bad search URL ${u}`);
}
pass(`${urlCases.length} URL forms parsed correctly, ${RECIPES.length} recipe search links built`);

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
