"use client";

import { useMemo, useState } from "react";
import { api, jsonBody, type CustomFood } from "@/lib/client";
import { CATS, FOODS, nut, r0, r1, type Food } from "@/lib/nutrition";
import { SectionHead, Empty } from "./ui";

export default function FoodDb({
  custom, onChange, say,
}: {
  custom: CustomFood[];
  onChange: (next: CustomFood[]) => void;
  say: (m: string, bad?: boolean) => void;
}) {
  const [cat, setCat] = useState("all");
  const [query, setQuery] = useState("");

  const all: Food[] = useMemo(() => [...custom, ...FOODS], [custom]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((f) => (cat === "all" || f.cat === cat) && (!q || f.name.toLowerCase().includes(q)));
  }, [all, cat, query]);

  const removeFood = async (f: CustomFood) => {
    if (!window.confirm(`Remove "${f.name}" from your custom foods?`)) return;
    const before = custom;
    onChange(custom.filter((x) => x.cid !== f.cid));
    try { await api(`/api/foods?id=${f.cid}`, { method: "DELETE" }); say("Food removed"); }
    catch (e) { onChange(before); say(e instanceof Error ? e.message : "Could not remove it.", true); }
  };

  const cats: [string, string][] = [["all", "Everything"], ...Object.entries(CATS)];

  return (
    <section>
      <SectionHead eyebrow="Reference" title="Indian food database">
        Per 100 g and per standard household serving. Raw weights are marked — dals and grains
        roughly triple in weight when cooked, so 30 g raw dal is one full katori on the plate.
      </SectionHead>

      <div className="track-head no-print">
        <div className="searchwrap" style={{ flex: 1, maxWidth: 340 }}>
          <input className="inp" type="search" placeholder="Search — dal, paneer, roti, soya…"
                 style={{ fontFamily: "var(--sans)" }} autoComplete="off"
                 value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="rot" style={{ marginBottom: 0 }}>
          {cats.map(([k, n]) => (
            <button key={k} type="button" aria-pressed={k === cat} onClick={() => setCat(k)}>{n}</button>
          ))}
        </div>
      </div>

      <div className="tablewrap" style={{ marginTop: 14 }}>
        <table>
          <thead>
            <tr>
              <th>Food</th><th>Standard serving</th>
              <th className="num">kcal</th><th className="num">Protein</th>
              <th className="num">Carbs</th><th className="num">Fat</th>
              <th className="num">kcal /100g</th><th className="num">P /100g</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8}><Empty>No food matches &quot;{query}&quot;. Try a shorter word — &quot;dal&quot;, &quot;paneer&quot;, &quot;soya&quot;.</Empty></td></tr>
            ) : rows.map((f) => {
              const n = nut(f, f.sg);
              const mine = (f as CustomFood).custom === true;
              return (
                <tr key={f.name}>
                  <td>
                    {f.name}
                    {mine ? (
                      <>
                        <span className="pill pill-p" style={{ marginLeft: 4 }}>yours</span>
                        <button className="btn btn-sm btn-ghost no-print" style={{ marginLeft: 6 }}
                                onClick={() => removeFood(f as CustomFood)}>×</button>
                      </>
                    ) : f.note ? (
                      <span className={`pill ${f.note === "raw" ? "pill-warn" : "pill-good"}`} style={{ marginLeft: 4 }}>
                        {f.note}
                      </span>
                    ) : null}
                  </td>
                  <td style={{ color: "var(--ink-3)", fontSize: 13 }}>{f.sl}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{r0(n.k)}</td>
                  <td className="num" style={{ color: "var(--protein)" }}>{r1(n.p)}</td>
                  <td className="num" style={{ color: "var(--carb)" }}>{r1(n.c)}</td>
                  <td className="num" style={{ color: "var(--fat)" }}>{r1(n.f)}</td>
                  <td className="num" style={{ color: "var(--ink-3)" }}>{f.k}</td>
                  <td className="num" style={{ color: "var(--ink-3)" }}>{f.p}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="tile-n" style={{ marginTop: 14, maxWidth: "66ch" }}>
        Values are drawn from the Indian Food Composition Tables (IFCT 2017) and USDA FoodData
        Central, rounded to whole numbers. Home cooking varies — the amount of oil in a sabzi swings
        its calories more than anything else on this page, which is why every recipe card specifies
        oil in grams.
      </p>

      <div className="no-print" style={{ marginTop: 20 }}>
        <AddFood
          onSaved={(f) => { onChange([f, ...custom]); say(`Added ${f.name}`); }}
          say={say}
        />
      </div>
    </section>
  );
}

function AddFood({
  onSaved, say,
}: { onSaved: (f: CustomFood) => void; say: (m: string, bad?: boolean) => void }) {
  const [v, setV] = useState({ name: "", cat: "dish", k: "", p: "", c: "", f: "", sg: "100", sl: "" });
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV({ ...v, [key]: e.target.value });

  const implied = (Number(v.p) || 0) * 4 + (Number(v.c) || 0) * 4 + (Number(v.f) || 0) * 9;
  const stated = Number(v.k) || 0;
  const mismatch = stated > 0 && implied > 0 && Math.abs(implied - stated) > Math.max(60, stated * 0.3);

  const save = async () => {
    setBusy(true);
    try {
      const f = await api<CustomFood>("/api/foods", jsonBody({
        name: v.name, cat: v.cat,
        k: Number(v.k), p: Number(v.p), c: Number(v.c), f: Number(v.f),
        sg: Number(v.sg) || 100, sl: v.sl,
      }));
      onSaved(f);
      setV({ name: "", cat: "dish", k: "", p: "", c: "", f: "", sg: "100", sl: "" });
    } catch (e) {
      say(e instanceof Error ? e.message : "Could not save that food.", true);
    } finally { setBusy(false); }
  };

  return (
    <details className="disclosure">
      <summary>Add your own food — a packet, a supplement, or a dish your kitchen makes</summary>
      <div className={`disclosure-body${busy ? " saving" : ""}`}>
        <p className="tile-n" style={{ marginBottom: 14, maxWidth: "62ch" }}>
          Enter the values <b>per 100 g</b> — that is what packet labels print, and what keeps this
          food comparable with everything else in the table.
        </p>
        <div className="form-grid">
          <div className="field" style={{ gridColumn: "span 2" }}>
            <label htmlFor="nf-name">Food name</label>
            <input id="nf-name" className="inp" style={{ fontFamily: "var(--sans)" }}
                   value={v.name} onChange={set("name")} placeholder="Amul Whey Protein" />
          </div>
          <div className="field">
            <label htmlFor="nf-cat">Category</label>
            <select id="nf-cat" className="inp" value={v.cat} onChange={set("cat")}>
              {Object.entries(CATS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="nf-k">kcal / 100 g</label>
            <input id="nf-k" className="inp" type="number" min={0} max={950} value={v.k} onChange={set("k")} />
          </div>
          <div className="field">
            <label htmlFor="nf-p">Protein / 100 g</label>
            <input id="nf-p" className="inp" type="number" min={0} max={100} step={0.1} value={v.p} onChange={set("p")} />
          </div>
          <div className="field">
            <label htmlFor="nf-c">Carbs / 100 g</label>
            <input id="nf-c" className="inp" type="number" min={0} max={100} step={0.1} value={v.c} onChange={set("c")} />
          </div>
          <div className="field">
            <label htmlFor="nf-f">Fat / 100 g</label>
            <input id="nf-f" className="inp" type="number" min={0} max={100} step={0.1} value={v.f} onChange={set("f")} />
          </div>
          <div className="field">
            <label htmlFor="nf-sg">Serving (g)</label>
            <input id="nf-sg" className="inp" type="number" min={1} max={2000} value={v.sg} onChange={set("sg")} />
          </div>
          <div className="field" style={{ gridColumn: "span 2" }}>
            <label htmlFor="nf-sl">What that serving is called</label>
            <input id="nf-sl" className="inp" style={{ fontFamily: "var(--sans)" }}
                   value={v.sl} onChange={set("sl")} placeholder="1 scoop (30 g)" />
          </div>
        </div>

        {mismatch && (
          <div className="note note-warn" style={{ marginTop: 14 }}>
            Those macros work out to about <b>{Math.round(implied)} kcal</b> per 100 g, not {stated}.
            Protein and carbs are 4 kcal per gram, fat is 9. Check the label before saving.
          </div>
        )}

        <button className="btn btn-primary" type="button" style={{ marginTop: 16 }}
                onClick={save} disabled={busy || !v.name.trim() || !v.k}>
          {busy ? "Saving…" : "Save food"}
        </button>
      </div>
    </details>
  );
}
