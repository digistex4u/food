"use client";

import { createContext, useContext } from "react";
import { r0, r1 } from "@/lib/nutrition";

/**
 * Which step of the wizard is on screen.
 *
 * The step numbers are not fixed: a lifestyle user never sees the tracker or
 * the mechanics screens, so "Step five" means something different to them than
 * it does to someone on the fitness path. Rather than thread a number through
 * eight components, the shell publishes the position it actually rendered and
 * every section heading reads it. The literal eyebrow each component passes
 * survives as the fallback for anything rendered outside a step.
 */
const StepCtx = createContext<number | null>(null);
export const StepProvider = StepCtx.Provider;

const ORDINALS = [
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve",
];
export const stepWord = (n: number): string => `Step ${ORDINALS[n - 1] ?? n}`;

export function SectionHead({ eyebrow, title, children }: {
  eyebrow: string; title: string; children?: React.ReactNode;
}) {
  const n = useContext(StepCtx);
  return (
    <div className="sec-head">
      <span className="eyebrow">{n ? stepWord(n) : eyebrow}</span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}

export function Tile({ k, v, unit, note, hero, color, flat }: {
  k: string; v: React.ReactNode; unit?: string; note?: React.ReactNode;
  hero?: boolean; color?: string; flat?: boolean;
}) {
  return (
    <div
      className={`tile${hero ? " tile-hero" : ""}`}
      style={flat ? { border: 0, boxShadow: "none", background: "var(--surface-2)" } : undefined}
    >
      <span className="tile-k">{k}</span>
      <span className="tile-v" style={color ? { color } : undefined}>
        {v}
        {unit && <span className="tile-u">{unit}</span>}
      </span>
      {note && <span className="tile-n">{note}</span>}
    </div>
  );
}

/** A macro row: name, figure, share of the day, and a fill bar. `of` turns it
 *  into a progress bar against a target; without it, it shows composition. */
export function MacroBar({ name, cls, value, of, unit, right }: {
  name: string; cls: "m-p" | "m-c" | "m-f" | "m-k";
  value: number; of: number; unit: string; right?: React.ReactNode;
}) {
  const pct = of > 0 ? Math.min(100, (value / of) * 100) : 0;
  return (
    <div className={`macro-row ${cls}`}>
      <div className="macro-top">
        <span className="macro-name">{name}</span>
        <span className="macro-fig">
          {r0(value)}
          <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>{` / ${r0(of)} ${unit}`}</span>
        </span>
        <span className="macro-cal">{right ?? `${Math.round(pct)}%`}</span>
      </div>
      <div className="macro-track">
        <span className="macro-fill" style={{ width: `${pct.toFixed(1)}%` }} />
      </div>
    </div>
  );
}

export function Note({ html, warn, children, style }: {
  html?: string; warn?: boolean; children?: React.ReactNode; style?: React.CSSProperties;
}) {
  const cls = `note${warn ? " note-warn" : ""}`;
  if (html !== undefined) {
    return <div className={cls} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return <div className={cls} style={style}>{children}</div>;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="loading-wrap">
      <span className="spinner" /> {label}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

export const fmt1 = r1;
export const fmt0 = r0;

/** Half-step quantities read better as ½ than as 0.5 on a kitchen card. */
export function halfLabel(n: number): string {
  return (Math.round(n * 2) / 2).toString().replace(/^0\.5$/, "½").replace(".5", "½");
}
