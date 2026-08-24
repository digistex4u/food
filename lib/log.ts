import { num } from "@/lib/db";

/** Raw shape of a log_entries row as Postgres returns it (NUMERIC comes back as text). */
export interface LogRow {
  id: number; meal: string; food_ref: string; food_name: string;
  grams: string; kcal: string; protein: string; carbs: string; fat: string;
}

export interface LogEntry {
  id: number; meal: string; ref: string; name: string;
  g: number; k: number; p: number; c: number; f: number;
}

export const toEntry = (r: LogRow): LogEntry => ({
  id: Number(r.id), meal: r.meal, ref: r.food_ref, name: r.food_name,
  g: num(r.grams), k: num(r.kcal), p: num(r.protein), c: num(r.carbs), f: num(r.fat),
});

export const LOG_COLUMNS =
  "id, meal, food_ref, food_name, grams, kcal, protein, carbs, fat";
