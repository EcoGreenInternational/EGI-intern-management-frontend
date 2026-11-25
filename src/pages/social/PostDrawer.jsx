// pages/social/PostDrawer.jsx – create, edit, review and track one post.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { socialApi } from "./socialApi";
import { PLATFORM, PLATFORMS, STATUS, dayOf, fmtDay, fmtStamp, fmtTime, idOf, localISO } from "./constants";
import { Avatar, StatusPill, useEscape } from "./ui";

const MAX_MEDIA_MB = 50;
const HISTORY_LABEL = {
  created: "Created", submitted: "Sent for approval", approved: "Approved", rejected: "Sent back",
  posted: "Marked as posted", missed: "Missed", metrics: "Results added", rescheduled: "Rescheduled", edited: "Edited",
};

const emptyForm = (defaults = {}) => ({
  socialProject: defaults.socialProject || "", platform: "Instagram", plannedPostDate: defaults.date || localISO(), plannedTime: "",
  assignedTo: "", contentDescription: "", caption: "", hashtags: [], firstComment: "", media: [], postUrl: "",
});
const formFrom = (p) => ({
  socialProject: idOf(p.socialProject), platform: p.platform, plannedPostDate: dayOf(p), plannedTime: p.plannedTime || "",
  assignedTo: idOf(p.assignedTo), contentDescription: p.contentDescription || "", caption: p.caption || "",
  hashtags: p.hashtags || [], firstComment: p.firstComment || "", media: p.media || [], postUrl: p.postUrl || "",
});
const PLANNING = ["socialProject", "platform", "plannedPostDate", "plannedTime", "assignedTo", "contentDescription"];
const CONTENT  = ["caption", "hashtags", "firstComment", "media", "postUrl"];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── Hashtag chips ───────────────────────────────────────────────────────────
function HashtagInput({ value, onChange, disabled, id }) {
  const [text, setText] = useState("");
  const add = (raw) => {
    const tags = raw.split(/[\s,]+/).map(t => t.replace(/^#*/, "").trim()).filter(Boolean).map(t => `#${t}`);
    const next = [...value]; tags.forEach(t => { if (!next.includes(t)) next.push(t); });
    onChange(next.slice(0, 30)); setText("");
  };
  if (disabled) return <div className="sm-readonly">{value.length ? value.join(" ") : "No hashtags"}</div>;
  return (
    <div className="sm-tags">
      {value.map(t => (
        <span key={t} className="sm-tag">{t}
          <button type="button" onClick={() => onChange(value.filter(x => x !== t))} aria-label={`Remove ${t}`}>×</button>
        </span>
      ))}
      <input id={id} value={text} placeholder={value.length ? "" : "Type a hashtag and press Enter"}
        onChange={e => { const v = e.target.value; if (/[\s,]$/.test(v)) add(v); else setText(v); }}
        onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); if (text.trim()) add(text); }
          if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => text.trim() && add(text)} />
    </div>
  );
}

// ── Live preview ────────────────────────────────────────────────────────────
function Preview({ form, projectName }) {
  const plat = PLATFORM[form.platform] || PLATFORM.Other;
  const first = form.media[0];
  const full = [form.caption, form.hashtags.join(" ")].filter(Boolean).join("\n\n");
  const over = plat.limit && full.length > plat.limit;
  const shown = over ? full.slice(0, plat.limit) : full;
  const parts = shown.split(/(#[\p{L}\p{N}_]+)/u);
  return (
    <div className={`sm-preview sm-preview--${form.platform}`} aria-label={`${plat.label} preview`}>
      <div className="sm-preview-head">
        <span className="sm-avatar" style={{ background: "#1f8a4c" }}>{(projectName || "EG").slice(0, 2).toUpperCase()}</span>
        <div>
          <div className="sm-preview-name">{projectName || "Your project"}</div>
          <div className="sm-preview-plat">{plat.label}{form.plannedTime ? `, ${fmtTime(form.plannedTime)}` : ""}</div>
        </div>
      </div>
      {form.platform !== "Twitter" || first ? (
        <div className="sm-preview-media">
          {first ? (first.resourceType === "video" ? <video src={first.url} muted /> : <img src={first.url} alt="" />) : "No image yet"}
        </div>
      ) : null}
      <div className="sm-preview-text">
        {full ? parts.map((s, i) => s.startsWith("#") ? <span key={i} className="sm-ht">{s}</span> : s) : <span style={{ color: "#6b7c72" }}>The caption will appear here.</span>}
        {over && "…"}
      </div>
      {over && <div className="sm-preview-cut">{plat.label} cuts captions at {plat.limit.toLocaleString()} characters. This one is {full.length.toLocaleString()}.</div>}
      {form.firstComment && <div className="sm-preview-comment"><strong>First comment:</strong> {form.firstComment}</div>}
    </div>
  );
}

// ── Drawer ──────────────────────────────────────────────────────────────────
export default function PostDrawer({ postId, defaults, me, projects, members, onClose, onChanged, onDeleted, toast }) {
  const isNew = !postId;
  const isSup = me?.role === "supervisor";
  const [post, setPost] = useState(null);
  const [form, setForm] = useState(() => emptyForm(defaults));
  const [base, setBase] = useState(() => emptyForm(defaults));
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState("");
  const [uploading, setUploading] = useState(0);
  const [panel, setPanel] = useState(null);          // "reject" | "posted" | "results"
  const [reason, setReason] = useState("");
  const [postedUrl, setPostedUrl] = useState("");
  const [metrics, setMetrics] = useState({ views: "", likes: "", comments: "", shares: "" });
  const [comment, setComment] = useState("");
  const fileRef = useRef(null);
  const newUploads = useRef(new Set());

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true); setLoadError("");
    try {
      const p = await socialApi.get(postId);
      setPost(p); const f = formFrom(p); setForm(f); setBase(f);
      setPostedUrl(p.postUrl || "");
    } catch (e) { setLoadError(e.message); }
    setLoading(false);
  }, [isNew, postId]);
  useEffect(() => { load(); }, [load]);

  const close = useCallback(() => {
    // Throw away images uploaded in this session that were never saved.
    newUploads.current.forEach(pid => {
      const m = form.media.find(x => x.publicId === pid);
      if (m && !base.media.some(x => x.publicId === pid)) socialApi.discardMedia(m);
    });
    onClose();
  }, [form.media, base.media, onClose]);
  useEscape(close);

  const allowed = isNew ? { edit: true, editPlanning: true } : (post?.allowed || {});
  const project = projects.find(p => p._id === form.socialProject) || (post?.socialProject?._id === form.socialProject ? post.socialProject : null);
  const needsApproval = project ? project.requireApproval !== false : true;
  const plat = PLATFORM[form.platform] || PLATFORM.Other;
  const captionLen = [form.caption, form.hashtags.join(" ")].filter(Boolean).join("\n\n").length;
  const dirty = !same(form, base);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const assignable = useMemo(() => {
    const ids = (project?.assignedPersons || []).map(idOf);
    const list = ids.length ? members.filter(m => ids.includes(idOf(m))) : members;
    return list;
  }, [project, members]);

  // keep assignee valid for the chosen project; prefill the project's link
  useEffect(() => {
    if (!isNew || !isSup) return;
    if (assignable.length === 1) setForm(f => ({ ...f, assignedTo: idOf(assignable[0]) }));
    else if (!assignable.some(m => idOf(m) === form.assignedTo)) setForm(f => ({ ...f, assignedTo: "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.socialProject]);

  const pickFiles = async (files) => {
    for (const file of Array.from(files || [])) {
      if (!/^(image\/(jpeg|png|webp|gif)|video\/(mp4|quicktime|webm))$/.test(file.type)) { toast(`"${file.name}" isn't a supported image or video.`, "error"); continue; }
      if (file.size > MAX_MEDIA_MB * 1024 * 1024) { toast(`"${file.name}" is over ${MAX_MEDIA_MB} MB.`, "error"); continue; }
      if (form.media.length + uploading >= 10) { toast("A post can have up to 10 images or videos.", "error"); break; }
      setUploading(n => n + 1);
      try {
        const m = await socialApi.uploadMedia(file);
        newUploads.current.add(m.publicId);
        setForm(f => ({ ...f, media: [...f.media, m] }));
      } catch (e) { toast(e.message, "error"); }
      setUploading(n => n - 1);
    }
    if (fileRef.current) fileRef.current.value = "";
  };
  const removeMedia = (m) => {
    if (newUploads.current.has(m.publicId) && !base.media.some(x => x.publicId === m.publicId)) socialApi.discardMedia(m);
    set("media", form.media.filter(x => x.publicId !== m.publicId));
  };

  const payload = () => {
    const out = {};
    if (allowed.editPlanning) PLANNING.forEach(k => { if (isNew || !same(form[k], base[k])) out[k] = form[k]; });
    if (allowed.edit)        CONTENT.forEach(k => { if (isNew || !same(form[k], base[k])) out[k] = form[k]; });
    if (!isSup) delete out.assignedTo;
    return out;
  };

  const applied = (p, msg) => {
    setPost(p); const f = formFrom(p); setForm(f); setBase(f); newUploads.current.clear();
    setPanel(null); onChanged(p); if (msg) toast(msg);
  };

  const run = async (name, fn) => {
    setBusy(name);
    try { await fn(); } catch (e) { toast(e.message, "error"); }
    setBusy("");
  };

  const saveIfNeeded = async () => {
    if (isNew) {
      if (!form.socialProject) throw new Error("Choose a project.");
      if (isSup && !form.assignedTo) throw new Error("Choose who will post it.");
      const p = await socialApi.create(payload());
      newUploads.current.clear();
      return p;
    }
    if (!dirty) return post;
    return socialApi.update(post._id, payload());
  };

  const onSave      = () => run("save", async () => { const p = await saveIfNeeded(); applied(p, isNew ? "Post created" : "Changes saved"); });
  const onSubmit    = () => run("submit", async () => { const p = await saveIfNeeded(); applied(await socialApi.submit(p._id), needsApproval ? "Sent for approval" : "Ready to post"); });
  const onApprove   = () => run("approve", async () => { const p = await saveIfNeeded(); applied(await socialApi.approve(p._id), "Approved"); });
  const onReject    = () => run("reject", async () => {
    if (!reason.trim()) throw new Error("Say what needs to change.");
    applied(await socialApi.reject(post._id, reason.trim()), "Sent back"); setReason("");
  });
  const onPosted    = () => run("posted", async () => { const p = await saveIfNeeded(); applied(await socialApi.markPosted(p._id, postedUrl.trim()), "Marked as posted"); });
  const onResults   = () => run("results", async () => {
    const m = Object.fromEntries(Object.entries(metrics).map(([k, v]) => [k, parseInt(v, 10) || 0]));
    if (!Object.values(m).some(Boolean)) throw new Error("Enter at least one number.");
    applied(await socialApi.results(post._id, m), "Results saved");
  });
  const onComment   = () => run("comment", async () => {
    if (!comment.trim()) return;
    const p = await socialApi.comment(post._id, comment.trim());
    setPost(p); setComment(""); onChanged(p);
  });
  const onDelete    = () => run("delete", async () => {
    if (!window.confirm("Delete this post? This can't be undone.")) return;
    await socialApi.remove(post._id); toast("Post deleted"); onDeleted(post._id); onClose();
  });

  const v = { views: parseInt(metrics.views, 10) || 0, likes: parseInt(metrics.likes, 10) || 0, comments: parseInt(metrics.comments, 10) || 0, shares: parseInt(metrics.shares, 10) || 0 };
  const er = v.views ? (((v.likes + v.comments + v.shares) / v.views) * 100).toFixed(1) : "0.0";

  const status = post?.status;
  const sub = isNew ? "Plan a post, then write it or assign it to someone." : post && (
    <>Due {fmtDay(dayOf(post), { weekday: "long", day: "numeric", month: "long" })}{post.plannedTime ? ` at ${fmtTime(post.plannedTime)}` : ""}.
      {" "}{post.assignedTo?.name} posts it{post.assignedBy && idOf(post.assignedBy) !== idOf(post.assignedTo) ? `, planned by ${post.assignedBy.name}` : ""}.</>
  );

  return createPortal(
    <div className="sm">
      <div className="sm-scrim" onClick={close} />
      <aside className="sm-drawer" role="dialog" aria-modal="true" aria-label={isNew ? "New post" : "Post details"}>
        <header className="sm-drawer-head">
          <div style={{ minWidth: 0 }}>
            <div className="sm-drawer-title">
              <span className="sm-dot" style={{ background: plat.color, width: 10, height: 10 }} aria-hidden="true" />
              {isNew ? "New post" : `${project?.name || post?.title || "Post"} on ${plat.label}`}
              {status && <StatusPill status={status} />}
            </div>
            <div className="sm-drawer-sub">{sub}</div>
          </div>
          <button className="sm-btn sm-btn--ghost sm-icon-btn" onClick={close} aria-label="Close">✕</button>
        </header>

        {loading ? <div className="sm-loading">Loading post…</div> : loadError ? (
          <div style={{ padding: 24 }}><div className="sm-error">{loadError}<button className="sm-btn sm-btn--sm" onClick={load}>Try again</button></div></div>
        ) : (
          <div className="sm-drawer-body">
            <div className="sm-drawer-main">
              {status === "Rejected" && post.approval?.rejectionReason && (
                <div className="sm-banner sm-banner--changes"><strong>{post.approval.reviewedBy?.name || "A supervisor"} asked for changes</strong>{post.approval.rejectionReason}</div>
              )}
              {status === "Pending Approval" && (
                <div className="sm-banner sm-banner--waiting">
                  <strong>{allowed.approve ? "This post is waiting for your approval" : "Waiting for a supervisor to approve"}</strong>
                  {allowed.approve ? "Check the caption and preview, then approve it or send it back with a note." : "You'll get a notification when it's approved or sent back."}
                </div>
              )}
              {status === "Missed" && (
                <div className="sm-banner sm-banner--missed"><strong>This post was missed</strong>
                  {allowed.editPlanning ? "Move it to a new date to bring it back, or mark it as posted if it went up late." : "If it went up late, mark it as posted."}</div>
              )}
              {status === "Approved" && (
                <div className="sm-banner sm-banner--ready"><strong>Ready to post</strong>Post it on {plat.label}, then mark it as posted and paste the link.</div>
              )}

              {/* Plan */}
              <section>
                <div className="sm-section-title">Plan</div>
                {allowed.editPlanning ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div className="sm-grid-2">
                      <div className="sm-field">
                        <label htmlFor="sm-project">Project</label>
                        <select id="sm-project" className="sm-select" value={form.socialProject} onChange={e => set("socialProject", e.target.value)} disabled={!isNew && !isSup}>
                          <option value="">Choose a project</option>
                          {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div className="sm-field">
                        <label htmlFor="sm-platform">Platform</label>
                        <select id="sm-platform" className="sm-select" value={form.platform} onChange={e => set("platform", e.target.value)}>
                          {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM[p].label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className={isSup ? "sm-grid-3" : "sm-grid-2"}>
                      {isSup && (
                        <div className="sm-field">
                          <label htmlFor="sm-assignee">Who posts it</label>
                          <select id="sm-assignee" className="sm-select" value={form.assignedTo} onChange={e => set("assignedTo", e.target.value)}>
                            <option value="">Choose a person</option>
                            {assignable.map(m => <option key={idOf(m)} value={idOf(m)}>{m.name}{m.role === "supervisor" ? " (supervisor)" : ""}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="sm-field">
                        <label htmlFor="sm-date">Date</label>
                        <input id="sm-date" type="date" className="sm-select" value={form.plannedPostDate} onChange={e => set("plannedPostDate", e.target.value)} />
                      </div>
                      <div className="sm-field">
                        <label htmlFor="sm-time">Time <span className="sm-help">(optional)</span></label>
                        <input id="sm-time" type="time" className="sm-select" value={form.plannedTime} onChange={e => set("plannedTime", e.target.value)} />
                      </div>
                    </div>
                    <div className="sm-field">
                      <label htmlFor="sm-brief">Brief</label>
                      <textarea id="sm-brief" className="sm-textarea" rows={2} value={form.contentDescription} placeholder="What should this post be about?"
                        onChange={e => set("contentDescription", e.target.value)} />
                    </div>
                  </div>
                ) : (
                  <div className="sm-readonly">{form.contentDescription || "No brief."}</div>
                )}
              </section>

              {/* Post */}
              <section>
                <div className="sm-section-title">
                  Post
                  {allowed.edit && plat.limit && <span className={`sm-counter${captionLen > plat.limit ? " sm-over" : ""}`}>{captionLen.toLocaleString()} / {plat.limit.toLocaleString()}</span>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="sm-field">
                    <label htmlFor="sm-caption">Caption</label>
                    {allowed.edit
                      ? <textarea id="sm-caption" className="sm-textarea" rows={6} value={form.caption} placeholder={`Write the ${plat.label} caption`} onChange={e => set("caption", e.target.value)} />
                      : <div className="sm-readonly">{form.caption || "No caption."}</div>}
                  </div>
                  <div className="sm-field">
                    <label htmlFor="sm-tags">Hashtags</label>
                    <HashtagInput id="sm-tags" value={form.hashtags} onChange={v => set("hashtags", v)} disabled={!allowed.edit} />
                  </div>
                  <div className="sm-field">
                    <span className="sm-label">Images and videos</span>
                    <div className="sm-media">
                      {form.media.map(m => (
                        <div key={m.publicId} className="sm-media-item">
                          {m.resourceType === "video" ? <video src={m.url} muted /> : <img src={m.url} alt={m.name} />}
                          {allowed.edit && <button type="button" onClick={() => removeMedia(m)} aria-label={`Remove ${m.name}`}>×</button>}
                        </div>
                      ))}
                      {allowed.edit && (
                        <button type="button" className="sm-media-add" onClick={() => fileRef.current?.click()} disabled={uploading > 0}>
                          <span aria-hidden="true">+</span>{uploading ? `Uploading ${uploading}…` : "Add image or video"}
                        </button>
                      )}
                      {!allowed.edit && !form.media.length && <span className="sm-quiet">No images.</span>}
                    </div>
                    <input ref={fileRef} type="file" hidden multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm" onChange={e => pickFiles(e.target.files)} />
                    {allowed.edit && <span className="sm-help">JPG, PNG, WEBP, GIF or MP4/MOV/WEBM, up to {MAX_MEDIA_MB} MB each.</span>}
                  </div>
                  <div className="sm-field">
                    <label htmlFor="sm-first">First comment <span className="sm-help">(posted right after, e.g. a link)</span></label>
                    {allowed.edit
                      ? <input id="sm-first" className="sm-input" value={form.firstComment} onChange={e => set("firstComment", e.target.value)} placeholder="Optional" />
                      : <div className="sm-readonly">{form.firstComment || "None."}</div>}
                  </div>
                  {(status === "Posted" || status === "Reviewed") && (
                    <div className="sm-field">
                      <span className="sm-label">Link to the post</span>
                      {post.postUrl ? <a href={post.postUrl} target="_blank" rel="noreferrer" style={{ color: "#1f8a4c", fontWeight: 600, fontSize: 13.5, wordBreak: "break-all" }}>{post.postUrl}</a> : <span className="sm-quiet">No link added.</span>}
                    </div>
                  )}
                </div>
              </section>

              {/* Results */}
              {status === "Reviewed" && post.metrics && (
                <section>
                  <div className="sm-section-title">Results</div>
                  <div className="sm-metrics">
                    {[["views", "Views"], ["likes", "Likes"], ["comments", "Comments"], ["shares", "Shares"]].map(([k, l]) => (
                      <div key={k} className="sm-metric"><b>{(post.metrics[k] || 0).toLocaleString()}</b><span>{l}</span></div>
                    ))}
                  </div>
                  <p className="sm-help" style={{ marginTop: 8 }}>Engagement {post.metrics.engagementRate}%, score {post.metrics.performanceScore.toLocaleString()}.</p>
                </section>
              )}

              {/* Inline action forms */}
              {panel === "reject" && (
                <div className="sm-inline-form">
                  <label className="sm-label" htmlFor="sm-reason">What needs to change?</label>
                  <textarea id="sm-reason" className="sm-textarea" rows={3} value={reason} onChange={e => setReason(e.target.value)} autoFocus placeholder="e.g. Use the new logo and shorten the caption" />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="sm-btn sm-btn--danger" onClick={onReject} disabled={busy === "reject"}>{busy === "reject" ? "Sending back…" : "Send back"}</button>
                    <button className="sm-btn sm-btn--ghost" onClick={() => setPanel(null)}>Cancel</button>
                  </div>
                </div>
              )}
              {panel === "posted" && (
                <div className="sm-inline-form">
                  <label className="sm-label" htmlFor="sm-url">Link to the live post</label>
                  <input id="sm-url" className="sm-input" value={postedUrl} onChange={e => setPostedUrl(e.target.value)} placeholder="https://…" autoFocus />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="sm-btn sm-btn--leaf" onClick={onPosted} disabled={busy === "posted"}>{busy === "posted" ? "Saving…" : "Mark as posted"}</button>
                    <button className="sm-btn sm-btn--ghost" onClick={() => setPanel(null)}>Cancel</button>
                  </div>
                </div>
              )}
              {panel === "results" && (
                <div className="sm-inline-form">
                  <span className="sm-label">Results after 7 days</span>
                  <div className="sm-metrics">
                    {[["views", "Views"], ["likes", "Likes"], ["comments", "Comments"], ["shares", "Shares"]].map(([k, l]) => (
                      <label key={k} className="sm-field"><span className="sm-label">{l}</span>
                        <input type="number" min="0" className="sm-input" value={metrics[k]} onChange={e => setMetrics(m => ({ ...m, [k]: e.target.value }))} />
                      </label>
                    ))}
                  </div>
                  <span className="sm-help">Engagement {er}%, score {(v.views + v.likes * 2 + v.comments * 3).toLocaleString()}.</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="sm-btn sm-btn--leaf" onClick={onResults} disabled={busy === "results"}>{busy === "results" ? "Saving…" : "Save results"}</button>
                    <button className="sm-btn sm-btn--ghost" onClick={() => setPanel(null)}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Comments */}
              {!isNew && post && (
                <section>
                  <div className="sm-section-title">Comments</div>
                  <div className="sm-thread">
                    {(post.comments || []).length === 0 && <span className="sm-quiet">No comments yet. Ask a question or leave feedback here.</span>}
                    {(post.comments || []).map(c => (
                      <div key={c._id} className="sm-msg">
                        <Avatar person={c.author} />
                        <div className="sm-msg-body">
                          <div className="sm-msg-meta"><strong>{c.author?.name || "Someone"}</strong>{fmtStamp(c.createdAt)}</div>
                          {c.text}
                        </div>
                      </div>
                    ))}
                    <div className="sm-compose">
                      <textarea className="sm-textarea" rows={2} value={comment} placeholder="Write a comment" aria-label="Write a comment"
                        onChange={e => setComment(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onComment(); }} />
                      <button className="sm-btn" onClick={onComment} disabled={!comment.trim() || busy === "comment"}>Add comment</button>
                    </div>
                  </div>
                </section>
              )}
            </div>

            <aside className="sm-drawer-side">
              <section>
                <div className="sm-section-title">Preview</div>
                <Preview form={form} projectName={project?.name || post?.title} />
              </section>
              {!isNew && post?.history?.length > 0 && (
                <section>
                  <div className="sm-section-title">Activity</div>
                  <ol className="sm-history">
                    {[...post.history].reverse().map((h, i) => (
                      <li key={i} className={`sm-h-${h.action}`}>
                        {HISTORY_LABEL[h.action] || h.action}{h.by?.name ? ` by ${h.by.name}` : ""}{h.note ? `: ${h.note}` : ""}
                        <time>{fmtStamp(h.at)}</time>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </aside>
          </div>
        )}

        {!loading && !loadError && (
          <footer className="sm-drawer-foot">
            {allowed.approve && status === "Pending Approval" && (
              <button className="sm-btn sm-btn--clay" onClick={onApprove} disabled={!!busy}>{busy === "approve" ? "Approving…" : "Approve"}</button>
            )}
            {allowed.reject && panel !== "reject" && (
              <button className="sm-btn sm-btn--danger" onClick={() => setPanel("reject")} disabled={!!busy}>Send back</button>
            )}
            {allowed.submit && (
              <button className="sm-btn sm-btn--primary" onClick={onSubmit} disabled={!!busy || uploading > 0}>
                {busy === "submit" ? "Sending…" : needsApproval ? (status === "Rejected" ? "Resend for approval" : "Send for approval") : "Mark ready to post"}
              </button>
            )}
            {allowed.approve && status !== "Pending Approval" && isSup && (
              <button className="sm-btn" onClick={onApprove} disabled={!!busy}>Approve now</button>
            )}
            {allowed.markPosted && panel !== "posted" && (
              <button className={`sm-btn ${status === "Approved" ? "sm-btn--leaf" : ""}`} onClick={() => setPanel("posted")} disabled={!!busy}>Mark as posted</button>
            )}
            {allowed.addMetrics && panel !== "results" && (
              <button className={`sm-btn ${status === "Posted" ? "sm-btn--leaf" : ""}`} onClick={() => {
                if (post.metrics) setMetrics({ views: post.metrics.views || "", likes: post.metrics.likes || "", comments: post.metrics.comments || "", shares: post.metrics.shares || "" });
                setPanel("results");
              }} disabled={!!busy}>{status === "Reviewed" ? "Update results" : "Add results"}</button>
            )}
            <span className="sm-spacer" />
            {(isNew || dirty) && (allowed.edit || allowed.editPlanning) && (
              <button className={`sm-btn ${isNew ? "sm-btn--primary" : ""}`} onClick={onSave} disabled={!!busy || uploading > 0}>
                {busy === "save" ? "Saving…" : isNew ? "Create post" : "Save changes"}
              </button>
            )}
            {allowed.delete && <button className="sm-btn sm-btn--ghost sm-btn--danger" onClick={onDelete} disabled={!!busy}>Delete</button>}
            {!isNew && !Object.values(allowed).some(Boolean) && <span className="sm-quiet">{STATUS[status]?.label}. Nothing more to do here.</span>}
          </footer>
        )}
      </aside>
    </div>,
    document.body
  );
}
