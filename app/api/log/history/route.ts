import { q, num, dateStr } from "@/lib/db";
import { handle, ok, str } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Daily calorie and protein totals, for the 14-day bar strip. */
export async function GET(req: Request) {
  return handle(async () => {
    const u = new URL(req.url);
    const profile = str(u.searchParams.get("profile"), "profile", 64);
    const days = Math.min(120, Math.max(7, Number(u.searchParams.get("days") ?? 14)));
    const rows = await q<{ log_date: Date; kcal: string; protein: string }>(
      `SELECT log_date, SUM(kcal) AS kcal, SUM(protein) AS protein
         FROM log_entries
        WHERE profile_id = $1 AND log_date > CURRENT_DATE - $2::int
        GROUP BY log_date ORDER BY log_date`,
      [profile, days]
    );
    return ok(rows.map((r) => ({ d: dateStr(r.log_date), k: num(r.kcal), p: num(r.protein) })));
  });
}
