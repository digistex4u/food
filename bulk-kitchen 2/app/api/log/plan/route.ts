import { q } from "@/lib/db";
import { handle, ok, str, dateField, ValidationError } from "@/lib/api";
import { buildPlan, calc, TAG2MEAL } from "@/lib/nutrition";
import { toEntry, LOG_COLUMNS, type LogRow } from "@/lib/log";
import { loadProfile } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Writes the generated bulk plan into a day's log in one transaction-free batch.
 * The plan is rebuilt on the server from the stored profile rather than trusted
 * from the client, so a tampered request cannot write nutrition that does not
 * follow from the person's own numbers.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const b = (await req.json()) as Record<string, unknown>;
    const profileId = str(b.profileId, "profileId", 64);
    const date = dateField(b.date);

    const profile = await loadProfile(profileId);
    if (!profile) throw new ValidationError("That profile no longer exists.");

    const c = calc(profile);
    const P = buildPlan(c.target, c.protein, c.fatG, c.carbG, profile.planConfig);

    const values: unknown[] = [];
    const tuples: string[] = [];
    for (const m of P.meals) {
      for (const it of m.items) {
        const n = it.n;
        const base = values.length;
        tuples.push(
          `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10})`
        );
        values.push(
          profileId, date, TAG2MEAL[m.tag] ?? "snack",
          it.food.name, it.food.name, it.g,
          n.k.toFixed(2), n.p.toFixed(2), n.c.toFixed(2), n.f.toFixed(2)
        );
      }
    }
    if (!tuples.length) throw new ValidationError("The plan produced no items.");

    const rows = await q<LogRow>(
      `INSERT INTO log_entries (profile_id, log_date, meal, food_ref, food_name, grams, kcal, protein, carbs, fat)
       VALUES ${tuples.join(",")}
       RETURNING ${LOG_COLUMNS}`,
      values
    );
    return ok(rows.map(toEntry));
  });
}
