// pages/social/ProjectsDialog.jsx – create and edit social projects (supervisors).
import { useState } from "react";
import { socialApi } from "./socialApi";
import { PLATFORM, PLATFORMS, idOf } from "./constants";
import { Avatar, Dialog } from "./ui";

const blank = () => ({ name: "", description: "", assignedPersons: [], requireApproval: true, platformUrls: PLATFORMS.map(p => ({ platform: p, url: "" })) });

export default function ProjectsDialog({ projects, members, onClose, onChanged, toast }) {
  const [editing, setEditing] = useState(null);   // null = list, "new" or project id
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const open = (p) => {
    if (!p) { setForm(blank()); setEditing("new"); return; }
    setForm({
      name: p.name, description: p.description || "", requireApproval: p.requireApproval !== false,
      assignedPersons: (p.assignedPersons || []).map(idOf),
      platformUrls: PLATFORMS.map(pl => ({ platform: pl, url: p.platformUrls?.find(x => x.platform === pl)?.url || "" })),
    });
    setEditing(p._id);
  };

  const save = async () => {
    if (!form.name.trim()) return toast("Give the project a name.", "error");
    if (!form.assignedPersons.length) return toast("Add at least one person.", "error");
    setSaving(true);
    try {
      await socialApi.saveProject(editing === "new" ? null : editing, { ...form, platformUrls: form.platformUrls.filter(x => x.url.trim()) });
      toast(editing === "new" ? "Project created" : "Project saved");
      onChanged(); setEditing(null);
    } catch (e) { toast(e.message, "error"); }
    setSaving(false);
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? Its routines will be paused.`)) return;
    try { await socialApi.deleteProject(p._id); toast("Project deleted"); onChanged(); }
    catch (e) { toast(e.message, "error"); }
  };

  if (editing) {
    return (
      <Dialog title={editing === "new" ? "New project" : "Edit project"} onClose={() => setEditing(null)}
        footer={<>
          <button className="sm-btn sm-btn--ghost" onClick={() => setEditing(null)}>Back</button>
          <button className="sm-btn sm-btn--primary" onClick={save} disabled={saving}>{saving ? "Saving…" : editing === "new" ? "Create project" : "Save project"}</button>
        </>}>
        <div className="sm-field">
          <label htmlFor="pj-name">Name</label>
          <input id="pj-name" className="sm-input" value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Eco Green main page" />
        </div>
        <div className="sm-field">
          <label htmlFor="pj-desc">Description</label>
          <textarea id="pj-desc" className="sm-textarea" rows={2} value={form.description} onChange={e => set("description", e.target.value)} />
        </div>
        <div className="sm-field">
          <span className="sm-label">People</span>
          <div className="sm-people">
            {members.map(m => {
              const on = form.assignedPersons.includes(idOf(m));
              return (
                <button key={idOf(m)} type="button" className="sm-person" aria-pressed={on}
                  onClick={() => set("assignedPersons", on ? form.assignedPersons.filter(x => x !== idOf(m)) : [...form.assignedPersons, idOf(m)])}>
                  <Avatar person={m} />{m.name}
                </button>
              );
            })}
          </div>
        </div>
        <label className="sm-check">
          <input type="checkbox" checked={form.requireApproval} onChange={e => set("requireApproval", e.target.checked)} />
          <span><strong>Posts need approval.</strong> A supervisor approves each post before it goes up.</span>
        </label>
        <div className="sm-field">
          <span className="sm-label">Page links</span>
          <div className="sm-grid-2">
            {form.platformUrls.map(({ platform, url }) => (
              <label key={platform} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="sm-plat" style={{ minWidth: 100 }}><span className="sm-dot" style={{ background: PLATFORM[platform].color }} />{PLATFORM[platform].label}</span>
                <input className="sm-input" value={url} placeholder="https://…"
                  onChange={e => set("platformUrls", form.platformUrls.map(x => x.platform === platform ? { ...x, url: e.target.value } : x))} />
              </label>
            ))}
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog title="Social projects" onClose={onClose}
      footer={<><button className="sm-btn sm-btn--ghost" onClick={onClose}>Close</button><button className="sm-btn sm-btn--primary" onClick={() => open(null)}>New project</button></>}>
      {projects.length === 0 ? (
        <div className="sm-empty"><h3>No projects yet</h3><p>A project is a brand or page you post for, like the main Eco Green page.</p></div>
      ) : projects.map(p => (
        <div key={p._id} className="sm-proj">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sm-proj-name">{p.name}</div>
            {p.description && <div className="sm-quiet">{p.description}</div>}
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
              {(p.assignedPersons || []).map(u => <Avatar key={idOf(u)} person={members.find(m => idOf(m) === idOf(u)) || u} />)}
              <span className="sm-quiet" style={{ marginLeft: 6 }}>{p.requireApproval === false ? "No approval needed" : "Posts need approval"}</span>
            </div>
          </div>
          <button className="sm-btn sm-btn--sm" onClick={() => open(p)}>Edit</button>
          <button className="sm-btn sm-btn--sm sm-btn--ghost sm-btn--danger" onClick={() => remove(p)}>Delete</button>
        </div>
      ))}
    </Dialog>
  );
}
