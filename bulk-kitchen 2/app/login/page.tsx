"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [passcode, setPasscode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        setErr(b?.error || "That did not work.");
        setBusy(false);
        return;
      }
      window.location.href = next;
    } catch {
      setErr("Could not reach the server. Check your connection.");
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <div className="gate">
        <span className="brand-mark">BK</span>
        <h1>Bulk Kitchen</h1>
        <p>Enter the household passcode to open the tracker.</p>
        <form onSubmit={submit}>
          {err && <div className="err">{err}</div>}
          <div className="field">
            <label htmlFor="pc">Passcode</label>
            <input
              id="pc"
              className="inp"
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              autoFocus
              autoComplete="current-password"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy || !passcode}>
            {busy ? "Checking…" : "Open"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="center-screen"><span className="spinner" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
