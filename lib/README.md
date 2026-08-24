# Bulk Kitchen

A vegetarian eating app for an Indian kitchen, in two halves. Answer one question — are you here
for **fitness** or for **lifestyle** — and it becomes either a measured mass-gain workbench or a
month of light Indian menus with a recipe video against every dish.

Built with Next.js (App Router) and Postgres. Deploys to Vercel.

---

## One screen at a time

The app is a wizard, not a set of tabs. Each screen does one thing and hands you to the next with
a **Next** button, in the order the work actually happens: decide what this is for, measure
yourself, read the numbers that follow, then the food. The rail across the top is the map — once a
step has been reached it stays clickable, so the wizard is a first pass rather than a corridor.

**Which screens exist depends on the first answer.**

| Step | Fitness | Lifestyle |
| --- | :---: | :---: |
| What is this for | ● | ● |
| About you | ● | ● |
| Body & fat pattern | ● | ● |
| How the body works | ● | — |
| Today's portions | ● | — |
| Your 30 days | ● | ● |
| Kitchen cards | ● | ● |
| **Daily tracker** | ● | **—** |
| Weight & progress | ● | ● |
| Food database | ● | ● |

A lifestyle user is never shown the daily food tracker. A food diary is the single most effective
habit in the weight-loss literature and also the one most people abandon inside a fortnight, so it
is offered to whoever asked for it and withheld from whoever did not. A tracker nobody fills in is
worse than no tracker: it turns an app you use into an app you owe.

### The lifestyle month

Thirty days — four weeks and two — of breakfast, lunch, evening snack and dinner. Every meal on
every day offers **three vegetarian Indian options**; tap one and it is saved for that day.
Ninety-one dishes in all, each with its serving in katori and chammach, a line on why it earns its
place, and a YouTube search built from its Hindi name.

The calendar is *generated*, not typed out. Thirty days by four slots by three options is 360
entries, and a hand-written table that size is a table with mistakes in it. Each slot walks its own
pool at its own stride, chosen to be coprime with the pool size — which is what guarantees every
dish comes round, no slot repeats the dish it offered yesterday, and breakfast and dinner do not
march in step. The build validator proves all of that rather than trusting the comment that claims
it.

**The menu is a base, and the app says so.** Four light plates come to about 1,300 kcal. For a small
sedentary person that is close to a maintenance day; for a 78 kg man who walks to work it is a 900
kcal hole, and serving him that under the banner of "lifestyle" would be prescribing a crash diet to
somebody who asked for dinner. So each day ends with what else goes on the plate — another roti, a
katori of dal, a glass of milk — closed greedily against what he actually burns, protein first,
against a floor of 1.2 g per kg rather than the deficiency-avoiding RDA of 0.8. Across four body
types from 48 kg to 92 kg, every one of the thirty days lands within 260 kcal of maintenance once
corrected. **Print the week** and the cook gets the dishes and the additions on one sheet, in Hindi
and English.

### The fitness month

Thirty days portioned to the same calorie and protein target, each built from a different set of
your meal options — so the numbers hold steady while the food does not repeat. This is not new
data: the plan template already carries three to five alternatives per feeding, and the schedule is
a walk over them. Each meal advances at a stride *chosen* to be coprime with its option count,
because with four options and a stride of two you would see two of them all month. Anything you
pinned on the plan screen stays pinned on all thirty days — choosing oats means oats.

---

## What's in it

| Section | What it does |
| --- | --- |
| **What is this for** | Fitness or lifestyle — the answer decides which of the screens below exist |
| **Your numbers** | Mifflin-St Jeor BMR → TDEE → goal-adjusted calorie target and macro split |
| **Body & fat pattern** | Waist-based body-fat and lean-mass estimates, waist-to-height risk banding, Asian Indian BMI cutoffs, and fat-distribution selectors |
| **How the body works** | Nine mechanisms — energy balance, the BMR/TEF/NEAT/EAT split, muscle protein synthesis, the leucine threshold, vegetarian protein quality, progressive overload, realistic rate of gain |
| **Daily tracker** | Log food by meal against the day's target, with a 14-day calorie strip |
| **Weight & progress** | Daily weights, a 7-day moving average, and a verdict that tells you when — and only when — to change the calorie target |
| **Bulk plan** | Seven feedings portioned to your exact target, each with 3–5 Indian alternatives, per-item swaps, and a tickable weekly shopping list |
| **Your 30 days** | A month of menus — the lifestyle calendar, or thirty target-matched fitness days |
| **Kitchen cards** | Hindi + English recipe cards on a 7-day rotation, printable with a QR code to the cooking video, quantities in grams *and* katori/chammach |
| **Food database** | 122 Indian foods per 100 g and per household serving, plus your own additions |

### Body type, honestly

Somatotypes (ectomorph / mesomorph / endomorph) are **not** used to set macros. That scheme comes
from Sheldon's 1940s constitutional psychology, and the strongest direct test of "match the diet to
the body" — DIETFITS (Gardner et al., *JAMA* 2018, n=609, 12 months) — found neither genotype
pattern (p=0.20) nor insulin secretion (p=0.47) predicted who did better on low-fat versus low-carb.

What *is* used is a tape measure, which changes two things defensibly:

- **Protein is set per kg of lean mass**, estimated via Relative Fat Mass (Woolcott & Bergman,
  *Sci Rep* 2018 — R² 0.75 in men vs 0.61 for BMI). Fat tissue needs almost no protein, so
  g/kg-*bodyweight* overshoots badly for anyone carrying more of it. This also fixed a real bug:
  an 88 kg cut previously demanded 211 g of protein that no vegetarian day could deliver; on lean
  mass it asks for 159 g, and the plan's shortfall dropped from 86 g to 37 g.
- **Waist-to-height ratio** drives the risk read, using the NICE NG246 bands (<0.5 healthy,
  0.5–0.59 increased, ≥0.6 high) and the 2025 Asian Indian cutoffs (BMI 23 overweight, waist
  ≥90 cm men / ≥80 cm women).

Fat *distribution* is offered as a selector because it is real and observable, and because the
thin-fat phenotype — normal BMI, high body fat, soft midsection — is common in South Asians and
invisible to BMI. It sharpens the advice. It does not change the macro split.

### Options and swaps

The day is not a fixed menu. Every feeding offers three to five Indian alternatives — oats or poha
or besan chilla or idli-sambar for breakfast; paneer bhurji, soya keema, palak paneer, dal makhani
or khichdi for dinner — and **any single item inside a meal can be traded for a comparable food**:
milk for masala chai or filter coffee, roti for rice, paneer for soya, ghee for oil.

A swap keeps the same number of *household servings* rather than the same grams or the same
calories: one glass of milk becomes one cup of chai, not 250 g of chai leaves. Whatever that
changes, the solver absorbs across the rest of the day — swap milk for black coffee and the protein
it was carrying gets made up elsewhere, visibly, in the totals.

Choices are stored per profile as JSON (`profiles.plan_config`) and validated server-side: an
unknown food or meal is dropped rather than stored, and the solver independently clamps anything
stale, so a config written by an older version can never crash a plan. Because the server rebuilds
the plan from the stored config, **Load bulk plan** and the shopping list follow the swaps too.

### Cooking videos

Every card links to a video. By default that is a **YouTube search** built from the dish's Hindi
name — `मसाला ओट्स रेसिपी` — never a hardcoded video id. Shipping specific links would mean shipping
things that rot, get taken down, or turn out to be the wrong dish, and nobody would notice until
the person cooking had already followed one.

Anyone can **pin a specific video** to a recipe once they have watched it and liked it; it is stored
in `recipe_links` and shared by the whole household, because the video is a property of the dish,
not of one person. Pasted URLs are parsed and rebuilt rather than stored as typed, so a Shorts link,
a `youtu.be` share link and a link with tracking parameters all normalise to the same clean watch
URL — and anything that is not a YouTube video is refused rather than printed onto a card.

Printed cards carry a **QR code** for whichever link applies, generated in the browser rather than
fetched from an image service: a card that only works online is a card that fails in a kitchen.

On the plan screen a meal gets a video link only when there is something to cook, and that is
decided from the data rather than the label: a meal containing a food the table classifies as a
cooked dish links to that dish, a meal with a grain in it links to the menu's own name, and milk,
nuts and a date get nothing. Eighteen of the thirty-one meal options carry a link and thirteen
correctly do not, because sending someone to a YouTube search for "milk, nuts and dates" answers a
question they did not ask.

### The plan solver

Scaling a meal template by a single factor gives portions that hit calories but drift badly on
macros. `buildPlan()` instead scales, rounds to practical kitchen quantities, then runs a small
search: it nudges individual portions by one step at a time, and — when no single change helps —
tries **paired trades**, raising one portion while lowering another. That pairing is what lets
protein rise while calories hold steady (more paneer only works if the rice comes down with it).

Measured across eight body types from 45 kg to 95 kg, the generated day lands within **±5 kcal**,
**±11 g protein** and **±7 g fat** of target. Where it genuinely cannot — a cut with a 211 g protein
target cannot be met by a bulk food template — it says so and names the swaps, instead of quietly
missing.

---

## Deploying your own

### 1. Deploy

Push this repo to your own GitHub account and import it in Vercel, or click through
**New Project → Import Git Repository**.

### 2. Attach a database

In the Vercel project: **Storage → Create Database → Postgres → Connect**.

Vercel injects `DATABASE_URL` automatically. **Tables are created on first page load** — there is no
migration step to run. The schema is a set of `CREATE TABLE IF NOT EXISTS` statements executed once
per server process, so it is safe against an existing database.

### 3. Set two environment variables

**Settings → Environment Variables:**

| Variable | What it is |
| --- | --- |
| `APP_PASSCODE` | The passcode everyone types to open the app |
| `AUTH_SECRET` | A long random string that signs the session cookie — `openssl rand -hex 32` |

### 4. Redeploy

Environment variables only reach the app on a fresh build: **Deployments → ⋯ → Redeploy**.

Visit `/setup` at any time; it shows which of the three values are still missing.

---

## Running locally

```bash
npm install
cp .env.example .env.local     # fill in DATABASE_URL, APP_PASSCODE, AUTH_SECRET
npm run dev
```

Any Postgres works — a local one, Neon, Supabase. With Docker:

```bash
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=bulkkitchen postgres:16
# DATABASE_URL=postgres://postgres:dev@127.0.0.1:5432/bulkkitchen
```

---

## How it's put together

```
lib/nutrition.ts    the whole domain: food table, mechanics copy, plan template,
                    recipes, BMR maths, the plan solver, the 30-day schedule,
                    weight-trend reading. Pure and dependency-free — the server
                    and the browser run the same code, so the API can rebuild a
                    plan to validate a write.
lib/lifestyle.ts    the other half: 91 Indian dishes across four slots, the walk
                    that turns them into a month, and the correction that fits a
                    light menu to a real person's maintenance.
lib/db.ts           pg Pool cached on globalThis (serverless reuses processes),
                    plus the idempotent schema.
lib/auth.ts         HMAC-signed cookie via Web Crypto, so middleware can verify
                    it on the edge runtime.
middleware.ts       gates every route and API path except /login and /setup.
app/api/*           REST endpoints, all validated server-side.
components/*        one component per wizard step; App.tsx is the shell that
                    decides which steps a path has and renders one at a time.
scripts/validate.ts every food reference in the plan, swap table and recipe
                    cards resolves; the food table's macros agree with its
                    calories; and the solver is run across body types, meal
                    options and every swap to prove it still lands on target.
```

Run the checks with `npm run validate`.

**Why passcode auth and not accounts.** Everyone in a household shares the data anyway, so per-user
login would add an OAuth round trip and buy nothing. One passcode, then pick your profile.

**Why macros are duplicated onto every log row.** A log entry stores the nutrition it was worth at
the time. If a food's values are later corrected, history stays true to what was recorded rather
than silently rewriting itself.

**Why dates never touch `toISOString()`.** It converts to UTC, which shifts the calendar day for
everyone east of Greenwich — including every user of this app. Days are formatted from local parts.

---

## A note on the numbers

Food values come from the Indian Food Composition Tables (IFCT 2017) and USDA FoodData Central.
BMR is Mifflin-St Jeor, which is a population average, not a measurement of you. Weigh yourself
daily, read the weekly average, and let your own scale overrule the formula.

This is general nutrition information, not medical advice.
