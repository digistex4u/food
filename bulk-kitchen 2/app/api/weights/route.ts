import { q, q1, num, dateStr } from "@/lib/db";
import { handle, ok, str, numField, dateField, ValidationError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(async () => {
    const u = new URL(req.url);
    const profile = str(u.searchParams.get("profile"), "profile", 64);
    const days = Math.min(365, Math.max(14, Number(u.searchParams.get("days") ?? 90)));
    const rows = await q<{ log_date: Date; weight_kg: string }>(
      `SELECT log_date, weight_kg FROM weights
        WHERE profile_id = $1 AND log_date > CURRENT_DATE - $2::int
        ORDER BY log_date`,
      [profile, days]
    );
    return ok(rows.map((r) => ({ d: dateStr(r.log_date), w: num(r.weight_kg) })));
  });
}

/**
 * One weight per calendar day — logging twice replaces the earlier reading
 * rather than adding a second, because two readings on one day is a mistake,
 * not data.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const b = (await req.json()) as Record<string, unknown>;
    const profile = str(b.profileId, "profileId", 64);
    const date = dateField(b.date);
    const w = numField(b.weight, "Weight", 25, 300);
    await q1(
      `INSERT INTO weights (profile_id, log_date, weight_kg) VALUES ($1,$2,$3)
       ON CONFLICT (profile_id, log_date) DO UPDATE SET weight_kg = EXCLUDED.weight_kg`,
      [profile, date, w]
    );
    // Keep the profile's own weight in step with the newest reading, so the
    // calorie target tracks the body it is being calculated for.
    const newest = await q1<{ log_date: Date }>(
      `SELECT log_date FROM weights WHERE profile_id = $1 ORDER BY log_date DESC LIMIT 1`,
      [profile]
    );
    if (newest && dateStr(newest.log_date) === date) {
      await q1(`UPDATE profiles SET weight_kg = $1 WHERE id = $2`, [w, profile]);
    }
    return ok({ ok: true, d: date, w });
  });
}

export async function DELETE(req: Request) {
  return handle(async () => {
    const u = new URL(req.url);
    const profile = str(u.searchParams.get("profile"), "profile", 64);
    const date = u.searchParams.get("date");
    if (!date) throw new ValidationError("Which day should be removed?");
    await q1(`DELETE FROM weights WHERE profile_id = $1 AND log_date = $2`, [profile, dateField(date)]);
    return ok({ ok: true });
  });
}
