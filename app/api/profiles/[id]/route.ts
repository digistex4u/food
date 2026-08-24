import { q1 } from "@/lib/db";
import { handle, ok, numField, ValidationError } from "@/lib/api";
import { PROFILE_COLUMNS, toProfile, type ProfileRow } from "@/lib/profile";
import { PLAN, hasFood, type PlanConfig } from "@/lib/nutrition";
import { cleanMenuConfig } from "@/lib/lifestyle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GOALS = ["lean", "fast", "maintain", "recomp", "cut"];
const ACTS = ["1.2", "1.375", "1.55", "1.725", "1.9"];
const PATTERNS = ["central", "lower", "even", "thinfat", "unset"];
const BUILDS = ["hardgainer", "balanced", "gains-fat", "unset"];
const PATHS = ["fitness", "lifestyle", "unset"];
const TAGS = new Set(PLAN.map((m) => m.tag));

/**
 * Sanitises the meal-option and swap choices before they are stored. A config
 * is replayed by the solver on every plan build, so a junk value written once
 * would break every future plan — it is cheaper to reject it here.
 */
function cleanConfig(raw: unknown): PlanConfig {
  const src = (raw && typeof raw === "object" ? raw : {}) as PlanConfig;
  const variants: Record<string, number> = {};
  for (const [tag, v] of Object.entries(src.variants ?? {})) {
    const meal = PLAN.find((m) => m.tag === tag);
    if (!meal) continue;
    const n = Math.trunc(Number(v));
    if (Number.isFinite(n) && n >= 0 && n < meal.options.length) variants[tag] = n;
  }
  const swaps: Record<string, string> = {};
  for (const [key, to] of Object.entries(src.swaps ?? {})) {
    const [tag, from] = String(key).split("::");
    if (!TAGS.has(tag) || !from || typeof to !== "string") continue;
    if (!hasFood(from) || !hasFood(to)) continue;
    if (Object.keys(swaps).length >= 60) break;
    swaps[`${tag}::${from}`] = to;
  }
  return { variants, swaps };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const b = (await req.json()) as Record<string, unknown>;

    // Build the update from whichever fields were actually sent, so the client
    // can PATCH a single edited input without echoing the whole profile back.
    const sets: string[] = [];
    const vals: unknown[] = [];
    const push = (col: string, v: unknown) => { sets.push(`${col} = $${sets.length + 1}`); vals.push(v); };

    if (b.name !== undefined) push("name", String(b.name).trim().slice(0, 60) || "Person");
    if (b.sex !== undefined) push("sex", b.sex === "f" ? "f" : "m");
    if (b.age !== undefined) push("age", Math.round(numField(b.age, "Age", 12, 100)));
    if (b.ht !== undefined) push("height_cm", numField(b.ht, "Height", 100, 250));
    if (b.wt !== undefined) push("weight_kg", numField(b.wt, "Weight", 25, 300));
    if (b.act !== undefined && ACTS.includes(String(b.act))) push("activity", String(b.act));
    if (b.goal !== undefined && GOALS.includes(String(b.goal))) push("goal", String(b.goal));
    // A tape measurement can be cleared as well as set, so null is meaningful here.
    if (b.waist !== undefined)
      push("waist_cm", b.waist === null || b.waist === "" ? null : numField(b.waist, "Waist", 40, 200));
    if (b.hip !== undefined)
      push("hip_cm", b.hip === null || b.hip === "" ? null : numField(b.hip, "Hip", 40, 200));
    if (b.pattern !== undefined && PATTERNS.includes(String(b.pattern))) push("fat_pattern", String(b.pattern));
    if (b.build !== undefined && BUILDS.includes(String(b.build))) push("build_type", String(b.build));
    if (b.path !== undefined && PATHS.includes(String(b.path))) push("path", String(b.path));
    if (b.menuConfig !== undefined) {
      sets.push(`menu_config = $${sets.length + 1}::jsonb`);
      vals.push(JSON.stringify(cleanMenuConfig(b.menuConfig)));
    }
    if (b.planConfig !== undefined) {
      sets.push(`plan_config = $${sets.length + 1}::jsonb`);
      vals.push(JSON.stringify(cleanConfig(b.planConfig)));
    }
    if (!sets.length) throw new ValidationError("Nothing to update.");

    vals.push(id);
    const row = await q1<ProfileRow>(
      `UPDATE profiles SET ${sets.join(", ")} WHERE id = $${vals.length} RETURNING ${PROFILE_COLUMNS}`,
      vals
    );
    if (!row) throw new ValidationError("That profile no longer exists.");
    return ok(toProfile(row));
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const left = await q1<{ n: string }>(`SELECT count(*)::text AS n FROM profiles`);
    if (Number(left?.n ?? 0) <= 1) {
      throw new ValidationError("This is the only profile — add another before removing it.");
    }
    // log_entries, weights and shopping_items cascade on delete.
    await q1(`DELETE FROM profiles WHERE id = $1`, [id]);
    return ok({ ok: true });
  });
}
