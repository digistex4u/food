/**
 * The nutrition engine. Pure, dependency-free and shared by the server and the
 * browser: the same functions that draw the plan on screen also validate what
 * the API writes to Postgres.
 *
 * Food values are from the Indian Food Composition Tables (IFCT 2017) and USDA
 * FoodData Central, per 100 g, rounded to one decimal.
 */

export type GoalKey = "lean" | "fast" | "maintain" | "recomp" | "cut";
export type Sex = "m" | "f";

export interface Goal { pct: number; label: string; pk: number; fatPct: number; dir: number }
export interface Nutrients { k: number; p: number; c: number; f: number }
export interface Macro { k: number; p: number; c: number; f: number }

/** [name, category, kcal, protein, carbs, fat, servingGrams, servingLabel, note] per 100 g */
type RawRow = [string, string, number, number, number, number, number, string, string];

export interface Food extends Macro {
  id: number; name: string; cat: string;
  /** grams in one standard household serving */
  sg: number;
  /** label for that serving, e.g. "1 katori (150 g)" */
  sl: string;
  note: string;
}

export interface Profile {
  id: string; name: string; sex: Sex;
  age: number; ht: number; wt: number;
  /** activity multiplier, as a string so it round-trips through <select> */
  act: string;
  goal: GoalKey;
}

export interface Calc {
  bmr: number; tdee: number; target: number;
  protein: number; fatG: number; carbG: number;
  bmi: number; g: Goal; wkLo: number; wkHi: number; surplus: number;
}

export interface Mechanism {
  t: string; b: string; eqn?: string;
  split?: [string, string, string, string][];
}

export interface PlanItemTemplate {
  f: string; g: number; step: number;
  u?: string; pcg?: number; s?: boolean;
}
export interface PlanOption { name: string; items: PlanItemTemplate[] }
export interface PlanMealTemplate {
  time: string; tag: string; options: PlanOption[];
}

/**
 * A person's deviations from the default day. Stored per profile as JSON.
 * `variants` picks which option each meal uses; `swaps` replaces one food
 * inside a meal, keyed "<meal tag>::<original food>".
 */
export interface PlanConfig {
  variants?: Record<string, number>;
  swaps?: Record<string, string>;
}
export interface PlanItem {
  food: Food; g: number; u?: string; pcg?: number;
  step: number; fixed: boolean; lo: number; hi: number;
  /** Set when this item replaced a default — the name it stands in for. */
  swappedFrom?: string;
  /** The item's key inside its meal, stable across swaps, used to store swaps. */
  slot: string;
  /** Filled in by buildPlan's final pass, once the portion has settled. */
  n: Nutrients;
}
export interface PlanMeal {
  time: string; tag: string; name: string;
  /** Which option is selected, and what the others are called. */
  variantIndex: number; optionNames: string[];
  items: PlanItem[]; tot: Nutrients;
}
export interface BuiltPlan {
  meals: PlanMeal[]; tot: Nutrients; factor: number; base: number;
}
interface Move { it: PlanItem; g: number; old?: number }

export interface RecipeIngredient { f: string; g: number; hh: string; hhHi: string }
export interface Recipe {
  id: string; en: string; hi: string; meal: string; mins: number; serves: number;
  ing: RecipeIngredient[];
  /** [englishName, hindiName, quantityEn, quantityHi] — spices, negligible calories */
  extras: [string, string, string, string][];
  /** [englishStep, hindiStep] */
  steps: [string, string][];
}
export interface RotationDay { day: string; hi: string; r: string[] }

/* ---------------------------------------------------------------- food database */
export const CATS: Record<string, string> = {
  grain: "Grains & flours", dal: "Dals & legumes", dairy: "Dairy", soya: "Soya & protein",
  nut: "Nuts, seeds & fats", veg: "Vegetables", fruit: "Fruit", dish: "Cooked dishes",
  drink: "Drinks", sweet: "Sugars",
};

const RAW: RawRow[] = [
// --- GRAINS & FLOURS (raw unless stated) ---
["Wheat flour (atta)","grain",341,12.1,71.2,1.7,40,"1 roti's worth (40 g)","raw"],
["Chapati / roti, plain","grain",264,8.4,50.6,3.0,40,"1 medium roti (40 g)","cooked, no ghee"],
["Rice, white, cooked","grain",130,2.7,28.2,0.3,150,"1 katori (150 g)","cooked"],
["Rice, white, raw","grain",345,6.8,78.2,0.5,60,"1 katori cooked = 60 g raw","raw"],
["Rice, brown, cooked","grain",123,2.7,25.6,1.0,150,"1 katori (150 g)","cooked"],
["Poha (flattened rice)","grain",346,6.6,77.3,1.2,60,"1 plate = 60 g raw","raw"],
["Suji / rava","grain",348,10.4,74.8,0.8,50,"1 bowl upma = 50 g raw","raw"],
["Oats, rolled","grain",389,16.9,66.3,6.9,50,"1 scoop (50 g)","raw"],
["Dalia (broken wheat)","grain",342,12.0,71.0,1.5,50,"1 bowl = 50 g raw","raw"],
["Besan (gram flour)","grain",387,22.0,57.8,6.7,40,"1 chilla (40 g)","raw"],
["Bajra flour","grain",361,11.6,67.5,5.0,40,"1 roti (40 g)","raw"],
["Sattu (roasted gram flour)","grain",413,20.6,61.0,6.0,40,"1 glass = 40 g","raw"],
["Ragi flour","grain",328,7.3,72.0,1.3,40,"1 roti (40 g)","raw"],
["Bread, white","grain",265,9.0,49.0,3.2,25,"1 slice (25 g)",""],
["Bread, brown / multigrain","grain",250,10.5,44.0,3.5,30,"1 slice (30 g)",""],
["Maida (refined flour)","grain",348,11.0,73.9,0.9,30,"30 g","raw"],

// --- DALS & LEGUMES (raw weights) ---
["Toor / arhar dal","dal",343,22.3,62.0,1.7,30,"1 katori cooked = 30 g raw","raw"],
["Moong dal (yellow)","dal",348,24.5,59.0,1.2,30,"1 katori cooked = 30 g raw","raw"],
["Moong, whole green","dal",334,24.0,56.7,1.2,30,"1 katori cooked = 30 g raw","raw"],
["Masoor dal","dal",343,25.1,59.0,1.1,30,"1 katori cooked = 30 g raw","raw"],
["Chana dal","dal",360,22.0,60.0,5.3,30,"1 katori cooked = 30 g raw","raw"],
["Urad dal","dal",341,25.2,58.9,1.6,30,"1 katori cooked = 30 g raw","raw"],
["Rajma (kidney beans)","dal",333,22.9,60.0,1.3,40,"1 katori cooked = 40 g raw","raw"],
["Kabuli chana (chickpeas)","dal",364,19.0,61.0,6.0,40,"1 katori cooked = 40 g raw","raw"],
["Kala chana","dal",360,20.5,61.0,5.3,40,"1 katori cooked = 40 g raw","raw"],
["Roasted chana (bhuna)","dal",364,22.5,58.0,5.2,30,"1 fistful (30 g)","ready to eat"],
["Sprouted moong","dal",100,7.6,17.0,0.5,100,"1 katori (100 g)","sprouted"],
["Lobia / black-eyed peas","dal",343,23.5,60.0,1.5,40,"1 katori cooked = 40 g raw","raw"],

// --- DAIRY ---
["Milk, buffalo, full fat","dairy",97,3.8,5.0,6.5,250,"1 glass (250 ml)",""],
["Milk, cow, full cream","dairy",62,3.2,4.7,3.3,250,"1 glass (250 ml)",""],
["Milk, toned","dairy",58,3.1,4.9,3.0,250,"1 glass (250 ml)",""],
["Milk, double toned","dairy",44,3.3,4.9,1.5,250,"1 glass (250 ml)",""],
["Paneer, full fat","dairy",296,18.3,1.2,25.0,100,"1 slab (100 g)",""],
["Paneer, low fat","dairy",205,24.0,4.0,10.0,100,"1 slab (100 g)",""],
["Curd (dahi), full fat","dairy",60,3.1,4.7,3.3,150,"1 katori (150 g)",""],
["Curd, low fat","dairy",50,3.5,4.9,1.7,150,"1 katori (150 g)",""],
["Hung curd / Greek yoghurt","dairy",97,9.0,4.0,5.0,150,"1 katori (150 g)",""],
["Ghee","dairy",900,0,0,100,5,"1 tsp (5 g)",""],
["Butter","dairy",717,0.9,0.1,81,10,"1 tbsp (10 g)",""],
["Cheese, processed","dairy",350,22.0,2.0,28.0,20,"1 slice (20 g)",""],
["Khoya / mawa","dairy",421,14.6,20.5,31.2,50,"50 g",""],
["Buttermilk (chaas)","dairy",30,1.6,3.4,1.0,200,"1 glass (200 ml)",""],

// --- SOYA & SUPPLEMENTS ---
["Soya chunks / nutrela, dry","soya",345,52.0,33.0,0.5,30,"1 katori cooked = 30 g dry","raw"],
["Soya granules, dry","soya",350,52.0,32.0,0.5,30,"30 g dry","raw"],
["Tofu","soya",76,8.0,1.9,4.8,100,"100 g",""],
["Soya milk, unsweetened","soya",43,3.3,1.8,2.0,250,"1 glass (250 ml)",""],
["Whey protein isolate","soya",370,80.0,7.0,3.0,30,"1 scoop (30 g)","supplement"],
["Whey protein concentrate","soya",400,75.0,10.0,6.0,30,"1 scoop (30 g)","supplement"],
["Plant protein powder","soya",380,72.0,10.0,5.0,30,"1 scoop (30 g)","supplement"],

// --- NUTS, SEEDS & FATS ---
["Almonds","nut",579,21.2,21.6,49.9,15,"12 pieces (15 g)",""],
["Peanuts","nut",567,25.8,16.1,49.2,25,"1 fistful (25 g)",""],
["Peanut butter","nut",588,25.1,20.0,50.0,15,"1 tbsp (15 g)",""],
["Cashew","nut",553,18.2,30.2,43.9,15,"10 pieces (15 g)",""],
["Walnut","nut",654,15.2,13.7,65.2,15,"4 halves (15 g)",""],
["Pistachio","nut",560,20.2,27.2,45.3,15,"15 g",""],
["Chia seeds","nut",486,16.5,42.1,30.7,10,"1 tbsp (10 g)",""],
["Flax seeds","nut",534,18.3,28.9,42.2,10,"1 tbsp (10 g)",""],
["Sesame (til)","nut",573,17.7,23.4,49.7,10,"1 tbsp (10 g)",""],
["Makhana (fox nuts)","nut",347,9.7,77.0,0.1,25,"1 bowl (25 g)",""],
["Pumpkin seeds","nut",559,30.2,10.7,49.1,15,"15 g",""],
["Coconut, fresh","nut",354,3.3,15.2,33.5,30,"30 g",""],
["Mustard / sunflower oil","nut",884,0,0,100,14,"1 tbsp (14 g)",""],
["Cooking oil, 1 tsp","nut",884,0,0,100,5,"1 tsp (5 g)",""],

// --- VEGETABLES (raw) ---
["Potato, boiled","veg",87,2.0,20.1,0.1,150,"1 medium (150 g)",""],
["Sweet potato, boiled","veg",86,1.6,20.1,0.1,150,"1 medium (150 g)",""],
["Palak (spinach)","veg",23,2.9,3.6,0.4,100,"1 bunch cooked (100 g)","raw"],
["Methi (fenugreek leaves)","veg",49,4.4,6.0,0.9,100,"100 g","raw"],
["Bhindi (okra)","veg",33,1.9,7.5,0.2,150,"1 katori (150 g)","raw"],
["Gobhi (cauliflower)","veg",25,1.9,5.0,0.3,150,"1 katori (150 g)","raw"],
["Baingan (brinjal)","veg",25,1.0,5.9,0.2,150,"1 katori (150 g)","raw"],
["Lauki (bottle gourd)","veg",14,0.6,3.4,0.1,150,"1 katori (150 g)","raw"],
["Gajar (carrot)","veg",41,0.9,9.6,0.2,100,"1 medium (100 g)","raw"],
["Matar (green peas)","veg",81,5.4,14.5,0.4,100,"1 katori (100 g)","raw"],
["Tamatar (tomato)","veg",18,0.9,3.9,0.2,100,"1 medium (100 g)","raw"],
["Pyaaz (onion)","veg",40,1.1,9.3,0.1,80,"1 medium (80 g)","raw"],
["Shimla mirch (capsicum)","veg",27,1.0,6.0,0.2,100,"1 medium (100 g)","raw"],
["Mushroom","veg",22,3.1,3.3,0.3,100,"100 g","raw"],
["Kheera (cucumber)","veg",15,0.7,3.6,0.1,100,"100 g","raw"],

// --- FRUIT ---
["Banana","fruit",89,1.1,22.8,0.3,120,"1 medium (120 g)",""],
["Mango","fruit",60,0.8,15.0,0.4,200,"1 medium (200 g)",""],
["Apple","fruit",52,0.3,13.8,0.2,150,"1 medium (150 g)",""],
["Papaya","fruit",43,0.5,10.8,0.3,150,"1 katori (150 g)",""],
["Dates (khajur)","fruit",277,1.8,75.0,0.2,8,"1 piece (8 g)",""],
["Raisins (kishmish)","fruit",299,3.1,79.2,0.5,15,"1 tbsp (15 g)",""],
["Orange","fruit",47,0.9,11.8,0.1,150,"1 medium (150 g)",""],
["Guava (amrood)","fruit",68,2.6,14.3,0.9,150,"1 medium (150 g)",""],

// --- COOKED DISHES (as typically made at home, oil included) ---
["Dal tadka, cooked","dish",115,5.8,15.0,3.5,150,"1 katori (150 g)","with tadka"],
["Rajma curry, cooked","dish",127,5.7,17.5,3.6,150,"1 katori (150 g)",""],
["Chole, cooked","dish",140,6.3,18.0,4.8,150,"1 katori (150 g)",""],
["Sambar","dish",73,3.4,9.5,2.3,150,"1 katori (150 g)",""],
["Paneer bhurji","dish",227,14.6,4.5,17.0,150,"1 katori (150 g)",""],
["Palak paneer","dish",180,10.0,6.0,13.0,150,"1 katori (150 g)",""],
["Mixed veg sabzi","dish",80,2.2,9.0,4.2,150,"1 katori (150 g)","2 tsp oil"],
["Aloo sabzi","dish",118,2.0,17.0,4.8,150,"1 katori (150 g)",""],
["Soya keema","dish",158,17.5,10.0,5.5,150,"1 katori (150 g)",""],
["Khichdi","dish",110,4.2,18.0,2.4,200,"1 plate (200 g)",""],
["Curd rice","dish",110,3.2,17.0,3.2,200,"1 katori (200 g)",""],
["Idli","dish",116,3.9,24.0,0.7,50,"1 idli (50 g)",""],
["Dosa, plain","dish",210,4.9,36.0,4.6,80,"1 dosa (80 g)",""],
["Upma","dish",167,3.9,25.0,5.6,150,"1 katori (150 g)",""],
["Poha, cooked","dish",135,2.6,24.0,3.4,200,"1 plate (200 g)",""],
["Paratha, plain","dish",300,6.4,42.0,11.4,70,"1 paratha (70 g)",""],
["Aloo paratha","dish",240,5.0,33.0,9.6,120,"1 paratha (120 g)",""],
["Besan chilla","dish",180,9.5,20.0,7.0,90,"1 chilla (90 g)",""],
["Moong dal chilla","dish",165,10.5,19.0,5.5,90,"1 chilla (90 g)",""],
["Veg pulao","dish",145,3.4,24.0,4.0,200,"1 plate (200 g)",""],
["Banana milkshake","dish",107,3.3,15.5,3.3,300,"1 glass (300 ml)","milk + banana"],
["Sweet lassi","dish",95,2.4,14.0,3.2,250,"1 glass (250 ml)",""],
["Dal makhani","dish",187,6.5,15.0,11.0,150,"1 katori (150 g)","rich"],
["Paneer sandwich","dish",243,11.5,24.0,11.0,160,"1 sandwich (160 g)",""],
["Tofu bhurji","dish",118,8.4,4.0,7.6,150,"1 katori (150 g)",""],
["Vegetable raita","dish",65,3.0,5.4,3.2,150,"1 katori (150 g)",""],

// --- DRINKS ---
["Masala chai (milk, sugar)","drink",55,1.5,8.0,1.8,150,"1 cup (150 ml)",""],
["Filter coffee (milk, sugar)","drink",60,1.7,8.5,2.0,150,"1 cup (150 ml)",""],
["Black coffee, no sugar","drink",2,0.2,0.3,0,200,"1 mug (200 ml)",""],
["Green tea","drink",1,0,0.2,0,200,"1 cup (200 ml)",""],
["Nimbu paani (lemon, sugar)","drink",30,0.1,7.6,0,250,"1 glass (250 ml)",""],
["Coconut water","drink",19,0.7,3.7,0.2,250,"1 glass (250 ml)",""],
["Sattu drink (with jaggery)","drink",120,5.5,20.0,1.8,250,"1 glass (250 ml)",""],

// --- SUGARS ---
["Sugar","sweet",400,0,100,0,5,"1 tsp (5 g)",""],
["Jaggery (gur)","sweet",383,0.4,98.0,0.1,10,"1 piece (10 g)",""],
["Honey","sweet",304,0.3,82.4,0,15,"1 tbsp (15 g)",""]
];

export const FOODS: Food[] = RAW.map((r, i) => ({
  id:i, name:r[0], cat:r[1],
  k:r[2], p:r[3], c:r[4], f:r[5],
  sg:r[6], sl:r[7], note:r[8]
}));
const byName: Record<string, Food> = {};
FOODS.forEach((f) => { byName[f.name] = f; });
export function hasFood(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(byName, name);
}

export function F(name: string): Food {
  const x = byName[name];
  if (!x) throw new Error("Unknown food referenced in a plan or recipe: " + name);
  return x;
}

/* ------------------------------------------------------------- body mechanics */
export const MECH: Mechanism[] = [
{t:"Energy balance is the only switch",
 b:`Your body cannot create mass out of nothing. Every gram of new muscle is built from material you swallowed and paid for with energy you swallowed. If energy in equals energy out, your weight holds. If energy in is less, your body dismantles stored tissue — fat first if you are training and eating protein, muscle too if you are not. If energy in is more, the excess is available for construction.
 <br><br>This is why <strong>a bulk requires a surplus and there is no way around it.</strong> "Eating clean" without eating more will not add muscle. The surplus is the raw material; training is only the instruction telling the body where to put it.`,
 eqn:"Δ tissue  =  (energy in)  −  (BMR + TEF + NEAT + EAT)"},

{t:"Where your calories actually go",
 b:`"Energy out" is not one number, it is four, and only one of them is exercise. Understanding the split is what stops people from wildly over-estimating how much their gym session burns.`,
 split:[
  ["60–70%","BMR","Basal metabolic rate","Heart, brain, kidneys, liver, breathing, cell repair. What you burn lying still. Mostly set by your lean mass."],
  ["8–12%","TEF","Thermic effect of food","The cost of digesting. Protein costs 20–30% of its own calories to process; carbs 5–10%; fat 0–3%. High-protein diets quietly burn more."],
  ["15–30%","NEAT","Non-exercise activity","Walking, fidgeting, standing, gestures. The most variable number in the equation — it can differ by 2,000 kcal between two people of the same size."],
  ["5–10%","EAT","Exercise activity","Your actual workout. An hour of hard lifting is roughly 300 kcal — one paratha. This is why you cannot out-train a bad diet."]
 ]},

{t:"Muscle is a balance, not an accumulation",
 b:`Muscle protein is constantly being built (synthesis) and constantly being torn down (breakdown). You are replacing roughly 1–2% of your muscle protein <em>every day</em>. Growth is not "adding" — it is running synthesis slightly ahead of breakdown, repeatedly, for months.
 <br><br>Resistance training raises synthesis for about <strong>24–48 hours</strong> after a session. Protein raises it for about <strong>3–5 hours</strong> per feeding. Neither alone is enough: training without protein raises synthesis you have no bricks for; protein without training raises synthesis with no address to send it to. <strong>The overlap is where muscle happens</strong>, which is the entire argument for training each muscle twice a week and eating protein four times a day rather than once.`,
 eqn:"net growth  =  Σ(synthesis)  −  Σ(breakdown)   ·   over weeks, not days"},

{t:"The leucine threshold — why four meals beat one",
 b:`Muscle protein synthesis is not switched on gradually by protein. It is triggered by one amino acid — <strong>leucine</strong> — crossing a threshold of roughly <strong>2.5–3 g in a single meal</strong>. Below the threshold, little happens. Above it, you get a full response; well above it, you get no extra response, and the surplus amino acids are burned for energy or stored.
 <br><br>That makes protein a <em>per-meal</em> problem, not a daily-total problem. 120 g of protein eaten as one enormous dinner triggers one response. The same 120 g split across four meals of 30 g triggers four. For a vegetarian this matters more than for anyone else, because plant proteins carry less leucine per gram — you need a slightly bigger portion to cross the same line.`,
 eqn:"≈ 30–40 g protein  ×  4 meals  ≫  120 g  ×  1 meal"},

{t:"Vegetarian protein: the quality problem, and the fix",
 b:`Protein is scored by how well its amino acid profile matches human requirements — the DIAAS scale. Dairy and soya score near 1.0, meaning almost fully usable. Most dals score 0.6–0.7 and most cereals 0.4–0.5, because each is missing a different amino acid: <strong>dals are short on methionine, cereals are short on lysine.</strong>
 <br><br>The fix is the meal your grandmother already made. <strong>Dal with roti, rajma with rice, idli with sambar</strong> — cereal plus legume in the same meal covers both gaps, and the combination scores far higher than either half. You do not need to combine at every meal, only across the day, but Indian meals happen to do it automatically.
 <br><br>Practical ranking for a vegetarian bulk: <strong>whey and paneer</strong> (complete, dense, cheap per gram of protein) → <strong>soya chunks</strong> (52 g protein per 100 g, the single most efficient food on this list) → <strong>curd and milk</strong> → <strong>dals with cereals</strong> → nuts and seeds last, because they are fat calories that happen to contain protein.`},

{t:"Your target is 1.6–2.2 g protein per kg — and no more",
 b:`The dose-response curve for protein and muscle gain flattens hard at about <strong>1.6 g per kg of bodyweight</strong>, and is essentially flat by <strong>2.2 g/kg</strong>. Above that, extra protein does nothing for muscle; it is simply expensive fuel.
 <br><br>This app sets you toward the upper half of that range for two reasons: you are in a surplus (higher protein biases the surplus toward lean tissue rather than fat), and you are vegetarian (lower average protein quality, so a slightly larger dose delivers the same usable amino acids). If your kidneys are healthy, this range is well-established as safe.`,
 eqn:"protein target  =  bodyweight(kg)  ×  2.0 g   ·   split across 4–5 feedings"},

{t:"Training is the instruction — mechanical tension is the signal",
 b:`Muscle grows in response to <strong>mechanical tension</strong>: force generated by a muscle under stretch, taken close to failure, repeated. Not soreness, not sweat, not burn. The signal is tension, and the way you keep the signal coming is <strong>progressive overload</strong> — every week, slightly more weight, or more reps at the same weight, or better range of motion.
 <br><br>A beginner needs surprisingly little: <strong>2–4 sessions a week, 10–20 hard sets per muscle group per week, 5–30 reps per set, the last 1–3 reps genuinely difficult.</strong> Compound lifts first — squat, deadlift or hip hinge, a press, a row, a pull-down — because they load the most muscle per unit of time and progress most reliably.
 <br><br>Without this, the surplus has nowhere to go. <strong>Eating in a surplus while not training does not build muscle. It builds fat, and that is the entire mechanism.</strong>`},

{t:"How fast it can actually go",
 b:`This is where most bulks fail — not from too little food, but from too much, chasing a rate the body cannot use. Muscle accrual has a ceiling set by biology, and calories beyond that ceiling become fat with almost perfect efficiency.
 <br><br>A realistic natural ceiling: <strong>0.25–0.5% of bodyweight per week</strong> for a beginner, roughly half that in year two, and a quarter of it after that. For a 70 kg beginner that is <strong>175–350 g per week</strong> — a number so small your bathroom scale will struggle to distinguish it from yesterday's water. Which is why you weigh daily and read the <em>weekly average</em>, never a single morning.
 <br><br>Beginners also have an advantage that expires: <strong>nutrient partitioning</strong> is best in the first year, so a larger share of the surplus goes to muscle rather than fat. Do not waste it with a sloppy surplus.`,
 eqn:"weekly gain  =  bodyweight(kg) × 0.0025 to 0.005   ·   weigh daily, average weekly"},

{t:"The vegetarian bulker's real enemy: volume",
 b:`The problem with a vegetarian bulk is almost never protein. It is <strong>satiety</strong>. Dals, sabzis, salads and whole grains are high in fibre and water, which means they fill your stomach long before they fill your calorie target. People fail this diet holding a fork, not a supplement tub.
 <br><br>Four levers that fix it, in order of effectiveness: <strong>(1) Drink calories.</strong> A milk-banana-peanut-butter shake is 400 kcal that takes ninety seconds and no stomach space. <strong>(2) Add fat, not bulk.</strong> One tablespoon of ghee or oil is 120 kcal and occupies no volume — this is what ghee on roti was always for. <strong>(3) Cut the raw salad volume</strong> at your two biggest meals; eat it at the smallest. <strong>(4) Eat more often</strong> — six smaller feedings beat three large ones you cannot finish.
 <br><br>And sleep. <strong>7–9 hours.</strong> Growth hormone pulses during deep sleep, testosterone is largely produced overnight, and one week of 5-hour nights measurably shifts weight gain away from muscle and toward fat. Sleep is not a lifestyle tip here; it is part of the mechanism.`}
];

/* ----------------------------------------------------------- bulk plan template */
/**
 * The day, as a set of options rather than one fixed menu.
 *
 * Each of the seven feedings offers three or four Indian alternatives. Option
 * zero is the default; the numbers below are *base* quantities for a ~3,100 kcal
 * day, which buildPlan then scales and solves against the eater's real target,
 * so switching an option never breaks the maths.
 */
export const PLAN: PlanMealTemplate[] = [
{time:"06:30", tag:"On waking", options:[
  {name:"Milk, nuts and dates", items:[
    {f:"Milk, cow, full cream", g:250, step:25, u:"ml"},
    {f:"Almonds", g:15, step:5},
    {f:"Dates (khajur)", g:16, step:8, u:"pc", pcg:8}]},
  {name:"Masala chai and roasted chana", items:[
    {f:"Masala chai (milk, sugar)", g:200, step:50, u:"ml"},
    {f:"Roasted chana (bhuna)", g:35, step:10},
    {f:"Peanuts", g:20, step:5}]},
  {name:"Filter coffee and banana", items:[
    {f:"Filter coffee (milk, sugar)", g:200, step:50, u:"ml"},
    {f:"Banana", g:120, step:60, u:"pc", pcg:120},
    {f:"Almonds", g:15, step:5}]},
  {name:"Sattu sharbat", items:[
    {f:"Sattu drink (with jaggery)", g:300, step:50, u:"ml"},
    {f:"Peanuts", g:20, step:5}]},
]},

{time:"08:30", tag:"Breakfast", options:[
  {name:"Oats cooked in milk", items:[
    {f:"Oats, rolled", g:80, step:10},
    {f:"Milk, cow, full cream", g:200, step:25, u:"ml"},
    {f:"Banana", g:120, step:60, u:"pc", pcg:120},
    {f:"Peanut butter", g:15, step:5}]},
  {name:"Poha with peanuts", items:[
    {f:"Poha, cooked", g:250, step:50, u:"plate", pcg:200},
    {f:"Peanuts", g:25, step:5},
    {f:"Milk, cow, full cream", g:200, step:25, u:"ml"},
    {f:"Banana", g:120, step:60, u:"pc", pcg:120}]},
  {name:"Besan chilla with curd", items:[
    {f:"Besan chilla", g:180, step:45, u:"chilla", pcg:90},
    {f:"Curd (dahi), full fat", g:150, step:25},
    {f:"Banana", g:120, step:60, u:"pc", pcg:120},
    {f:"Milk, cow, full cream", g:150, step:25, u:"ml"}]},
  {name:"Idli and sambar", items:[
    {f:"Idli", g:200, step:50, u:"idli", pcg:50},
    {f:"Sambar", g:200, step:50, u:"katori", pcg:150},
    {f:"Milk, cow, full cream", g:200, step:25, u:"ml"},
    {f:"Peanuts", g:20, step:5}]},
  {name:"Dalia khichdi", items:[
    {f:"Dalia (broken wheat)", g:70, step:10},
    {f:"Moong dal (yellow)", g:25, step:5},
    {f:"Ghee", g:10, step:5, u:"tsp", pcg:5},
    {f:"Milk, cow, full cream", g:200, step:25, u:"ml"}]},
]},

{time:"11:30", tag:"Mid-morning", options:[
  {name:"Curd and roasted chana", items:[
    {f:"Curd (dahi), full fat", g:150, step:25},
    {f:"Roasted chana (bhuna)", g:30, step:10}]},
  {name:"Sprouts chaat", items:[
    {f:"Sprouted moong", g:180, step:50},
    {f:"Peanuts", g:25, step:5}]},
  {name:"Banana and peanuts", items:[
    {f:"Banana", g:120, step:60, u:"pc", pcg:120},
    {f:"Peanuts", g:35, step:5}]},
  {name:"Chaas and makhana", items:[
    {f:"Buttermilk (chaas)", g:250, step:50, u:"ml"},
    {f:"Makhana (fox nuts)", g:30, step:5},
    {f:"Peanuts", g:20, step:5}]},
]},

{time:"14:00", tag:"Lunch", options:[
  {name:"Roti, dal, sabzi, curd", items:[
    {f:"Chapati / roti, plain", g:120, step:40, u:"roti", pcg:40},
    {f:"Dal tadka, cooked", g:200, step:50, u:"katori", pcg:150},
    {f:"Mixed veg sabzi", g:150, step:50, u:"katori", pcg:150},
    {f:"Curd (dahi), full fat", g:150, step:50, u:"katori", pcg:150},
    {f:"Kheera (cucumber)", g:100, step:50, s:false}]},
  {name:"Rajma chawal", items:[
    {f:"Rice, white, cooked", g:200, step:50, u:"katori", pcg:150},
    {f:"Rajma curry, cooked", g:250, step:50, u:"katori", pcg:150},
    {f:"Mixed veg sabzi", g:150, step:50, u:"katori", pcg:150},
    {f:"Curd (dahi), full fat", g:150, step:50, u:"katori", pcg:150},
    {f:"Kheera (cucumber)", g:100, step:50, s:false}]},
  {name:"Roti, chole, salad", items:[
    {f:"Chapati / roti, plain", g:120, step:40, u:"roti", pcg:40},
    {f:"Chole, cooked", g:220, step:50, u:"katori", pcg:150},
    {f:"Curd (dahi), full fat", g:150, step:50, u:"katori", pcg:150},
    {f:"Kheera (cucumber)", g:100, step:50, s:false}]},
  {name:"Soya pulao and raita", items:[
    {f:"Veg pulao", g:250, step:50, u:"plate", pcg:200},
    {f:"Soya chunks / nutrela, dry", g:25, step:5},
    {f:"Vegetable raita", g:150, step:50, u:"katori", pcg:150},
    {f:"Kheera (cucumber)", g:100, step:50, s:false}]},
  {name:"Idli, sambar, curd", items:[
    {f:"Idli", g:250, step:50, u:"idli", pcg:50},
    {f:"Sambar", g:250, step:50, u:"katori", pcg:150},
    {f:"Curd (dahi), full fat", g:150, step:50, u:"katori", pcg:150},
    {f:"Peanuts", g:20, step:5}]},
]},

{time:"17:30", tag:"Around training", options:[
  {name:"Protein shake", items:[
    {f:"Milk, cow, full cream", g:250, step:25, u:"ml"},
    {f:"Banana", g:120, step:60, u:"pc", pcg:120},
    {f:"Whey protein isolate", g:30, step:15, u:"scoop", pcg:30}]},
  {name:"Paneer sandwich", items:[
    {f:"Paneer sandwich", g:160, step:80, u:"sandwich", pcg:160},
    {f:"Milk, cow, full cream", g:200, step:25, u:"ml"}]},
  {name:"Lassi and peanuts", items:[
    {f:"Sweet lassi", g:250, step:50, u:"ml"},
    {f:"Peanuts", g:30, step:5}]},
  {name:"Sattu shake", items:[
    {f:"Sattu (roasted gram flour)", g:40, step:10},
    {f:"Milk, cow, full cream", g:250, step:25, u:"ml"},
    {f:"Jaggery (gur)", g:10, step:5}]},
]},

{time:"20:30", tag:"Dinner", options:[
  {name:"Paneer bhurji and roti", items:[
    {f:"Paneer bhurji", g:150, step:50, u:"katori", pcg:150},
    {f:"Chapati / roti, plain", g:120, step:40, u:"roti", pcg:40},
    {f:"Palak (spinach)", g:100, step:50, s:false}]},
  {name:"Soya keema and roti", items:[
    {f:"Soya keema", g:200, step:50, u:"katori", pcg:150},
    {f:"Chapati / roti, plain", g:120, step:40, u:"roti", pcg:40},
    {f:"Curd (dahi), full fat", g:100, step:50, u:"katori", pcg:150},
    {f:"Kheera (cucumber)", g:100, step:50, s:false}]},
  {name:"Palak paneer and rice", items:[
    {f:"Palak paneer", g:180, step:50, u:"katori", pcg:150},
    {f:"Rice, white, cooked", g:180, step:50, u:"katori", pcg:150},
    {f:"Curd (dahi), full fat", g:100, step:50, u:"katori", pcg:150}]},
  {name:"Dal makhani and roti", items:[
    {f:"Dal makhani", g:180, step:50, u:"katori", pcg:150},
    {f:"Chapati / roti, plain", g:120, step:40, u:"roti", pcg:40},
    {f:"Curd (dahi), full fat", g:100, step:50, u:"katori", pcg:150},
    {f:"Palak (spinach)", g:100, step:50, s:false}]},
  {name:"Khichdi with ghee", items:[
    {f:"Khichdi", g:300, step:50, u:"plate", pcg:200},
    {f:"Curd (dahi), full fat", g:150, step:50, u:"katori", pcg:150},
    {f:"Ghee", g:5, step:5, u:"tsp", pcg:5},
    {f:"Palak (spinach)", g:100, step:50, s:false}]},
]},

{time:"22:30", tag:"Before bed", options:[
  {name:"Milk with ghee", items:[
    {f:"Milk, cow, full cream", g:200, step:25, u:"ml"},
    {f:"Ghee", g:5, step:5, u:"tsp", pcg:5, s:false}]},
  {name:"Haldi doodh", items:[
    {f:"Milk, cow, full cream", g:250, step:25, u:"ml"},
    {f:"Jaggery (gur)", g:10, step:5, s:false}]},
  {name:"Curd", items:[
    {f:"Curd (dahi), full fat", g:200, step:50, u:"katori", pcg:150}]},
  {name:"Whey in water", items:[
    {f:"Whey protein isolate", g:20, step:10, u:"scoop", pcg:30}]},
]}
];

/**
 * What each plan item can be traded for, one-for-one.
 *
 * Curated rather than computed: "things with similar calories" would happily
 * offer you 900 g of lauki in place of a glass of milk. These are swaps a
 * person would actually make in an Indian kitchen. A swap keeps the same number
 * of household servings — one glass of milk becomes one cup of chai — and the
 * solver then re-balances the rest of the day around whatever changed.
 */
export const SWAP_GROUPS: Record<string, string[]> = {
  "Milk, cow, full cream": ["Masala chai (milk, sugar)", "Filter coffee (milk, sugar)", "Milk, buffalo, full fat", "Milk, toned", "Soya milk, unsweetened", "Buttermilk (chaas)", "Black coffee, no sugar"],
  "Milk, buffalo, full fat": ["Milk, cow, full cream", "Masala chai (milk, sugar)", "Filter coffee (milk, sugar)", "Milk, toned"],
  "Masala chai (milk, sugar)": ["Filter coffee (milk, sugar)", "Milk, cow, full cream", "Green tea", "Black coffee, no sugar", "Buttermilk (chaas)"],
  "Filter coffee (milk, sugar)": ["Masala chai (milk, sugar)", "Milk, cow, full cream", "Black coffee, no sugar", "Green tea"],
  "Buttermilk (chaas)": ["Curd (dahi), full fat", "Milk, toned", "Nimbu paani (lemon, sugar)", "Coconut water"],
  Almonds: ["Peanuts", "Cashew", "Walnut", "Pumpkin seeds", "Pistachio"],
  Peanuts: ["Almonds", "Cashew", "Roasted chana (bhuna)", "Makhana (fox nuts)", "Pumpkin seeds"],
  "Peanut butter": ["Almonds", "Peanuts", "Sesame (til)", "Ghee", "Cashew"],
  "Dates (khajur)": ["Raisins (kishmish)", "Banana", "Jaggery (gur)", "Honey"],
  "Oats, rolled": ["Dalia (broken wheat)", "Suji / rava", "Poha (flattened rice)", "Ragi flour", "Besan (gram flour)"],
  "Dalia (broken wheat)": ["Oats, rolled", "Suji / rava", "Poha (flattened rice)", "Ragi flour"],
  Banana: ["Mango", "Apple", "Guava (amrood)", "Papaya", "Orange"],
  "Curd (dahi), full fat": ["Hung curd / Greek yoghurt", "Curd, low fat", "Buttermilk (chaas)", "Paneer, low fat", "Vegetable raita"],
  "Roasted chana (bhuna)": ["Peanuts", "Sprouted moong", "Makhana (fox nuts)", "Almonds"],
  "Sprouted moong": ["Roasted chana (bhuna)", "Kala chana", "Peanuts"],
  "Makhana (fox nuts)": ["Roasted chana (bhuna)", "Peanuts", "Almonds"],
  "Chapati / roti, plain": ["Rice, white, cooked", "Bajra flour", "Ragi flour", "Dosa, plain", "Paratha, plain"],
  "Rice, white, cooked": ["Chapati / roti, plain", "Rice, brown, cooked", "Veg pulao", "Khichdi"],
  "Dal tadka, cooked": ["Rajma curry, cooked", "Chole, cooked", "Sambar", "Dal makhani", "Soya keema"],
  "Rajma curry, cooked": ["Dal tadka, cooked", "Chole, cooked", "Dal makhani", "Soya keema"],
  "Chole, cooked": ["Rajma curry, cooked", "Dal tadka, cooked", "Sambar", "Dal makhani"],
  Sambar: ["Dal tadka, cooked", "Chole, cooked", "Rajma curry, cooked"],
  "Dal makhani": ["Dal tadka, cooked", "Rajma curry, cooked", "Chole, cooked"],
  "Mixed veg sabzi": ["Aloo sabzi", "Bhindi (okra)", "Gobhi (cauliflower)", "Baingan (brinjal)", "Palak (spinach)"],
  "Kheera (cucumber)": ["Gajar (carrot)", "Tamatar (tomato)", "Pyaaz (onion)"],
  "Palak (spinach)": ["Methi (fenugreek leaves)", "Kheera (cucumber)", "Gajar (carrot)"],
  "Whey protein isolate": ["Whey protein concentrate", "Plant protein powder", "Paneer, low fat", "Soya chunks / nutrela, dry", "Hung curd / Greek yoghurt"],
  "Paneer bhurji": ["Palak paneer", "Soya keema", "Tofu bhurji", "Dal makhani", "Chole, cooked"],
  "Palak paneer": ["Paneer bhurji", "Soya keema", "Tofu bhurji", "Dal makhani"],
  "Soya keema": ["Paneer bhurji", "Palak paneer", "Tofu bhurji", "Rajma curry, cooked"],
  "Soya chunks / nutrela, dry": ["Tofu", "Paneer, low fat", "Whey protein isolate", "Soya granules, dry"],
  Ghee: ["Butter", "Mustard / sunflower oil", "Peanut butter"],
  "Jaggery (gur)": ["Honey", "Sugar", "Dates (khajur)"],
  "Sweet lassi": ["Buttermilk (chaas)", "Milk, cow, full cream", "Curd (dahi), full fat"],
  Idli: ["Dosa, plain", "Chapati / roti, plain", "Poha, cooked"],
  "Poha, cooked": ["Upma", "Idli", "Besan chilla", "Moong dal chilla"],
  "Besan chilla": ["Moong dal chilla", "Poha, cooked", "Upma", "Dosa, plain"],
  "Veg pulao": ["Rice, white, cooked", "Khichdi", "Chapati / roti, plain"],
  Khichdi: ["Veg pulao", "Rice, white, cooked", "Curd rice"],
  "Vegetable raita": ["Curd (dahi), full fat", "Buttermilk (chaas)", "Hung curd / Greek yoghurt"],
  "Paneer sandwich": ["Besan chilla", "Moong dal chilla", "Paneer bhurji"],
  "Sattu (roasted gram flour)": ["Whey protein isolate", "Besan (gram flour)", "Peanut butter"],
  "Sattu drink (with jaggery)": ["Sweet lassi", "Milk, cow, full cream", "Buttermilk (chaas)"],
  "Moong dal (yellow)": ["Masoor dal", "Toor / arhar dal", "Chana dal"],
};

/** Alternatives for one item, filtered to foods that actually exist. */
export function swapsFor(foodName: string): Food[] {
  return (SWAP_GROUPS[foodName] ?? []).filter(hasFood).map((n) => F(n));
}

export const PLAN_RULES: [string, string][] = [
 ["Weigh yourself every morning, same conditions", "After the toilet, before food or water, same clothes. Then ignore the daily number entirely — only the 7-day average tells you anything. Water weight swings 1–2 kg for reasons that have nothing to do with muscle."],
 ["Adjust every two weeks, not every two days", "If the weekly average has not moved up in two weeks, add 200 kcal. If it is climbing faster than 0.5% of your bodyweight a week, cut 200. Two weeks is the shortest window where the signal beats the noise."],
 ["Hit the protein number before the calorie number", "If you are going to miss a target today, miss carbs. Protein is the one macro where the shortfall cannot be made up tomorrow — the leucine trigger is per meal, and a missed meal is a missed response."],
 ["Ghee and oil are your calorie lever, salad is your volume brake", "When you cannot finish the food, add a teaspoon of ghee (45 kcal, no volume) rather than another roti. When you are gaining too fast, cut the ghee first — it is the easiest 200 kcal to remove without touching protein."],
 ["The shake is non-negotiable on hard days", "On days you genuinely cannot eat, the milk-banana-peanut-butter shake alone delivers 400+ kcal and 15 g protein in ninety seconds. A missed solid meal replaced by a shake is a good day; a missed meal replaced by nothing is a lost week."],
 ["Train, or this is just a fat-gain protocol", "Two to four sessions a week, compound lifts, adding weight or reps every week. The food is the material; the training is the instruction. Without the second one, the surplus has exactly one place to go."]
];

/* ---------------------------------------------------------------- recipe cards */
export const RECIPES: Recipe[] = [
{id:"paneer-bhurji", en:"Paneer Bhurji", hi:"पनीर भुर्जी", meal:"Dinner", mins:20, serves:2,
 ing:[
  {f:"Paneer, full fat", g:250, hh:"1 big slab", hhHi:"1 बड़ा टुकड़ा"},
  {f:"Pyaaz (onion)", g:80, hh:"1 medium", hhHi:"1 मध्यम"},
  {f:"Tamatar (tomato)", g:100, hh:"1 medium", hhHi:"1 मध्यम"},
  {f:"Shimla mirch (capsicum)", g:50, hh:"half", hhHi:"आधी"},
  {f:"Cooking oil, 1 tsp", g:10, hh:"2 tsp", hhHi:"2 छोटे चम्मच"}],
 extras:[["Cumin seeds","जीरा","1 tsp","1 छोटा चम्मच"],["Turmeric","हल्दी","1/2 tsp","आधा छोटा चम्मच"],
         ["Red chilli powder","लाल मिर्च","1/2 tsp","आधा छोटा चम्मच"],["Salt","नमक","to taste","स्वादानुसार"],
         ["Coriander leaves","हरा धनिया","a handful","मुट्ठी भर"]],
 steps:[
  ["Crumble the paneer with your hands into small pieces. Do not grate it.","पनीर को हाथ से छोटे-छोटे टुकड़ों में मसल लें। कद्दूकस न करें।"],
  ["Heat 10 g oil in a kadhai. Add cumin and let it splutter.","कड़ाही में 10 ग्राम तेल गरम करें। जीरा डालें और चटकने दें।"],
  ["Add chopped onion and fry 3 minutes until soft and light golden.","कटा हुआ प्याज़ डालें, 3 मिनट भूनें जब तक नरम और हल्का सुनहरा हो जाए।"],
  ["Add capsicum and tomato, cook 4 minutes until the tomato breaks down.","शिमला मिर्च और टमाटर डालें, 4 मिनट पकाएँ जब तक टमाटर गल न जाए।"],
  ["Add turmeric, red chilli and salt. Mix well.","हल्दी, लाल मिर्च और नमक डालकर अच्छे से मिलाएँ।"],
  ["Add the crumbled paneer. Stir on low flame for 3 minutes only — longer makes it rubbery.","मसला हुआ पनीर डालें। धीमी आँच पर सिर्फ़ 3 मिनट चलाएँ — ज़्यादा पकाने से पनीर रबड़ जैसा हो जाता है।"],
  ["Turn off the gas, add coriander leaves, serve hot.","गैस बंद करें, हरा धनिया डालें, गरम परोसें।"]]},

{id:"soya-keema", en:"Soya Keema", hi:"सोया कीमा", meal:"Dinner", mins:25, serves:2,
 ing:[
  {f:"Soya chunks / nutrela, dry", g:60, hh:"1 katori dry", hhHi:"1 कटोरी सूखा"},
  {f:"Pyaaz (onion)", g:80, hh:"1 medium", hhHi:"1 मध्यम"},
  {f:"Tamatar (tomato)", g:120, hh:"1 large", hhHi:"1 बड़ा"},
  {f:"Matar (green peas)", g:50, hh:"1/2 katori", hhHi:"आधी कटोरी"},
  {f:"Mustard / sunflower oil", g:15, hh:"1 tbsp", hhHi:"1 बड़ा चम्मच"}],
 extras:[["Ginger-garlic paste","अदरक-लहसुन पेस्ट","1 tbsp","1 बड़ा चम्मच"],["Turmeric","हल्दी","1/2 tsp","आधा छोटा चम्मच"],
         ["Coriander powder","धनिया पाउडर","1 tsp","1 छोटा चम्मच"],["Garam masala","गरम मसाला","1/2 tsp","आधा छोटा चम्मच"],
         ["Salt","नमक","to taste","स्वादानुसार"]],
 steps:[
  ["Boil the soya chunks in water for 5 minutes. Drain, rinse in cold water, squeeze out all the water.","सोया चंक्स को 5 मिनट पानी में उबालें। पानी निकालकर ठंडे पानी से धोएँ और अच्छी तरह निचोड़ लें।"],
  ["Grind them in the mixer for 2–3 seconds only, so they become keema-like — not a paste.","मिक्सी में सिर्फ़ 2-3 सेकंड चलाएँ ताकि कीमे जैसा दाना बने, पेस्ट नहीं।"],
  ["Heat 15 g oil and fry the onion 4 minutes until golden.","15 ग्राम तेल गरम करें, प्याज़ को 4 मिनट सुनहरा होने तक भूनें।"],
  ["Add ginger-garlic paste and cook 1 minute.","अदरक-लहसुन का पेस्ट डालकर 1 मिनट भूनें।"],
  ["Add tomato, turmeric, chilli, coriander powder and salt. Cook 5 minutes until the oil separates.","टमाटर, हल्दी, मिर्च, धनिया पाउडर और नमक डालें। तेल छूटने तक 5 मिनट पकाएँ।"],
  ["Add the soya and peas with half a cup of water. Cover and cook 8 minutes on low flame.","सोया और मटर डालें, आधा कप पानी डालें। ढककर धीमी आँच पर 8 मिनट पकाएँ।"],
  ["Finish with garam masala and coriander leaves.","गरम मसाला और हरा धनिया डालकर परोसें।"]]},

{id:"dal-tadka", en:"Dal Tadka", hi:"दाल तड़का", meal:"Lunch", mins:30, serves:3,
 ing:[
  {f:"Toor / arhar dal", g:90, hh:"3 katori cooked", hhHi:"3 कटोरी पकी दाल"},
  {f:"Ghee", g:10, hh:"2 tsp", hhHi:"2 छोटे चम्मच"},
  {f:"Tamatar (tomato)", g:80, hh:"1 small", hhHi:"1 छोटा"},
  {f:"Pyaaz (onion)", g:60, hh:"1 small", hhHi:"1 छोटा"}],
 extras:[["Cumin seeds","जीरा","1 tsp","1 छोटा चम्मच"],["Garlic, chopped","कटा लहसुन","4 cloves","4 कलियाँ"],
         ["Dried red chilli","सूखी लाल मिर्च","2","2"],["Turmeric","हल्दी","1/2 tsp","आधा छोटा चम्मच"],
         ["Salt","नमक","to taste","स्वादानुसार"]],
 steps:[
  ["Wash the dal in 3 changes of water, then soak 20 minutes.","दाल को 3 बार पानी बदलकर धोएँ, फिर 20 मिनट भिगोएँ।"],
  ["Pressure cook with 3 cups water, turmeric and salt — 4 whistles, then low flame 5 minutes.","3 कप पानी, हल्दी और नमक के साथ कुकर में 4 सीटी लगाएँ, फिर धीमी आँच पर 5 मिनट।"],
  ["Whisk the cooked dal smooth with a ladle.","पकी दाल को कलछी से अच्छे से घोंट लें।"],
  ["For the tadka, heat 10 g ghee in a small pan. Add cumin, then garlic, then dried red chilli.","तड़के के लिए छोटे पैन में 10 ग्राम घी गरम करें। जीरा, फिर लहसुन, फिर सूखी लाल मिर्च डालें।"],
  ["Add onion and tomato, cook 3 minutes until soft.","प्याज़ और टमाटर डालकर 3 मिनट नरम होने तक पकाएँ।"],
  ["Pour the tadka into the dal, cover for 2 minutes, then stir.","तड़का दाल में डालें, 2 मिनट ढक दें, फिर मिलाएँ।"],
  ["Use exactly 10 g ghee — the tadka is where the dal's calories are won or lost.","घी बिल्कुल 10 ग्राम ही डालें — दाल की कैलोरी तड़के से ही घटती-बढ़ती है।"]]},

{id:"rajma", en:"Rajma Masala", hi:"राजमा मसाला", meal:"Lunch", mins:45, serves:3,
 ing:[
  {f:"Rajma (kidney beans)", g:120, hh:"3 katori cooked", hhHi:"3 कटोरी पका राजमा"},
  {f:"Pyaaz (onion)", g:100, hh:"1 large", hhHi:"1 बड़ा"},
  {f:"Tamatar (tomato)", g:150, hh:"2 medium", hhHi:"2 मध्यम"},
  {f:"Mustard / sunflower oil", g:15, hh:"1 tbsp", hhHi:"1 बड़ा चम्मच"}],
 extras:[["Ginger-garlic paste","अदरक-लहसुन पेस्ट","1 tbsp","1 बड़ा चम्मच"],["Turmeric","हल्दी","1/2 tsp","आधा छोटा चम्मच"],
         ["Coriander powder","धनिया पाउडर","2 tsp","2 छोटे चम्मच"],["Garam masala","गरम मसाला","1 tsp","1 छोटा चम्मच"],
         ["Salt","नमक","to taste","स्वादानुसार"]],
 steps:[
  ["Soak the rajma overnight, at least 8 hours. This step cannot be skipped.","राजमा को रात भर, कम से कम 8 घंटे भिगोएँ। यह ज़रूरी है, छोड़ें नहीं।"],
  ["Drain, then pressure cook in fresh water with salt — 6–7 whistles, then 10 minutes on low. A bean should mash between two fingers.","पानी बदलकर नमक के साथ कुकर में 6-7 सीटी, फिर 10 मिनट धीमी आँच। दाना दो उंगलियों से मसल जाना चाहिए।"],
  ["Heat 15 g oil and fry the onion 5 minutes until deep golden.","15 ग्राम तेल गरम करें, प्याज़ 5 मिनट गहरा सुनहरा होने तक भूनें।"],
  ["Add ginger-garlic, then tomato puree. Cook 6–7 minutes until the oil separates.","अदरक-लहसुन, फिर टमाटर की प्यूरी डालें। 6-7 मिनट तेल छूटने तक पकाएँ।"],
  ["Add turmeric, chilli, coriander powder and garam masala.","हल्दी, मिर्च, धनिया पाउडर और गरम मसाला डालें।"],
  ["Add the rajma along with its cooking water. Simmer 12 minutes uncovered.","राजमा को उसके पानी सहित डालें। 12 मिनट बिना ढके पकाएँ।"],
  ["Mash a spoonful of beans against the side of the pan to thicken the gravy.","एक चम्मच राजमा कड़ाही की दीवार पर मसल दें ताकि ग्रेवी गाढ़ी हो जाए।"]]},

{id:"palak-paneer", en:"Palak Paneer", hi:"पालक पनीर", meal:"Dinner", mins:30, serves:2,
 ing:[
  {f:"Palak (spinach)", g:300, hh:"2 bunches", hhHi:"2 गड्डी"},
  {f:"Paneer, full fat", g:200, hh:"1 slab", hhHi:"1 टुकड़ा"},
  {f:"Pyaaz (onion)", g:60, hh:"1 small", hhHi:"1 छोटा"},
  {f:"Tamatar (tomato)", g:60, hh:"1 small", hhHi:"1 छोटा"},
  {f:"Cooking oil, 1 tsp", g:10, hh:"2 tsp", hhHi:"2 छोटे चम्मच"},
  {f:"Milk, cow, full cream", g:50, hh:"1/4 glass", hhHi:"चौथाई गिलास"}],
 extras:[["Ginger-garlic paste","अदरक-लहसुन पेस्ट","1 tsp","1 छोटा चम्मच"],["Green chilli","हरी मिर्च","2","2"],
         ["Garam masala","गरम मसाला","1/2 tsp","आधा छोटा चम्मच"],["Salt","नमक","to taste","स्वादानुसार"]],
 steps:[
  ["Blanch the spinach in boiling water 2 minutes, then put it straight into cold water. This keeps it green.","पालक को उबलते पानी में 2 मिनट डालें, फिर तुरंत ठंडे पानी में डालें। इससे रंग हरा रहता है।"],
  ["Grind to a coarse paste. Do not add water.","दरदरा पीस लें। पानी न डालें।"],
  ["Cut the paneer into cubes. Do not fry them.","पनीर को टुकड़ों में काटें। तलें नहीं।"],
  ["Heat 10 g oil, fry onion 3 minutes, add ginger-garlic, then tomato. Cook 4 minutes.","10 ग्राम तेल गरम करें, प्याज़ 3 मिनट भूनें, अदरक-लहसुन, फिर टमाटर डालें। 4 मिनट पकाएँ।"],
  ["Add the spinach paste. Cook 5 minutes on medium flame without a lid.","पालक का पेस्ट डालें। मध्यम आँच पर 5 मिनट बिना ढके पकाएँ।"],
  ["Add 50 ml milk and salt, stir through.","50 मि.ली. दूध और नमक डालकर मिलाएँ।"],
  ["Add the paneer, cook 2 minutes only, then turn off the gas.","पनीर डालें, सिर्फ़ 2 मिनट पकाएँ, फिर गैस बंद कर दें।"]]},

{id:"moong-chilla", en:"Moong Dal Chilla, stuffed", hi:"मूंग दाल चीला", meal:"Breakfast", mins:25, serves:2,
 ing:[
  {f:"Moong dal (yellow)", g:100, hh:"1 katori", hhHi:"1 कटोरी"},
  {f:"Paneer, full fat", g:60, hh:"small piece", hhHi:"छोटा टुकड़ा"},
  {f:"Pyaaz (onion)", g:50, hh:"1 small", hhHi:"1 छोटा"},
  {f:"Tamatar (tomato)", g:50, hh:"1 small", hhHi:"1 छोटा"},
  {f:"Cooking oil, 1 tsp", g:10, hh:"2 tsp", hhHi:"2 छोटे चम्मच"}],
 extras:[["Ginger","अदरक","1 inch","1 इंच"],["Green chilli","हरी मिर्च","2","2"],
         ["Turmeric","हल्दी","a pinch","चुटकी भर"],["Salt","नमक","to taste","स्वादानुसार"]],
 steps:[
  ["Soak the moong dal 4 hours. Drain the water.","मूंग दाल 4 घंटे भिगोएँ। पानी निकाल दें।"],
  ["Grind with ginger, green chilli and very little water into a thick batter — like dosa batter, not thin.","अदरक, हरी मिर्च और बहुत कम पानी के साथ गाढ़ा घोल पीसें — डोसे के घोल जैसा, पतला नहीं।"],
  ["Add salt and a pinch of turmeric. Rest 10 minutes.","नमक और चुटकी भर हल्दी डालें। 10 मिनट रखें।"],
  ["Crumble the paneer and mix with chopped onion and tomato — this is the stuffing.","पनीर को मसलें, कटा प्याज़ और टमाटर मिलाएँ — यही भरावन है।"],
  ["Heat a tawa, spread one ladle of batter thin. Drizzle 2–3 g oil around the edge.","तवा गरम करें, एक कलछी घोल पतला फैलाएँ। किनारों पर 2-3 ग्राम तेल डालें।"],
  ["When the top sets, put stuffing on one half, fold over and press. Cook 1 minute each side.","ऊपर से सूखने पर आधे हिस्से पर भरावन रखें, मोड़ें और दबाएँ। दोनों तरफ़ 1-1 मिनट सेकें।"],
  ["This batter makes 4 chillas — 2 per person.","इस घोल से 4 चीले बनेंगे — हर व्यक्ति के लिए 2।"]]},

{id:"masala-oats", en:"Masala Oats with Vegetables", hi:"मसाला ओट्स", meal:"Breakfast", mins:12, serves:1,
 ing:[
  {f:"Oats, rolled", g:60, hh:"1 katori", hhHi:"1 कटोरी"},
  {f:"Matar (green peas)", g:40, hh:"1/2 katori", hhHi:"आधी कटोरी"},
  {f:"Gajar (carrot)", g:50, hh:"1 small", hhHi:"1 छोटी"},
  {f:"Pyaaz (onion)", g:40, hh:"1 small", hhHi:"1 छोटा"},
  {f:"Peanuts", g:15, hh:"1 tbsp", hhHi:"1 बड़ा चम्मच"},
  {f:"Cooking oil, 1 tsp", g:5, hh:"1 tsp", hhHi:"1 छोटा चम्मच"}],
 extras:[["Mustard seeds","राई","1/2 tsp","आधा छोटा चम्मच"],["Curry leaves","करी पत्ता","6–8","6-8"],
         ["Turmeric","हल्दी","1/4 tsp","चौथाई छोटा चम्मच"],["Salt","नमक","to taste","स्वादानुसार"]],
 steps:[
  ["Heat 5 g oil, add mustard seeds and curry leaves.","5 ग्राम तेल गरम करें, राई और करी पत्ता डालें।"],
  ["Add the peanuts and roast 1 minute.","मूंगफली डालकर 1 मिनट भूनें।"],
  ["Add onion, carrot and peas. Cook 4 minutes.","प्याज़, गाजर और मटर डालें। 4 मिनट पकाएँ।"],
  ["Add the oats and roast 1 minute — this stops them turning sticky.","ओट्स डालकर 1 मिनट भूनें — इससे चिपचिपे नहीं होंगे।"],
  ["Add 250 ml hot water and salt. Cook 3 minutes, stirring.","250 मि.ली. गरम पानी और नमक डालें। 3 मिनट चलाते हुए पकाएँ।"],
  ["Turn off while it is still slightly loose — it thickens in the bowl.","थोड़ा गीला रहने पर ही गैस बंद करें — कटोरी में अपने आप गाढ़ा हो जाएगा।"]]},

{id:"banana-shake", en:"Banana Peanut Shake", hi:"केला मूंगफली शेक", meal:"Shake", mins:3, serves:1,
 ing:[
  {f:"Milk, cow, full cream", g:300, hh:"1 large glass", hhHi:"1 बड़ा गिलास"},
  {f:"Banana", g:120, hh:"1 medium", hhHi:"1 मध्यम"},
  {f:"Peanut butter", g:20, hh:"1 heaped tbsp", hhHi:"1 भरा बड़ा चम्मच"},
  {f:"Dates (khajur)", g:16, hh:"2 pieces", hhHi:"2 खजूर"}],
 extras:[["Cardamom powder","इलायची पाउडर","a pinch","चुटकी भर"]],
 steps:[
  ["Remove the seeds from the dates.","खजूर से बीज निकाल दें।"],
  ["Put the milk, banana, peanut butter and dates into the mixer.","दूध, केला, पीनट बटर और खजूर मिक्सी में डालें।"],
  ["Blend 40 seconds until completely smooth.","40 सेकंड चलाएँ जब तक पूरी तरह चिकना न हो जाए।"],
  ["Serve immediately. Do not make it in advance.","तुरंत परोसें। पहले से बनाकर न रखें।"],
  ["If it is too thick, add 50 ml more milk — never water. Water costs you the calories.","गाढ़ा लगे तो 50 मि.ली. दूध और डालें — पानी कभी नहीं। पानी से कैलोरी घट जाती है।"]]},

{id:"chole", en:"Chole", hi:"छोले", meal:"Lunch", mins:45, serves:3,
 ing:[
  {f:"Kabuli chana (chickpeas)", g:120, hh:"3 katori cooked", hhHi:"3 कटोरी पके छोले"},
  {f:"Pyaaz (onion)", g:100, hh:"1 large", hhHi:"1 बड़ा"},
  {f:"Tamatar (tomato)", g:150, hh:"2 medium", hhHi:"2 मध्यम"},
  {f:"Mustard / sunflower oil", g:20, hh:"1.5 tbsp", hhHi:"डेढ़ बड़ा चम्मच"}],
 extras:[["Chole masala","छोले मसाला","2 tsp","2 छोटे चम्मच"],["Amchur (dry mango powder)","अमचूर","1 tsp","1 छोटा चम्मच"],
         ["Tea bag (for colour)","टी-बैग (रंग के लिए)","1","1"],["Baking soda","मीठा सोडा","a pinch","चुटकी भर"],
         ["Salt","नमक","to taste","स्वादानुसार"]],
 steps:[
  ["Soak the chana overnight with a pinch of baking soda.","छोले को रात भर एक चुटकी मीठा सोडा डालकर भिगोएँ।"],
  ["Pressure cook with salt and one tea bag for colour — 5–6 whistles. Remove the tea bag.","नमक और एक टी-बैग के साथ 5-6 सीटी लगाएँ। टी-बैग निकाल दें।"],
  ["Heat 20 g oil and fry the onion 6 minutes to deep brown.","20 ग्राम तेल गरम करें, प्याज़ 6 मिनट गहरा भूरा होने तक भूनें।"],
  ["Add ginger-garlic, then tomato. Cook until the oil separates.","अदरक-लहसुन, फिर टमाटर डालें। तेल छूटने तक पकाएँ।"],
  ["Add chole masala, amchur, chilli and turmeric.","छोले मसाला, अमचूर, मिर्च और हल्दी डालें।"],
  ["Add the chana with its water. Simmer 15 minutes.","छोले को उनके पानी सहित डालें। 15 मिनट पकाएँ।"],
  ["Mash a few chana to thicken the gravy. Finish with a little more amchur.","कुछ छोले मसल दें ताकि ग्रेवी गाढ़ी हो। ऊपर से थोड़ा अमचूर डालें।"]]},

{id:"soya-pulao", en:"Soya Vegetable Pulao", hi:"सोया सब्ज़ी पुलाव", meal:"Lunch", mins:30, serves:3,
 ing:[
  {f:"Rice, white, raw", g:150, hh:"1 katori raw", hhHi:"1 कटोरी कच्चा चावल"},
  {f:"Soya chunks / nutrela, dry", g:45, hh:"3/4 katori dry", hhHi:"पौन कटोरी सूखा"},
  {f:"Matar (green peas)", g:60, hh:"1/2 katori", hhHi:"आधी कटोरी"},
  {f:"Gajar (carrot)", g:80, hh:"1 medium", hhHi:"1 मध्यम"},
  {f:"Ghee", g:15, hh:"1 tbsp", hhHi:"1 बड़ा चम्मच"}],
 extras:[["Bay leaf","तेजपत्ता","1","1"],["Cloves","लौंग","3","3"],["Green cardamom","हरी इलायची","2","2"],
         ["Salt","नमक","to taste","स्वादानुसार"]],
 steps:[
  ["Wash the rice, soak 20 minutes, then drain.","चावल धोकर 20 मिनट भिगोएँ, फिर पानी निकाल दें।"],
  ["Boil the soya chunks 5 minutes, squeeze dry, and cut each one in half.","सोया 5 मिनट उबालें, निचोड़ें, और हर टुकड़े को आधा काट लें।"],
  ["Heat 15 g ghee, add bay leaf, cloves and cardamom.","15 ग्राम घी गरम करें, तेजपत्ता, लौंग और इलायची डालें।"],
  ["Add onion and fry 4 minutes. Add carrot, peas and soya, fry 3 minutes.","प्याज़ डालकर 4 मिनट भूनें। गाजर, मटर और सोया डालकर 3 मिनट भूनें।"],
  ["Add the rice and fry gently 2 minutes — do not break the grains.","चावल डालकर 2 मिनट हल्के हाथ से भूनें — दाने टूटने न पाएँ।"],
  ["Add 300 ml water and salt. Cover and cook on low flame 12 minutes.","300 मि.ली. पानी और नमक डालें। ढककर धीमी आँच पर 12 मिनट पकाएँ।"],
  ["Rest 5 minutes covered before opening the lid.","ढक्कन खोलने से पहले 5 मिनट ढका रहने दें।"]]},

{id:"sprouts", en:"Sprouts Chaat", hi:"अंकुरित मूंग चाट", meal:"Snack", mins:10, serves:2,
 ing:[
  {f:"Sprouted moong", g:200, hh:"2 katori", hhHi:"2 कटोरी"},
  {f:"Tamatar (tomato)", g:80, hh:"1 medium", hhHi:"1 मध्यम"},
  {f:"Pyaaz (onion)", g:60, hh:"1 small", hhHi:"1 छोटा"},
  {f:"Kheera (cucumber)", g:80, hh:"1 small", hhHi:"1 छोटा"},
  {f:"Peanuts", g:20, hh:"1.5 tbsp", hhHi:"डेढ़ बड़ा चम्मच"}],
 extras:[["Lemon","नींबू","1","1"],["Black salt","काला नमक","1/2 tsp","आधा छोटा चम्मच"],
         ["Chaat masala","चाट मसाला","1 tsp","1 छोटा चम्मच"],["Coriander leaves","हरा धनिया","a handful","मुट्ठी भर"]],
 steps:[
  ["Steam the sprouts 5 minutes — do not boil them, they turn mushy.","अंकुरित मूंग को 5 मिनट भाप में पकाएँ — उबालें नहीं, वरना गल जाएँगे।"],
  ["Dry-roast the peanuts on a tawa for 2 minutes.","मूंगफली को सूखे तवे पर 2 मिनट भूनें।"],
  ["Chop the tomato, onion and cucumber fine.","टमाटर, प्याज़ और खीरा बारीक काट लें।"],
  ["Mix everything with lemon juice, black salt and chaat masala.","सब कुछ नींबू का रस, काला नमक और चाट मसाला के साथ मिलाएँ।"],
  ["Serve within 15 minutes — after that it turns watery.","15 मिनट के अंदर परोसें — बाद में पानी छोड़ देता है।"]]},

{id:"dalia-khichdi", en:"Dalia Khichdi", hi:"दलिया खिचड़ी", meal:"Breakfast", mins:25, serves:2,
 ing:[
  {f:"Dalia (broken wheat)", g:100, hh:"1 katori", hhHi:"1 कटोरी"},
  {f:"Moong dal (yellow)", g:40, hh:"1/2 katori", hhHi:"आधी कटोरी"},
  {f:"Gajar (carrot)", g:60, hh:"1 small", hhHi:"1 छोटी"},
  {f:"Matar (green peas)", g:50, hh:"1/2 katori", hhHi:"आधी कटोरी"},
  {f:"Ghee", g:10, hh:"2 tsp", hhHi:"2 छोटे चम्मच"}],
 extras:[["Cumin seeds","जीरा","1 tsp","1 छोटा चम्मच"],["Asafoetida","हींग","a pinch","चुटकी भर"],
         ["Turmeric","हल्दी","1/2 tsp","आधा छोटा चम्मच"],["Salt","नमक","to taste","स्वादानुसार"]],
 steps:[
  ["Dry-roast the dalia 3 minutes until it smells nutty.","दलिया को 3 मिनट सूखा भूनें जब तक खुशबू न आने लगे।"],
  ["Heat 10 g ghee in the cooker, add cumin and asafoetida.","कुकर में 10 ग्राम घी गरम करें, जीरा और हींग डालें।"],
  ["Add carrot and peas, fry 2 minutes.","गाजर और मटर डालकर 2 मिनट भूनें।"],
  ["Add the dalia, moong dal, turmeric, salt and 4 cups of water.","दलिया, मूंग दाल, हल्दी, नमक और 4 कप पानी डालें।"],
  ["Pressure cook 3 whistles, then 5 minutes on low flame.","3 सीटी लगाएँ, फिर धीमी आँच पर 5 मिनट पकाएँ।"],
  ["It should pour, not stand. Add hot water if it is too thick.","यह बहना चाहिए, जमना नहीं। गाढ़ा हो तो गरम पानी मिला दें।"]]},

{id:"peanut-laddoo", en:"Peanut Jaggery Laddoo", hi:"मूंगफली गुड़ लड्डू", meal:"Snack", mins:20, serves:6,
 ing:[
  {f:"Peanuts", g:200, hh:"2 katori", hhHi:"2 कटोरी"},
  {f:"Jaggery (gur)", g:120, hh:"1 katori, grated", hhHi:"1 कटोरी, कद्दूकस"},
  {f:"Ghee", g:20, hh:"1.5 tbsp", hhHi:"डेढ़ बड़ा चम्मच"}],
 extras:[["Cardamom powder","इलायची पाउडर","1/2 tsp","आधा छोटा चम्मच"]],
 steps:[
  ["Roast the peanuts on low flame 8 minutes, stirring constantly. Let them cool.","मूंगफली को धीमी आँच पर 8 मिनट लगातार चलाते हुए भूनें। ठंडा होने दें।"],
  ["Rub them between your palms to remove the skins.","हथेलियों से मलकर छिलके उतार लें।"],
  ["Grind coarse — some crunch should remain.","दरदरा पीसें — थोड़ा कुरकुरापन रहना चाहिए।"],
  ["Melt the jaggery with 20 g ghee on low flame, just until liquid. Do not overheat it.","गुड़ को 20 ग्राम घी के साथ धीमी आँच पर पिघलाएँ, बस पिघलने तक। ज़्यादा गरम न करें।"],
  ["Mix in the peanut powder and turn off the flame.","मूंगफली का चूरा मिलाएँ और गैस बंद कर दें।"],
  ["While still warm, shape into 6 laddoos. They harden as they cool.","गुनगुना रहते ही 6 लड्डू बना लें। ठंडा होने पर सख्त हो जाएँगे।"],
  ["Keeps 10 days in an airtight box. One laddoo is a full snack.","डिब्बे में 10 दिन तक चलेंगे। एक लड्डू पूरा नाश्ता है।"]]},

{id:"besan-chilla", en:"Besan Chilla", hi:"बेसन चीला", meal:"Breakfast", mins:20, serves:2,
 ing:[
  {f:"Besan (gram flour)", g:120, hh:"1 katori", hhHi:"1 कटोरी"},
  {f:"Pyaaz (onion)", g:60, hh:"1 small", hhHi:"1 छोटा"},
  {f:"Tamatar (tomato)", g:60, hh:"1 small", hhHi:"1 छोटा"},
  {f:"Palak (spinach)", g:40, hh:"a handful", hhHi:"मुट्ठी भर"},
  {f:"Cooking oil, 1 tsp", g:10, hh:"2 tsp", hhHi:"2 छोटे चम्मच"}],
 extras:[["Ajwain (carom seeds)","अजवाइन","1/2 tsp","आधा छोटा चम्मच"],["Green chilli","हरी मिर्च","2","2"],
         ["Turmeric","हल्दी","1/4 tsp","चौथाई छोटा चम्मच"],["Salt","नमक","to taste","स्वादानुसार"]],
 steps:[
  ["Mix the besan with 200 ml water into a smooth, lump-free batter.","बेसन में 200 मि.ली. पानी मिलाकर बिना गुठली का चिकना घोल बनाएँ।"],
  ["Add chopped onion, tomato, spinach, green chilli, ajwain and salt.","कटा प्याज़, टमाटर, पालक, हरी मिर्च, अजवाइन और नमक डालें।"],
  ["Rest the batter 10 minutes.","घोल को 10 मिनट रखा रहने दें।"],
  ["Heat the tawa, pour one ladle and spread. Drizzle 2–3 g oil at the edges.","तवा गरम करें, एक कलछी घोल डालकर फैलाएँ। किनारों पर 2-3 ग्राम तेल डालें।"],
  ["Cook 2 minutes, flip, cook 1.5 minutes more.","2 मिनट सेकें, पलटें, और 1.5 मिनट सेकें।"],
  ["Makes 4 chillas. Serve hot with curd.","4 चीले बनेंगे। दही के साथ गरम परोसें।"]]}
];

export const ROTATION: RotationDay[] = [
 {day:"Sunday",    hi:"रविवार",   r:["peanut-laddoo","dal-tadka","palak-paneer"]},
 {day:"Monday",    hi:"सोमवार",   r:["masala-oats","dal-tadka","paneer-bhurji"]},
 {day:"Tuesday",   hi:"मंगलवार",  r:["moong-chilla","rajma","soya-keema"]},
 {day:"Wednesday", hi:"बुधवार",   r:["banana-shake","chole","palak-paneer"]},
 {day:"Thursday",  hi:"गुरुवार",  r:["besan-chilla","dal-tadka","soya-pulao"]},
 {day:"Friday",    hi:"शुक्रवार", r:["sprouts","rajma","paneer-bhurji"]},
 {day:"Saturday",  hi:"शनिवार",   r:["dalia-khichdi","chole","soya-keema"]}
];

/* ------------------------------------------------------------- the maths engine */
export const GOALS: Record<GoalKey, Goal> = {
  lean:     {pct: 0.12, label:"Lean bulk",       pk:2.0, fatPct:0.25, dir:1},
  fast:     {pct: 0.20, label:"Aggressive bulk", pk:2.0, fatPct:0.25, dir:1},
  maintain: {pct: 0.00, label:"Maintain",        pk:1.8, fatPct:0.28, dir:0},
  recomp:   {pct:-0.08, label:"Recomposition",   pk:2.2, fatPct:0.28, dir:-1},
  cut:      {pct:-0.20, label:"Cut",             pk:2.4, fatPct:0.28, dir:-1}
};

export function calc(p: Profile): Calc {
  const w = +p.wt, h = +p.ht, a = +p.age, act = +p.act;
  const bmr = Math.round(10*w + 6.25*h - 5*a + (p.sex==="m" ? 5 : -161));
  const tdee = Math.round(bmr * act);
  const g = GOALS[p.goal];
  const target = Math.round(tdee * (1 + g.pct));
  const protein = Math.round(w * g.pk);
  const fatG = Math.round((target * g.fatPct) / 9);
  const carbG = Math.max(0, Math.round((target - protein*4 - fatG*9) / 4));
  const bmi = w / Math.pow(h/100, 2);
  // realistic weekly gain: 0.25–0.5 % bodyweight for a bulk
  const wkLo = g.dir>0 ? w*0.0025 : (g.dir<0 ? -w*0.010 : 0);
  const wkHi = g.dir>0 ? w*0.005  : (g.dir<0 ? -w*0.005 : 0);
  return {bmr, tdee, target, protein, fatG, carbG, bmi, g, wkLo, wkHi, surplus: target - tdee};
}

export const nut = (food: Macro, g: number): Nutrients => ({k: food.k*g/100, p: food.p*g/100, c: food.c*g/100, f: food.f*g/100});
export const addN = (a: Nutrients, b: Nutrients): Nutrients => ({k:a.k+b.k, p:a.p+b.p, c:a.c+b.c, f:a.f+b.f});
export const ZERO: Nutrients = { k: 0, p: 0, c: 0, f: 0 };
export const r0 = (n: number) => Math.round(n);
export const r1 = (n: number) => Math.round(n * 10) / 10;


/* ---- plan scaling ---- */
function roundStep(g: number, step: number) { return Math.max(step, Math.round(g/step)*step); }
export function buildPlan(target: number, proteinTarget?: number, fatTarget?: number, carbTarget?: number, config?: PlanConfig): BuiltPlan {
  if(!proteinTarget) proteinTarget = Math.round(target*0.21/4);   // defensive fallbacks
  if(!fatTarget)     fatTarget     = Math.round(target*0.25/9);
  if(!carbTarget)    carbTarget    = Math.max(0,(target - proteinTarget*4 - fatTarget*9)/4);
  // Resolve which option each meal is using, and apply any per-item swaps,
  // before any arithmetic — the base calorie figure has to come from the food
  // actually chosen, or scaling would be computed against a menu nobody eats.
  const chosen = PLAN.map((m) => {
    const opts = m.options;
    const raw = config?.variants?.[m.tag] ?? 0;
    const variantIndex = Number.isFinite(raw) ? Math.min(Math.max(0, Math.trunc(raw)), opts.length - 1) : 0;
    const items = opts[variantIndex].items.map((it) => {
      const to = config?.swaps?.[`${m.tag}::${it.f}`];
      if (!to || to === it.f || !hasFood(to)) return { ...it, slot: it.f };
      const from = F(it.f), next = F(to);
      // Keep the number of household servings, not the gram weight: one glass
      // of milk becomes one cup of chai, not 250 g of chai leaves.
      const servings = from.sg > 0 ? it.g / from.sg : 1;
      const g = Math.max(1, Math.round(servings * next.sg));
      const liquid = /\bml\)/.test(next.sl);
      return {
        f: to, g, slot: it.f, swappedFrom: from.name, s: it.s,
        step: next.sg >= 150 ? 50 : next.sg >= 60 ? 25 : next.sg >= 25 ? 10 : 5,
        u: liquid ? "ml" : undefined, pcg: undefined,
      } as PlanItemTemplate & { slot: string; swappedFrom?: string };
    });
    return { time: m.time, tag: m.tag, name: opts[variantIndex].name,
             variantIndex, optionNames: opts.map((o) => o.name), items };
  });

  const base = chosen.reduce((s, m) => s + m.items.reduce((t, it) => t + F(it.f).k * it.g / 100, 0), 0);
  const factor = Math.max(0.55, Math.min(1.75, target / base));

  // Pass 1 — scale every portion and round to a practical kitchen quantity.
  const meals: PlanMeal[] = chosen.map((m) => ({
    time: m.time, tag: m.tag, name: m.name,
    variantIndex: m.variantIndex, optionNames: m.optionNames,
    tot: { ...ZERO },
    items: m.items.map((it): PlanItem => {
      const food = F(it.f);
      const fixed = it.s === false;
      const g = fixed ? it.g : roundStep(it.g * factor, it.step);
      return {
        food, g, u: it.u, pcg: it.pcg, step: it.step, fixed,
        slot: (it as { slot?: string }).slot ?? it.f,
        swappedFrom: (it as { swappedFrom?: string }).swappedFrom,
        lo: fixed ? g : Math.max(it.step, roundStep(it.g * factor * 0.45, it.step)),
        hi: fixed ? g : roundStep(it.g * factor * 2.2, it.step),
        n: nut(food, g),
      };
    }),
  }));

  // Pass 2 — rounding leaves a gap. Nudge single portions by one step at a time,
  // each time taking the move that most reduces combined calorie + protein error.
  const adj: PlanItem[] = meals.flatMap((m) => m.items).filter((i) => !i.fixed);
  const totals = () => adj.concat(meals.flatMap(m=>m.items).filter(i=>i.fixed))
                          .reduce((a,i)=>addN(a, nut(i.food,i.g)), {...ZERO});
  const cost = () => { const t = totals();
    // weights tuned across body types: protein matters most, then fat (it runs away
    // on a paneer-and-ghee diet), then carbs, which are the remainder anyway.
    return Math.abs(target - t.k) + 4*Math.abs(proteinTarget - t.p)
         + 3*Math.abs(fatTarget - t.f) + 1*Math.abs(carbTarget - t.c); };
  const moves = (it: PlanItem): Move[] => [it.step, -it.step].map((d) => ({ it, g: it.g + d } as Move))
                        .filter(m => m.g >= m.it.lo && m.g <= m.it.hi);
  const apply = (ms: Move[]) => ms.forEach((m) => { m.old = m.it.g; m.it.g = m.g; });
  const undo = (ms: Move[]) => ms.forEach((m) => { m.it.g = m.old as number; });

  for(let iter=0; iter<50; iter++){
    let bestCost = cost();
    let best: Move[] | null = null;
    if(bestCost < 25) break;
    // single-portion nudges
    for(const it of adj) for(const m of moves(it)){
      apply([m]); const c = cost(); undo([m]);
      if(c < bestCost - 0.5){ bestCost = c; best = [m]; }
    }
    // paired trades — one portion up, another down. Needed when protein must rise
    // while calories hold: more paneer only works if the rice comes down with it.
    if(!best){
      for(let i=0; i<adj.length; i++) for(let j=0; j<adj.length; j++){
        if(i === j) continue;
        for(const a of moves(adj[i])) for(const z of moves(adj[j])){
          apply([a,z]); const c = cost(); undo([a,z]);
          if(c < bestCost - 0.5){ bestCost = c; best = [a,z]; }
        }
      }
    }
    if(!best) break;
    apply(best);
  }

  meals.forEach(m=>{
    m.items.forEach(i=>{ i.n = nut(i.food, i.g); });
    m.tot = m.items.reduce((a,i)=>addN(a,i.n), {...ZERO});
  });
  const tot = meals.reduce((a,m)=>addN(a,m.tot), {...ZERO});
  return {meals, tot, factor, base};
}
const PLURAL_SAME: Record<string, number> = { katori: 1, ml: 1, roti: 1, tsp: 1 };
export function qtyLabel(it: { g: number; u?: string; pcg?: number }): string {
  if(it.u && it.pcg){
    const n = it.g / it.pcg;
    const s = (Math.round(n*2)/2).toString().replace(/^0\.5$/,"½").replace(".5","½");
    const unit = it.u + ((n > 1 && !PLURAL_SAME[it.u]) ? "s" : "");
    return s + " " + unit;
  }
  if(it.u === "ml") return it.g + " ml";
  return it.g + " g";
}

/* -------------------------------------------------------------- shared helpers */

/** Per-serving macros for a recipe, computed from its ingredient list so a card
 *  and the food database can never disagree. Spices in `extras` are ignored. */
export function recipeMacros(r: Recipe): Nutrients {
  const t = r.ing.reduce((a, i) => addN(a, nut(F(i.f), i.g)), { ...ZERO });
  return { k: t.k / r.serves, p: t.p / r.serves, c: t.c / r.serves, f: t.f / r.serves };
}

export const MEALS = [
  { k: "morning",   n: "Early morning",   t: "06:00 – 08:00" },
  { k: "breakfast", n: "Breakfast",       t: "08:00 – 11:00" },
  { k: "lunch",     n: "Lunch",           t: "12:00 – 15:00" },
  { k: "snack",     n: "Snacks & shakes", t: "any time" },
  { k: "dinner",    n: "Dinner",          t: "19:00 – 22:00" },
] as const;
export type MealKey = (typeof MEALS)[number]["k"];

/** Maps a plan meal's tag onto one of the tracker's five slots. */
export const TAG2MEAL: Record<string, MealKey> = {
  "On waking": "morning", Breakfast: "breakfast", "Mid-morning": "snack",
  Lunch: "lunch", "Around training": "snack", Dinner: "dinner", "Before bed": "snack",
};

export const ACTIVITY = [
  { v: "1.2",   label: "Sedentary — desk job, no training" },
  { v: "1.375", label: "Light — training 1–3 days/week" },
  { v: "1.55",  label: "Moderate — training 3–5 days/week" },
  { v: "1.725", label: "Heavy — training 6–7 days/week" },
  { v: "1.9",   label: "Very heavy — physical job + daily training" },
];

export const GOAL_OPTIONS: { v: GoalKey; label: string }[] = [
  { v: "lean",     label: "Lean bulk — slow, minimal fat gain (+12%)" },
  { v: "fast",     label: "Aggressive bulk — fastest gain, some fat (+20%)" },
  { v: "maintain", label: "Maintain — hold current weight (+0%)" },
  { v: "recomp",   label: "Recomposition — build muscle, lose fat (−8%)" },
  { v: "cut",      label: "Cut — lose fat, keep muscle (−20%)" },
];

export const PLAN_TITLE: Record<GoalKey, string> = {
  lean: "Your bulk plan", fast: "Your bulk plan", maintain: "Your maintenance plan",
  recomp: "Your recomposition plan", cut: "Your cutting plan",
};

/** Honest commentary on how close the generated day got, and what to change. */
export function planNote(c: Calc, P: BuiltPlan, gapP: number): string {
  const kGap = r0(P.tot.k - c.target);
  if (gapP > 45)
    return `This day is built around a <strong>surplus</strong>, so at ${c.target} kcal it cannot carry your ${c.protein} g protein target — it lands <strong>${r0(gapP)} g short</strong>. Three swaps fix it without adding calories: replace the oats with <strong>2 scoops of whey and a banana</strong>, switch full-fat paneer for <strong>low-fat paneer</strong> (24 g protein per 100 g instead of 18, at two-thirds the calories), and put <strong>30 g of dry soya chunks</strong> into the lunch sabzi. Cut the ghee, the nuts and one roti to pay for it.`;
  if (gapP > 15)
    return `Protein lands <strong>${r0(gapP)} g short</strong>, because portions were scaled to hit calories first. Close it with <strong>${Math.ceil(gapP / 24)} more scoop${Math.ceil(gapP / 24) > 1 ? "s" : ""} of whey</strong>, or swap the full-fat paneer at dinner for the same weight of <strong>low-fat paneer</strong>.`;
  if (gapP < -15)
    return `This day runs <strong>${r0(-gapP)} g of protein above</strong> target, which is harmless — surplus protein is simply used as fuel. If you want those calories back for carbs, drop the whey scoop.`;
  return `Protein lands within <strong>${Math.abs(r0(gapP))} g</strong> of target and calories within <strong>${Math.abs(kGap)} kcal</strong>. This day, repeated about ninety times, is the entire programme.`;
}

/**
 * Weight-trend reading. The plan lives or dies on this: daily weight is mostly
 * water noise, so we compare two 7-day averages and only speak when the gap
 * between them is bigger than the noise.
 */
export interface TrendRead {
  avg7: number | null; avg7Prev: number | null;
  ratePerWeek: number | null;
  expectedLo: number; expectedHi: number;
  verdict: "no-data" | "too-few" | "on-track" | "too-slow" | "too-fast" | "wrong-way";
  advice: string;
}
export function readTrend(
  weights: { d: string; w: number }[], c: Calc
): TrendRead {
  const sorted = [...weights].sort((a, b) => (a.d < b.d ? -1 : 1));
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const last = sorted.slice(-7).map((x) => x.w);
  const prev = sorted.slice(-14, -7).map((x) => x.w);
  const expectedLo = c.wkLo, expectedHi = c.wkHi;
  const base = {
    avg7: last.length ? mean(last) : null,
    avg7Prev: prev.length ? mean(prev) : null,
    ratePerWeek: null as number | null, expectedLo, expectedHi,
  };
  if (!sorted.length)
    return { ...base, verdict: "no-data",
      advice: "Log your weight every morning — after the toilet, before food or water, same clothes. Two weeks of readings and this panel starts telling you whether to change anything." };
  if (last.length < 4 || prev.length < 3)
    return { ...base, verdict: "too-few",
      advice: `You have ${sorted.length} reading${sorted.length === 1 ? "" : "s"}. A trend needs about 14 — a single morning tells you nothing, because water weight swings 1–2 kg for reasons unrelated to muscle. Keep logging.` };

  const rate = mean(last) - mean(prev);
  const out = { ...base, ratePerWeek: rate };
  const lo = expectedLo, hi = expectedHi;
  if (c.g.dir > 0) {
    if (rate < 0) return { ...out, verdict: "wrong-way",
      advice: `Your 7-day average is <strong>falling ${Math.abs(rate * 1000).toFixed(0)} g a week</strong> while you are trying to gain. You are not eating what you think you are eating — log everything for three days, including the oil in the sabzi. If the log is honest, add <strong>300 kcal</strong>.` };
    if (rate < lo) return { ...out, verdict: "too-slow",
      advice: `Gaining <strong>${(rate * 1000).toFixed(0)} g a week</strong>, below the ${(lo * 1000).toFixed(0)} g floor. Add <strong>200 kcal</strong> — one banana shake, or two teaspoons of ghee — and hold it for another two weeks before touching it again.` };
    if (rate > hi) return { ...out, verdict: "too-fast",
      advice: `Gaining <strong>${(rate * 1000).toFixed(0)} g a week</strong>, above the ${(hi * 1000).toFixed(0)} g ceiling your body can turn into muscle. The excess is going on as fat. Cut <strong>200 kcal</strong> — take it from the ghee and the nuts, never from the protein.` };
    return { ...out, verdict: "on-track",
      advice: `Gaining <strong>${(rate * 1000).toFixed(0)} g a week</strong>, inside the ${(lo * 1000).toFixed(0)}–${(hi * 1000).toFixed(0)} g window. Change nothing. Re-read this in two weeks.` };
  }
  if (c.g.dir < 0) {
    if (rate > 0) return { ...out, verdict: "wrong-way",
      advice: `Your average is <strong>rising ${(rate * 1000).toFixed(0)} g a week</strong> while you are trying to lose. Log everything for three days before changing the target — the gap is almost always untracked oil, sugar in tea, or weekend meals.` };
    if (rate > hi) return { ...out, verdict: "too-slow",
      advice: `Losing <strong>${Math.abs(rate * 1000).toFixed(0)} g a week</strong>, slower than planned. Cut <strong>200 kcal</strong> from carbs and fat, keep protein exactly where it is.` };
    if (rate < lo) return { ...out, verdict: "too-fast",
      advice: `Losing <strong>${Math.abs(rate * 1000).toFixed(0)} g a week</strong> — fast enough that some of it is muscle. Add <strong>200 kcal</strong> back and make sure you are still lifting.` };
    return { ...out, verdict: "on-track",
      advice: `Losing <strong>${Math.abs(rate * 1000).toFixed(0)} g a week</strong>, right on plan. Change nothing.` };
  }
  return { ...out, verdict: Math.abs(rate) < 0.3 ? "on-track" : "too-fast",
    advice: Math.abs(rate) < 0.3
      ? `Weight is holding within ${Math.abs(rate * 1000).toFixed(0)} g a week. That is what maintenance looks like.`
      : `Weight moved <strong>${(rate * 1000).toFixed(0)} g</strong> this week while you are aiming to maintain. Adjust by 150 kcal in the opposite direction.` };
}

/* ------------------------------------------------------------ cooking videos */

/**
 * A YouTube search URL for a dish, in Hindi where we have the name.
 *
 * Deliberately a *search*, not a hardcoded video id. Picking specific videos
 * would mean shipping links that rot, get taken down, or turn out to be the
 * wrong dish entirely — and nobody would notice until the person cooking
 * followed one. A search always resolves to something current, and anyone can
 * pin a specific video per recipe once they have watched it.
 */
export function youtubeSearchUrl(nameEn: string, nameHi?: string): string {
  const query = nameHi ? `${nameHi} रेसिपी` : `${nameEn} recipe`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

/** Accepts the URL forms people actually paste, and normalises to a watch link. */
export function parseYouTubeUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  let u: URL;
  try {
    u = new URL(s.startsWith("http") ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
  let id = "";
  if (host === "youtu.be") id = u.pathname.slice(1);
  else if (host === "youtube.com" || host === "music.youtube.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v") ?? "";
    else if (u.pathname.startsWith("/shorts/")) id = u.pathname.split("/")[2] ?? "";
    else if (u.pathname.startsWith("/embed/")) id = u.pathname.split("/")[2] ?? "";
    else if (u.pathname === "/results") return u.toString(); // a search is fine too
    else if (u.pathname.startsWith("/playlist")) return u.toString();
  } else {
    return null;
  }
  if (!/^[\w-]{11}$/.test(id)) return null;
  const t = u.searchParams.get("t");
  return `https://www.youtube.com/watch?v=${id}${t ? `&t=${encodeURIComponent(t)}` : ""}`;
}
