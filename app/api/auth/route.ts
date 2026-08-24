import { NextResponse } from "next/server";
import { COOKIE, issueToken, safeEqual, passcodeConfigured } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!passcodeConfigured()) {
    return NextResponse.json(
      { error: "This deployment has no APP_PASSCODE or AUTH_SECRET set yet." },
      { status: 503 }
    );
  }

  let passcode = "";
  try {
    passcode = String(((await req.json()) as { passcode?: unknown })?.passcode ?? "");
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }

  // Deliberately slow: a household passcode is short, so make guessing it
  // over the network expensive enough to be pointless.
  await new Promise((r) => setTimeout(r, 400));

  if (!safeEqual(passcode, process.env.APP_PASSCODE as string)) {
    return NextResponse.json({ error: "That passcode is not right." }, { status: 401 });
  }

  const { value, maxAge } = await issueToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
