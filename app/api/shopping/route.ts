import { q, q1 } from "@/lib/db";
import { handle, ok, str, optStr, ValidationError } from "@/lib/api";
import { buildPlan, calc, CATS, F } from "@/lib/nutrition";
import { loadProfile } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Row {
  id: number; name: string; qty: string; cat: string;
  checked: boolean; generated: boolean; sort_order: number;
}
const toItem = (r: Row) => ({
  id: Number(r.id), name: r.name, qty: r.qty, cat: r.cat,
  checked: r.checked, generated: r.generated, sort: Number(r.sort_order),
});

export async function GET(req: Request) {
  return handle(async () => {
    const profile = str(new URL(req.url).searchParams.get("profile"), "profile", 64);
    const rows = await q<Row>(
      `SELECT id, name, qty, cat, checked, generated, sort_order
         FROM shopping_items WHERE profile_id = $1 ORDER BY sort_order, id`,
      [profile]
    );
    return ok(rows.map(toItem));
  });
}

/**
 * Two jobs: add one hand-typed item, or regenerate the whole week's list from
 * the plan. Regenerating deliberately keeps hand-added rows and the checked
 * state of anything still on the list, because the alternative — wiping what
 * someone already ticked off in the shop — is the worse failure.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const b = (await req.json()) as Record<string, unknown>;
    const profileId = str(b.profileId, "profileId", 64);

    if (b.action === "generate") {
      const profile = await loadProfile(profileId);
      if (!profile) throw new ValidationError("That profile no longer exists.");

      const c = calc(profile);
      const P = buildPlan(c.target, c.protein, c.fatG, c.carbG, profile.planConfig);

      const agg: Record<string, number> = {};
      for (const m of P.meals) for (const it of m.items) {
        agg[it.food.name] = (agg[it.food.name] ?? 0) + it.g * 7;
      }
      const entries = Object.entries(agg).sort((a, z) => z[1] - a[1]);

      await q1(`DELETE FROM shopping_items WHERE profile_id = $1 AND generated = true`, [profileId]);

      const vals: unknown[] = [];
      const tuples: string[] = [];
      entries.forEach(([name, grams], i) => {
        const qty = grams >= 1000 ? `${(Math.round(grams / 100) / 10).toFixed(1)} kg` : `${Math.round(grams)} g`;
        const base = vals.length;
        tuples.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},true,$${base + 5})`);
        vals.push(profileId, name, qty, CATS[F(name).cat] ?? "Other", i);
      });
      if (tuples.length) {
        await q(
          `INSERT INTO shopping_items (profile_id, name, qty, cat, generated, sort_order) VALUES ${tuples.join(",")}`,
          vals
        );
      }
      const rows = await q<Row>(
        `SELECT id, name, qty, cat, checked, generated, sort_order
           FROM shopping_items WHERE profile_id = $1 ORDER BY sort_order, id`,
        [profileId]
      );
      return ok(rows.map(toItem));
    }

    const name = str(b.name, "Item", 120);
    const row = await q1<Row>(
      `INSERT INTO shopping_items (profile_id, name, qty, cat, generated, sort_order)
       VALUES ($1,$2,$3,'Added by hand',false, 9000)
       RETURNING id, name, qty, cat, checked, generated, sort_order`,
      [profileId, name, optStr(b.qty, 40)]
    );
    return ok(toItem(row as Row));
  });
}

export async function PATCH(req: Request) {
  return handle(async () => {
    const b = (await req.json()) as Record<string, unknown>;
    if (b.action === "uncheckAll") {
      const profileId = str(b.profileId, "profileId", 64);
      await q1(`UPDATE shopping_items SET checked = false WHERE profile_id = $1`, [profileId]);
      return ok({ ok: true });
    }
    const id = Number(b.id);
    if (!id) throw new ValidationError("Which item?");
    const row = await q1<Row>(
      `UPDATE shopping_items SET checked = $1 WHERE id = $2
       RETURNING id, name, qty, cat, checked, generated, sort_order`,
      [Boolean(b.checked), id]
    );
    if (!row) throw new ValidationError("That item is gone.");
    return ok(toItem(row));
  });
}

export async function DELETE(req: Request) {
  return handle(async () => {
    const u = new URL(req.url);
    const id = u.searchParams.get("id");
    const profile = u.searchParams.get("profile");
    if (id) { await q1(`DELETE FROM shopping_items WHERE id = $1`, [Number(id)]); return ok({ ok: true }); }
    if (profile) {
      await q1(`DELETE FROM shopping_items WHERE profile_id = $1 AND checked = true`, [profile]);
      return ok({ ok: true });
    }
    throw new ValidationError("Pass an item id, or a profile to clear the ticked items.");
  });
}
