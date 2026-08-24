"use client";

import { useEffect, useState } from "react";
import { ACTIVITY, GOAL_OPTIONS, calc, r1, type GoalKey, type Profile } from "@/lib/nutrition";
import { SectionHead, Tile, Note } from "./ui";

/** Local mirror of the numeric inputs so typing "1" on the way to "172" does
 *  not get clamped, rejected, or round-tripped mid-keystroke. */
function useDraft(me: Profile) {
  const [draft, setDraft] = useState({
    name: me.name, age: String(me.age), ht: String(me.ht), wt: String(me.wt),
  });
  useEffect(() => {
    setDraft({ name: me.name, age: String(me.age), ht: String(me.ht), wt: String(me.wt) });
  }, [me.id, me.name, me.age, me.ht, me.wt]);
  return [draft, setDraft] as const;
}

export default function Numbers({
  me, onPatch,
}: { me: Profile; onPatch: (p: Partial<Profile>) => void | Promise<void> }) {
  const [draft, setDraft] = useDraft(me);
  const c = calc(me);

  const commitNumber = (field: "age" | "ht" | "wt", raw: string) => {
    const n = parseFloat(raw);
    if (!isFinite(n)) { setDraft((d) => ({ ...d, [field]: String(me[field]) })); return; }
    if (n !== me[field]) void onPatch({ [field]: n } as Partial<Profile>);
  };

  const ft = (() => { const ti = me.ht / 2.54; return `${Math.floor(ti / 12)}′ ${Math.round(ti % 12)}″`; })();
  const bmiCat = c.bmi < 18.5 ? "underweight" : c.bmi < 25 ? "healthy range" : c.bmi < 30 ? "overweight" : "obese range";
  const mx = Math.max(c.tdee, c.target);

  const ladder: [string, string, number, string][] = [
    ["BMR", "at complete rest", c.bmr, "var(--ink-3)"],
    ["Maintenance", "BMR × activity", c.tdee, "var(--protein)"],
    ["Your target", c.g.label.toLowerCase(), c.target, "var(--accent)"],
  ];
  const macroRows: [string, number, number, string][] = [
    ["Protein", c.protein, c.protein * 4, "m-p"],
    ["Carbs", c.carbG, c.carbG * 4, "m-c"],
    ["Fat", c.fatG, c.fatG * 9, "m-f"],
  ];

  const wkLo = r1(Math.abs(c.wkLo) * 1000), wkHi = r1(Math.abs(c.wkHi) * 1000);
  const sign = c.g.dir > 0 ? "+" : "−";

  return (
    <section>
      <SectionHead eyebrow="Step one" title="Your numbers">
        Everything downstream — the calorie target, the meal sizes, the gram quantities on the
        recipe cards — is derived from these five inputs. Change one and the whole app re-computes,
        for everyone, on every device.
      </SectionHead>

      <div className="stack">
        <div className="card card-pad">
          <div className="grid-3" style={{ gap: 16 }}>
            <div className="field">
              <label htmlFor="f-name">Name</label>
              <input
                id="f-name" className="inp" style={{ fontFamily: "var(--sans)" }} autoComplete="off"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                onBlur={() => { if (draft.name.trim() !== me.name) void onPatch({ name: draft.name.trim() || "Person" }); }}
              />
            </div>

            <div className="field">
              <label>Sex</label>
              <div className="seg" role="group" aria-label="Sex">
                {(["m", "f"] as const).map((v) => (
                  <button key={v} type="button" aria-pressed={me.sex === v}
                          onClick={() => onPatch({ sex: v })}>
                    {v === "m" ? "Male" : "Female"}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label htmlFor="f-age">Age <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>(years)</span></label>
              <input id="f-age" className="inp" type="number" min={12} max={100} step={1} inputMode="numeric"
                     value={draft.age}
                     onChange={(e) => setDraft((d) => ({ ...d, age: e.target.value }))}
                     onBlur={(e) => commitNumber("age", e.target.value)} />
            </div>

            <div className="field">
              <label htmlFor="f-ht">Height <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>(cm)</span></label>
              <input id="f-ht" className="inp" type="number" min={100} max={250} step={0.5} inputMode="decimal"
                     value={draft.ht}
                     onChange={(e) => setDraft((d) => ({ ...d, ht: e.target.value }))}
                     onBlur={(e) => commitNumber("ht", e.target.value)} />
              <span className="tile-n">{ft}</span>
            </div>

            <div className="field">
              <label htmlFor="f-wt">Weight <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>(kg)</span></label>
              <input id="f-wt" className="inp" type="number" min={25} max={300} step={0.1} inputMode="decimal"
                     value={draft.wt}
                     onChange={(e) => setDraft((d) => ({ ...d, wt: e.target.value }))}
                     onBlur={(e) => commitNumber("wt", e.target.value)} />
              <span className="tile-n">BMI {r1(c.bmi)} — {bmiCat}</span>
            </div>

            <div className="field">
              <label htmlFor="f-act">Daily activity</label>
              <select id="f-act" className="inp" value={me.act} onChange={(e) => onPatch({ act: e.target.value })}>
                {ACTIVITY.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
              </select>
            </div>

            <div className="field" style={{ gridColumn: "1/-1" }}>
              <label htmlFor="f-goal">Goal</label>
              <select id="f-goal" className="inp" value={me.goal}
                      onChange={(e) => onPatch({ goal: e.target.value as GoalKey })}>
                {GOAL_OPTIONS.map((g) => <option key={g.v} value={g.v}>{g.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="grid-4">
          <Tile hero k="Eat this many" v={c.target} unit="kcal"
                note={`${c.surplus >= 0 ? "+" : ""}${c.surplus} vs maintenance`} />
          <Tile k="Protein" v={c.protein} unit="g" color="var(--protein)"
                note={c.proteinBasis === "lean"
                  ? `${c.proteinPerKg} g per kg of lean mass — ${c.body.lbm} kg`
                  : `${c.proteinPerKg} g per kg bodyweight — add a waist measurement for a better figure`} />
          <Tile k="Carbs" v={c.carbG} unit="g" color="var(--carb)"
                note="whatever's left after protein and fat" />
          <Tile k="Fat" v={c.fatG} unit="g" color="var(--fat)"
                note={`${Math.round(c.g.fatPct * 100)}% of calories — hormones need it`} />
        </div>

        <div className="grid-2">
          <div className="card card-pad">
            <div className="eyebrow" style={{ marginBottom: 14 }}>Where the energy goes</div>
            <div className="ladder">
              {ladder.map(([l, s, v, col]) => (
                <div className="rung" key={l}>
                  <span className="rung-l">{l}<small>{s}</small></span>
                  <span className="rung-bar">
                    <span className="rung-fill" style={{ width: `${((v / mx) * 100).toFixed(1)}%`, background: col }} />
                  </span>
                  <span className="rung-v">{v}</span>
                </div>
              ))}
            </div>
            <Note style={{ marginTop: 16 }} html={
              c.surplus > 0
                ? `That <strong>${c.surplus} kcal</strong> gap is the entire bulk. It is roughly <strong>one banana shake</strong> — which is exactly why the shake is in your plan. Miss it daily and you are on a maintenance diet with extra steps.`
                : c.surplus < 0
                ? `You are eating <strong>${Math.abs(c.surplus)} kcal below</strong> maintenance. Keep protein high and keep lifting — that combination is what protects muscle while fat comes off.`
                : `You are at maintenance. Weight should hold steady while training slowly recomposes what's already there.`
            } />
          </div>

          <div className="card card-pad">
            <div className="eyebrow" style={{ marginBottom: 14 }}>Daily macro targets</div>
            <div className="macros">
              {macroRows.map(([n, v, kc, cls]) => (
                <div className={`macro-row ${cls}`} key={n}>
                  <div className="macro-top">
                    <span className="macro-name">{n}</span>
                    <span className="macro-fig">{v} g</span>
                    <span className="macro-cal">{kc} kcal · {Math.round((kc / c.target) * 100)}%</span>
                  </div>
                  <div className="macro-track">
                    <span className="macro-fill" style={{ width: `${((kc / c.target) * 100).toFixed(1)}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <Note style={{ marginTop: 16 }} html={
              `Split that protein across <strong>4–5 feedings of ${Math.round(c.protein / 4.5)}–${Math.round(c.protein / 4)} g</strong> rather than two big ones. Each feeding is a separate trigger for muscle protein synthesis — see <em>The leucine threshold</em> in the physiology section.`
            } />
          </div>
        </div>

        <div className="card card-pad">
          <div className="eyebrow" style={{ marginBottom: 12 }}>Expected progress</div>
          <div className="grid-3">
            <Tile k="Weekly change"
                  v={c.g.dir === 0 ? "0" : `${sign}${wkLo}–${wkHi}`} unit="g"
                  note={c.g.dir > 0 ? "0.25–0.5% of bodyweight — the natural ceiling"
                        : c.g.dir < 0 ? "0.5–1% of bodyweight per week" : "hold steady"} />
            <Tile k="In 12 weeks"
                  v={c.g.dir === 0 ? "0" : `${sign}${r1(Math.abs(c.wkLo) * 12)}–${r1(Math.abs(c.wkHi) * 12)}`} unit="kg"
                  note={c.g.dir > 0 ? "perhaps 60–70% of it lean, in year one" : "fat, if protein and training hold"} />
            <Tile k="Protein per meal" v={Math.round(c.protein / 4)} unit="g" color="var(--protein)"
                  note="across 4 feedings — clears the leucine threshold each time" />
          </div>
          <Note warn style={{ marginTop: 16 }} html={
            `<strong>The scale will not show this weekly.</strong> ${wkLo}–${wkHi} g is inside the noise of daily water weight, which swings 1–2 kg for reasons unrelated to muscle. Log your weight every morning on the <strong>Weight &amp; progress</strong> tab — it compares two 7-day averages and tells you when, and only when, to change the target.`
          } />
        </div>

        <p className="tile-n" style={{ maxWidth: "66ch" }}>
          These are population-average estimates, not measurements. Your own scale beats any formula.
          This is general nutrition information, not medical advice — if you have a health condition,
          check with a doctor or a registered dietitian first.
        </p>
      </div>
    </section>
  );
}
