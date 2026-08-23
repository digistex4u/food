/**
 * Passcode auth.
 *
 * One shared passcode opens the app; everyone then picks their profile. There
 * are no user accounts on purpose — this is a household tool, and an OAuth
 * round trip for a family member who wants to log a roti is friction with no
 * security benefit given they all share the data anyway.
 *
 * The cookie is an HMAC-signed expiry stamp, so the server keeps no session
 * store and the signature cannot be forged without AUTH_SECRET. Everything
 * here uses Web Crypto rather than node:crypto so the same code runs in
 * middleware on the edge runtime.
 */

export const COOKIE = "bk_session";
const MAX_AGE_DAYS = 60;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET is not set (needs at least 16 characters). Add it in Vercel → Settings → Environment Variables.");
  }
  return s;
}

export function passcodeConfigured(): boolean {
  return Boolean(process.env.APP_PASSCODE && process.env.AUTH_SECRET);
}

const b64url = (bytes: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return b64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
}

/** Constant-time string compare, so a wrong passcode leaks no timing signal. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function issueToken(): Promise<{ value: string; maxAge: number }> {
  const maxAge = MAX_AGE_DAYS * 24 * 60 * 60;
  const exp = String(Date.now() + maxAge * 1000);
  return { value: `${exp}.${await sign(exp)}`, maxAge };
}

export async function verifyToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return false;
  const exp = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  if (!/^\d+$/.test(exp)) return false;
  if (Number(exp) < Date.now()) return false;
  try {
    return safeEqual(mac, await sign(exp));
  } catch {
    return false;
  }
}
