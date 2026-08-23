"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api, jsonBody, type AppProfile, type Bootstrap, type CustomFood, type CustomRecipe,
} from "@/lib/client";
import { FOODS, type Food } from "@/lib/nutrition";
import { Loading } from "./ui";
import Numbers from "./Numbers";
import Mechanics from "./Mechanics";
import Tracker from "./Tracker";
import Weight from "./Weight";
import Plan from "./Plan";
import Recipes from "./Recipes";
import FoodDb from "./FoodDb";

const TABS = [
  { id: "num",   label: "Your numbers" },
  { id: "mech",  label: "How the body works" },
  { id: "track", label: "Daily tracker" },
  { id: "wt",    label: "Weight & progress" },
  { id: "plan",  label: "Bulk plan" },
  { id: "rec",   label: "Kitchen cards" },
  { id: "db",    label: "Food database" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function App() {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [activeId, setActiveId] = useState<string>("");
  const [tab, setTab] = useState<TabId>("num");
  const [dark, setDark] = useState(false);
  const [toast, setToast] = useState<{ msg: string; bad?: boolean } | null>(null);

  const say = useCallback((msg: string, bad = false) => {
    setToast({ msg, bad });
    window.setTimeout(() => setToast(null), bad ? 5000 : 2200);
  }, []);

  /* ---------------------------------------------------------------- boot */
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const b = await api<Bootstrap>("/api/bootstrap");
        if (!live) return;
        setBoot(b);
        const saved = localStorage.getItem("bk.active");
        const found = b.profiles.find((p) => p.id === saved);
        setActiveId(found ? found.id : b.profiles[0]?.id ?? "");
      } catch (e) {
        if (!live) return;
        const msg = e instanceof Error ? e.message : String(e);
        if (/database|DATABASE_URL/i.test(msg)) setNeedsSetup(true);
        setError(msg);
      }
    })();
    return () => { live = false; };
  }, []);

  /* --------------------------------------------------------------- theme */
  useEffect(() => {
    const stamp = document.documentElement.getAttribute("data-theme");
    setDark(stamp ? stamp === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);
  const toggleTheme = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("bk.theme", next); } catch { /* private mode */ }
    setDark(!dark);
  };

  /* ------------------------------------------------------------ profiles */
  const profiles = boot?.profiles ?? [];
  const me = useMemo(
    () => profiles.find((p) => p.id === activeId) ?? profiles[0],
    [profiles, activeId]
  );

  const setProfiles = useCallback((next: AppProfile[]) => {
    setBoot((b) => (b ? { ...b, profiles: next } : b));
  }, []);

  const chooseProfile = (id: string) => {
    setActiveId(id);
    try { localStorage.setItem("bk.active", id); } catch { /* private mode */ }
  };

  /** Optimistic profile edit: the inputs stay responsive while the PATCH flies. */
  const patchProfile = useCallback(
    async (patch: Partial<AppProfile>) => {
      if (!me) return;
      const optimistic = profiles.map((p) => (p.id === me.id ? { ...p, ...patch } : p));
      setProfiles(optimistic);
      try {
        const saved = await api<AppProfile>(`/api/profiles/${me.id}`, {
          method: "PATCH", body: JSON.stringify(patch),
        });
        setProfiles(optimistic.map((p) => (p.id === saved.id ? saved : p)));
      } catch (e) {
        setProfiles(profiles); // roll back to what the server last confirmed
        say(e instanceof Error ? e.message : "Could not save that.", true);
      }
    },
    [me, profiles, setProfiles, say]
  );

  const addProfile = async () => {
    const name = window.prompt("Name for the new profile?");
    if (name === null) return;
    try {
      const p = await api<AppProfile>("/api/profiles", jsonBody({ name: name.trim() || "Person" }));
      setProfiles([...profiles, p]);
      chooseProfile(p.id);
      setTab("num");
      say(`Added ${p.name}`);
    } catch (e) {
      say(e instanceof Error ? e.message : "Could not add that profile.", true);
    }
  };

  const removeProfile = async () => {
    if (!me) return;
    if (!window.confirm(`Remove "${me.name}" and everything they have logged? This cannot be undone.`)) return;
    try {
      await api(`/api/profiles/${me.id}`, { method: "DELETE" });
      const left = profiles.filter((p) => p.id !== me.id);
      setProfiles(left);
      chooseProfile(left[0]?.id ?? "");
      say(`Removed ${me.name}`);
    } catch (e) {
      say(e instanceof Error ? e.message : "Could not remove that profile.", true);
    }
  };

  /* -------------------------------------------------- foods and recipes */
  const customFoods = boot?.customFoods ?? [];
  const customRecipes = boot?.customRecipes ?? [];
  const setCustomFoods = (next: CustomFood[]) =>
    setBoot((b) => (b ? { ...b, customFoods: next } : b));
  const setCustomRecipes = (next: CustomRecipe[]) =>
    setBoot((b) => (b ? { ...b, customRecipes: next } : b));

  /** Built-ins plus the household's own foods, as one searchable list. */
  const allFoods: Food[] = useMemo(() => [...FOODS, ...customFoods], [customFoods]);

  /* -------------------------------------------------------------- render */
  if (needsSetup) {
    return (
      <div className="center-screen">
        <div className="gate" style={{ maxWidth: 500 }}>
          <span className="brand-mark">BK</span>
          <h1>No database attached yet</h1>
          <p>
            The app is deployed, but it has nowhere to store anything. Attach a Postgres database
            in your Vercel dashboard and redeploy.
          </p>
          <a className="btn btn-primary" href="/setup" style={{ textAlign: "center", textDecoration: "none" }}>
            Show me the steps
          </a>
        </div>
      </div>
    );
  }

  if (!boot || !me) {
    return (
      <div className="wrap">
        {error ? (
          <div className="center-screen">
            <div className="gate">
              <span className="brand-mark">BK</span>
              <h1>Something went wrong</h1>
              <p>{error}</p>
              <button className="btn" onClick={() => window.location.reload()}>Try again</button>
            </div>
          </div>
        ) : (
          <Loading label="Opening your kitchen…" />
        )}
      </div>
    );
  }

  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-in">
          <div className="brand">
            <span className="brand-mark">BK</span>
            <span className="brand-name">Bulk Kitchen</span>
            <span className="brand-sub">Vegetarian mass-gain, measured in grams</span>
          </div>

          <div className="who no-print">
            <label htmlFor="whoSel">Who</label>
            <select
              id="whoSel"
              value={me.id}
              onChange={(e) => {
                if (e.target.value === "__del") { void removeProfile(); return; }
                chooseProfile(e.target.value);
              }}
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              {profiles.length > 1 && <option value="__del">Remove this person…</option>}
            </select>
          </div>

          <button className="icon-btn no-print" onClick={addProfile} title="Add a person" aria-label="Add a person">
            <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
          </button>

          <button className="icon-btn no-print" onClick={toggleTheme} title="Switch theme" aria-label="Switch theme">
            {dark ? (
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
            )}
          </button>

          <button
            className="icon-btn no-print"
            title="Sign out"
            aria-label="Sign out"
            onClick={async () => {
              await fetch("/api/auth", { method: "DELETE" });
              window.location.href = "/login";
            }}
          >
            <svg viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>

        <nav className="wrap tabs no-print" role="tablist">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              className="tab"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => { setTab(t.id); window.scrollTo({ top: 0 }); }}
            >
              <span className="tnum">{String(i + 1).padStart(2, "0")}</span>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="wrap">
        {tab === "num"   && <Numbers me={me} onPatch={patchProfile} />}
        {tab === "mech"  && <Mechanics />}
        {tab === "track" && <Tracker me={me} foods={allFoods} say={say} />}
        {tab === "wt"    && <Weight me={me} say={say} />}
        {tab === "plan"  && <Plan me={me} say={say} onPatch={patchProfile} />}
        {tab === "rec"   && (
          <Recipes
            custom={customRecipes}
            onChange={setCustomRecipes}
            say={say}
          />
        )}
        {tab === "db"    && (
          <FoodDb custom={customFoods} onChange={setCustomFoods} say={say} />
        )}
      </main>

      {toast && <div className={`toast${toast.bad ? " bad" : ""}`}>{toast.msg}</div>}
    </>
  );
}
