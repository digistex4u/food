"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, dkey, jsonBody, parseDay, type WeightPoint } from "@/lib/client";
import { calc, readTrend, r1, type Profile } from "@/lib/nutrition";
import { SectionHead, Tile, Loading, Empty } from "./ui";

const VERDICT_TITLE: Record<string, string> = {
  "no-data": "Nothing logged yet",
  "too-few": "Not enough readings to call it",
  "on-track": "On track — change nothing",
  "too-slow": "Moving too slowly",
  "too-fast": "Moving too fast",
  "wrong-way": "Going the wrong way",
};

export default function Weight({
  me, say,
}: { me: Profile; say: (m: string, bad?: boolean) => void }) {
  const [points, setPoints] = useState<WeightPoint[] | null>(null);
  const [entry, setEntry] = useState("");
  const [entryDate, setEntryDate] = useState(() => dkey(new Date()));
  const [busy, setBusy] = useState(false);

  const c = calc(me);

  const load = useCallback(async () => {
    try { setPoints(await api<WeightPoint[]>(`/api/weights?profile=${me.id}&days=120`)); }
    catch (e) { setPoints([]); say(e instanceof Error ? e.message : "Could not load weights.", true); }
  }, [me.id, say]);

  useEffect(() => { void load(); }, [load]);

  const trend = useMemo(() => readTrend(points ?? [], c), [points, c]);

  const save = async () => {
    const w = parseFloat(entry);
    if (!isFinite(w) || w < 25 || w > 300) { say("Enter a weight in kilograms, between 25 and 300.", true); return; }
    setBusy(true);
    try {
      await api("/api/weights", jsonBody({ profileId: me.id, date: entryDate, weight: w }));
      setEntry("");
      await load();
      say(`Logged ${w} kg`);
    } catch (e) {
      say(e instanceof Error ? e.message : "Could not save that.", true);
    } finally { setBusy(false); }
  };

  const remove = async (d: string) => {
    try { await api(`/api/weights?profile=${me.id}&date=${d}`, { method: "DELETE" }); await load(); }
    catch (e) { say(e instanceof Error ? e.message : "Could not remove that.", true); }
  };

  const todayLogged = (points ?? []).some((p) => p.d === dkey(new Date()));

  return (
    <section>
      <SectionHead eyebrow="Step four" title="Weight & progress">
        The single measurement the whole plan depends on. Weigh yourself every morning — after the
        toilet, before food or water, same clothes — and let the trend, not any one morning, decide
        whether the calorie target changes.
      </SectionHead>

      <div className="stack">
        <div className="card card-pad">
          <div className="grid-3" style={{ gap: 14, alignItems: "end" }}>
            <div className="field">
              <label htmlFor="w-date">Morning of</label>
              <input id="w-date" className="inp" type="date" value={entryDate}
                     max={dkey(new Date())}
                     onChange={(e) => setEntryDate(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="w-kg">Weight (kg)</label>
              <input id="w-kg" className="inp" type="number" step={0.1} min={25} max={300}
                     inputMode="decimal" placeholder={String(me.wt)}
                     value={entry} onChange={(e) => setEntry(e.target.value)}
                     onKeyDown={(e) => { if (e.key === "Enter") void save(); }} />
            </div>
            <button className="btn btn-primary" onClick={save} disabled={busy || !entry}>
              {busy ? "Saving…" : todayLogged && entryDate === dkey(new Date()) ? "Replace today's" : "Log weight"}
            </button>
          </div>
          <p className="tile-n" style={{ marginTop: 12 }}>
            One reading per day — logging again for the same morning replaces it. Your profile weight
            updates automatically from the newest reading, so the calorie target follows the body it
            is being calculated for.
          </p>
        </div>

        {points === null ? (
          <Loading label="Loading your readings…" />
        ) : (
          <>
            <div className="grid-4">
              <Tile k="7-day average" v={trend.avg7 === null ? "—" : r1(trend.avg7)} unit="kg"
                    note="the only number that means anything" />
              <Tile k="Week before" v={trend.avg7Prev === null ? "—" : r1(trend.avg7Prev)} unit="kg"
                    note="what it is compared against" />
              <Tile k="Rate" color={trend.verdict === "on-track" ? "var(--good)" : trend.verdict === "wrong-way" ? "var(--crit)" : "var(--warn)"}
                    v={trend.ratePerWeek === null ? "—" : `${trend.ratePerWeek >= 0 ? "+" : "−"}${Math.abs(trend.ratePerWeek * 1000).toFixed(0)}`}
                    unit="g/wk" note="difference between the two averages" />
              <Tile k="Target rate"
                    v={c.g.dir === 0 ? "0" : `${c.g.dir > 0 ? "+" : "−"}${(Math.abs(c.wkLo) * 1000).toFixed(0)}–${(Math.abs(c.wkHi) * 1000).toFixed(0)}`}
                    unit="g/wk" note={`what a ${c.g.label.toLowerCase()} should look like`} />
            </div>

            <div className={`verdict v-${trend.verdict}`}>
              <span className="verdict-dot" />
              <div className="verdict-b">
                <h4>{VERDICT_TITLE[trend.verdict]}</h4>
                <p dangerouslySetInnerHTML={{ __html: trend.advice }} />
              </div>
            </div>

            <div className="card card-pad">
              <div className="eyebrow" style={{ marginBottom: 10 }}>Daily readings and 7-day average</div>
              {points.length < 2 ? (
                <Empty>Two readings and the chart appears. Fourteen and it starts being useful.</Empty>
              ) : (
                <TrendChart points={points} />
              )}
            </div>

            <div className="card card-pad">
              <div className="eyebrow" style={{ marginBottom: 12 }}>All readings</div>
              {points.length === 0 ? (
                <Empty>Nothing logged yet.</Empty>
              ) : (
                <div className="tablewrap" style={{ maxHeight: 320, overflowY: "auto" }}>
                  <table>
                    <thead>
                      <tr><th>Morning</th><th className="num">Weight</th><th className="num">Change</th><th /></tr>
                    </thead>
                    <tbody>
                      {[...points].reverse().map((p, i, arr) => {
                        const prev = arr[i + 1];
                        const d = prev ? p.w - prev.w : null;
                        return (
                          <tr key={p.d}>
                            <td>{parseDay(p.d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</td>
                            <td className="num" style={{ fontWeight: 600 }}>{p.w.toFixed(1)} kg</td>
                            <td className="num" style={{ color: d === null ? "var(--ink-3)" : d > 0 ? "var(--accent)" : d < 0 ? "var(--fat)" : "var(--ink-3)" }}>
                              {d === null ? "—" : `${d > 0 ? "+" : ""}${d.toFixed(1)}`}
                            </td>
                            <td className="num no-print">
                              <button className="btn btn-sm btn-ghost" onClick={() => remove(p.d)}>Remove</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ the chart */

/**
 * Daily readings as faint dots, the 7-day moving average as the line. Drawn
 * this way on purpose: the dots show how noisy body weight really is, and the
 * line shows the only signal inside that noise.
 */
function TrendChart({ points }: { points: WeightPoint[] }) {
  const W = 720, H = 170, PAD_L = 38, PAD_R = 8, PAD_T = 12, PAD_B = 22;

  const sorted = [...points].sort((a, b) => (a.d < b.d ? -1 : 1));
  const t0 = parseDay(sorted[0].d).getTime();
  const t1 = parseDay(sorted[sorted.length - 1].d).getTime();
  const span = Math.max(1, t1 - t0);

  const avg: (number | null)[] = sorted.map((_, i) => {
    if (i < 3) return null;
    const win = sorted.slice(Math.max(0, i - 6), i + 1).map((p) => p.w);
    return win.reduce((s, x) => s + x, 0) / win.length;
  });

  const ws = sorted.map((p) => p.w).concat(avg.filter((a): a is number => a !== null));
  const lo = Math.min(...ws), hi = Math.max(...ws);
  const pad = Math.max(0.4, (hi - lo) * 0.15);
  const yLo = lo - pad, yHi = hi + pad;

  const x = (d: string) => PAD_L + ((parseDay(d).getTime() - t0) / span) * (W - PAD_L - PAD_R);
  const y = (w: number) => PAD_T + (1 - (w - yLo) / Math.max(0.001, yHi - yLo)) * (H - PAD_T - PAD_B);

  const line = sorted
    .map((p, i) => (avg[i] === null ? null : `${x(p.d).toFixed(1)},${y(avg[i] as number).toFixed(1)}`))
    .filter(Boolean)
    .join(" ");

  const ticks = [yLo + (yHi - yLo) * 0.1, (yLo + yHi) / 2, yHi - (yHi - yLo) * 0.1];

  return (
    <div className="trend-wrap">
      <svg className="trend-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
           aria-label="Weight readings with a seven-day moving average">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={PAD_L - 6} y={y(t) + 3.5} textAnchor="end"
                  fill="var(--ink-3)" fontSize={9} fontFamily="var(--mono)">
              {t.toFixed(1)}
            </text>
          </g>
        ))}
        {sorted.map((p) => (
          <circle key={p.d} cx={x(p.d)} cy={y(p.w)} r={2.4} fill="var(--ink-3)" opacity={0.45}>
            <title>{`${p.d} — ${p.w.toFixed(1)} kg`}</title>
          </circle>
        ))}
        {line && <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth={2.2}
                           strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
        <text x={PAD_L} y={H - 6} fill="var(--ink-3)" fontSize={9} fontFamily="var(--mono)">
          {parseDay(sorted[0].d).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
        </text>
        <text x={W - PAD_R} y={H - 6} textAnchor="end" fill="var(--ink-3)" fontSize={9} fontFamily="var(--mono)">
          {parseDay(sorted[sorted.length - 1].d).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
        </text>
      </svg>
    </div>
  );
}
