"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, jsonBody, patchBody, type AppProfile, type ShoppingItem } from "@/lib/client";
import {
  F, PLAN_RULES, PLAN_TITLE, buildPlan, calc, nut, planNote, qtyLabel, r0, r1, swapsFor,
  type Food, type PlanConfig, type PlanItem, type PlanMeal, type Profile,
} from "@/lib/nutrition";
import { SectionHead, Tile, Note, Loading, Empty } from "./ui";

export default function Plan({
  me, say, onPatch,
}: {
  me: AppProfile;
  say: (m: string, bad?: boolean) => void;
  onPatch: (p: Partial<AppProfile>) => void | Promise<void>;
}) {
  const c = calc(me);
  const cfg: PlanConfig = useMemo(
    () => ({ variants: me.planConfig?.variants ?? {}, swaps: me.planConfig?.swaps ?? {} }),
    [me.planConfig]
  );
  const P = useMemo(
    () => buildPlan(c.target, c.protein, c.fatG, c.carbG, cfg),
    [c.target, c.protein, c.fatG, c.carbG, cfg]
  );
  const gapP = c.protein - P.tot.p;

  const chooseOption = (tag: string, index: number) => {
    const variants = { ...cfg.variants, [tag]: index };
    // A meal's swaps belong to the items of the option that was showing, so
    // changing option clears them rather than re-applying them to a menu they
    // were never chosen for.
    const swaps = Object.fromEntries(
      Object.entries(cfg.swaps ?? {}).filter(([k]) => !k.startsWith(`${tag}::`))
    );
    void onPatch({ planConfig: { variants, swaps } });
  };

  const applySwap = (tag: string, slot: string, toName: string | null) => {
    const swaps = { ...cfg.swaps };
    if (toName === null) delete swaps[`${tag}::${slot}`];
    else swaps[`${tag}::${slot}`] = toName;
    void onPatch({ planConfig: { variants: cfg.variants, swaps } });
  };

  const swapCount = Object.keys(cfg.swaps ?? {}).length;
  const variantCount = Object.values(cfg.variants ?? {}).filter((v) => v > 0).length;

  return (
    <section>
      <SectionHead eyebrow="Step five" title={PLAN_TITLE[me.goal]}>
        Seven feedings, portioned to your exact target. Each one offers three or four Indian
        alternatives, and any single item can be traded for another — milk for chai or filter
        coffee, paneer for soya, roti for rice. Change anything and the solver re-balances the rest
        of the day around it.
      </SectionHead>

      <div className="stack">
        <div className="card card-pad">
          <div className="eyebrow" style={{ marginBottom: 14 }}>What this day delivers</div>
          <div className="grid-4">
            <Tile flat k="Calories" v={r0(P.tot.k)} note={`target ${c.target}`} />
            <Tile flat k="Protein" v={r0(P.tot.p)} unit="g" color="var(--protein)" note={`target ${c.protein} g`} />
            <Tile flat k="Carbs" v={r0(P.tot.c)} unit="g" color="var(--carb)" note={`target ${c.carbG} g`} />
            <Tile flat k="Fat" v={r0(P.tot.f)} unit="g" color="var(--fat)" note={`target ${c.fatG} g`} />
          </div>
          <Note warn={gapP > 15} style={{ marginTop: 16 }} html={planNote(c, P, gapP)} />
          {(swapCount > 0 || variantCount > 0) && (
            <div className="track-head no-print" style={{ marginTop: 14, marginBottom: 0 }}>
              <span className="tile-n">
                You have changed <b>{variantCount}</b> meal{variantCount === 1 ? "" : "s"}
                {swapCount > 0 && <> and swapped <b>{swapCount}</b> item{swapCount === 1 ? "" : "s"}</>}.
                Everything above is recalculated from those choices.
              </span>
              <button className="btn btn-sm btn-ghost" style={{ marginLeft: "auto" }}
                      onClick={() => onPatch({ planConfig: { variants: {}, swaps: {} } })}>
                Reset to the default day
              </button>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-pad" style={{ paddingBottom: 0 }}>
            <div className="eyebrow">The day, meal by meal</div>
          </div>
          <div className="card-pad" style={{ paddingTop: 6 }}>
            {P.meals.map((m) => (
              <MealRow
                key={m.tag} m={m}
                onOption={(i) => chooseOption(m.tag, i)}
                onSwap={(slot, to) => applySwap(m.tag, slot, to)}
              />
            ))}
          </div>
        </div>

        <div className="grid-2">
          <ShoppingList me={me} say={say} />
          <div className="card card-pad">
            <div className="eyebrow" style={{ marginBottom: 12 }}>Rules that matter more than the plan</div>
            {PLAN_RULES.map((r, i) => (
              <div key={r[0]} style={{ padding: "11px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ display: "flex", gap: 9, alignItems: "baseline" }}>
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--accent)", fontWeight: 600 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <strong style={{ fontSize: 14 }}>{r[0]}</strong>
                    <p className="tile-n" style={{ marginTop: 3 }}>{r[1]}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- shopping list */

function ShoppingList({
  me, say,
}: { me: Profile; say: (m: string, bad?: boolean) => void }) {
  const [items, setItems] = useState<ShoppingItem[] | null>(null);
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await api<ShoppingItem[]>(`/api/shopping?profile=${me.id}`)); }
    catch (e) { setItems([]); say(e instanceof Error ? e.message : "Could not load the list.", true); }
  }, [me.id, say]);

  useEffect(() => { void load(); }, [load]);

  const generate = async () => {
    setBusy(true);
    try {
      const next = await api<ShoppingItem[]>("/api/shopping", jsonBody({ profileId: me.id, action: "generate" }));
      setItems(next);
      say("Rebuilt from your plan — hand-added items kept");
    } catch (e) {
      say(e instanceof Error ? e.message : "Could not rebuild the list.", true);
    } finally { setBusy(false); }
  };

  const toggle = async (it: ShoppingItem) => {
    const before = items ?? [];
    setItems(before.map((x) => (x.id === it.id ? { ...x, checked: !x.checked } : x)));
    try { await api("/api/shopping", patchBody({ id: it.id, checked: !it.checked })); }
    catch (e) { setItems(before); say(e instanceof Error ? e.message : "Could not save that.", true); }
  };

  const addItem = async () => {
    const name = adding.trim();
    if (!name) return;
    setAdding("");
    try { setItems([...(items ?? []), await api<ShoppingItem>("/api/shopping", jsonBody({ profileId: me.id, name }))]); }
    catch (e) { say(e instanceof Error ? e.message : "Could not add that.", true); }
  };

  const clearTicked = async () => {
    const before = items ?? [];
    setItems(before.filter((x) => !x.checked));
    try { await api(`/api/shopping?profile=${me.id}`, { method: "DELETE" }); }
    catch (e) { setItems(before); say(e instanceof Error ? e.message : "Could not clear those.", true); }
  };

  const uncheckAll = async () => {
    const before = items ?? [];
    setItems(before.map((x) => ({ ...x, checked: false })));
    try { await api("/api/shopping", patchBody({ action: "uncheckAll", profileId: me.id })); }
    catch (e) { setItems(before); say(e instanceof Error ? e.message : "Could not reset those.", true); }
  };

  const groups = useMemo(() => {
    const g: Record<string, ShoppingItem[]> = {};
    for (const it of items ?? []) (g[it.cat || "Other"] ??= []).push(it);
    return Object.entries(g);
  }, [items]);

  const done = (items ?? []).filter((i) => i.checked).length;

  return (
    <div className="card card-pad">
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div className="eyebrow">Weekly shopping list</div>
        {items && items.length > 0 && (
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginLeft: "auto" }}>
            {done} / {items.length} ticked
          </span>
        )}
      </div>

      {items === null ? (
        <Loading label="Loading the list…" />
      ) : items.length === 0 ? (
        <>
          <Empty>Nothing on the list yet. Build it from your plan — seven days of every ingredient.</Empty>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={generate} disabled={busy}>
            {busy ? "Building…" : "Build from my plan"}
          </button>
        </>
      ) : (
        <>
          {groups.map(([cat, list]) => (
            <div key={cat} style={{ marginBottom: 14 }}>
              <div className="r-sub">{cat}</div>
              {list.map((it) => (
                <label className={`shop-row${it.checked ? " done" : ""}`} key={it.id}>
                  <input type="checkbox" checked={it.checked} onChange={() => toggle(it)} />
                  <span className="shop-name">{it.name}</span>
                  <span className="shop-qty">{it.qty}</span>
                  {!it.generated && (
                    <button className="btn btn-sm btn-ghost no-print"
                            onClick={(e) => { e.preventDefault(); void api(`/api/shopping?id=${it.id}`, { method: "DELETE" }).then(load); }}>
                      ×
                    </button>
                  )}
                </label>
              ))}
            </div>
          ))}

          <div className="track-head no-print" style={{ marginTop: 4, marginBottom: 10 }}>
            <input className="inp" style={{ flex: 1, minWidth: 140, fontFamily: "var(--sans)" }}
                   placeholder="Add something else…" value={adding}
                   onChange={(e) => setAdding(e.target.value)}
                   onKeyDown={(e) => { if (e.key === "Enter") void addItem(); }} />
            <button className="btn btn-sm" onClick={addItem} disabled={!adding.trim()}>Add</button>
          </div>
          <div className="track-head no-print" style={{ marginBottom: 0 }}>
            <button className="btn btn-sm btn-ghost" onClick={uncheckAll}>Untick all</button>
            <button className="btn btn-sm btn-ghost" onClick={clearTicked} disabled={!done}>Remove ticked</button>
            <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={generate} disabled={busy}>
              {busy ? "Rebuilding…" : "Rebuild from plan"}
            </button>
          </div>
        </>
      )}

      <p className="tile-n" style={{ marginTop: 12 }}>
        Quantities are one person for seven days. Ticks are saved, so whoever is at the shop sees
        what is already in the basket.
      </p>
    </div>
  );
}

/* ------------------------------------------------------- one meal, with options */

function MealRow({
  m, onOption, onSwap,
}: {
  m: PlanMeal;
  onOption: (index: number) => void;
  onSwap: (slot: string, to: string | null) => void;
}) {
  // The option name is the menu as written; once an item inside it has been
  // traded, saying "Milk, nuts and dates" over a cup of coffee would be a lie.
  const adjusted = m.items.some((i) => i.swappedFrom);
  return (
    <div className="planmeal">
      <div className="pm-time">{m.time}<small>{m.tag}</small></div>
      <div>
        <div className="pm-name">
          {m.name}
          {adjusted && <span className="swapped-tag">adjusted</span>}
          <span className="pm-k">{r0(m.tot.k)} kcal · {r0(m.tot.p)} g P</span>
        </div>

        <div className="opt-chips no-print">
          <span className="opt-label">Instead</span>
          {m.optionNames.map((n, i) => (
            <button key={n} type="button" aria-pressed={i === m.variantIndex}
                    onClick={() => onOption(i)}>
              {n}
            </button>
          ))}
        </div>

        <div className="pm-items">
          {m.items.map((it) => (
            <SwappableItem key={it.slot} it={it} onSwap={onSwap} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------- one item, with a swap menu */

function SwappableItem({
  it, onSwap,
}: { it: PlanItem; onSwap: (slot: string, to: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);

  const original = it.swappedFrom ?? it.food.name;
  const originalFood = F(original);
  const alternatives = useMemo(
    () => swapsFor(original).filter((f) => f.name !== original),
    [original]
  );

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("click", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("click", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  // What one swap would cost or give, at the same number of servings — so the
  // choice is made on numbers rather than on the name alone.
  const perServing = (f: Food) => nut(f, f.sg);
  const mine = perServing(it.food);

  if (!alternatives.length) {
    return (
      <div className="pm-item">
        <span className="pi-q">{qtyLabel(it)}</span>
        <span className="pi-n">{it.food.name}</span>
      </div>
    );
  }

  return (
    <div className="pm-item">
      <span className="pi-q">{qtyLabel(it)}</span>
      <span className="swap-wrap" ref={wrap}>
        <button className="swap-btn pi-n" type="button" onClick={() => setOpen(!open)}
                aria-expanded={open} title={`Swap ${it.food.name} for something else`}>
          {it.food.name}
        </button>
        {it.swappedFrom && <span className="swapped-tag">was {it.swappedFrom.replace(/,.*$/, "")}</span>}

        {open && (
          <div className="swap-pop no-print">
            <div className="swap-pop-hd">Instead of {original.replace(/,.*$/, "")}</div>
            <div className="swap-pop-list">
              <button className="swap-opt" type="button" aria-pressed={!it.swappedFrom}
                      onClick={() => { onSwap(it.slot, null); setOpen(false); }}>
                <span className="so-n">{original}</span>
                <span className="so-k">{r0(perServing(originalFood).k)} kcal · {r1(perServing(originalFood).p)} g P</span>
              </button>
              {alternatives.map((f) => {
                const n = perServing(f);
                return (
                  <button key={f.name} className="swap-opt" type="button"
                          aria-pressed={it.food.name === f.name}
                          onClick={() => { onSwap(it.slot, f.name); setOpen(false); }}>
                    <span className="so-n">{f.name}</span>
                    <span className="so-k">{r0(n.k)} kcal · {r1(n.p)} g P</span>
                  </button>
                );
              })}
            </div>
            <div className="swap-pop-ft">
              <span className="tile-n">
                Figures are per standard serving. A swap keeps the same number of servings
                {mine.p > 2 && ", so a lower-protein choice is made up elsewhere in the day"}.
              </span>
            </div>
          </div>
        )}
      </span>
    </div>
  );
}
