"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api, dkey, jsonBody, type DayTotal, type LogEntry,
} from "@/lib/client";
import { MEALS, calc, nut, r0, r1, type Food, type Profile } from "@/lib/nutrition";
import { SectionHead, Tile, Note, Loading, Empty } from "./ui";

export default function Tracker({
  me, foods, say,
}: { me: Profile; foods: Food[]; say: (m: string, bad?: boolean) => void }) {
  const [date, setDate] = useState(() => new Date());
  const [entries, setEntries] = useState<LogEntry[] | null>(null);
  const [history, setHistory] = useState<DayTotal[]>([]);
  const [busy, setBusy] = useState(false);

  const c = calc(me);
  const day = dkey(date);
  const isToday = day === dkey(new Date());

  const load = useCallback(async () => {
    setEntries(null);
    try {
      const [e, h] = await Promise.all([
        api<LogEntry[]>(`/api/log?profile=${me.id}&date=${day}`),
        api<DayTotal[]>(`/api/log/history?profile=${me.id}&days=14`),
      ]);
      setEntries(e);
      setHistory(h);
    } catch (err) {
      setEntries([]);
      say(err instanceof Error ? err.message : "Could not load that day.", true);
    }
  }, [me.id, day, say]);

  useEffect(() => { void load(); }, [load]);

  const tot = useMemo(
    () => (entries ?? []).reduce(
      (a, e) => ({ k: a.k + e.k, p: a.p + e.p, c: a.c + e.c, f: a.f + e.f }),
      { k: 0, p: 0, c: 0, f: 0 }
    ),
    [entries]
  );

  const addEntry = async (food: Food, grams: number, meal: string) => {
    const n = nut(food, grams);
    const optimistic: LogEntry = {
      id: -Date.now(), meal, ref: food.name, name: food.name,
      g: grams, k: n.k, p: n.p, c: n.c, f: n.f,
    };
    setEntries((cur) => [...(cur ?? []), optimistic]);
    try {
      const saved = await api<LogEntry>("/api/log", jsonBody({
        profileId: me.id, date: day, meal, ref: food.name, name: food.name,
        g: grams, k: n.k, p: n.p, c: n.c, f: n.f,
      }));
      setEntries((cur) => (cur ?? []).map((e) => (e.id === optimistic.id ? saved : e)));
      void refreshHistory();
    } catch (err) {
      setEntries((cur) => (cur ?? []).filter((e) => e.id !== optimistic.id));
      say(err instanceof Error ? err.message : "Could not save that.", true);
    }
  };

  const refreshHistory = async () => {
    try { setHistory(await api<DayTotal[]>(`/api/log/history?profile=${me.id}&days=14`)); }
    catch { /* the strip is decoration; a stale one is fine */ }
  };

  const removeEntry = async (id: number) => {
    const before = entries ?? [];
    setEntries(before.filter((e) => e.id !== id));
    try { await api(`/api/log?id=${id}`, { method: "DELETE" }); void refreshHistory(); }
    catch (err) { setEntries(before); say(err instanceof Error ? err.message : "Could not remove that.", true); }
  };

  const loadPlan = async () => {
    if ((entries ?? []).length && !window.confirm("This day already has entries. Add the bulk plan on top of them?")) return;
    setBusy(true);
    try {
      const added = await api<LogEntry[]>("/api/log/plan", jsonBody({ profileId: me.id, date: day }));
      setEntries((cur) => [...(cur ?? []), ...added]);
      void refreshHistory();
      say(`Loaded ${added.length} items from your plan`);
    } catch (err) {
      say(err instanceof Error ? err.message : "Could not load the plan.", true);
    } finally { setBusy(false); }
  };

  const clearDay = async () => {
    if (!(entries ?? []).length) return;
    if (!window.confirm("Clear everything logged for this day?")) return;
    const before = entries ?? [];
    setEntries([]);
    try { await api(`/api/log?profile=${me.id}&date=${day}`, { method: "DELETE" }); void refreshHistory(); }
    catch (err) { setEntries(before); say(err instanceof Error ? err.message : "Could not clear the day.", true); }
  };

  const shift = (n: number) => {
    const d = new Date(date); d.setDate(d.getDate() + n);
    if (d > new Date()) return;
    setDate(d);
  };

  const gapK = c.target - tot.k, gapP = c.protein - tot.p;
  const note =
    !(entries ?? []).length
      ? `Nothing logged yet. Hit <strong>Load bulk plan</strong> to fill the day with your generated plan, then adjust what actually happened.`
      : gapP > 25
      ? `You are <strong>${r0(gapP)} g of protein short</strong>. Fastest fixes: one scoop of whey (24 g), 100 g paneer (18 g), or 30 g dry soya chunks (16 g). Close this before you worry about calories.`
      : gapK > 500
      ? `<strong>${r0(gapK)} kcal still to go</strong> and protein is on track — this is a job for a shake, ghee on the roti, or a fistful of peanuts. Adding volume you can't finish will not help.`
      : gapK < -400
      ? `You are <strong>${r0(-gapK)} kcal over</strong>. One day does not matter; a fortnight of this becomes fat. Trim the ghee and the nuts first, never the protein.`
      : `On track. This is what a good day looks like — the whole thing is repeating it about ninety more times.`;

  const macroRows: [string, number, number, string, string][] = [
    ["Calories", tot.k, c.target, "kcal", "m-k"],
    ["Protein", tot.p, c.protein, "g", "m-p"],
    ["Carbs", tot.c, c.carbG, "g", "m-c"],
    ["Fat", tot.f, c.fatG, "g", "m-f"],
  ];

  return (
    <section>
      <SectionHead eyebrow="Step three" title="Daily tracker">
        Log what actually went in. Search the food database, set the quantity, and watch the four
        bars fill toward today&apos;s target. Everything saves to the database, so the phone and the
        laptop show the same day.
      </SectionHead>

      <div className="track-head no-print">
        <div className="datenav">
          <button className="icon-btn" style={{ border: 0, boxShadow: "none", background: "none" }}
                  onClick={() => shift(-1)} aria-label="Previous day">
            <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <span className="d-lbl mono">
            {isToday ? "Today" : date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
          </span>
          <button className="icon-btn" style={{ border: 0, boxShadow: "none", background: "none" }}
                  onClick={() => shift(1)} disabled={isToday} aria-label="Next day">
            <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
        <button className="btn btn-sm" onClick={() => setDate(new Date())}>Today</button>
        <button className="btn btn-sm" onClick={loadPlan} disabled={busy}>
          {busy ? "Loading…" : "Load bulk plan"}
        </button>
        <button className="btn btn-sm btn-ghost" onClick={clearDay}>Clear day</button>
      </div>

      <div className="stack">
        <div className="card card-pad">
          <div className="grid-2" style={{ gap: 24 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 13 }}>Today vs target</div>
              <div className="macros">
                {macroRows.map(([n, v, t, u, cls]) => (
                  <div className={`macro-row ${cls}`} key={n}>
                    <div className="macro-top">
                      <span className="macro-name">{n}</span>
                      <span className="macro-fig">
                        {r0(v)}<span style={{ color: "var(--ink-3)", fontWeight: 400 }}>{` / ${t} ${u}`}</span>
                      </span>
                      <span className="macro-cal">{t > 0 ? Math.round(Math.min(100, (v / t) * 100)) : 0}%</span>
                    </div>
                    <div className="macro-track">
                      <span className="macro-fill" style={{ width: `${t > 0 ? Math.min(100, (v / t) * 100).toFixed(1) : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 13 }}>Standing</div>
              <div className="grid-2" style={{ gap: 10 }}>
                <Tile k="Calories left" v={gapK > 0 ? r0(gapK) : `+${r0(-gapK)}`}
                      color={gapK > 0 ? "var(--ink)" : "var(--warn)"}
                      note={gapK > 0 ? "still to eat" : "over target"} />
                <Tile k="Protein left" v={gapP > 0 ? `${r0(gapP)}g` : "done"}
                      color={gapP > 0 ? "var(--protein)" : "var(--good)"}
                      note={gapP > 0 ? "non-negotiable" : "target cleared"} />
              </div>
              <Note style={{ marginTop: 14 }} html={note} />
            </div>
          </div>
        </div>

        {entries === null ? (
          <Loading label="Loading the day…" />
        ) : (
          <div className="stack" style={{ gap: 14 }}>
            {MEALS.map((m) => (
              <MealBlock
                key={m.k} meal={m}
                rows={entries.filter((e) => e.meal === m.k)}
                foods={foods}
                onAdd={(food, g) => addEntry(food, g, m.k)}
                onRemove={removeEntry}
              />
            ))}
          </div>
        )}

        <div className="card card-pad">
          <div className="eyebrow" style={{ marginBottom: 12 }}>Last 14 days</div>
          <HistoryStrip history={history} target={c.target} />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ meal block */

function MealBlock({
  meal, rows, foods, onAdd, onRemove,
}: {
  meal: (typeof MEALS)[number];
  rows: LogEntry[];
  foods: Food[];
  onAdd: (food: Food, grams: number) => void;
  onRemove: (id: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Food | null>(null);
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState<"srv" | "g">("srv");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", away);
    return () => document.removeEventListener("click", away);
  }, []);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return foods.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, foods]);

  const mealKcal = rows.reduce((s, e) => s + e.k, 0);

  const submit = () => {
    if (!picked) return;
    const n = parseFloat(qty) || 1;
    const grams = Math.round(unit === "g" ? n : n * picked.sg);
    if (grams <= 0) return;
    onAdd(picked, grams);
    setQuery(""); setPicked(null); setQty("1"); setOpen(false);
  };

  return (
    <div className="meal-block">
      <div className="meal-hd">
        <h4>{meal.n}</h4>
        <span className="meal-t">{meal.t}</span>
        <span className="meal-k">{r0(mealKcal)} kcal</span>
      </div>

      {rows.length ? rows.map((e) => (
        <div className="logrow" key={e.id}>
          <span className="lr-n">{e.name}</span>
          <span className="lr-q">{r0(e.g)} g</span>
          <span className="lr-m">
            <span style={{ color: "var(--protein)" }}>P {r1(e.p)}</span>
            <span style={{ color: "var(--carb)" }}>C {r1(e.c)}</span>
            <span style={{ color: "var(--fat)" }}>F {r1(e.f)}</span>
          </span>
          <span className="lr-k">{r0(e.k)}</span>
          <button className="x no-print" onClick={() => onRemove(e.id)} aria-label={`Remove ${e.name}`}>×</button>
        </div>
      )) : (
        <Empty>Nothing logged for {meal.n.toLowerCase()}.</Empty>
      )}

      <div className="addbar no-print">
        <div className="searchwrap" ref={box}>
          <input
            className="inp" type="search" placeholder="Add food…" autoComplete="off"
            style={{ fontFamily: "var(--sans)" }}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPicked(null); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && hits.length && !picked) {
                e.preventDefault(); setPicked(hits[0]); setQuery(hits[0].name); setOpen(false);
              } else if (e.key === "Enter" && picked) { e.preventDefault(); submit(); }
              else if (e.key === "Escape") setOpen(false);
            }}
          />
          {open && hits.length > 0 && !picked && (
            <div className="results">
              {hits.map((f) => (
                <button key={f.name} type="button"
                        onClick={() => { setPicked(f); setQuery(f.name); setOpen(false); }}>
                  <span className="r-n">{f.name}</span>
                  <span className="r-k">{f.k} kcal · {f.p} g P /100g</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <input className="inp qty-in" type="number" min={0.25} step={0.25} inputMode="decimal"
               value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Quantity" />
        <select className="inp unit-sel" value={unit} onChange={(e) => setUnit(e.target.value as "srv" | "g")}
                aria-label="Unit">
          <option value="srv">servings</option>
          <option value="g">grams</option>
        </select>
        <button className="btn btn-sm btn-primary" disabled={!picked} onClick={submit}>Add</button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- history strip */

function HistoryStrip({ history, target }: { history: DayTotal[]; target: number }) {
  const days: Date[] = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d); }
  const map = new Map(history.map((h) => [h.d, h.k]));
  const vals = days.map((d) => map.get(dkey(d)) ?? 0);
  const mx = Math.max(target * 1.25, ...vals, 1);

  return (
    <>
      <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 110, position: "relative" }}>
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: `${((target / mx) * 100).toFixed(1)}%`,
          borderTop: "1px dashed var(--accent)", opacity: 0.7,
        }} />
        {days.map((d, i) => {
          const v = vals[i];
          const col = v === 0 ? "var(--surface-3)"
            : v < target * 0.85 ? "var(--carb)"
            : v > target * 1.15 ? "var(--fat)" : "var(--accent)";
          return (
            <div key={i} title={`${d.toDateString()} — ${r0(v)} kcal`}
                 style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
              <div style={{ height: `${Math.max(2, (v / mx) * 100)}%`, background: col, borderRadius: "3px 3px 0 0", minHeight: 2 }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
        {days.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-3)" }}>
            {d.getDate()}
          </div>
        ))}
      </div>
      <p className="tile-n" style={{ marginTop: 10 }}>
        Dashed line is your {target} kcal target. Amber bars are under, rust bars are over, green is within 15%.
      </p>
    </>
  );
}
