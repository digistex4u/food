"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api, jsonBody, type AppProfile, type Bootstrap, type CustomFood, type CustomRecipe,
  type RecipeLink,
} from "@/lib/client";
import { FOODS, pathOf, type Food, type PathKey } from "@/lib/nutrition";
import { Loading, StepProvider } from "./ui";
import PathPick from "./PathPick";
import Numbers from "./Numbers";
import BodyShape from "./BodyShape";
import Mechanics from "./Mechanics";
import Month from "./Month";
import Tracker from "./Tracker";
import Weight from "./Weight";
import Plan from "./Plan";
import Recipes from "./Recipes";
import FoodDb from "./FoodDb";

/**
 * The app is a wizard, not a set of tabs.
 *
 * One screen at a time, in the order the work actually happens: decide what
 * this is for, measure yourself, read the numbers that follow, then the food.
 * Which screens exist depends on the answer to the first one — a lifestyle user
 * is never shown the daily food tracker, because they were promised they would
 * not have to log anything.
 *
 * The rail across the top is not decoration. Once a step has been reached it
 * stays clickable, so the wizard is a first pass rather than a corridor: nobody
 * should have to press Next six times to look at the food database again.
 */
interface Step {
  id: string;
  label: string;
  short: string;
  /** Which paths this step belongs to. */
  on: PathKey[];
}

const BOTH: PathKey[] = ["fitness", "lifestyle"];

const STEPS: Step[] = [
  { id: "path",  label: "What is this for",    short: "Purpose",   on: ["fitness", "lifestyle", "unset"] },
  { id: "you",   label: "About you",           short: "You",       on: BOTH },
  { id: "body",  label: "Body & fat pattern",  short: "Body",      on: BOTH },
  { id: "mech",  label: "How the body works",  short: "Mechanics", on: ["fitness"] },
  { id: "plan",  label: "Today's portions",    short: "Plan",      on: ["fitness"] },
  { id: "month", label: "Your 30 days",        short: "30 days",   on: BOTH },
  { id: "rec",   label: "Kitchen cards",       short: "Cards",     on: BOTH },
  { id: "track", label: "Daily tracker",       short: "Tracker",   on: ["fitness"] },
  { id: "wt",    label: "Weight & progress",   short: "Weight",    on: BOTH },
  { id: "db",    label: "Food database",       short: "Foods",     on: BOTH },
];

export default function App() {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [activeId, setActiveId] = useState<string>("");
  const [at, setAt] = useState(0);
  const [seen, setSeen] = useState(0);
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
      setAt(0);
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

  /* ----------------------------------------------------------- the wizard */
  const path = me ? pathOf(me) : "unset";

  // Until the first question is answered there is exactly one screen, which is
  // what stops someone landing in a tracker they never asked for.
  const steps = useMemo(() => STEPS.filter((s) => s.on.includes(path)), [path]);
  const step = steps[Math.min(at, steps.length - 1)];
  const index = steps.findIndex((s) => s.id === step?.id);

  // How far this person has got before. Kept per profile and in the browser
  // rather than the database: it decides what is clickable, not what is true.
  const seenKey = me ? `bk.seen.${me.id}` : "";
  useEffect(() => {
    if (!seenKey) return;
    const raw = Number(localStorage.getItem(seenKey) ?? 0);
    setSeen(Number.isFinite(raw) ? raw : 0);
    setAt(0);
  }, [seenKey]);

  useEffect(() => {
    if (!seenKey || index < 0) return;
    if (index > seen) {
      setSeen(index);
      try { localStorage.setItem(seenKey, String(index)); } catch { /* private mode */ }
    }
  }, [index, seen, seenKey]);

  const go = useCallback((next: number) => {
    setAt(Math.max(0, Math.min(next, steps.length - 1)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [steps.length]);

  const blocked = step?.id === "path" && path === "unset";
  const last = index === steps.length - 1;

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

  if (!boot || !me || !step) {
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

  /* -------------------------------------------------- foods and recipes */
  const customFoods = boot.customFoods ?? [];
  const customRecipes = boot.customRecipes ?? [];
  const setCustomFoods = (next: CustomFood[]) =>
    setBoot((b) => (b ? { ...b, customFoods: next } : b));
  const setCustomRecipes = (next: CustomRecipe[]) =>
    setBoot((b) => (b ? { ...b, customRecipes: next } : b));

  const recipeLinks = boot.recipeLinks ?? [];
  /** Pin or unpin a cooking video, keeping the local list in step. */
  const setRecipeLink = (next: RecipeLink | null, id: string) =>
    setBoot((b) => {
      if (!b) return b;
      const rest = (b.recipeLinks ?? []).filter((l) => l.id !== id);
      return { ...b, recipeLinks: next ? [...rest, next] : rest };
    });

  /** Built-ins plus the household's own foods, as one searchable list. */
  const allFoods: Food[] = [...FOODS, ...customFoods];

  const choosePath = (p: PathKey) => {
    void patchProfile({ path: p });
    say(p === "fitness" ? "Fitness it is — let's measure you" : "Lifestyle it is — no logging, ever");
  };

  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-in">
          <div className="brand">
            <span className="brand-mark">BK</span>
            <span className="brand-name">Bulk Kitchen</span>
            <span className="brand-sub">
              {path === "lifestyle" ? "Light Indian eating, month by month" : "Vegetarian mass-gain, measured in grams"}
            </span>
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

        <nav className="wrap steprail no-print" aria-label="Progress">
          {steps.map((s, i) => {
            const done = i < index;
            const reachable = i <= seen;
            return (
              <button
                key={s.id}
                type="button"
                className="srail"
                aria-current={i === index ? "step" : undefined}
                data-done={done ? "" : undefined}
                disabled={!reachable}
                title={reachable ? s.label : "Not there yet"}
                onClick={() => go(i)}
              >
                <span className="sr-num">
                  {done ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                </span>
                {s.short}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="wrap wiz-main">
        <StepProvider value={index + 1}>
          {step.id === "path"  && <PathPick value={path} name={me.name} onChoose={choosePath} />}
          {step.id === "you"   && <Numbers me={me} onPatch={patchProfile} />}
          {step.id === "body"  && <BodyShape me={me} onPatch={patchProfile} />}
          {step.id === "mech"  && <Mechanics />}
          {step.id === "plan"  && <Plan me={me} say={say} onPatch={patchProfile} />}
          {step.id === "month" && <Month me={me} onPatch={patchProfile} />}
          {step.id === "track" && <Tracker me={me} foods={allFoods} say={say} />}
          {step.id === "wt"    && <Weight me={me} say={say} />}
          {step.id === "rec"   && (
            <Recipes
              custom={customRecipes}
              onChange={setCustomRecipes}
              links={recipeLinks}
              onLinkChange={setRecipeLink}
              say={say}
            />
          )}
          {step.id === "db"    && (
            <FoodDb custom={customFoods} onChange={setCustomFoods} say={say} />
          )}
        </StepProvider>
      </main>

      <div className="wiznav no-print">
        <div className="wrap wiznav-in">
          <button
            className="btn"
            onClick={() => go(index - 1)}
            disabled={index <= 0}
          >
            ← Back
          </button>

          <span className="wn-count mono">
            {index + 1} of {steps.length}
            <small>{step.label}</small>
          </span>

          {/* Before a path is chosen there is exactly one step, so "last step"
              and "cannot go on yet" are the same position and have to be told
              apart — otherwise the one screen that must not offer Next is the
              one that offers it. */}
          {blocked ? (
            <button className="btn btn-primary" disabled title="Choose one of the two first">
              Choose one to continue
            </button>
          ) : last ? (
            <button className="btn btn-primary" onClick={() => go(0)}>
              Back to the start
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => go(index + 1)}>
              Next: {steps[index + 1].short} →
            </button>
          )}
        </div>
      </div>

      {toast && <div className={`toast${toast.bad ? " bad" : ""}`}>{toast.msg}</div>}
    </>
  );
}
