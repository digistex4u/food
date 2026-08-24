import { Pool, type QueryResultRow } from "pg";

/**
 * Postgres access.
 *
 * Vercel injects DATABASE_URL (and POSTGRES_URL) when you attach a Postgres or
 * Neon database to the project, so nothing needs to be copied by hand. The pool
 * is cached on globalThis because serverless functions reuse their process
 * between invocations — without this, every request would open a new connection
 * and the database would run out of them under any real use.
 */

const CONN =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  "";

export const dbConfigured = Boolean(CONN);

declare global {
  // eslint-disable-next-line no-var
  var __bkPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __bkSchema: Promise<void> | undefined;
}

function pool(): Pool {
  if (!CONN) {
    throw new Error(
      "DATABASE_URL is not set. Attach a Postgres database to this Vercel project (Storage → Create Database), then redeploy."
    );
  }
  if (!globalThis.__bkPool) {
    globalThis.__bkPool = new Pool({
      connectionString: CONN,
      // Managed Postgres (Neon, Supabase, Vercel) all require TLS but present
      // certificates this container has no root for, so verification is off
      // while transport encryption stays on.
      ssl: CONN.includes("localhost") || CONN.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
    globalThis.__bkPool.on("error", (err) => {
      console.error("[db] idle client error", err.message);
    });
  }
  return globalThis.__bkPool;
}

/** Run a query, making sure the schema exists first. */
export async function q<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  await ensureSchema();
  const res = await pool().query<T>(text, params);
  return res.rows;
}

/** Same, for the common "expect one row" case. */
export async function q1<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS profiles (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  sex         TEXT NOT NULL DEFAULT 'm',
  age         INTEGER NOT NULL DEFAULT 28,
  height_cm   NUMERIC(5,1) NOT NULL DEFAULT 172,
  weight_kg   NUMERIC(5,1) NOT NULL DEFAULT 65,
  activity    TEXT NOT NULL DEFAULT '1.375',
  goal        TEXT NOT NULL DEFAULT 'lean',
  waist_cm    NUMERIC(5,1),
  hip_cm      NUMERIC(5,1),
  fat_pattern TEXT NOT NULL DEFAULT 'unset',
  build_type  TEXT NOT NULL DEFAULT 'unset',
  plan_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per food eaten. Macros are stored alongside the reference on purpose:
-- if a food's values are ever corrected, history must not silently rewrite itself.
CREATE TABLE IF NOT EXISTS log_entries (
  id          BIGSERIAL PRIMARY KEY,
  profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  log_date    DATE NOT NULL,
  meal        TEXT NOT NULL,
  food_ref    TEXT NOT NULL,
  food_name   TEXT NOT NULL,
  grams       NUMERIC(7,1) NOT NULL,
  kcal        NUMERIC(8,2) NOT NULL,
  protein     NUMERIC(7,2) NOT NULL,
  carbs       NUMERIC(7,2) NOT NULL,
  fat         NUMERIC(7,2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS log_entries_profile_date ON log_entries (profile_id, log_date);

CREATE TABLE IF NOT EXISTS weights (
  profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  log_date    DATE NOT NULL,
  weight_kg   NUMERIC(5,2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, log_date)
);

CREATE TABLE IF NOT EXISTS custom_foods (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  cat           TEXT NOT NULL DEFAULT 'dish',
  kcal_100      NUMERIC(7,2) NOT NULL,
  protein_100   NUMERIC(6,2) NOT NULL,
  carbs_100     NUMERIC(6,2) NOT NULL,
  fat_100       NUMERIC(6,2) NOT NULL,
  serving_g     NUMERIC(6,1) NOT NULL DEFAULT 100,
  serving_label TEXT NOT NULL DEFAULT '100 g',
  note          TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS custom_recipes (
  id          BIGSERIAL PRIMARY KEY,
  title_en    TEXT NOT NULL,
  title_hi    TEXT NOT NULL DEFAULT '',
  meal        TEXT NOT NULL DEFAULT 'Dinner',
  mins        INTEGER NOT NULL DEFAULT 20,
  serves      INTEGER NOT NULL DEFAULT 2,
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  extras      JSONB NOT NULL DEFAULT '[]'::jsonb,
  steps       JSONB NOT NULL DEFAULT '[]'::jsonb,
  day_index   INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shopping_items (
  id          BIGSERIAL PRIMARY KEY,
  profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  qty         TEXT NOT NULL DEFAULT '',
  cat         TEXT NOT NULL DEFAULT '',
  checked     BOOLEAN NOT NULL DEFAULT false,
  generated   BOOLEAN NOT NULL DEFAULT false,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shopping_profile ON shopping_items (profile_id);

-- One saved cooking video per recipe. Keyed by recipe id so it covers both the
-- shipped cards ("paneer-bhurji") and custom ones ("c12"), and is shared by the
-- whole household rather than per profile — the video is a property of the dish.
CREATE TABLE IF NOT EXISTS recipe_links (
  recipe_id  TEXT PRIMARY KEY,
  url        TEXT NOT NULL,
  title      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Added after the first release: meal options and per-item swaps. Existing
-- deployments get the column here rather than needing a migration step.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Body composition, added later: a waist measurement lets the app estimate body
-- fat and set protein from lean mass instead of total weight.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS waist_cm    NUMERIC(5,1);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hip_cm      NUMERIC(5,1);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fat_pattern TEXT NOT NULL DEFAULT 'unset';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS build_type  TEXT NOT NULL DEFAULT 'unset';
`;

/**
 * Creates the schema on first use and never again in this process. Every
 * statement is CREATE ... IF NOT EXISTS, so running it against an existing
 * database is a no-op — which is what makes it safe to call from every route
 * rather than needing a separate migration step at deploy time.
 */
export function ensureSchema(): Promise<void> {
  if (!globalThis.__bkSchema) {
    globalThis.__bkSchema = pool()
      .query(SCHEMA)
      .then(() => undefined)
      .catch((err) => {
        // Let the next request retry rather than caching a failure forever.
        globalThis.__bkSchema = undefined;
        throw err;
      });
  }
  return globalThis.__bkSchema;
}

/** Postgres NUMERIC arrives as a string; every read path goes through this. */
export const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

/** DATE arrives as a JS Date in UTC; we only ever want the calendar day. */
export const dateStr = (v: unknown): string =>
  v instanceof Date
    ? `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`
    : String(v).slice(0, 10);
