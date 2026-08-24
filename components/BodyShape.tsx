"use client";

import { useEffect, useState } from "react";
import type { AppProfile } from "@/lib/client";
import { calc, type Profile } from "@/lib/nutrition";
import {
  BUILD_TYPES, FAT_PATTERNS, INDIAN_BMI_BANDS, THIN_FAT, WHTR_LABEL,
  katchMcArdle, waistCutoff,
  type BuildType, type FatPattern, type RiskBand,
} from "@/lib/bodycomp";
import { Tile, Note } from "./ui";

/** Three-segment meter for the NICE waist-to-height bands. */
function WhtrMeter({ whtr, band }: { whtr: number; band: RiskBand }) {
  const segs: RiskBand[] = ["healthy", "increased", "high"];
  return (
    <div className="meter">
      <div className="meter-track">
        {segs.map((s) => (
          <span key={s} className={`meter-seg ${band === s ? `on-${s}` : "off"}`} />
        ))}
      </div>
      <div className="meter-scale">
        <span>0.40</span><span>0.50</span><span>0.60</span><span>0.70</span>
      </div>
      <p className="tile-n" style={{ marginTop: 8 }}>
        Your ratio is <b className="mono">{whtr.toFixed(2)}</b> — {WHTR_LABEL[band].toLowerCase()}.
        NICE puts the healthy band under 0.50: keep your waist to less than half your height.
      </p>
    </div>
  );
}

export default function BodyShape({
  me, onPatch,
}: { me: AppProfile; onPatch: (p: Partial<AppProfile>) => void | Promise<void> }) {
  const [waist, setWaist] = useState(me.waist ? String(me.waist) : "");
  const [hip, setHip] = useState(me.hip ? String(me.hip) : "");

  useEffect(() => {
    setWaist(me.waist ? String(me.waist) : "");
    setHip(me.hip ? String(me.hip) : "");
  }, [me.id, me.waist, me.hip]);

  const c = calc(me as Profile);
  const b = c.body;

  const commit = (field: "waist" | "hip", raw: string) => {
    const t = raw.trim();
    if (t === "") { if (me[field] != null) void onPatch({ [field]: null } as Partial<AppProfile>); return; }
    const n = parseFloat(t);
    if (!isFinite(n) || n < 40 || n > 200) { setWaist(me.waist ? String(me.waist) : ""); return; }
    if (n !== me[field]) void onPatch({ [field]: n } as Partial<AppProfile>);
  };

  return (
    <div className="stack">
      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 6 }}>Measure, don&apos;t guess</div>
        <p className="tile-n" style={{ maxWidth: "64ch", marginBottom: 16 }}>
          One tape measurement changes more of this app than anything except your weight. It lets
          the plan estimate your body fat, set protein from <b>lean mass</b> rather than total
          weight, and tell you whether a bulk is the right move at all.
        </p>

        <div className="grid-3" style={{ gap: 16 }}>
          <div className="field">
            <label htmlFor="m-waist">Waist (cm)</label>
            <input id="m-waist" className="inp" type="number" min={40} max={200} step={0.5}
                   inputMode="decimal" placeholder="e.g. 84"
                   value={waist} onChange={(e) => setWaist(e.target.value)}
                   onBlur={(e) => commit("waist", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="m-hip">Hip (cm) <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>— optional</span></label>
            <input id="m-hip" className="inp" type="number" min={40} max={200} step={0.5}
                   inputMode="decimal" placeholder="e.g. 96"
                   value={hip} onChange={(e) => setHip(e.target.value)}
                   onBlur={(e) => commit("hip", e.target.value)} />
          </div>
          <div className="field">
            <label>Waist-to-height</label>
            <div className="inp" style={{ background: "var(--surface-2)", borderStyle: "dashed" }}>
              {b.whtr !== null ? b.whtr.toFixed(2) : "—"}
            </div>
          </div>
        </div>

        <p className="measure-help">
          <b>Waist:</b> at the narrowest point between your lowest rib and the top of your hip bone,
          usually just above the navel. Standing, at the end of a normal breath out — don&apos;t suck
          in, and don&apos;t pull the tape tight.<br />
          <b>Hip:</b> around the widest part of your buttocks. Only used to work out the ratio
          between the two.
        </p>
      </div>

      {b.whtr !== null && (
        <>
          <div className="grid-4">
            <Tile k="Body fat" v={b.bodyFat ?? "—"} unit="%"
                  note="estimated from waist and height (RFM)" />
            <Tile k="Lean mass" v={b.lbm ?? "—"} unit="kg" color="var(--protein)"
                  note="what your protein target is now based on" />
            <Tile k="Waist / height" v={b.whtr.toFixed(2)}
                  color={b.whtrBand === "healthy" ? "var(--good)" : b.whtrBand === "high" ? "var(--crit)" : "var(--warn)"}
                  note={b.whtrBand ? WHTR_LABEL[b.whtrBand].toLowerCase() : ""} />
            <Tile k="BMI (Indian scale)" v={b.bmi.toFixed(1)}
                  note={b.bmiBand.label} />
          </div>

          <div className="card card-pad">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              <div className="eyebrow">What the tape says</div>
              {b.whtrBand && (
                <span className={`band-pill band-${b.whtrBand}`}>{WHTR_LABEL[b.whtrBand]}</span>
              )}
              {b.waistFlag && (
                <span className="band-pill band-high">
                  Waist ≥ {waistCutoff(me.sex)} cm — abdominal obesity threshold
                </span>
              )}
            </div>
            <h3 style={{ fontSize: 17, marginBottom: 8 }}>{b.headline}</h3>
            <p className="prose" style={{ fontSize: 15, maxWidth: "68ch" }}>{b.advice}</p>
            {b.whtr !== null && b.whtrBand && (
              <div style={{ marginTop: 16 }}><WhtrMeter whtr={b.whtr} band={b.whtrBand} /></div>
            )}
          </div>

          <div className="grid-2">
            <div className="card card-pad">
              <div className="eyebrow" style={{ marginBottom: 12 }}>Two estimates of your BMR</div>
              <div className="ladder">
                {([
                  ["Mifflin-St Jeor", "from total weight — drives your target", c.bmr, "var(--accent)"],
                  ["Katch-McArdle", "from lean mass — a cross-check", b.lbm !== null ? katchMcArdle(b.lbm) : 0, "var(--protein)"],
                ] as [string, string, number, string][]).map(([l, s, v, col]) => (
                  <div className="rung" key={l}>
                    <span className="rung-l">{l}<small>{s}</small></span>
                    <span className="rung-bar">
                      <span className="rung-fill" style={{ width: `${(v / Math.max(c.bmr, b.lbm !== null ? katchMcArdle(b.lbm) : 1) * 100).toFixed(1)}%`, background: col }} />
                    </span>
                    <span className="rung-v">{v}</span>
                  </div>
                ))}
              </div>
              <Note style={{ marginTop: 14 }}>
                {b.lbm !== null && Math.abs(katchMcArdle(b.lbm) - c.bmr) > c.bmr * 0.1 ? (
                  <>These disagree by more than 10%, which happens when body composition is unusual
                  for the weight. Your target follows <b>Mifflin</b>, because it works from measured
                  weight rather than compounding an estimate — but treat the target as a starting
                  point and let two weeks of weigh-ins settle it.</>
                ) : (
                  <>The two agree closely, which is a good sign the body-fat estimate is sensible.
                  Your target follows <b>Mifflin</b>, since it doesn&apos;t compound the tape estimate.</>
                )}
              </Note>
            </div>

            <div className="card card-pad">
              <div className="eyebrow" style={{ marginBottom: 12 }}>Where your protein number comes from</div>
              <div className="grid-2" style={{ gap: 10 }}>
                <Tile flat k="Protein target" v={c.protein} unit="g" color="var(--protein)"
                      note={c.proteinBasis === "lean"
                        ? `${c.proteinPerKg} g per kg of lean mass`
                        : `${c.proteinPerKg} g per kg of bodyweight`} />
                <Tile flat k="If set on total weight" v={Math.round(me.wt * c.proteinPerKg)} unit="g"
                      note="what the usual shortcut would have asked for" />
              </div>
              <Note style={{ marginTop: 14 }}>
                Fat tissue needs almost no protein, so prescribing per kg of <em>total</em> weight
                overshoots for anyone carrying more of it — sometimes by so much that no vegetarian
                day can deliver it. Basing it on lean mass is both better supported and actually
                achievable.
              </Note>
            </div>
          </div>
        </>
      )}

      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 6 }}>Where do you carry it?</div>
        <p className="tile-n" style={{ maxWidth: "64ch", marginBottom: 14 }}>
          This is about <em>distribution</em>, which is real and measurable — not about
          &ldquo;body types&rdquo;. It sharpens the risk read and the advice; it does not change your
          macro split, because no good evidence says it should.
          {b.patternInferred && <> Your hip measurement already suggests <b>{FAT_PATTERNS.find((f) => f.v === b.pattern)?.label.toLowerCase()}</b> — confirm or correct it below.</>}
        </p>
        <div className="pick-grid">
          {FAT_PATTERNS.map((f) => (
            <button key={f.v} type="button" className="pick"
                    aria-pressed={(me.pattern ?? "unset") === f.v}
                    onClick={() => onPatch({ pattern: (me.pattern === f.v ? "unset" : f.v) as FatPattern })}>
              <b>{f.label}</b>
              <small>{f.blurb}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 6 }}>How does your weight usually behave?</div>
        <p className="tile-n" style={{ maxWidth: "64ch", marginBottom: 14 }}>
          How easily you gain is a decent proxy for how much you fidget, walk and burn outside the
          gym — which really does move energy balance. This nudges your starting surplus by up to
          5% and nothing else. Two weeks of weigh-ins overrule it either way.
        </p>
        <div className="pick-grid">
          {BUILD_TYPES.map((t) => (
            <button key={t.v} type="button" className="pick"
                    aria-pressed={(me.build ?? "unset") === t.v}
                    onClick={() => onPatch({ build: (me.build === t.v ? "unset" : t.v) as BuildType })}>
              <b>{t.label}</b>
              <small>{t.blurb}</small>
            </button>
          ))}
        </div>
        {c.buildAdj !== 0 && (
          <Note style={{ marginTop: 14 }}>
            This has moved your target by <b>{c.buildAdj > 0 ? "+" : ""}{Math.round(c.buildAdj * c.tdee)} kcal</b>{" "}
            ({c.buildAdj > 0 ? "+" : ""}{Math.round(c.buildAdj * 100)}%). If the scale disagrees after a
            fortnight, the scale is right.
          </Note>
        )}
      </div>

      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 10 }}>Why the Indian scale is different</div>
        <p className="prose" style={{ fontSize: 15.5, maxWidth: "68ch" }}>{THIN_FAT}</p>
        <div className="tablewrap" style={{ marginTop: 14 }}>
          <table>
            <thead><tr><th>Band</th><th className="num">BMI</th><th>Where you sit</th></tr></thead>
            <tbody>
              {INDIAN_BMI_BANDS.map((band) => {
                const here = band.label === b.bmiBand.label;
                return (
                  <tr key={band.label} style={here ? { background: "var(--accent-soft)" } : undefined}>
                    <td style={here ? { fontWeight: 600 } : undefined}>{band.label}</td>
                    <td className="num">
                      {band.to === null ? `${band.from}+` : `${band.from} – ${band.to}`}
                    </td>
                    <td>{here ? <span className={`band-pill band-${band.risk}`}>you are here</span> : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="tile-n" style={{ marginTop: 12, maxWidth: "66ch" }}>
          These come from the 2025 revised national definition of obesity for Asian Indians, which
          moved the overweight threshold down to BMI 23 and set abdominal obesity at a waist of
          90 cm for men and 80 cm for women. They are lower than the international WHO cutoffs for
          a reason — the same BMI carries more fat, and more of it around the organs.
        </p>
      </div>

      <p className="tile-n" style={{ maxWidth: "66ch" }}>
        Every figure on this page is an estimate from a tape measure, not a measurement of your
        actual body composition. A DEXA scan is the real thing. These estimates are good enough to
        set a starting target and to tell you which direction to move — no more than that. This is
        general nutrition information, not medical advice.
      </p>
    </div>
  );
}
