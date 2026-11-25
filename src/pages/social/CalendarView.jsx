// pages/social/CalendarView.jsx – month / week calendar. Posts you're allowed to
// reschedule can be dragged to another day.
import { useState } from "react";
import { PLATFORM, WEEKDAYS_SHORT, addDays, dayOf, fmtTime, localISO, projectName, startOfWeek } from "./constants";

export function calendarRange(mode, anchor) {
  if (mode === "week") { const s = startOfWeek(anchor); return { from: s, to: addDays(s, 6) }; }
  const first = `${anchor.slice(0, 7)}-01`;
  const from = startOfWeek(first);
  const d = new Date(`${first}T12:00:00`); d.setMonth(d.getMonth() + 1); d.setDate(0);
  const last = localISO(d);
  const to = addDays(startOfWeek(last), 6);
  return { from, to };
}

export default function CalendarView({ posts, mode, setMode, anchor, setAnchor, onOpen, onMove }) {
  const [dropDay, setDropDay] = useState(null);
  const today = localISO();
  const { from, to } = calendarRange(mode, anchor);
  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  const month = anchor.slice(0, 7);
  const byDay = posts.reduce((acc, p) => { (acc[dayOf(p)] = acc[dayOf(p)] || []).push(p); return acc; }, {});
  Object.values(byDay).forEach(list => list.sort((a, b) => (a.plannedTime || "99").localeCompare(b.plannedTime || "99")));

  const label = mode === "week"
    ? `${new Date(`${from}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${new Date(`${to}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
    : new Date(`${anchor}T12:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const shift = (dir) => {
    if (mode === "week") return setAnchor(addDays(anchor, 7 * dir));
    const d = new Date(`${month}-01T12:00:00`); d.setMonth(d.getMonth() + dir); setAnchor(localISO(d));
  };

  const limit = mode === "week" ? 50 : 3;

  return (
    <div>
      <div className="sm-cal-bar">
        <button className="sm-btn sm-icon-btn" onClick={() => shift(-1)} aria-label={`Previous ${mode}`}>‹</button>
        <button className="sm-btn sm-icon-btn" onClick={() => shift(1)} aria-label={`Next ${mode}`}>›</button>
        <button className="sm-btn sm-btn--sm" onClick={() => setAnchor(today)}>Today</button>
        <div className="sm-cal-label" aria-live="polite">{label}</div>
        <span className="sm-spacer" />
        <div className="sm-seg" role="group" aria-label="Calendar view">
          <button aria-pressed={mode === "month"} onClick={() => setMode("month")}>Month</button>
          <button aria-pressed={mode === "week"} onClick={() => setMode("week")}>Week</button>
        </div>
      </div>

      <div className={`sm-cal${mode === "week" ? " sm-cal-week" : ""}`}>
        <div className="sm-cal-dow">{WEEKDAYS_SHORT.map(d => <div key={d}>{d}</div>)}</div>
        <div className="sm-cal-grid">
          {days.map(day => {
            const items = byDay[day] || [];
            const cls = ["sm-cal-day", mode === "month" && day.slice(0, 7) !== month ? "sm-out" : "", day === today ? "sm-today-cell" : "", dropDay === day ? "sm-drop" : ""].join(" ");
            return (
              <div key={day} className={cls}
                onDragOver={e => { if (e.dataTransfer.types.includes("text/egi-post")) { e.preventDefault(); setDropDay(day); } }}
                onDragLeave={() => setDropDay(d => (d === day ? null : d))}
                onDrop={e => { e.preventDefault(); setDropDay(null); const id = e.dataTransfer.getData("text/egi-post"); if (id) onMove(id, day); }}>
                <span className="sm-cal-num" aria-label={new Date(`${day}T12:00:00`).toDateString()}>{Number(day.slice(8))}</span>
                {items.slice(0, limit).map(p => {
                  const plat = PLATFORM[p.platform] || PLATFORM.Other;
                  const tone = p.status === "Missed" ? " sm-ev--missed" : p.status === "Pending Approval" ? " sm-ev--waiting" : "";
                  const canMove = !!p.allowed?.editPlanning && !["Posted", "Reviewed"].includes(p.status);
                  return (
                    <button key={p._id} className={`sm-ev${tone}`} style={{ "--plat": plat.color }} draggable={canMove}
                      onDragStart={e => { e.dataTransfer.setData("text/egi-post", p._id); e.dataTransfer.effectAllowed = "move"; }}
                      onClick={() => onOpen(p)} title={`${projectName(p)} on ${plat.label}${p.plannedTime ? ` at ${fmtTime(p.plannedTime)}` : ""}`}>
                      {p.plannedTime && <span className="sm-ev-time">{fmtTime(p.plannedTime).replace(":00", "").replace(" ", "")}</span>}
                      <span className="sm-ev-name">{projectName(p)}</span>
                      <span className="sm-dot" style={{ background: plat.color }} aria-hidden="true" />
                    </button>
                  );
                })}
                {items.length > limit && (
                  <button className="sm-more" onClick={() => { setAnchor(day); setMode("week"); }}>
                    {items.length - limit} more
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p className="sm-cal-hint">Drag a post to another day to reschedule it. Posts that are already posted stay where they are.</p>
    </div>
  );
}
