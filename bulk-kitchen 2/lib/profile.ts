import { q1, num } from "@/lib/db";
import type { PlanConfig, Profile } from "@/lib/nutrition";

export const PROFILE_COLUMNS =
  "id, name, sex, age, height_cm, weight_kg, activity, goal, plan_config";

export interface ProfileRow {
  id: string; name: string; sex: string; age: number;
  height_cm: string; weight_kg: string; activity: string; goal: string;
  plan_config: unknown;
}

export interface StoredProfile extends Profile { planConfig: PlanConfig }

export function toProfile(r: ProfileRow): StoredProfile {
  const cfg = (r.plan_config && typeof r.plan_config === "object" ? r.plan_config : {}) as PlanConfig;
  return {
    id: r.id, name: r.name, sex: r.sex === "f" ? "f" : "m", age: Number(r.age),
    ht: num(r.height_cm), wt: num(r.weight_kg), act: r.activity,
    goal: r.goal as Profile["goal"],
    planConfig: { variants: cfg.variants ?? {}, swaps: cfg.swaps ?? {} },
  };
}

/** Loads a profile for server-side plan rebuilding, or null if it is gone. */
export async function loadProfile(id: string): Promise<StoredProfile | null> {
  const r = await q1<ProfileRow>(`SELECT ${PROFILE_COLUMNS} FROM profiles WHERE id = $1`, [id]);
  return r ? toProfile(r) : null;
}
