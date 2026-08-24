import { q, q1 } from "@/lib/db";
import { handle, ok, str, optStr, numField, dateField, ValidationError } from "@/lib/api";
import { MEALS } from "@/lib/nutrition";
import { toEntry, LOG_COLUMNS, type LogRow } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MEAL_KEYS = MEALS.map((m) => m.k) as readonly string[];


export async function GET(req: Request) {
  return handle(async () => {
    const u = new URL(req.url);
    const profile = str(u.searchParams.get("profile"), "profile", 64);
    const date = dateField(u.searchParams.get("date"));
    const rows = await q<LogRow>(
      `SELECT ${LOG_COLUMNS} FROM log_entries
        WHERE profile_id = $1 AND log_date = $2 ORDER BY id`,
      [profile, date]
    );
    return ok(rows.map(toEntry));
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const b = (await req.json()) as Record<string, unknown>;
    const profile = str(b.profileId, "profileId", 64);
    const date = dateField(b.date);
    const meal = String(b.meal);
    if (!MEAL_KEYS.includes(meal)) throw new ValidationError("Unknown meal slot.");

    const grams = numField(b.g, "Quantity", 0.1, 5000);
    const row = await q1<LogRow>(
      `INSERT INTO log_entries (profile_id, log_date, meal, food_ref, food_name, grams, kcal, protein, carbs, fat)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING ${LOG_COLUMNS}`,
      [
        profile, date, meal,
        optStr(b.ref, 120) || "custom",
        str(b.name, "Food name", 120),
        grams,
        numField(b.k, "kcal", 0, 20000),
        numField(b.p, "protein", 0, 2000),
        numField(b.c, "carbs", 0, 3000),
        numField(b.f, "fat", 0, 2000),
      ]
    );
    return ok(toEntry(row as LogRow));
  });
}

export async function DELETE(req: Request) {
  return handle(async () => {
    const u = new URL(req.url);
    const id = u.searchParams.get("id");
    const profile = u.searchParams.get("profile");
    const date = u.searchParams.get("date");
    if (id) {
      await q1(`DELETE FROM log_entries WHERE id = $1`, [Number(id)]);
      return ok({ ok: true });
    }
    // No id means "clear this whole day".
    if (profile && date) {
      await q1(`DELETE FROM log_entries WHERE profile_id = $1 AND log_date = $2`, [profile, dateField(date)]);
      return ok({ ok: true });
    }
    throw new ValidationError("Pass either an entry id, or a profile and date to clear.");
  });
}

