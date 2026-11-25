// pages/social/SocialPage.jsx – the Social Media section.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { socialApi, pendingOpen, OPEN_POST_EVENT, NOTIFICATION_EVENT } from "./socialApi";
import { PLATFORM, PLATFORMS, STATUS, addDays, idOf, localISO, startOfWeek } from "./constants";
import TodayStrip from "./TodayStrip";
import BoardView from "./BoardView";
import ListView from "./ListView";
import CalendarView, { calendarRange } from "./CalendarView";
import RoutinesView from "./RoutinesView";
import PostDrawer from "./PostDrawer";
import ProjectsDialog from "./ProjectsDialog";
import { useToast } from "./ui";
import "./social.css";

const RANGES = {
  week:   { label: "This week",    get: () => { const s = startOfWeek(localISO()); return { from: s, to: addDays(s, 6) }; } },
  month:  { label: "This month",   get: () => { const t = localISO(); const d = new Date(`${t.slice(0, 7)}-01T12:00:00`); d.setMonth(d.getMonth() + 1); d.setDate(0); return { from: `${t.slice(0, 7)}-01`, to: localISO(d) }; } },
  next30: { label: "Next 30 days", get: () => ({ from: localISO(), to: addDays(localISO(), 30) }) },
  last30: { label: "Last 30 days", get: () => ({ from: addDays(localISO(), -30), to: localISO() }) },
};

const joinList = (parts) => parts.length <= 1 ? parts : [...parts.slice(0, -1).flatMap((p, i) => (i ? [", ", p] : [p])), " and ", parts[parts.length - 1]];

export default function SocialPage({ view = "board" }) {
  const { user: me } = useAuth();
  const isSup = me?.role === "supervisor";
  const [toastNode, toast] = useToast();

  const [tab, setTab] = useState(view === "calendar" ? "calendar" : "board");
  const [scope, setScope] = useState(isSup ? "all" : "mine");
  const [assignee, setAssignee] = useState("");
  const [project, setProject] = useState("");
  const [platform, setPlatform] = useState("");
  const [status, setStatus] = useState("");
  const [range, setRange] = useState("week");
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [calMode, setCalMode] = useState("month");
  const [calAnchor, setCalAnchor] = useState(localISO());

  const [posts, setPosts] = useState([]);
  const [today, setToday] = useState([]);
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [todayLoading, setTodayLoading] = useState(true);
  const [routinesLoading, setRoutinesLoading] = useState(true);
  const [error, setError] = useState("");
  const [drawer, setDrawer] = useState(null);       // { id } | { isNew: true, defaults }
  const [showProjects, setShowProjects] = useState(false);

  useEffect(() => { const t = setTimeout(() => setSearch(searchText.trim()), 300); return () => clearTimeout(t); }, [searchText]);
  useEffect(() => { if (view === "calendar") setTab("calendar"); }, [view]);

  const common = useMemo(() => ({
    scope, assignee: scope === "all" ? assignee : "", project, platform, search,
  }), [scope, assignee, project, platform, search]);

  const window_ = useMemo(() => (tab === "calendar" ? calendarRange(calMode, calAnchor) : RANGES[range].get()), [tab, calMode, calAnchor, range]);

  const loadMeta = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([socialApi.projects(), socialApi.members()]);
      setProjects(p); setMembers(m);
    } catch (e) { toast(e.message, "error"); }
  }, [toast]);

  const loadRoutines = useCallback(async () => {
    setRoutinesLoading(true);
    try { setRoutines(await socialApi.routines()); } catch (e) { toast(e.message, "error"); }
    setRoutinesLoading(false);
  }, [toast]);

  const loadPosts = useCallback(async () => {
    if (tab === "routines") return;
    setLoading(true); setError("");
    try {
      setPosts(await socialApi.list({ ...common, ...window_, status: tab === "list" ? status : "" }));
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [tab, common, window_, status]);

  const loadToday = useCallback(async () => {
    setTodayLoading(true);
    try {
      const t = localISO();
      const [list, s] = await Promise.all([socialApi.list({ ...common, from: t, to: t }), socialApi.dashboard({ scope: common.scope, assignee: common.assignee })]);
      setToday(list); setStats(s);
    } catch { /* the main list shows errors */ }
    setTodayLoading(false);
  }, [common]);

  useEffect(() => { loadMeta(); loadRoutines(); }, [loadMeta, loadRoutines]);
  useEffect(() => { loadPosts(); }, [loadPosts]);
  useEffect(() => { loadToday(); }, [loadToday]);

  const refresh = useCallback(() => { loadPosts(); loadToday(); }, [loadPosts, loadToday]);

  // Live updates: refresh when a notification arrives (pushed by the bell).
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    const onNote = () => refreshRef.current();
    const onOpen = (e) => { pendingOpen.id = null; setDrawer({ id: e.detail?.id }); };
    window.addEventListener(NOTIFICATION_EVENT, onNote);
    window.addEventListener(OPEN_POST_EVENT, onOpen);
    if (pendingOpen.id) { setDrawer({ id: pendingOpen.id }); pendingOpen.id = null; }
    return () => { window.removeEventListener(NOTIFICATION_EVENT, onNote); window.removeEventListener(OPEN_POST_EVENT, onOpen); };
  }, []);

  const openPost = (p) => setDrawer({ id: p._id });
  const newPost = (defaults = {}) => {
    if (!projects.length) { toast(isSup ? "Create a social project first." : "You aren't in any social project yet.", "error"); if (isSup) setShowProjects(true); return; }
    setDrawer({ isNew: true, defaults: { socialProject: project || (projects.length === 1 ? projects[0]._id : ""), ...defaults } });
  };

  const replaceEverywhere = (p) => {
    const swap = (list) => list.map(x => (x._id === p._id ? { ...x, ...p } : x));
    setPosts(swap); setToday(swap);
  };
  const onChanged = (p) => {
    if (drawer?.isNew) setDrawer({ id: p._id });
    replaceEverywhere(p);
    refresh();
  };
  const onDeleted = (id) => { setPosts(l => l.filter(x => x._id !== id)); setToday(l => l.filter(x => x._id !== id)); loadToday(); };

  const onMove = async (id, day) => {
    const post = posts.find(p => p._id === id);
    if (!post || post.plannedPostDate?.slice(0, 10) === day) return;
    setPosts(list => list.map(p => (p._id === id ? { ...p, plannedPostDate: `${day}T00:00:00.000Z` } : p)));
    try {
      await socialApi.update(id, { plannedPostDate: day });
      toast(`Moved to ${new Date(`${day}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`);
      refresh();
    } catch (e) { toast(e.message, "error"); loadPosts(); }
  };

  // Header sentence
  const o = stats?.overview;
  const parts = [];
  if (o) {
    const todo = (o.planned || 0) + (o.rejected || 0);
    if (o.pendingApproval) parts.push(<span key="w" className="sm-attn">{o.pendingApproval} waiting for {isSup ? "your " : ""}approval</span>);
    if (todo) parts.push(<strong key="t">{todo} to do</strong>);
    if (o.approved) parts.push(<strong key="r">{o.approved} ready to post</strong>);
    if (o.missed) parts.push(<strong key="m">{o.missed} missed</strong>);
  }
  const scopeWord = scope === "mine" ? "Your posts" : assignee ? `${members.find(m => idOf(m) === assignee)?.name || "Their"} posts` : "Across the team";

  const tabs = [
    { key: "board", label: "Board" },
    { key: "calendar", label: "Calendar" },
    { key: "list", label: "List" },
    { key: "routines", label: "Routines", count: routines.filter(r => r.active).length || null },
  ];

  return (
    <div className="sm">
      {toastNode}

      <header className="sm-head">
        <div>
          <h1 className="sm-title">Social media</h1>
          <p className="sm-summary">
            {!o ? "Loading…" : parts.length ? <>{scopeWord}: {joinList(parts)}.</> : <>{scopeWord}: nothing waiting right now.</>}
          </p>
        </div>
        <div className="sm-head-actions">
          {isSup && <button className="sm-btn" onClick={() => setShowProjects(true)}>Projects</button>}
          <button className="sm-btn sm-btn--primary" onClick={() => newPost()}>New post</button>
        </div>
      </header>

      <TodayStrip posts={today} onOpen={openPost} canPlan loading={todayLoading} onPlan={() => newPost({ date: localISO() })} />

      <nav className="sm-tabs" role="tablist" aria-label="Views">
        {tabs.map(t => (
          <button key={t.key} role="tab" className="sm-tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}{t.count ? <span className="sm-count">{t.count}</span> : null}
          </button>
        ))}
      </nav>

      {tab !== "routines" && (
        <div className="sm-filters">
          <div className="sm-seg" role="group" aria-label="Whose posts">
            <button aria-pressed={scope === "mine"} onClick={() => { setScope("mine"); setAssignee(""); }}>Mine</button>
            <button aria-pressed={scope === "all"} onClick={() => setScope("all")}>{isSup ? "Everyone" : "My team"}</button>
          </div>
          {scope === "all" && (
            <select className="sm-select" value={assignee} onChange={e => setAssignee(e.target.value)} aria-label="Person">
              <option value="">All people</option>
              {members.filter(m => isSup || idOf(m) !== idOf(me)).map(m => <option key={idOf(m)} value={idOf(m)}>{m.name}</option>)}
            </select>
          )}
          <select className="sm-select" value={project} onChange={e => setProject(e.target.value)} aria-label="Project">
            <option value="">All projects</option>
            {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
          <select className="sm-select" value={platform} onChange={e => setPlatform(e.target.value)} aria-label="Platform">
            <option value="">All platforms</option>
            {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM[p].label}</option>)}
          </select>
          {tab === "list" && (
            <select className="sm-select" value={status} onChange={e => setStatus(e.target.value)} aria-label="Status">
              <option value="">Any status</option>
              {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
            </select>
          )}
          <input className="sm-input" type="search" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Search captions" aria-label="Search captions" />
          <span className="sm-spacer" />
          {tab !== "calendar" && (
            <div className="sm-seg" role="group" aria-label="Dates">
              {Object.entries(RANGES).map(([k, r]) => <button key={k} aria-pressed={range === k} onClick={() => setRange(k)}>{r.label}</button>)}
            </div>
          )}
        </div>
      )}

      {error && <div className="sm-error">{error}<button className="sm-btn sm-btn--sm" onClick={loadPosts}>Try again</button></div>}

      {tab === "routines" ? (
        <RoutinesView routines={routines} projects={projects} members={members} isSup={isSup} loading={routinesLoading}
          onChanged={() => { loadRoutines(); refresh(); }} toast={toast} />
      ) : tab === "calendar" ? (
        <CalendarView posts={posts} mode={calMode} setMode={setCalMode} anchor={calAnchor} setAnchor={setCalAnchor} onOpen={openPost} onMove={onMove} />
      ) : loading && !posts.length ? (
        <div className="sm-loading">Loading posts…</div>
      ) : posts.length === 0 ? (
        <div className="sm-empty">
          <h3>No posts {RANGES[range].label.toLowerCase()}</h3>
          <p>{scope === "mine" ? "Nothing is planned for you in this period. Try another date range or switch to the whole team." : "Nothing is planned in this period. Plan a post, or set up a routine for posts that repeat."}</p>
          <button className="sm-btn sm-btn--primary" onClick={() => newPost()}>New post</button>
        </div>
      ) : tab === "board" ? (
        <BoardView posts={posts} onOpen={openPost} />
      ) : (
        <ListView posts={posts} onOpen={openPost} />
      )}

      {drawer && (
        <PostDrawer key={drawer.id || "new"} postId={drawer.id} defaults={drawer.defaults} me={me} projects={projects} members={members}
          onClose={() => setDrawer(null)} onChanged={onChanged} onDeleted={onDeleted} toast={toast} />
      )}
      {showProjects && (
        <ProjectsDialog projects={projects} members={members} onClose={() => setShowProjects(false)} onChanged={loadMeta} toast={toast} />
      )}
    </div>
  );
}
