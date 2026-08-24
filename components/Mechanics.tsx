"use client";

import { MECH } from "@/lib/nutrition";
import { SectionHead } from "./ui";

export default function Mechanics() {
  return (
    <section>
      <SectionHead eyebrow="The physiology" title="How the body actually works">
        Nine mechanisms that decide whether the food you eat becomes muscle, fat, or heat.
        Read this once — it explains every number the app gives you.
      </SectionHead>

      <div className="mech">
        {MECH.map((m, i) => (
          <article className="mech-item" key={m.t}>
            <span className="mech-n">{String(i + 1).padStart(2, "0")}</span>
            <div className="mech-b">
              <h3>{m.t}</h3>
              <div className="prose" dangerouslySetInnerHTML={{ __html: m.b }} />
              {m.eqn && <div className="eqn" style={{ marginTop: 13 }}>{m.eqn}</div>}
              {m.split && (
                <div className="split" style={{ marginTop: 14 }}>
                  {m.split.map((s) => (
                    <div className="split-c" key={s[1]}>
                      <b>{s[0]}</b>
                      <span>{s[1]}</span>
                      <small>{s[2]}</small>
                      <small style={{ marginTop: 4 }}>{s[3]}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
