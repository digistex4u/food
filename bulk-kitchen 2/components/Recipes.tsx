"use client";

import { useMemo, useState } from "react";
import { api, jsonBody, type CustomRecipe, type FreeIngredient } from "@/lib/client";
import {
  F, RECIPES, ROTATION, recipeMacros, r0, r1, type Recipe,
} from "@/lib/nutrition";
import { SectionHead } from "./ui";

export default function Recipes({
  custom, onChange, say,
}: {
  custom: CustomRecipe[];
  onChange: (next: CustomRecipe[]) => void;
  say: (m: string, bad?: boolean) => void;
}) {
  const [dayIdx, setDayIdx] = useState(() => new Date().getDay());
  const day = ROTATION[dayIdx];

  const builtIn = useMemo(
    () => day.r.map((id) => RECIPES.find((r) => r.id === id)).filter(Boolean) as Recipe[],
    [day]
  );
  const mine = useMemo(
    () => custom.filter((r) => r.day === null || r.day === dayIdx),
    [custom, dayIdx]
  );

  const removeCustom = async (cid: number) => {
    if (!window.confirm("Remove this recipe?")) return;
    const before = custom;
    onChange(custom.filter((r) => r.cid !== cid));
    try { await api(`/api/recipes?id=${cid}`, { method: "DELETE" }); say("Recipe removed"); }
    catch (e) { onChange(before); say(e instanceof Error ? e.message : "Could not remove it.", true); }
  };

  return (
    <section>
      <SectionHead eyebrow="Step six" title="Kitchen cards">
        Hand these to whoever cooks. Every card is Hindi and English side by side, with quantities in
        both grams and household measures (katori, chammach) so nothing depends on owning a scale.
      </SectionHead>

      <div className="rot no-print" role="group" aria-label="Day of the week">
        {ROTATION.map((d, i) => (
          <button key={d.day} type="button" aria-pressed={i === dayIdx} onClick={() => setDayIdx(i)}>
            {d.day}<small className="hi">{d.hi}</small>
          </button>
        ))}
      </div>

      <div className="track-head no-print" style={{ marginBottom: 16 }}>
        <span className="eyebrow">
          {day.day}&apos;s cooking list · <span className="hi" style={{ letterSpacing: 0, textTransform: "none" }}>{day.hi} की रसोई</span>
          {" · "}{builtIn.length + mine.length} dishes
        </span>
        <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={() => window.print()}>
          Print today&apos;s cards
        </button>
      </div>

      <div className="stack" style={{ gap: 18 }}>
        {builtIn.map((r) => <BuiltInCard key={r.id} r={r} />)}
        {mine.map((r) => <CustomCard key={r.id} r={r} onRemove={() => removeCustom(r.cid)} />)}
      </div>

      <div className="no-print" style={{ marginTop: 22 }}>
        <AddRecipe
          onSaved={(r) => { onChange([r, ...custom]); say(`Added ${r.en}`); }}
          say={say}
        />
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- the cards */

function CardShell({
  en, hi, meal, mins, serves, ingredients, steps, macros, onRemove,
}: {
  en: string; hi: string; meal: string; mins: number; serves: number;
  ingredients: React.ReactNode; steps: [string, string][];
  macros?: { k: number; p: number; c: number; f: number };
  onRemove?: () => void;
}) {
  return (
    <article className="rcard">
      <div className="rcard-hd">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="r-en">{en}</div>
            {hi && <div className="r-hi hi">{hi}</div>}
          </div>
          {onRemove && (
            <button className="btn btn-sm btn-ghost no-print" onClick={onRemove}>Remove</button>
          )}
        </div>
        <div className="rcard-meta">
          <span><b>{meal}</b></span>
          <span>{mins} min · <span className="hi">{mins} मिनट</span></span>
          <span>Serves <b>{serves}</b> · <span className="hi">{serves} लोगों के लिए</span></span>
        </div>
      </div>

      <div className="rcard-bd">
        <div>
          <div className="r-sub">Ingredients <span className="r-sub-hi">सामग्री</span></div>
          <div className="ing">{ingredients}</div>
        </div>
        <div>
          <div className="r-sub">Method <span className="r-sub-hi">बनाने का तरीका</span></div>
          <div className="steps">
            {steps.map((s, i) => (
              <div className="step" key={i}>
                <div>
                  {s[0]}
                  {s[1] && <span className="st-hi">{s[1]}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {macros && (
        <div className="r-macros">
          <div className="r-macro"><b>{r0(macros.k)}</b><span>kcal / serving</span></div>
          <div className="r-macro"><b style={{ color: "var(--protein)" }}>{r1(macros.p)} g</b><span>protein</span></div>
          <div className="r-macro"><b style={{ color: "var(--carb)" }}>{r1(macros.c)} g</b><span>carbs</span></div>
          <div className="r-macro"><b style={{ color: "var(--fat)" }}>{r1(macros.f)} g</b><span>fat</span></div>
        </div>
      )}
    </article>
  );
}

function BuiltInCard({ r }: { r: Recipe }) {
  const m = recipeMacros(r);
  return (
    <CardShell
      en={r.en} hi={r.hi} meal={r.meal} mins={r.mins} serves={r.serves}
      macros={m} steps={r.steps}
      ingredients={
        <>
          {r.ing.map((i) => (
            <div className="ing-row" key={i.f}>
              <span className="ing-q">{i.g} g</span>
              <span className="ing-n">
                {F(i.f).name.replace(/,.*$/, "")}
                <span className="ing-hi">{i.hhHi} · {i.hh}</span>
              </span>
            </div>
          ))}
          {r.extras.map((e) => (
            <div className="ing-row" key={e[0]}>
              <span className="ing-q" style={{ color: "var(--ink-3)" }}>{e[2]}</span>
              <span className="ing-n">{e[0]}<span className="ing-hi">{e[1]} · {e[3]}</span></span>
            </div>
          ))}
        </>
      }
    />
  );
}

function CustomCard({ r, onRemove }: { r: CustomRecipe; onRemove: () => void }) {
  return (
    <CardShell
      en={r.en} hi={r.hi} meal={r.meal} mins={r.mins} serves={r.serves}
      steps={r.steps} onRemove={onRemove}
      ingredients={
        <>
          {r.free.map((i, n) => (
            <div className="ing-row" key={n}>
              <span className="ing-q">{i.qty}</span>
              <span className="ing-n">{i.en}{i.hi && <span className="ing-hi">{i.hi}</span>}</span>
            </div>
          ))}
        </>
      }
    />
  );
}

/* ------------------------------------------------------------- add a recipe */

const blankIng = (): FreeIngredient => ({ qty: "", en: "", hi: "" });
const blankStep = (): [string, string] => ["", ""];

function AddRecipe({
  onSaved, say,
}: { onSaved: (r: CustomRecipe) => void; say: (m: string, bad?: boolean) => void }) {
  const [en, setEn] = useState("");
  const [hi, setHi] = useState("");
  const [meal, setMeal] = useState("Dinner");
  const [mins, setMins] = useState("20");
  const [serves, setServes] = useState("2");
  const [day, setDay] = useState<string>("");
  const [ing, setIng] = useState<FreeIngredient[]>([blankIng(), blankIng(), blankIng()]);
  const [steps, setSteps] = useState<[string, string][]>([blankStep(), blankStep()]);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const r = await api<CustomRecipe>("/api/recipes", jsonBody({
        en, hi, meal, mins: Number(mins), serves: Number(serves),
        day: day === "" ? null : Number(day),
        ing: ing.filter((i) => i.en.trim() || i.hi.trim()),
        steps: steps.filter((s) => s[0].trim() || s[1].trim()),
      }));
      onSaved(r);
      setEn(""); setHi(""); setIng([blankIng(), blankIng(), blankIng()]); setSteps([blankStep(), blankStep()]);
    } catch (e) {
      say(e instanceof Error ? e.message : "Could not save the recipe.", true);
    } finally { setBusy(false); }
  };

  return (
    <details className="disclosure">
      <summary>Add your own recipe — साप्ताहिक रसोई में नया व्यंजन जोड़ें</summary>
      <div className={`disclosure-body${busy ? " saving" : ""}`}>
        <div className="form-grid" style={{ marginBottom: 14 }}>
          <div className="field">
            <label htmlFor="r-en">Name (English)</label>
            <input id="r-en" className="inp" style={{ fontFamily: "var(--sans)" }}
                   value={en} onChange={(e) => setEn(e.target.value)} placeholder="Methi Thepla" />
          </div>
          <div className="field">
            <label htmlFor="r-hi">Name (हिन्दी)</label>
            <input id="r-hi" className="inp hi" style={{ fontFamily: "var(--deva)" }}
                   value={hi} onChange={(e) => setHi(e.target.value)} placeholder="मेथी थेपला" />
          </div>
          <div className="field">
            <label htmlFor="r-meal">Meal</label>
            <select id="r-meal" className="inp" value={meal} onChange={(e) => setMeal(e.target.value)}>
              {["Breakfast", "Lunch", "Dinner", "Snack", "Shake"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="r-day">Which day?</label>
            <select id="r-day" className="inp" value={day} onChange={(e) => setDay(e.target.value)}>
              <option value="">Every day</option>
              {ROTATION.map((d, i) => <option key={d.day} value={i}>{d.day}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="r-mins">Minutes</label>
            <input id="r-mins" className="inp" type="number" min={1} max={600}
                   value={mins} onChange={(e) => setMins(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="r-serves">Serves</label>
            <input id="r-serves" className="inp" type="number" min={1} max={30}
                   value={serves} onChange={(e) => setServes(e.target.value)} />
          </div>
        </div>

        <div className="r-sub" style={{ marginBottom: 8 }}>Ingredients <span className="r-sub-hi">सामग्री</span></div>
        {ing.map((row, i) => (
          <div className="repeat-row" key={i}>
            <input className="inp" style={{ width: 110, flex: "none" }} placeholder="200 g"
                   value={row.qty}
                   onChange={(e) => setIng(ing.map((x, n) => (n === i ? { ...x, qty: e.target.value } : x)))} />
            <input className="inp" placeholder="Ingredient in English" value={row.en}
                   onChange={(e) => setIng(ing.map((x, n) => (n === i ? { ...x, en: e.target.value } : x)))} />
            <input className="inp hi" style={{ fontFamily: "var(--deva)" }} placeholder="हिन्दी में" value={row.hi}
                   onChange={(e) => setIng(ing.map((x, n) => (n === i ? { ...x, hi: e.target.value } : x)))} />
            <button className="rm-btn" type="button" aria-label="Remove ingredient"
                    onClick={() => setIng(ing.length > 1 ? ing.filter((_, n) => n !== i) : ing)}>×</button>
          </div>
        ))}
        <button className="btn btn-sm" type="button" style={{ marginBottom: 18 }}
                onClick={() => setIng([...ing, blankIng()])}>Add ingredient</button>

        <div className="r-sub" style={{ marginBottom: 8 }}>Method <span className="r-sub-hi">बनाने का तरीका</span></div>
        {steps.map((s, i) => (
          <div className="repeat-row" key={i}>
            <span className="mono" style={{ width: 22, flex: "none", paddingTop: 11, color: "var(--accent)", fontSize: 11, fontWeight: 600 }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <input className="inp" placeholder="Step in English" value={s[0]}
                   onChange={(e) => setSteps(steps.map((x, n) => (n === i ? [e.target.value, x[1]] : x)))} />
            <input className="inp hi" style={{ fontFamily: "var(--deva)" }} placeholder="हिन्दी में" value={s[1]}
                   onChange={(e) => setSteps(steps.map((x, n) => (n === i ? [x[0], e.target.value] : x)))} />
            <button className="rm-btn" type="button" aria-label="Remove step"
                    onClick={() => setSteps(steps.length > 1 ? steps.filter((_, n) => n !== i) : steps)}>×</button>
          </div>
        ))}
        <button className="btn btn-sm" type="button" onClick={() => setSteps([...steps, blankStep()])}>Add step</button>

        <div style={{ marginTop: 20, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn-primary" type="button" onClick={save}
                  disabled={busy || !en.trim() || !ing.some((i) => i.en.trim() || i.hi.trim()) || !steps.some((s) => s[0].trim() || s[1].trim())}>
            {busy ? "Saving…" : "Save recipe"}
          </button>
          <span className="tile-n" style={{ maxWidth: "44ch" }}>
            Your own recipes are stored as free text, so they carry no calculated macros —
            the shipped cards get theirs from the food database.
          </span>
        </div>
      </div>
    </details>
  );
}
