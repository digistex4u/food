"use client";

import type { Food, PlanConfig, Profile, Recipe } from "@/lib/nutrition";

/** A profile as the API returns it: the body numbers plus the person's chosen
 *  meal options and food swaps. */
export interface AppProfile extends Profile { planConfig: PlanConfig }

export interface CustomFood extends Food { cid: number; custom: true }
export interface FreeIngredient { qty: string; en: string; hi: string }
export interface CustomRecipe {
  id: string; cid: number; custom: true;
  en: string; hi: string; meal: string; mins: number; serves: number;
  free: FreeIngredient[]; steps: [string, string][]; day: number | null;
}
export type AnyRecipe = Recipe | CustomRecipe;
export const isCustomRecipe = (r: AnyRecipe): r is CustomRecipe =>
  (r as CustomRecipe).custom === true;

export interface LogEntry {
  id: number; meal: string; ref: string; name: string;
  g: number; k: number; p: number; c: number; f: number;
}
export interface ShoppingItem {
  id: number; name: string; qty: string; cat: string;
  checked: boolean; generated: boolean; sort: number;
}
export interface WeightPoint { d: string; w: number }
export interface DayTotal { d: string; k: number; p: number }

/** A cooking video pinned to a recipe, shared by everyone in the household. */
export interface RecipeLink { id: string; url: string; title: string }

export interface Bootstrap {
  profiles: AppProfile[];
  customFoods: CustomFood[];
  customRecipes: CustomRecipe[];
  recipeLinks: RecipeLink[];
}

/** Thin fetch wrapper: JSON in, JSON out, and server error messages surface as
 *  thrown Errors so every caller can show the real reason rather than "failed". */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* non-JSON error page */ }

  if (!res.ok) {
    if (res.status === 401) {
      window.location.href = "/login";
      throw new Error("Signed out");
    }
    const msg = (body as { error?: string })?.error;
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return body as T;
}

export const jsonBody = (data: unknown) => ({ method: "POST", body: JSON.stringify(data) });
export const patchBody = (data: unknown) => ({ method: "PATCH", body: JSON.stringify(data) });

/** Local calendar day as YYYY-MM-DD. Never toISOString(), which shifts the day
 *  for anyone east of UTC — including everyone using this app. */
export const dkey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const parseDay = (s: string): Date => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
