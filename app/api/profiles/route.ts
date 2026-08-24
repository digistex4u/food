import { q, q1 } from "@/lib/db";
import { handle, ok, str, numField, ValidationError } from "@/lib/api";
import { PROFILE_COLUMNS, toProfile, type ProfileRow } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GOALS = ["lean", "fast", "maintain", "recomp", "cut"];
const ACTS = ["1.2", "1.375", "1.55", "1.725", "1.9"];

export async function GET() {
  return handle(async () => {
    const rows = await q<ProfileRow>(
      `SELECT ${PROFILE_COLUMNS} FROM profiles ORDER BY sort_order, created_at`
    );
    return ok(rows.map(toProfile));
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const b = (await req.json()) as Record<string, unknown>;
    const name = str(b.name, "Name", 60);
    const sex = b.sex === "f" ? "f" : "m";
    const age = numField(b.age ?? 28, "Age", 12, 100);
    const ht = numField(b.ht ?? 172, "Height", 100, 250);
    const wt = numField(b.wt ?? 65, "Weight", 25, 300);
    const act = ACTS.includes(String(b.act)) ? String(b.act) : "1.375";
    const goal = GOALS.includes(String(b.goal)) ? String(b.goal) : "lean";

    const count = await q1<{ n: string }>(`SELECT count(*)::text AS n FROM profiles`);
    if (Number(count?.n ?? 0) >= 20) {
      throw new ValidationError("That is 20 profiles already — remove one before adding another.");
    }
    const row = await q1<ProfileRow>(
      `INSERT INTO profiles (id, name, sex, age, height_cm, weight_kg, activity, goal, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, COALESCE((SELECT max(sort_order)+1 FROM profiles), 0))
       RETURNING ${PROFILE_COLUMNS}`,
      [crypto.randomUUID(), name, sex, age, ht, wt, act, goal]
    );
    return ok(toProfile(row as ProfileRow));
  });
}
