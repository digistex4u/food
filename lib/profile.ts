import { q1, num } from "@/lib/db";
import type { BuildType, FatPattern, PathKey, PlanConfig, Profile } from "@/lib/nutrition";
import { cleanMenuConfig, type MenuConfig } from "@/lib/lifestyle";

export const PROFILE_COLUMNS =
  "id, name, sex, age, height_cm, weight_kg, activity, goal, plan_config, waist_cm, hip_cm, fat_pattern, build_type, path, menu_config";

export interface ProfileRow {
  id: string; name: string; sex: string; age: number;
  height_cm: string; weight_kg: string; activity: string; goal: string;
  plan_config: unknown;
  waist_cm: string | null; hip_cm: string | null;
  fat_pattern: string; build_type: string;
  path: string; menu_config: unknown;
}

export interface StoredProfile extends Profile { planConfig: PlanConfig; menuConfig: MenuConfig }

export function toProfile(r: ProfileRow): StoredProfile {
  const cfg = (r.plan_config && typeof r.plan_config === "object" ? r.plan_config : {}) as PlanConfig;
  return {
    id: r.id, name: r.name, sex: r.sex === "f" ? "f" : "m", age: Number(r.age),
    ht: num(r.height_cm), wt: num(r.weight_kg), act: r.activity,
    goal: r.goal as Profile["goal"],
    waist: r.waist_cm === null ? null : num(r.waist_cm),
    hip: r.hip_cm === null ? null : num(r.hip_cm),
    pattern: (r.fat_pattern || "unset") as FatPattern,
    build: (r.build_type || "unset") as BuildType,
    path: (r.path === "fitness" || r.path === "lifestyle" ? r.path : "unset") as PathKey,
    planConfig: { variants: cfg.variants ?? {}, swaps: cfg.swaps ?? {} },
    menuConfig: cleanMenuConfig(r.menu_config),
  };
}

/** Loads a profile for server-side plan rebuilding, or null if it is gone. */
export async function loadProfile(id: string): Promise<StoredProfile | null> {
  const r = await q1<ProfileRow>(`SELECT ${PROFILE_COLUMNS} FROM profiles WHERE id = $1`, [id]);
  return r ? toProfile(r) : null;
}
