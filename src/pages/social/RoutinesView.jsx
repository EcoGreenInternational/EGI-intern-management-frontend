// pages/social/RoutinesView.jsx – repeating posts that are created automatically.
import { useState } from "react";
import { socialApi } from "./socialApi";
import { PLATFORM, PLATFORMS, WEEKDAY_LETTERS, fmtDay, fmtTime, idOf, localISO } from "./constants";
import { Avatar, DaysMini, Dialog } from "./ui";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const describeDays = (days = []) => {
  const s = [...days].sort().join("");
  if (s === "0123456") return "Every day";
  if (s === "12345") return "Weekdays";
  if (s === "06") return "Weekends";
  return days.map(d => DAY_NAMES[d].slice(0, 3)).join(", ");
};

function RoutineDialog({ routine, projects, members, onClose, onSaved, toast }) {
  const [form, setForm] = useState(() => routine ? {
    name: routine.name, socialProject: idOf(routine.socialProject), platform: routine.platform, assignedTo: idOf(routine.assignedTo),
    time: routine.time || "", daysOfWeek: routine.daysOfWeek || [], startDate: routine.startDate, endDate: routine.endDate || "",
    contentDescription: routine.contentDescription || "", caption: routine.caption || "", hashtags: (routine.hashtags || []).join(" "),
    firstComment: routine.firstComment || "", autoApproved: routine.autoApproved !== false,
  } : {
    name: "", socialProject: "", platform: "Instagram", assignedTo: "", time: "08:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    startDate: localISO(), endDate: "", contentDescription: "", caption: "", hashtags: "", firstComment: "", autoApproved: true,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const project = projects.find(p => p._id === form.socialProject);
  const ids = (project?.assignedPersons || []).map(idOf);
  const people = ids.length ? members.filter(m => ids.includes(idOf(m))) : members;
  const toggleDay = (d) => set("daysOfWeek", form.daysOfWeek.includes(d) ? form.daysOfWeek.filter(x => x !== d) : [...form.daysOfWeek, d]);

  const save = async () => {
    if (!form.name.trim()) return toast("Give the routine a name.", "error");
    if (!form.socialProject) return toast("Choose a project.", "error");
    if (!form.assignedTo) return toast("Choose who will post it.", "error");
    if (!form.daysOfWeek.length) return toast("Pick at least one day.", "error");
    setSaving(true);
    try {
      const res = await socialApi.saveRoutine(routine?._id, form);
      toast(routine ? "Routine updated" : res.generated ? `Routine created. ${res.generated} post${res.generated > 1 ? "s" : ""} added to the calendar.` : "Routine created");
      onSaved(); onClose();
    } catch (e) { toast(e.message, "error"); }
    setSaving(false);
  };

  return (
    <Dialog title={routine ? "Edit routine" : "New routine"} onClose={onClose} width={720}
      footer={<>
        <button className="sm-btn sm-btn--ghost" onClick={onClose}>Cancel</button>
        <button className="sm-btn sm-btn--primary" onClick={save} disabled={saving}>{saving ? "Saving…" : routine ? "Save routine" : "Create routine"}</button>
      </>}>
      <p className="sm-help" style={{ marginTop: -6 }}>A post is created automatically on each chosen day, so nobody has to add it by hand. The person can still edit each day's caption.</p>
      <div className="sm-field">
        <label htmlFor="rt-name">Name</label>
        <input id="rt-name" className="sm-input" value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Good morning post" />
      </div>
      <div className="sm-grid-3">
        <div className="sm-field">
          <label htmlFor="rt-project">Project</label>
          <select id="rt-project" className="sm-select" value={form.socialProject} onChange={e => set("socialProject", e.target.value)}>
            <option value="">Choose a project</option>
            {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </div>
        <div className="sm-field">
          <label htmlFor="rt-platform">Platform</label>
          <select id="rt-platform" className="sm-select" value={form.platform} onChange={e => set("platform", e.target.value)}>
            {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM[p].label}</option>)}
          </select>
        </div>
        <div className="sm-field">
          <label htmlFor="rt-person">Who posts it</label>
          <select id="rt-person" className="sm-select" value={form.assignedTo} onChange={e => set("assignedTo", e.target.value)}>
            <option value="">Choose a person</option>
            {people.map(m => <option key={idOf(m)} value={idOf(m)}>{m.name}</option>)}
          </select>
        </div>
      </div>
      <div className="sm-field">
        <span className="sm-label">Days</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div className="sm-days" role="group" aria-label="Days of the week">
            {WEEKDAY_LETTERS.map((l, i) => (
              <button key={i} type="button" className="sm-day" aria-pressed={form.daysOfWeek.includes(i)} aria-label={DAY_NAMES[i]} onClick={() => toggleDay(i)}>{l}</button>
            ))}
          </div>
          <div className="sm-seg" role="group" aria-label="Quick choices">
            <button type="button" aria-pressed={describeDays(form.daysOfWeek) === "Every day"} onClick={() => set("daysOfWeek", [0, 1, 2, 3, 4, 5, 6])}>Every day</button>
            <button type="button" aria-pressed={describeDays(form.daysOfWeek) === "Weekdays"} onClick={() => set("daysOfWeek", [1, 2, 3, 4, 5])}>Weekdays</button>
          </div>
        </div>
      </div>
      <div className="sm-grid-3">
        <div className="sm-field">
          <label htmlFor="rt-time">Time</label>
          <input id="rt-time" type="time" className="sm-select" value={form.time} onChange={e => set("time", e.target.value)} />
        </div>
        <div className="sm-field">
          <label htmlFor="rt-start">Starts</label>
          <input id="rt-start" type="date" className="sm-select" value={form.startDate} onChange={e => set("startDate", e.target.value)} />
        </div>
        <div className="sm-field">
          <label htmlFor="rt-end">Ends <span className="sm-help">(optional)</span></label>
          <input id="rt-end" type="date" className="sm-select" value={form.endDate} min={form.startDate} onChange={e => set("endDate", e.target.value)} />
        </div>
      </div>
      <div className="sm-field">
        <label htmlFor="rt-brief">Brief</label>
        <input id="rt-brief" className="sm-input" value={form.contentDescription} onChange={e => set("contentDescription", e.target.value)} placeholder="What the daily post is about" />
      </div>
      <div className="sm-field">
        <label htmlFor="rt-caption">Starting caption</label>
        <textarea id="rt-caption" className="sm-textarea" rows={3} value={form.caption} onChange={e => set("caption", e.target.value)} placeholder="Copied into each day's post" />
      </div>
      <div className="sm-grid-2">
        <div className="sm-field">
          <label htmlFor="rt-tags">Hashtags</label>
          <input id="rt-tags" className="sm-input" value={form.hashtags} onChange={e => set("hashtags", e.target.value)} placeholder="#goodmorning #ecogreen" />
        </div>
        <div className="sm-field">
          <label htmlFor="rt-first">First comment</label>
          <input id="rt-first" className="sm-input" value={form.firstComment} onChange={e => set("firstComment", e.target.value)} placeholder="Optional" />
        </div>
      </div>
      <label className="sm-check">
        <input type="checkbox" checked={form.autoApproved} onChange={e => set("autoApproved", e.target.checked)} />
        <span><strong>Skip approval for these posts.</strong> Each day's post starts as "Ready to post". Untick to have each one approved first.</span>
      </label>
    </Dialog>
  );
}

export default function RoutinesView({ routines, projects, members, isSup, onChanged, toast, loading }) {
  const [editing, setEditing] = useState(null);   // routine | "new" | null

  const toggle = async (r) => {
    try {
      await socialApi.saveRoutine(r._id, { active: !r.active });
      toast(r.active ? "Routine paused. Upcoming posts from it were removed." : "Routine turned on");
      onChanged();
    } catch (e) { toast(e.message, "error"); }
  };
  const remove = async (r) => {
    if (!window.confirm(`Delete the routine "${r.name}"? Past posts stay; upcoming ones nobody has started are removed.`)) return;
    try { await socialApi.deleteRoutine(r._id); toast("Routine deleted"); onChanged(); }
    catch (e) { toast(e.message, "error"); }
  };

  return (
    <div>
      <div className="sm-filters">
        <span className="sm-quiet" style={{ maxWidth: "70ch" }}>
          {isSup ? "Routines create the same kind of post on chosen days, like a daily good-morning post. Today's and tomorrow's posts are added automatically." : "These repeating posts are assigned to you. They appear on your board each day automatically."}
        </span>
        <span className="sm-spacer" />
        {isSup && <button className="sm-btn sm-btn--primary" onClick={() => setEditing("new")}>New routine</button>}
      </div>

      {loading ? <div className="sm-loading">Loading routines…</div> : routines.length === 0 ? (
        <div className="sm-empty">
          <h3>No routines yet</h3>
          <p>{isSup ? "Add one for posts that repeat, like a daily good-morning post, so nobody has to plan them by hand." : "None of your posts repeat yet."}</p>
          {isSup && <button className="sm-btn sm-btn--primary" onClick={() => setEditing("new")}>New routine</button>}
        </div>
      ) : (
        <div className="sm-routines">
          {routines.map(r => {
            const plat = PLATFORM[r.platform] || PLATFORM.Other;
            return (
              <article key={r._id} className={`sm-routine${r.active ? "" : " sm-paused"}`} style={{ "--plat": plat.color }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div className="sm-routine-name">{r.name}</div>
                    <div className="sm-quiet">{r.socialProject?.name || "Deleted project"}, {plat.label}</div>
                  </div>
                  <Avatar person={r.assignedTo} size="lg" />
                </div>
                <div className="sm-routine-when">
                  <DaysMini days={r.daysOfWeek} />
                  <span>{describeDays(r.daysOfWeek)}{r.time ? ` at ${fmtTime(r.time)}` : ""}</span>
                </div>
                <div className="sm-quiet">
                  From {fmtDay(r.startDate, { day: "numeric", month: "short", year: "numeric" })}{r.endDate ? ` to ${fmtDay(r.endDate, { day: "numeric", month: "short", year: "numeric" })}` : ""}.
                  {" "}{r.autoApproved ? "No approval needed." : "Each post needs approval."}
                </div>
                {isSup && (
                  <div className="sm-routine-foot">
                    <button className="sm-switch" role="switch" aria-checked={r.active} onClick={() => toggle(r)}>
                      <i aria-hidden="true" />{r.active ? "On" : "Paused"}
                    </button>
                    <span style={{ display: "flex", gap: 6 }}>
                      <button className="sm-btn sm-btn--sm" onClick={() => setEditing(r)}>Edit</button>
                      <button className="sm-btn sm-btn--sm sm-btn--ghost sm-btn--danger" onClick={() => remove(r)}>Delete</button>
                    </span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {editing && (
        <RoutineDialog routine={editing === "new" ? null : editing} projects={projects} members={members}
          onClose={() => setEditing(null)} onSaved={onChanged} toast={toast} />
      )}
    </div>
  );
}
