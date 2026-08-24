# Bulk Kitchen

A vegetarian mass-gain workbench for an Indian kitchen. It works out what you should eat from your
own body, tracks what you actually ate, turns the target into a portioned day, and prints the
cooking instructions in Hindi and English for whoever is at the stove.

Built with Next.js (App Router) and Postgres. Deploys to Vercel.

---

## What's in it

| Section | What it does |
| --- | --- |
| **Your numbers** | Mifflin-St Jeor BMR → TDEE → goal-adjusted calorie target and macro split |
| **How the body works** | Nine mechanisms — energy balance, the BMR/TEF/NEAT/EAT split, muscle protein synthesis, the leucine threshold, vegetarian protein quality, progressive overload, realistic rate of gain |
| **Daily tracker** | Log food by meal against the day's target, with a 14-day calorie strip |
| **Weight & progress** | Daily weights, a 7-day moving average, and a verdict that tells you when — and only when — to change the calorie target |
| **Bulk plan** | Seven feedings portioned to your exact target, each with 3–5 Indian alternatives, per-item swaps, and a tickable weekly shopping list |
| **Kitchen cards** | Hindi + English recipe cards on a 7-day rotation, printable with a QR code to the cooking video, quantities in grams *and* katori/chammach |
| **Food database** | 122 Indian foods per 100 g and per household serving, plus your own additions |

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
                    recipes, BMR maths, the plan solver, weight-trend reading.
                    Pure and dependency-free — the server and the browser run the
                    same code, so the API can rebuild a plan to validate a write.
lib/db.ts           pg Pool cached on globalThis (serverless reuses processes),
                    plus the idempotent schema.
lib/auth.ts         HMAC-signed cookie via Web Crypto, so middleware can verify
                    it on the edge runtime.
middleware.ts       gates every route and API path except /login and /setup.
app/api/*           REST endpoints, all validated server-side.
components/*        one component per tab.
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
