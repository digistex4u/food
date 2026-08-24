import { q, q1 } from "@/lib/db";
import { handle, ok, str, optStr, numField, ValidationError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Row {
  id: number; title_en: string; title_hi: string; meal: string;
  mins: number; serves: number;
  ingredients: unknown; extras: unknown; steps: unknown; day_index: number | null;
}

/** A custom recipe carries its own macros because its ingredients are free text
 *  — it is not tied to the built-in food table the way the shipped cards are. */
interface FreeIngredient { qty: string; en: string; hi: string }

const toRecipe = (r: Row) => ({
  id: `c${r.id}`, cid: Number(r.id), custom: true as const,
  en: r.title_en, hi: r.title_hi, meal: r.meal,
  mins: Number(r.mins), serves: Number(r.serves),
  free: (Array.isArray(r.ingredients) ? r.ingredients : []) as FreeIngredient[],
  extras: (Array.isArray(r.extras) ? r.extras : []) as string[][],
  steps: (Array.isArray(r.steps) ? r.steps : []) as [string, string][],
  day: r.day_index === null ? null : Number(r.day_index),
});

export async function GET() {
  return handle(async () => {
    const rows = await q<Row>(
      `SELECT id, title_en, title_hi, meal, mins, serves, ingredients, extras, steps, day_index
         FROM custom_recipes ORDER BY created_at DESC`
    );
    return ok(rows.map(toRecipe));
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const b = (await req.json()) as Record<string, unknown>;
    const en = str(b.en, "Recipe name", 120);
    const hi = optStr(b.hi, 120);
    const meal = optStr(b.meal, 30) || "Dinner";
    const mins = Math.round(numField(b.mins ?? 20, "Cooking time", 1, 600));
    const serves = Math.round(numField(b.serves ?? 2, "Serves", 1, 30));

    const rawIng = Array.isArray(b.ing) ? b.ing : [];
    if (!rawIng.length) throw new ValidationError("A recipe needs at least one ingredient.");
    if (rawIng.length > 40) throw new ValidationError("That is more than 40 ingredients — split the recipe up.");
    const ing: FreeIngredient[] = rawIng.slice(0, 40).map((x) => {
      const o = x as Record<string, unknown>;
      return { qty: optStr(o.qty, 40), en: optStr(o.en, 80), hi: optStr(o.hi, 80) };
    }).filter((x) => x.en || x.hi);

    const rawSteps = Array.isArray(b.steps) ? b.steps : [];
    if (!rawSteps.length) throw new ValidationError("A recipe needs at least one step.");
    const steps: [string, string][] = rawSteps.slice(0, 30).map((x) => {
      const a = x as unknown[];
      return [optStr(a?.[0], 400), optStr(a?.[1], 400)] as [string, string];
    }).filter((s) => s[0] || s[1]);

    const day = b.day === null || b.day === undefined || b.day === "" ? null
      : Math.max(0, Math.min(6, Math.round(Number(b.day))));

    const row = await q1<Row>(
      `INSERT INTO custom_recipes (title_en, title_hi, meal, mins, serves, ingredients, extras, steps, day_index)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,'[]'::jsonb,$7::jsonb,$8)
       RETURNING id, title_en, title_hi, meal, mins, serves, ingredients, extras, steps, day_index`,
      [en, hi, meal, mins, serves, JSON.stringify(ing), JSON.stringify(steps), day]
    );
    return ok(toRecipe(row as Row));
  });
}

export async function DELETE(req: Request) {
  return handle(async () => {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) throw new ValidationError("Which recipe should be removed?");
    await q1(`DELETE FROM custom_recipes WHERE id = $1`, [Number(id)]);
    return ok({ ok: true });
  });
}
