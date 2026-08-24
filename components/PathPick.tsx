"use client";

import { PATHS, type PathKey } from "@/lib/nutrition";
import { SectionHead } from "./ui";

const Tick = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="pp-tick">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

/**
 * The first screen. Everything downstream branches on this answer, so it is
 * asked plainly and once, and it can be changed later from the same screen —
 * someone who starts on lifestyle and decides to get serious should not have to
 * make a second profile to do it.
 */
export default function PathPick({
  value, name, onChoose,
}: {
  value: PathKey;
  name: string;
  onChoose: (p: PathKey) => void;
}) {
  return (
    <section>
      <SectionHead eyebrow="Step one" title={`What is this for, ${name}?`}>
        Two different apps live in here. Pick the one you will actually use — the honest answer,
        not the ambitious one. You can change it whenever you like and nothing you have entered
        is lost.
      </SectionHead>

      <div className="path-grid">
        {PATHS.map((p) => (
          <button
            key={p.v}
            type="button"
            className="path-card"
            aria-pressed={value === p.v}
            onClick={() => onChoose(p.v)}
          >
            <span className="pc-head">
              <span className="pc-label">{p.label}</span>
              {value === p.v && <span className="pc-chosen">Chosen</span>}
            </span>
            <span className="pc-sub">{p.sub}</span>
            <span className="pc-blurb">{p.blurb}</span>
            <span className="pc-gives">
              {p.gives.map((g) => (
                <span key={g} className="pc-give"><Tick />{g}</span>
              ))}
            </span>
          </button>
        ))}
      </div>

      <p className="tile-n" style={{ marginTop: 16, maxWidth: "62ch" }}>
        The difference that matters most: the <b>Fitness</b> path asks you to log what you eat
        every day, and the <b>Lifestyle</b> path never does. A food diary is the single most
        effective habit in the weight-loss literature and also the one most people abandon inside
        a fortnight, so it is offered rather than imposed.
      </p>
    </section>
  );
}
