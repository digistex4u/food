"use client";

import { useMemo, useState } from "react";
import type { AppProfile } from "@/lib/client";
import {
  MONTH_DAYS, RECIPES, WEEKDAYS, WEEKDAYS_HI, buildPlan, calc, dayConfig, r0,
  recipesForDay, youtubeSearchUrl,
} from "@/lib/nutrition";
import {
  SLOTS, WEEK_COUNT, addLabel, addLabelHi, dayMenu, dishVideo, fitToPerson, proteinFloor,
  weekLabel, type DayMenu, type Fit, type MenuConfig,
} from "@/lib/lifestyle";
import { Note, SectionHead, Tile } from "./ui";

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
);

/** A YouTube search for one dish. Never a hardcoded video id — see the note in
 *  nutrition.ts. Small enough to sit against every suggestion without shouting. */
function VideoChip({ href, label }: { href: string; label: string }) {
  return (
    <a className="ytc" href={href} target="_blank" rel="noopener noreferrer"
       title={`Find a recipe video for ${label}`}>
      <PlayIcon />
      Recipe video
    </a>
  );
}

/* ------------------------------------------------------------------- week rail */

function WeekRail({ week, onWeek }: { week: number; onWeek: (w: number) => void }) {
  return (
    <div className="week-rail no-print">
      {Array.from({ length: WEEK_COUNT }, (_, w) => (
        <button key={w} type="button" aria-pressed={w === week} onClick={() => onWeek(w)}>
          {weekLabel(w)}
        </button>
      ))}
    </div>
  );
}

const dayHead = (d: Date, n: number) => ({
  n: n + 1,
  wd: WEEKDAYS[d.getDay()],
  wdHi: WEEKDAYS_HI[d.getDay()],
  date: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
});

/* ============================================================ the month, shared */

export default function Month({
  me, onPatch,
}: {
  me: AppProfile;
  onPatch: (p: Partial<AppProfile>) => void | Promise<void>;
}) {
  const [week, setWeek] = useState(0);
  const lifestyle = me.path === "lifestyle";

  const cfg: MenuConfig = useMemo(
    () => ({ picks: me.menuConfig?.picks ?? {}, start: me.menuConfig?.start ?? "" }),
    [me.menuConfig]
  );

  // The month has to start somewhere. Until someone presses "Start today" it
  // starts today, computed rather than stored, so an app opened for the first
  // time in March does not show a calendar that began in January.
  const start = useMemo(() => {
    if (cfg.start) {
      const [y, m, d] = cfg.start.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }, [cfg.start]);

  const days = useMemo(() => {
    const first = week * 7;
    const count = Math.min(7, MONTH_DAYS - first);
    return Array.from({ length: count }, (_, i) => first + i);
  }, [week]);

  const restart = () => {
    const t = new Date();
    const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    void onPatch({ menuConfig: { picks: cfg.picks, start: key } });
    setWeek(0);
  };

  return (
    <section className="month-step">
      <SectionHead
        eyebrow={lifestyle ? "Step four" : "Step six"}
        title="Your 30 days"
      >
        {lifestyle ? (
          <>
            Four weeks and two days of vegetarian Indian eating, decided in advance. Every meal
            offers three options — tap the one you want and it is saved for that day. Every
            suggestion has a recipe video against it.
          </>
        ) : (
          <>
            Thirty days, each one portioned to the same calorie and protein target but built from
            a different set of your meal options — so the numbers hold steady while the food does
            not repeat. Anything you pinned on the plan screen stays put every day.
          </>
        )}
      </SectionHead>

      {lifestyle && (
        <div className="card card-pad no-print" style={{ marginBottom: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>What a month of this looks like</div>
          <MonthSummary me={me} />
        </div>
      )}

      <div className="track-head no-print" style={{ marginBottom: 14 }}>
        <span className="tile-n">
          Day 1 is <b>{start.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</b>
        </span>
        <button className="btn btn-sm btn-ghost" onClick={restart} style={{ marginLeft: "auto" }}>
          Start the month from today
        </button>
        {lifestyle && (
          <button className="btn btn-sm" onClick={() => window.print()}>
            Print this week for the kitchen
          </button>
        )}
      </div>

      <WeekRail week={week} onWeek={setWeek} />

      {lifestyle && <WeekPrint me={me} week={week} />}

      <div className="stack">
        {days.map((d) =>
          lifestyle ? (
            <LifestyleDay key={d} d={d} start={start} cfg={cfg} me={me} onPatch={onPatch} />
          ) : (
            <FitnessDay key={d} d={d} start={start} me={me} />
          )
        )}
      </div>

      <p className="tile-n" style={{ marginTop: 18, maxWidth: "62ch" }}>
        {lifestyle ? (
          <>
            Nothing here needs logging. Print the week, hand it to whoever cooks, and the only
            decision left each day is which of three dishes to make.
          </>
        ) : (
          <>
            Quantities for any single day are on the plan screen, where you can also swap
            individual items. This view is the shape of the month; that one is the shape of a day.
          </>
        )}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------- a lifestyle day */

function LifestyleDay({
  d, start, cfg, me, onPatch,
}: {
  d: number; start: Date; cfg: MenuConfig; me: AppProfile;
  onPatch: (p: Partial<AppProfile>) => void | Promise<void>;
}) {
  const menu: DayMenu = useMemo(() => dayMenu(d, start, cfg.picks), [d, start, cfg.picks]);
  const h = dayHead(menu.date, d);
  const c = useMemo(() => calc(me), [me]);
  const fit = useMemo(() => fitToPerson(menu.k, menu.p, c.tdee, me.wt, d), [menu.k, menu.p, c.tdee, me.wt, d]);

  const pick = (slot: string, index: number) => {
    void onPatch({ menuConfig: { ...cfg, picks: { ...cfg.picks, [`${d}:${slot}`]: index } } });
  };

  return (
    <div className="card day-card">
      <div className="day-head">
        <span className="dh-n">Day {h.n}</span>
        <span className="dh-d">{h.wd} · {h.date}</span>
        <span className="dh-hi hi">{h.wdHi}</span>
        <span className="dh-k mono">{menu.k} kcal · {menu.p} g protein</span>
      </div>

      {menu.slots.map(({ slot, options, chosen, index }) => (
        <div className="slot-row" key={slot.k}>
          <div className="sr-when">
            {slot.n}
            <small>{slot.t}</small>
            <small className="hi">{slot.hi}</small>
          </div>

          <div className="sr-body">
            <div className="opt-chips no-print">
              {options.map((o, i) => (
                <button key={o.id} type="button" aria-pressed={i === index}
                        onClick={() => pick(slot.k, i)}>
                  {o.en}
                  <span className="chip-k">{o.k}</span>
                </button>
              ))}
            </div>

            <div className="sr-chosen">
              <div className="sc-name">
                {chosen.en}
                <span className="hi sc-hi">{chosen.hi}</span>
                <span className="sc-k mono">{chosen.k} kcal · {chosen.p} g P</span>
              </div>
              <div className="sc-serve">
                {chosen.serve} <span className="hi">· {chosen.serveHi}</span>
              </div>
              <div className="sc-why">{chosen.why}</div>
              <VideoChip href={dishVideo(chosen)} label={chosen.en} />
            </div>
          </div>
        </div>
      ))}

      <AddOnRow fit={fit} />
    </div>
  );
}

/* ------------------------------------------------- what the plate still needs */

/**
 * The menu is a base, not a prescription. Someone who burns 2,200 kcal cannot
 * live on four light plates, and the app knows what they burn, so it says what
 * else goes on the plate rather than leaving them to work it out or, worse,
 * leaving them hungry and calling it a lifestyle.
 */
function AddOnRow({ fit }: { fit: Fit }) {
  if (fit.verdict === "right") {
    return (
      <div className="addon-row">
        <span className="ar-label">Fits you</span>
        <span className="ar-note">{fit.note}</span>
      </div>
    );
  }
  return (
    <div className={`addon-row${fit.verdict === "over" ? " ar-over" : ""}`}>
      <span className="ar-label">{fit.verdict === "over" ? "Ease off" : "Add to the plate"}</span>
      <span className="ar-note">{fit.note}</span>
      {fit.adds.length > 0 && (
        <span className="ar-adds">
          {fit.adds.map(({ addon, n }) => (
            <span className="ar-add" key={addon.one}>
              {addLabel(addon, n)}
              <span className="hi"> · {addLabelHi(addon, n)}</span>
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- a fitness day */

/**
 * Solved days, kept between renders.
 *
 * buildPlan runs a search, and thirty of them costs the better part of a second
 * on a laptop — several on a phone. Nothing about a day changes unless the
 * target or the pinned choices change, so the result is cached on exactly those
 * inputs and the cache is dropped whole when any of them move. Without this,
 * paging between weeks re-solves days that were already solved a moment ago.
 */
const dayCache = new Map<string, ReturnType<typeof buildPlan>>();

function solveDay(
  d: number, target: number, protein: number, fatG: number, carbG: number,
  cfg: AppProfile["planConfig"]
) {
  const key = `${target}|${protein}|${fatG}|${carbG}|${JSON.stringify(cfg ?? {})}`;
  const hit = dayCache.get(`${key}|${d}`);
  if (hit) return hit;
  // A changed target invalidates every day, so the whole cache goes rather than
  // growing a stale entry per profile edit.
  const first = dayCache.keys().next().value;
  if (first && !first.startsWith(key)) dayCache.clear();
  const built = buildPlan(target, protein, fatG, carbG, dayConfig(d, cfg));
  dayCache.set(`${key}|${d}`, built);
  return built;
}

function FitnessDay({ d, start, me }: { d: number; start: Date; me: AppProfile }) {
  const c = useMemo(() => calc(me), [me]);
  const date = useMemo(
    () => new Date(start.getFullYear(), start.getMonth(), start.getDate() + d),
    [start, d]
  );
  const built = useMemo(
    () => solveDay(d, c.target, c.protein, c.fatG, c.carbG, me.planConfig),
    [c.target, c.protein, c.fatG, c.carbG, d, me.planConfig]
  );
  const cards = useMemo(
    () => recipesForDay(d).map((id) => RECIPES.find((r) => r.id === id)).filter(Boolean),
    [d]
  );
  const h = dayHead(date, d);

  return (
    <div className="card day-card">
      <div className="day-head">
        <span className="dh-n">Day {h.n}</span>
        <span className="dh-d">{h.wd} · {h.date}</span>
        <span className="dh-hi hi">{h.wdHi}</span>
        <span className="dh-k mono">
          {r0(built.tot.k)} kcal · {r0(built.tot.p)} g protein
        </span>
      </div>

      <div className="fd-meals">
        {built.meals.map((m) => (
          <div className="fd-meal" key={m.tag}>
            <span className="fdm-t mono">{m.time}</span>
            <span className="fdm-n">{m.name}</span>
            <span className="fdm-k mono">{r0(m.tot.k)}</span>
          </div>
        ))}
      </div>

      <div className="fd-cook">
        <span className="fdc-label">Cook today</span>
        {cards.map((r) => r && (
          <span className="fdc-item" key={r.id}>
            <span className="fdc-n">{r.en}<span className="hi"> · {r.hi}</span></span>
            <VideoChip href={youtubeSearchUrl(r.en, r.hi)} label={r.en} />
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------- the printable week menu */

/** What the person cooking actually needs: names, servings, nothing else. */
export function WeekPrint({ me, week }: { me: AppProfile; week: number }) {
  const cfg = me.menuConfig ?? { picks: {}, start: "" };
  const start = useMemo(() => {
    if (cfg.start) {
      const [y, m, d] = cfg.start.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }, [cfg.start]);

  const first = week * 7;
  const days = Array.from({ length: Math.min(7, MONTH_DAYS - first) }, (_, i) =>
    dayMenu(first + i, start, cfg.picks)
  );

  const c = calc(me);
  return (
    <div className="week-print">
      <h3>{weekLabel(week)} — {me.name}</h3>
      <p className="wp-note">
        Serve the dish named, then add what is listed in the last column. Quantities are for one
        person. / नीचे लिखा खाना बनाएँ, और आख़िरी कॉलम में लिखी चीज़ें साथ में दें।
      </p>
      <table>
        <thead>
          <tr>
            <th>Day</th>
            {SLOTS.map((s) => <th key={s.k}>{s.n}<span className="hi"> / {s.hi}</span></th>)}
            <th>Also serve<span className="hi"> / साथ में</span></th>
          </tr>
        </thead>
        <tbody>
          {days.map((dm) => (
            <tr key={dm.day}>
              <th scope="row">
                {WEEKDAYS[dm.date.getDay()]}
                <small>{dm.date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}</small>
              </th>
              {dm.slots.map(({ slot, chosen }) => (
                <td key={slot.k}>
                  <b>{chosen.en}</b>
                  <span className="hi">{chosen.hi}</span>
                  <small>{chosen.serve}</small>
                </td>
              ))}
              <td>
                {/* One line, not one row per item: a week has to fit on a page
                    or nobody sticks it to the fridge. */}
                <b style={{ fontWeight: 500 }}>
                  {fitToPerson(dm.k, dm.p, c.tdee, me.wt, dm.day).adds
                    .map(({ addon, n }) => addLabel(addon, n)).join(", ") || "nothing extra"}
                </b>
                <span className="hi">
                  {fitToPerson(dm.k, dm.p, c.tdee, me.wt, dm.day).adds
                    .map(({ addon, n }) => addLabelHi(addon, n)).join(", ")}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The month's calorie read, shown to lifestyle users instead of a target. */
export function MonthSummary({ me }: { me: AppProfile }) {
  const c = calc(me);
  const cfg = me.menuConfig ?? { picks: {}, start: "" };
  const totals = useMemo(() => {
    const t = new Date();
    const start = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    const all = Array.from({ length: MONTH_DAYS }, (_, d) => dayMenu(d, start, cfg.picks));
    return {
      k: Math.round(all.reduce((s, x) => s + x.k, 0) / all.length),
      p: Math.round(all.reduce((s, x) => s + x.p, 0) / all.length),
    };
  }, [cfg.picks]);

  const floorP = proteinFloor(me.wt);
  const fit = fitToPerson(totals.k, totals.p, c.tdee, me.wt);

  return (
    <>
      <div className="grid-4">
        <Tile flat k="The menu alone" v={totals.k} unit="kcal" note="average across the month" />
        <Tile flat k="Its protein" v={totals.p} unit="g" color="var(--protein)"
              note={`your floor is ${floorP} g`} />
        <Tile flat k="What you burn" v={c.tdee} unit="kcal" note="maintenance, estimated" />
        <Tile flat k="Still to add" v={Math.max(0, fit.gapK)} unit="kcal"
              color={fit.verdict === "right" ? "var(--good)" : "var(--warn)"}
              note={fit.verdict === "right" ? "nothing — it fits you" : "roti, dal, curd, milk"} />
      </div>

      {/* The menu is deliberately light. Presenting a 900 kcal shortfall as a
          result rather than a gap would be prescribing a crash diet to somebody
          who asked for dinner. */}
      <Note warn={fit.verdict !== "right"} style={{ marginTop: 14 }}>
        {fit.verdict === "short" ? (
          <>
            These dishes are portioned light on purpose, so the same calendar works for a 50 kg
            person and a 90 kg one. On its own the menu runs about <b>{fit.gapK} kcal</b> below
            what you burn, which is too big a gap to sit in every day — each day below says what
            to put alongside it to close that. Eat to appetite; the additions are a floor, not a
            ceiling.
          </>
        ) : fit.verdict === "over" ? (
          <>
            The menu comes to more than you burn. Take the lighter of the three options where you
            can, and go easy on the ghee.
          </>
        ) : (
          <>The menu lands close to what you burn, and carries enough protein with it.</>
        )}
      </Note>
    </>
  );
}
