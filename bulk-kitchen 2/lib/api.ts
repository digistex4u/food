import { NextResponse } from "next/server";

/** Shapes every route's error response the same way, and keeps stack traces off the wire. */
export function fail(err: unknown, status = 500) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[api]", msg);
  const isSetup = /DATABASE_URL|AUTH_SECRET/.test(msg);
  return NextResponse.json({ error: msg }, { status: isSetup ? 503 : status });
}

export const ok = <T>(data: T) => NextResponse.json(data);

export function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** Reads a required string, trimmed and length-capped so nothing unbounded reaches the database. */
export function str(v: unknown, field: string, max = 200): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) throw new ValidationError(`${field} is required.`);
  if (s.length > max) throw new ValidationError(`${field} must be under ${max} characters.`);
  return s;
}

export function optStr(v: unknown, max = 200): string {
  const s = typeof v === "string" ? v.trim() : "";
  return s.slice(0, max);
}

export function numField(v: unknown, field: string, min: number, max: number): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (!isFinite(n)) throw new ValidationError(`${field} must be a number.`);
  if (n < min || n > max) throw new ValidationError(`${field} must be between ${min} and ${max}.`);
  return n;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function dateField(v: unknown, field = "date"): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!DATE_RE.test(s)) throw new ValidationError(`${field} must look like 2026-08-23.`);
  return s;
}

export class ValidationError extends Error {}

/** Wraps a handler so validation errors become 400s and everything else a 500. */
export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ValidationError) return bad(err.message);
    return fail(err);
  }
}
