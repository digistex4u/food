import { q, q1, num, dbConfigured } from "@/lib/db";
import { handle, ok } from "@/lib/api";
import { NextResponse } from "next/server";
import { PROFILE_COLUMNS, toProfile, type ProfileRow } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Everything the app needs on first paint, in one round trip: the profile list
 * (creating a starter profile if the database is empty), plus custom foods and
 * recipes. Saves the client from a waterfall of four requests before it can
 * draw anything.
 */
export async function GET() {
  if (!dbConfigured) {
    return NextResponse.json(
      { error: "No database attached yet.", setup: true },
      { status: 503 }
    );
  }
  return handle(async () => {
    let profiles = await q<ProfileRow>(
      `SELECT ${PROFILE_COLUMNS} FROM profiles ORDER BY sort_order, created_at`
    );

    if (!profiles.length) {
      await q1(
        `INSERT INTO profiles (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [crypto.randomUUID(), "Me"]
      );
      profiles = await q<ProfileRow>(
        `SELECT ${PROFILE_COLUMNS} FROM profiles ORDER BY sort_order, created_at`
      );
    }

    const [foods, recipes] = await Promise.all([
      q(`SELECT id, name, cat, kcal_100, protein_100, carbs_100, fat_100, serving_g, serving_label, note
           FROM custom_foods ORDER BY name`),
      q(`SELECT id, title_en, title_hi, meal, mins, serves, ingredients, extras, steps, day_index
           FROM custom_recipes ORDER BY created_at DESC`),
    ]);

    return ok({
      profiles: profiles.map(toProfile),
      customFoods: foods.map((r) => ({
        id: -Number(r.id), cid: Number(r.id), name: r.name, cat: r.cat,
        k: num(r.kcal_100), p: num(r.protein_100), c: num(r.carbs_100), f: num(r.fat_100),
        sg: num(r.serving_g), sl: r.serving_label, note: r.note, custom: true,
      })),
      customRecipes: recipes.map((r) => ({
        id: `c${r.id}`, cid: Number(r.id), custom: true,
        en: r.title_en, hi: r.title_hi, meal: r.meal,
        mins: Number(r.mins), serves: Number(r.serves),
        free: Array.isArray(r.ingredients) ? r.ingredients : [],
        steps: Array.isArray(r.steps) ? r.steps : [],
        day: r.day_index === null ? null : Number(r.day_index),
      })),
    });
  });
}
