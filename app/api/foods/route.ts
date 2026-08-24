import { q, q1, num } from "@/lib/db";
import { handle, ok, str, optStr, numField, ValidationError } from "@/lib/api";
import { CATS } from "@/lib/nutrition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Row {
  id: number; name: string; cat: string;
  kcal_100: string; protein_100: string; carbs_100: string; fat_100: string;
  serving_g: string; serving_label: string; note: string;
}
const toFood = (r: Row) => ({
  id: -Number(r.id), // negative ids keep custom foods from colliding with built-ins
  cid: Number(r.id),
  name: r.name, cat: r.cat,
  k: num(r.kcal_100), p: num(r.protein_100), c: num(r.carbs_100), f: num(r.fat_100),
  sg: num(r.serving_g), sl: r.serving_label, note: r.note, custom: true as const,
});

export async function GET() {
  return handle(async () => {
    const rows = await q<Row>(
      `SELECT id, name, cat, kcal_100, protein_100, carbs_100, fat_100, serving_g, serving_label, note
         FROM custom_foods ORDER BY name`
    );
    return ok(rows.map(toFood));
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const b = (await req.json()) as Record<string, unknown>;
    const name = str(b.name, "Food name", 120);
    const cat = Object.keys(CATS).includes(String(b.cat)) ? String(b.cat) : "dish";
    const k = numField(b.k, "Calories per 100 g", 0, 950);
    const p = numField(b.p, "Protein per 100 g", 0, 100);
    const c = numField(b.c, "Carbs per 100 g", 0, 100);
    const f = numField(b.f, "Fat per 100 g", 0, 100);

    // Catch the commonest data-entry mistake: macros that cannot produce the
    // stated calories. 4/4/9 with a generous tolerance for fibre and rounding.
    const implied = p * 4 + c * 4 + f * 9;
    if (k > 0 && Math.abs(implied - k) > Math.max(60, k * 0.3)) {
      throw new ValidationError(
        `Those numbers do not add up: ${p} g protein, ${c} g carbs and ${f} g fat work out to about ${Math.round(implied)} kcal, not ${k}. Check the label.`
      );
    }
    if (p + c + f > 100) {
      throw new ValidationError("Protein, carbs and fat cannot add up to more than 100 g per 100 g of food.");
    }

    const sg = numField(b.sg ?? 100, "Serving size", 1, 2000);
    const sl = optStr(b.sl, 80) || `${Math.round(sg)} g`;

    const exists = await q1<{ id: number }>(`SELECT id FROM custom_foods WHERE lower(name) = lower($1)`, [name]);
    if (exists) throw new ValidationError(`"${name}" is already in your custom foods.`);

    const row = await q1<Row>(
      `INSERT INTO custom_foods (name, cat, kcal_100, protein_100, carbs_100, fat_100, serving_g, serving_label, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'yours')
       RETURNING id, name, cat, kcal_100, protein_100, carbs_100, fat_100, serving_g, serving_label, note`,
      [name, cat, k, p, c, f, sg, sl]
    );
    return ok(toFood(row as Row));
  });
}

export async function DELETE(req: Request) {
  return handle(async () => {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) throw new ValidationError("Which food should be removed?");
    await q1(`DELETE FROM custom_foods WHERE id = $1`, [Number(id)]);
    return ok({ ok: true });
  });
}
