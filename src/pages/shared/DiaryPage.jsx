import { useState, useEffect, useRef, useCallback } from "react";
import { CheckCircleIcon, TrashIcon, FolderIcon } from "../../components/shared/Icons.jsx";
import { diaryAPI } from "../../utils/api";

// Entries are stored per user on the server (/api/diary).
// The old diary kept everything in this browser-only key, shared by everyone
// who used the browser. It is only read now, to offer a one-time import.
const LEGACY_DIARY_KEY = "egi_diary_v2";
const readLegacyEntries = () => {
  try {
    const list = JSON.parse(localStorage.getItem(LEGACY_DIARY_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch { return []; }
};
const clearLegacyEntries = () => { try { localStorage.removeItem(LEGACY_DIARY_KEY); } catch { /* ignore */ } };

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // must match the backend limit

// Server entries use _id; the UI works with "id".
const norm       = (e) => ({ ...e, id: e._id || e.id });
const byDateDesc = (list) => [...list].sort((a,b) => (b.date||"").localeCompare(a.date||""));

const dataUrlToBlob = (dataUrl) => {
  const [head, b64 = ""] = String(dataUrl).split(",");
  const mime = (head.match(/data:([^;]+)/) || [])[1] || "application/octet-stream";
  const bin  = atob(b64);
  const arr  = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
};

// Browsers block opening data: URLs in a new tab, so legacy (base64) files are
// opened through a temporary blob URL; uploaded files open their Cloudinary URL.
const attachmentSrc  = (f) => f?.url || f?.data || "";
const openAttachment = (f) => {
  if (f?.url) { window.open(f.url, "_blank", "noopener,noreferrer"); return; }
  if (f?.data) {
    const blobUrl = URL.createObjectURL(dataUrlToBlob(f.data));
    window.open(blobUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  }
};


function getFileType(name = "") {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (["jpg","jpeg","png","gif","webp","svg","bmp"].includes(ext))
    return { icon: "🖼️", label: "Image",   accent: "#6366f1", soft: "#eef2ff", border: "#c7d2fe" };
  if (ext === "pdf")
    return { icon: "📄", label: "PDF",     accent: "#e11d48", soft: "#fff1f2", border: "#fecdd3" };
  if (["doc","docx"].includes(ext))
    return { icon: "📝", label: "Word",    accent: "#2563eb", soft: "#eff6ff", border: "#bfdbfe" };
  if (["xls","xlsx","csv"].includes(ext))
    return { icon: "📊", label: "Excel",   accent: "#16a34a", soft: "#f0fdf4", border: "#bbf7d0" };
  if (["ppt","pptx"].includes(ext))
    return { icon: "📋", label: "PPT",     accent: "#ea580c", soft: "#fff7ed", border: "#fed7aa" };
  if (["zip","rar","7z","tar","gz"].includes(ext))
    return { icon: "🗜️", label: "Archive", accent: "#78716c", soft: "#fafaf9", border: "#d6d3d1" };
  if (["mp4","mov","avi","mkv","webm"].includes(ext))
    return { icon: "🎬", label: "Video",   accent: "#7c3aed", soft: "#f5f3ff", border: "#ddd6fe" };
  if (["mp3","wav","ogg","m4a"].includes(ext))
    return { icon: "🎵", label: "Audio",   accent: "#0891b2", soft: "#ecfeff", border: "#a5f3fc" };
  if (["txt","md","rtf"].includes(ext))
    return { icon: "📃", label: "Text",    accent: "#475569", soft: "#f8fafc", border: "#e2e8f0" };
  return   { icon: "📎", label: "File",    accent: "#64748b", soft: "#f8fafc", border: "#e2e8f0" };
}
const isImg = (n = "") => ["jpg","jpeg","png","gif","webp","svg","bmp"].includes((n.split(".").pop()||"").toLowerCase());
const fmtBytes = (b = 0) => b < 1024 ? b+"B" : b < 1048576 ? (b/1024).toFixed(1)+"KB" : (b/1048576).toFixed(1)+"MB";
// Local calendar date (toISOString() is UTC and gives yesterday before 05:30 in Sri Lanka).
const localISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayStr = () => localISO();
const fmtDate = (s) => {
  if (!s) return "";
  return new Date(s + "T00:00:00").toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
};
const fmtDateShort = (s) => {
  if (!s) return "";
  return new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" });
};


const TAGS = ["#work","#personal","#study","#meeting","#idea","#mood","#goal"];
const TAG_PALETTE = {
  "#work":     { bg:"#dbeafe", fg:"#1e40af", border:"#93c5fd" },
  "#personal": { bg:"#fce7f3", fg:"#9d174d", border:"#f9a8d4" },
  "#study":    { bg:"#d1fae5", fg:"#065f46", border:"#6ee7b7" },
  "#meeting":  { bg:"#ede9fe", fg:"#5b21b6", border:"#c4b5fd" },
  "#idea":     { bg:"#fef9c3", fg:"#854d0e", border:"#fde047" },
  "#mood":     { bg:"#fee2e2", fg:"#991b1b", border:"#fca5a5" },
  "#goal":     { bg:"#e0f2fe", fg:"#075985", border:"#7dd3fc" },
};
const MOODS = [
  { emoji:"😄", label:"Great"    },
  { emoji:"🙂", label:"Good"     },
  { emoji:"😐", label:"Okay"     },
  { emoji:"😕", label:"Low"      },
  { emoji:"😤", label:"Stressed" },
  { emoji:"😴", label:"Tired"    },
  { emoji:"🤩", label:"Amazing"  },
  { emoji:"💪", label:"Motivated"},
];

function getMonthGrid(year, month) {
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const total    = new Date(year, month + 1, 0).getDate();
  return { firstDay, total };
}



function Chip({ tag, onRemove, tiny }) {
  const c = TAG_PALETTE[tag] || { bg:"#f1f5f9", fg:"#475569", border:"#cbd5e1" };
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:4,
      padding: tiny ? "1px 8px" : "3px 10px",
      borderRadius:99, fontSize: tiny ? 10 : 11, fontWeight:700,
      background:c.bg, color:c.fg, border:`1.5px solid ${c.border}`,
      letterSpacing:".01em",
    }}>
      {tag}
      {onRemove && (
        <button onClick={onRemove} style={{ background:"none", border:"none", cursor:"pointer", padding:0, fontSize:10, color:c.fg, lineHeight:1, opacity:.7, display:"flex", alignItems:"center" }}>✕</button>
      )}
    </span>
  );
}

function MoodPicker({ value, onChange }) {
  return (
    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
      {MOODS.map(m => {
        const active = value === m.emoji;
        return (
          <button key={m.emoji} onClick={() => onChange(active ? "" : m.emoji)} title={m.label} style={{
            display:"flex", flexDirection:"column", alignItems:"center", gap:2,
            padding:"6px 8px", borderRadius:10, border:"1.5px solid",
            borderColor: active ? "#16a34a" : "#e2e8f0",
            background: active ? "#f0fdf4" : "#fafafa",
            cursor:"pointer", transition:"all .15s",
            transform: active ? "scale(1.12)" : "scale(1)",
            boxShadow: active ? "0 2px 8px rgba(22,163,74,.18)" : "none",
          }}>
            <span style={{ fontSize:22 }}>{m.emoji}</span>
            <span style={{ fontSize:9, fontWeight:700, color: active ? "#16a34a" : "#94a3b8", textTransform:"uppercase", letterSpacing:".04em" }}>{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}


function ImgTile({ file, onRemove }) {
  return (
    <div style={{ position:"relative", borderRadius:12, overflow:"hidden", width:100, height:100, flexShrink:0, boxShadow:"0 2px 8px rgba(0,0,0,.12)" }}>
      <img src={attachmentSrc(file)} alt={file.name} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top, rgba(0,0,0,.55) 0%, transparent 50%)" }} />
      <div style={{ position:"absolute", bottom:4, left:6, right:22, fontSize:8, color:"#fff", fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{file.name}</div>
      {onRemove && (
        <button onClick={onRemove} style={{ position:"absolute", top:4, right:4, width:18, height:18, borderRadius:99, background:"rgba(0,0,0,.6)", border:"1.5px solid rgba(255,255,255,.3)", color:"#fff", fontSize:9, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>✕</button>
      )}
    </div>
  );
}


function FileRow({ file, onRemove, onDownload }) {
  const ft = getFileType(file.name);
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:12,
      padding:"10px 14px", borderRadius:12,
      background: ft.soft, border:`1.5px solid ${ft.border}`,
      transition:"box-shadow .15s",
    }}>
      <span style={{ fontSize:24, flexShrink:0 }}>{ft.icon}</span>
      <div style={{ flex:1, overflow:"hidden" }}>
        <div style={{ fontSize:12, fontWeight:700, color:"#1e293b", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{file.name}</div>
        <div style={{ fontSize:10, color:ft.accent, fontWeight:600, marginTop:2 }}>{ft.label}{file.size ? ` · ${fmtBytes(file.size)}` : ""}</div>
      </div>
      {onDownload && (
        <button onClick={onDownload} title="Download" style={{ background:ft.soft, border:`1px solid ${ft.border}`, borderRadius:8, padding:"4px 10px", cursor:"pointer", fontSize:11, color:ft.accent, fontWeight:700, fontFamily:"inherit" }}>↓</button>
      )}
      {onRemove && (
        <button onClick={onRemove} title="Remove" style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"4px 8px", cursor:"pointer", fontSize:11, color:"#ef4444", fontWeight:700, fontFamily:"inherit" }}>✕</button>
      )}
    </div>
  );
}

function MiniCalendar({ entries, selected, onSelect }) {
  const today = todayStr();
  const [vy, setVy] = useState(() => new Date().getFullYear());
  const [vm, setVm] = useState(() => new Date().getMonth());

  const entryMap = {};
  entries.forEach(e => { entryMap[e.date] = e; });

  const { firstDay, total } = getMonthGrid(vy, vm);
  const monthLabel = new Date(vy, vm, 1).toLocaleDateString("en-GB", { month:"long", year:"numeric" });

  const prev = () => vm === 0 ? (setVy(y => y-1), setVm(11)) : setVm(m => m-1);
  const next = () => vm === 11 ? (setVy(y => y+1), setVm(0)) : setVm(m => m+1);

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= total; d++) {
    const ds = `${vy}-${String(vm+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    cells.push({ d, ds });
  }

  return (
    <div>
      {/* Nav */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <button onClick={prev} style={{ width:30, height:30, borderRadius:8, border:"1.5px solid #e2e8f0", background:"#fff", cursor:"pointer", fontSize:14, color:"#475569", display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
        <span style={{ fontFamily:"'DM Serif Display',serif", fontSize:15, fontWeight:400, color:"#0f172a", letterSpacing:".01em" }}>{monthLabel}</span>
        <button onClick={next} style={{ width:30, height:30, borderRadius:8, border:"1.5px solid #e2e8f0", background:"#fff", cursor:"pointer", fontSize:14, color:"#475569", display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
      </div>

  
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:1, marginBottom:6 }}>
        {["M","T","W","T","F","S","S"].map((d,i) => (
          <div key={i} style={{ textAlign:"center", fontSize:9, fontWeight:700, color:"#94a3b8", letterSpacing:".08em", padding:"2px 0" }}>{d}</div>
        ))}
      </div>

  
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
        {cells.map((cell, i) => {
          if (!cell) return <div key={`e-${i}`} />;
          const isToday = cell.ds === today;
          const isSel   = cell.ds === selected;
          const entry   = entryMap[cell.ds];
          const hasNote = !!entry;
          return (
            <button key={cell.ds} onClick={() => onSelect(cell.ds)} style={{
              position:"relative",
              aspectRatio:"1",
              borderRadius:8,
              border:"1.5px solid",
              borderColor: isSel ? "#16a34a" : isToday ? "#86efac" : hasNote ? "#d1fae5" : "transparent",
              background: isSel ? "#16a34a" : isToday ? "#f0fdf4" : hasNote ? "#f0fdf4" : "transparent",
              cursor:"pointer",
              fontFamily:"'DM Sans',sans-serif",
              fontSize:12,
              fontWeight: isSel || isToday ? 700 : 400,
              color: isSel ? "#fff" : isToday ? "#16a34a" : "#334155",
              transition:"all .12s",
              display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:1,
            }}>
              {cell.d}
              {hasNote && !isSel && (
                <span style={{ fontSize:7, lineHeight:1 }}>{entry.mood || "•"}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════
function Analytics({ entries }) {
  const total      = entries.length;
  const thisMonth  = entries.filter(e => e.date?.startsWith(todayStr().slice(0,7))).length;
  const totalWords = entries.reduce((s,e) => s + (e.content?.trim().split(/\s+/).filter(Boolean).length||0), 0);
  const totalFiles = entries.reduce((s,e) => s + ((e.attachments||[]).length), 0);

  // streak
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(); d.setDate(d.getDate()-i);
    if (entries.find(e => e.date === localISO(d))) streak++;
    else if (i > 0) break;
  }

  // mood freq
  const mc = {}; entries.forEach(e => e.mood && (mc[e.mood]=(mc[e.mood]||0)+1));
  const topMood = Object.entries(mc).sort((a,b)=>b[1]-a[1])[0];

  // tag freq
  const tc = {}; entries.forEach(e => e.tags?.forEach(t => tc[t]=(tc[t]||0)+1));
  const topTags = Object.entries(tc).sort((a,b)=>b[1]-a[1]).slice(0,4);

  const blocks = [
    { icon:"📝", val:total,      label:"Entries",  c:"#16a34a", bg:"#f0fdf4", border:"#bbf7d0" },
    { icon:"📅", val:thisMonth,  label:"This Month",c:"#2563eb", bg:"#eff6ff", border:"#bfdbfe" },
    { icon:"🔥", val:streak,     label:"Day Streak",c:"#e11d48", bg:"#fff1f2", border:"#fecdd3" },
    { icon:"✍️", val:totalWords.toLocaleString(), label:"Words", c:"#7c3aed", bg:"#f5f3ff", border:"#ddd6fe" },
  ];

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
        {blocks.map(b => (
          <div key={b.label} style={{ padding:"12px", borderRadius:12, background:b.bg, border:`1.5px solid ${b.border}`, textAlign:"center" }}>
            <div style={{ fontSize:16, marginBottom:4 }}>{b.icon}</div>
            <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:24, color:b.c, lineHeight:1 }}>{b.val}</div>
            <div style={{ fontSize:9, fontWeight:700, color:b.c, opacity:.7, textTransform:"uppercase", letterSpacing:".08em", marginTop:3 }}>{b.label}</div>
          </div>
        ))}
      </div>

      {totalFiles > 0 && (
        <div style={{ padding:"8px 12px", borderRadius:10, background:"#f8fafc", border:"1.5px solid #e2e8f0", marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:16 }}>📎</span>
          <span style={{ fontSize:11, fontWeight:600, color:"#475569" }}>{totalFiles} file{totalFiles>1?"s":""} attached</span>
        </div>
      )}

      {topMood && (
        <div style={{ padding:"12px", borderRadius:12, background:"linear-gradient(135deg,#fffbeb,#fef3c7)", border:"1.5px solid #fde68a", marginBottom:12 }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#92400e", letterSpacing:".08em", textTransform:"uppercase", marginBottom:6 }}>Top Mood</div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:28 }}>{topMood[0]}</span>
            <span style={{ fontSize:12, color:"#b45309", fontWeight:600 }}>{topMood[1]}×</span>
          </div>
        </div>
      )}

      {topTags.length > 0 && (
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:".08em", textTransform:"uppercase", marginBottom:8 }}>Top Tags</div>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            {topTags.map(([tag, count]) => (
              <div key={tag} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <Chip tag={tag} tiny />
                <span style={{ fontSize:11, fontWeight:700, color:"#94a3b8" }}>{count}×</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ON THIS DAY
// ═══════════════════════════════════════════════════════════════════════════════
function OnThisDay({ entries }) {
  const today = todayStr();
  const mmdd  = today.slice(5);
  const memories = entries.filter(e => e.date && e.date.slice(5)===mmdd && e.date!==today);
  if (!memories.length) return null;
  return (
    <div style={{
      padding:"14px 16px", borderRadius:14,
      background:"linear-gradient(135deg,#fffbeb 0%,#fff7ed 100%)",
      border:"1.5px solid #fde68a",
      marginBottom:16,
    }}>
      <div style={{ fontSize:11, fontWeight:800, color:"#92400e", letterSpacing:".06em", textTransform:"uppercase", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
        <span>🌟</span> On This Day
      </div>
      {memories.slice(0,2).map(m => (
        <div key={m.id} style={{ marginBottom:8, paddingBottom:8, borderBottom:"1px solid rgba(253,230,138,.4)" }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#b45309", marginBottom:3 }}>{fmtDateShort(m.date)}</div>
          <div style={{ fontSize:12, color:"#78350f", lineHeight:1.6 }}>
            {m.mood && <span style={{ marginRight:4 }}>{m.mood}</span>}
            {(m.content||"").slice(0,90)}{m.content?.length>90?"…":""}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTRY CARD (list item)
// ═══════════════════════════════════════════════════════════════════════════════
function EntryCard({ entry, onEdit, onDelete, isActive, onClick }) {
  const preview   = (entry.content||"").slice(0,130);
  const hasTrunc  = (entry.content||"").length > 130;
  const attachCnt = (entry.attachments||[]).length;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding:"18px 20px",
        borderRadius:16,
        border:"1.5px solid",
        borderColor: isActive ? "#16a34a" : hovered ? "#cbd5e1" : "#e2e8f0",
        background: isActive ? "#f0fdf4" : "#fff",
        cursor:"pointer",
        transition:"all .18s",
        marginBottom:10,
        boxShadow: isActive
          ? "0 4px 16px rgba(22,163,74,.10)"
          : hovered
          ? "0 4px 16px rgba(0,0,0,.07)"
          : "0 1px 3px rgba(0,0,0,.04)",
        position:"relative",
      }}
    >
      {/* Active indicator line */}
      {isActive && (
        <div style={{ position:"absolute", left:0, top:12, bottom:12, width:3, borderRadius:"0 3px 3px 0", background:"linear-gradient(180deg,#16a34a,#15803d)" }} />
      )}

      {/* Header row */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
            {entry.mood && <span style={{ fontSize:16 }}>{entry.mood}</span>}
            <span style={{ fontSize:11, fontWeight:600, color:"#94a3b8", letterSpacing:".02em" }}>{fmtDateShort(entry.date)}</span>
          </div>
          {entry.title && (
            <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:16, color:"#0f172a", lineHeight:1.3 }}>{entry.title}</div>
          )}
        </div>
        <div style={{ display:"flex", gap:4, opacity: hovered||isActive ? 1 : 0, transition:"opacity .15s" }} onClick={e => e.stopPropagation()}>
          <button onClick={() => onEdit(entry)} style={{ width:28, height:28, borderRadius:8, border:"1px solid #e2e8f0", background:"#f8fafc", color:"#475569", cursor:"pointer", fontSize:12, display:"flex", alignItems:"center", justifyContent:"center" }}>✏️</button>
          <button onClick={() => onDelete(entry.id)} style={{ width:28, height:28, borderRadius:8, border:"1px solid #fecaca", background:"#fff1f2", color:"#e11d48", cursor:"pointer", fontSize:12, display:"flex", alignItems:"center", justifyContent:"center" }}>🗑</button>
        </div>
      </div>

      {/* Preview text */}
      {preview && (
        <p style={{ fontSize:13, color:"#64748b", margin:"0 0 10px", lineHeight:1.65 }}>
          {preview}{hasTrunc && <span style={{ color:"#94a3b8" }}>…</span>}
        </p>
      )}

      {/* Footer row */}
      <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
        {entry.tags?.slice(0,3).map(t => <Chip key={t} tag={t} tiny />)}
        {attachCnt > 0 && (
          <span style={{ fontSize:10, fontWeight:600, color:"#64748b", background:"#f1f5f9", border:"1px solid #e2e8f0", borderRadius:99, padding:"2px 8px", marginLeft:"auto" }}>
            📎 {attachCnt}
          </span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTRY EDITOR MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function EntryEditor({ entry, onSave, onClose }) {
  const [form, setForm] = useState({
    date: todayStr(), title:"", content:"", tags:[], mood:"",
    ...entry,
    attachments: [...(entry?.attachments||[]), ...(entry?.images||[])],
  });
  const [tagInput, setTagInput] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [uploading, setUploading] = useState(0);
  const [error,    setError]    = useState("");
  // publicIds uploaded while this editor is open — discarded again on Cancel/remove
  const sessionUploads = useRef(new Set());
  const fileRef  = useRef(null);
  const areaRef  = useRef(null);

  useEffect(() => { areaRef.current?.focus(); }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]:v }));

  const addTag = (raw) => {
    const t = raw.startsWith("#") ? raw : `#${raw}`;
    if (t.length > 1 && !form.tags.includes(t)) set("tags", [...form.tags, t]);
    setTagInput("");
  };

  // Files are uploaded to the server straight away (no more base64 in localStorage).
  const readFiles = (fileList) => {
    setError("");
    Array.from(fileList).forEach(async (file) => {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setError(`"${file.name}" is larger than 10 MB and was not attached.`);
        return;
      }
      setUploading(n => n + 1);
      try {
        const { attachment } = await diaryAPI.uploadAttachment(file);
        sessionUploads.current.add(attachment.publicId);
        setForm(f => ({ ...f, attachments: [...f.attachments, attachment] }));
      } catch (e) {
        setError(e.message || `Could not upload "${file.name}".`);
      } finally {
        setUploading(n => n - 1);
      }
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  const discardUpload = (att) => {
    if (att?.publicId && sessionUploads.current.has(att.publicId)) {
      sessionUploads.current.delete(att.publicId);
      diaryAPI.discardAttachment(att).catch(() => {});
    }
  };

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); readFiles(e.dataTransfer.files); };
  const removeAttach = (i) => {
    discardUpload(form.attachments[i]);
    set("attachments", form.attachments.filter((_,j)=>j!==i));
  };

  const cancel = () => {
    form.attachments.forEach(discardUpload);
    onClose();
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await onSave(form);
      sessionUploads.current.clear();
    } catch (e) {
      setError(e.message || "Could not save the entry. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div style={{
      position:"fixed", inset:0,
      background:"rgba(15,23,42,.65)",
      backdropFilter:"blur(6px)",
      display:"flex", alignItems:"center", justifyContent:"center",
      zIndex:9999, padding:20,
    }} onClick={e => e.target===e.currentTarget && cancel()}>
      <div style={{
        background:"#fff",
        borderRadius:24,
        width:"100%", maxWidth:680,
        maxHeight:"92vh",
        overflow:"auto",
        boxShadow:"0 40px 120px rgba(0,0,0,.25), 0 0 0 1px rgba(0,0,0,.06)",
        display:"flex", flexDirection:"column",
      }}>

        {/* ── Modal header ── */}
        <div style={{
          padding:"22px 28px 18px",
          borderBottom:"1px solid #f1f5f9",
          display:"flex", justifyContent:"space-between", alignItems:"center",
          position:"sticky", top:0, background:"#fff", zIndex:2,
          borderRadius:"24px 24px 0 0",
        }}>
          <div>
            <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:20, color:"#0f172a" }}>
              {entry?.id ? "Edit Entry" : "New Entry"}
            </div>
            <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>
              {entry?.id ? "Make changes to your diary entry" : "Record your thoughts for today"}
            </div>
          </div>
          <button onClick={cancel} style={{ width:34, height:34, borderRadius:10, border:"1.5px solid #e2e8f0", background:"#f8fafc", cursor:"pointer", fontSize:16, color:"#64748b", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
        </div>

        <div style={{ padding:"24px 28px", display:"flex", flexDirection:"column", gap:20 }}>

          {/* Date + Title */}
          <div style={{ display:"grid", gridTemplateColumns:"160px 1fr", gap:12 }}>
            <div>
              <label style={{ fontSize:11, fontWeight:700, color:"#475569", letterSpacing:".06em", textTransform:"uppercase", display:"block", marginBottom:6 }}>Date</label>
              <input type="date" value={form.date} onChange={e => set("date",e.target.value)}
                style={{ width:"100%", padding:"9px 12px", borderRadius:10, border:"1.5px solid #e2e8f0", fontSize:13, fontFamily:"'DM Sans',sans-serif", color:"#0f172a", background:"#fafafa", boxSizing:"border-box", outline:"none" }} />
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:700, color:"#475569", letterSpacing:".06em", textTransform:"uppercase", display:"block", marginBottom:6 }}>Title <span style={{ opacity:.4, fontWeight:400 }}>(optional)</span></label>
              <input value={form.title} onChange={e => set("title",e.target.value)} placeholder="Give this entry a title…"
                style={{ width:"100%", padding:"9px 12px", borderRadius:10, border:"1.5px solid #e2e8f0", fontSize:13, fontFamily:"'DM Sans',sans-serif", color:"#0f172a", background:"#fafafa", boxSizing:"border-box", outline:"none" }} />
            </div>
          </div>

          {/* Mood */}
          <div>
            <label style={{ fontSize:11, fontWeight:700, color:"#475569", letterSpacing:".06em", textTransform:"uppercase", display:"block", marginBottom:10 }}>Mood</label>
            <MoodPicker value={form.mood} onChange={v => set("mood",v)} />
          </div>

          {/* Content */}
          <div>
            <label style={{ fontSize:11, fontWeight:700, color:"#475569", letterSpacing:".06em", textTransform:"uppercase", display:"block", marginBottom:6 }}>Entry</label>
            <textarea
              ref={areaRef}
              value={form.content}
              onChange={e => set("content",e.target.value)}
              placeholder="What's on your mind today?&#10;&#10;Reflect on your tasks, feelings, wins, or anything worth remembering…"
              rows={8}
              style={{
                width:"100%", padding:"14px 16px",
                borderRadius:12, border:"1.5px solid #e2e8f0",
                fontSize:14, fontFamily:"'DM Sans',sans-serif",
                color:"#1e293b", lineHeight:1.75,
                resize:"vertical", boxSizing:"border-box",
                outline:"none", background:"#fafafa",
                transition:"border-color .15s",
              }}
              onFocus={e => e.target.style.borderColor="#16a34a"}
              onBlur={e => e.target.style.borderColor="#e2e8f0"}
            />
          </div>

          {/* Tags */}
          <div>
            <label style={{ fontSize:11, fontWeight:700, color:"#475569", letterSpacing:".06em", textTransform:"uppercase", display:"block", marginBottom:10 }}>Tags</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
              {TAGS.map(t => {
                const active = form.tags.includes(t);
                const c = TAG_PALETTE[t] || {};
                return (
                  <button key={t} onClick={() => active ? set("tags",form.tags.filter(x=>x!==t)) : addTag(t)}
                    style={{
                      padding:"4px 12px", borderRadius:99, fontSize:11, fontWeight:700,
                      cursor:"pointer", fontFamily:"inherit", border:"1.5px solid",
                      borderColor: active ? c.border : "#e2e8f0",
                      background: active ? c.bg : "#fafafa",
                      color: active ? c.fg : "#64748b",
                      transition:"all .12s",
                    }}>
                    {active && "✓ "}{t}
                  </button>
                );
              })}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key==="Enter"&&tagInput.trim()) addTag(tagInput.trim()); }}
                placeholder="Add custom tag, press Enter…"
                style={{ flex:1, padding:"8px 12px", borderRadius:9, border:"1.5px solid #e2e8f0", fontSize:12, fontFamily:"inherit", outline:"none", background:"#fafafa" }} />
              <button onClick={() => tagInput.trim()&&addTag(tagInput.trim())}
                style={{ padding:"8px 16px", borderRadius:9, background:"#f0fdf4", border:"1.5px solid #bbf7d0", color:"#16a34a", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>Add</button>
            </div>
            {form.tags.length > 0 && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop:10 }}>
                {form.tags.map(t => <Chip key={t} tag={t} onRemove={() => set("tags",form.tags.filter(x=>x!==t))} />)}
              </div>
            )}
          </div>

          {/* Attachments */}
          <div>
            <label style={{ fontSize:11, fontWeight:700, color:"#475569", letterSpacing:".06em", textTransform:"uppercase", display:"block", marginBottom:6 }}>
              Attachments
              <span style={{ fontWeight:400, color:"#94a3b8", marginLeft:6, textTransform:"none", letterSpacing:0 }}>— images, PDFs, docs, videos, any file</span>
            </label>

            <input ref={fileRef} type="file" multiple onChange={e => readFiles(e.target.files)} style={{ display:"none" }} />

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border:`2px dashed ${dragOver ? "#16a34a" : "#cbd5e1"}`,
                borderRadius:14, padding:"22px 20px",
                textAlign:"center", cursor:"pointer",
                background: dragOver ? "#f0fdf4" : "#fafafa",
                transition:"all .15s",
                marginBottom: form.attachments.length > 0 ? 14 : 0,
              }}
            >
              <div style={{ marginBottom:8, display:"flex", justifyContent:"center" }}>
                <FolderIcon size={32} color={dragOver ? "#16a34a" : "#64748b"} />
              </div>
              <div style={{ fontSize:13, fontWeight:600, color: dragOver ? "#16a34a" : "#475569" }}>
                {dragOver ? "Release to attach files" : "Click to browse or drag & drop"}
              </div>
              <div style={{ fontSize:11, color:"#94a3b8", marginTop:4 }}>Images · PDFs · Word · Excel · Videos · Audio · Any type · max 10 MB each</div>
            </div>

            {/* Image previews */}
            {form.attachments.some(f=>isImg(f.name)) && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginBottom:10 }}>
                {form.attachments.map((f,i) => isImg(f.name) ? <ImgTile key={i} file={f} onRemove={() => removeAttach(i)} /> : null)}
              </div>
            )}

            {/* Non-image files */}
            {form.attachments.filter(f=>!isImg(f.name)).length > 0 && (
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {form.attachments.map((f,i) => !isImg(f.name) ? (
                  <FileRow key={i} file={f} onRemove={() => removeAttach(i)} />
                ) : null)}
              </div>
            )}

            {form.attachments.length > 0 && (
              <div style={{ fontSize:11, color:"#94a3b8", marginTop:8 }}>
                {form.attachments.length} file{form.attachments.length>1?"s":""} attached
              </div>
            )}
            {uploading > 0 && (
              <div style={{ fontSize:11, color:"#16a34a", fontWeight:600, marginTop:8 }}>
                Uploading {uploading} file{uploading>1?"s":""}…
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding:"16px 28px 24px",
          borderTop:"1px solid #f1f5f9",
          display:"flex", justifyContent:"flex-end", gap:10,
          position:"sticky", bottom:0, background:"#fff",
          borderRadius:"0 0 24px 24px",
        }}>
          <button onClick={cancel} style={{ padding:"10px 24px", borderRadius:11, border:"1.5px solid #e2e8f0", background:"#f8fafc", color:"#475569", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
          {error && (
            <div style={{ marginRight:"auto", alignSelf:"center", fontSize:12, color:"#e11d48", fontWeight:600 }}>{error}</div>
          )}
          <button onClick={handleSave} disabled={saving || uploading > 0} style={{
            padding:"10px 28px", borderRadius:11, border:"none",
            background: (saving || uploading > 0) ? "#86efac" : "linear-gradient(135deg,#16a34a,#15803d)",
            color:"#fff", fontSize:13, fontWeight:700,
            cursor: (saving || uploading > 0) ? "default" : "pointer",
            fontFamily:"inherit",
            boxShadow:"0 4px 14px rgba(22,163,74,.3)",
            transition:"all .15s",
          }}>
            {saving ? "Saving…" : uploading > 0 ? "Uploading…" : entry?.id ? "Save Changes" : "Save Entry"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTRY DETAIL (right panel / day view)
// ═══════════════════════════════════════════════════════════════════════════════
function EntryDetail({ entry, onEdit, onDelete }) {
  if (!entry) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", minHeight:320, color:"#94a3b8" }}>
      <div style={{ marginBottom:14, opacity:.4 }}><FolderIcon size={44} color="#94a3b8" /></div>
      <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:18, color:"#cbd5e1", marginBottom:6 }}>No entry selected</div>
      <div style={{ fontSize:13, color:"#94a3b8" }}>Click a date on the calendar or an entry in the list</div>
    </div>
  );

  const attachments = entry.attachments || entry.images || [];
  const dlFile = (f) => openAttachment(f);

  return (
    <div style={{ padding:"28px 32px", height:"100%", overflowY:"auto" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
            {entry.mood && <span style={{ fontSize:20 }}>{entry.mood}</span>}
            <span style={{ fontSize:12, fontWeight:600, color:"#94a3b8", letterSpacing:".03em" }}>{fmtDate(entry.date)}</span>
          </div>
          {entry.title
            ? <h2 style={{ fontFamily:"'DM Serif Display',serif", fontSize:26, color:"#0f172a", margin:0, lineHeight:1.25 }}>{entry.title}</h2>
            : <h2 style={{ fontFamily:"'DM Serif Display',serif", fontSize:20, color:"#94a3b8", margin:0, fontStyle:"italic" }}>Untitled</h2>
          }
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => onEdit(entry)} style={{
            padding:"7px 16px", borderRadius:9, border:"1.5px solid #e2e8f0", background:"#f8fafc",
            color:"#475569", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit",
            display:"flex", alignItems:"center", gap:5,
          }}>✏️ Edit</button>
          <button onClick={() => onDelete(entry.id)} style={{
            padding:"7px 16px", borderRadius:9, border:"1.5px solid #fecdd3", background:"#fff1f2",
            color:"#e11d48", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit",
            display:"flex", alignItems:"center", gap:5,
          }}>🗑 Delete</button>
        </div>
      </div>

      {/* Tags */}
      {entry.tags?.length > 0 && (
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:20 }}>
          {entry.tags.map(t => <Chip key={t} tag={t} />)}
        </div>
      )}

      {/* Divider */}
      <div style={{ height:1, background:"linear-gradient(to right,#e2e8f0,transparent)", marginBottom:20 }} />

      {/* Content */}
      <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:15, color:"#334155", lineHeight:1.85, whiteSpace:"pre-wrap", margin:"0 0 24px" }}>
        {entry.content || <em style={{ color:"#cbd5e1" }}>No content written.</em>}
      </p>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:"#475569", letterSpacing:".08em", textTransform:"uppercase", marginBottom:14, display:"flex", alignItems:"center", gap:6 }}>
            <span>📎</span> Attachments ({attachments.length})
          </div>

          {/* Image grid */}
          {attachments.some(f=>isImg(f.name)) && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))", gap:10, marginBottom:14 }}>
              {attachments.filter(f=>isImg(f.name)).map((f,i) => (
                <div key={i} style={{ borderRadius:12, overflow:"hidden", aspectRatio:"1", boxShadow:"0 2px 10px rgba(0,0,0,.10)", cursor:"pointer" }}
                  onClick={() => openAttachment(f)} title="Click to open full size">
                  <img src={attachmentSrc(f)} alt={f.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                </div>
              ))}
            </div>
          )}

          {/* Non-image rows */}
          {attachments.filter(f=>!isImg(f.name)).length > 0 && (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {attachments.filter(f=>!isImg(f.name)).map((f,i) => (
                <FileRow key={i} file={f} onDownload={() => dlFile(f)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function DiaryPage() {
  const [entries,       setEntries]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [loadError,     setLoadError]     = useState("");
  const [legacyEntries, setLegacyEntries] = useState(() => readLegacyEntries());
  const [importing,     setImporting]     = useState(false);
  const [showEditor,    setShowEditor]    = useState(false);
  const [editEntry,     setEditEntry]     = useState(null);
  const [selectedDate,  setSelectedDate]  = useState(todayStr());
  const [search,        setSearch]        = useState("");
  const [filterTag,     setFilterTag]     = useState("");
  const [view,          setView]          = useState("list"); // list | day
  const [toast,         setToast]         = useState(null);
  const [deleteId,      setDeleteId]      = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const d = await diaryAPI.list();
      setEntries(byDateDesc((d.entries || []).map(norm)));
    } catch (e) {
      setLoadError(e.message || "Could not load your diary.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // Errors are thrown back to the editor so it can show them and stay open.
  const save = async (form) => {
    const payload = {
      date: form.date, title: form.title || "", content: form.content || "",
      mood: form.mood || "", tags: form.tags || [], attachments: form.attachments || [],
    };
    if (form.id) {
      const d = await diaryAPI.update(form.id, payload);
      setEntries(es => byDateDesc(es.map(e => e.id===form.id ? norm(d.entry) : e)));
      setToast({ msg:"Entry updated", ok:true });
    } else {
      const d = await diaryAPI.create(payload);
      setEntries(es => byDateDesc([norm(d.entry), ...es]));
      setToast({ msg:"Entry saved", ok:true });
    }
    setShowEditor(false);
    setEditEntry(null);
  };

  const del = async (id) => {
    try {
      await diaryAPI.remove(id);
      setEntries(es => es.filter(e => e.id!==id));
      setToast({ msg:"Entry deleted", ok:false });
    } catch (e) {
      setToast({ msg: e.message || "Could not delete the entry", ok:false });
    }
    setDeleteId(null);
  };

  // One-time import of entries from the old browser-only diary.
  const importLegacy = async () => {
    setImporting(true);
    const alreadyImported = new Set(entries.map(e => e.legacyId).filter(Boolean));
    let imported = 0, failed = 0, skippedFiles = 0;

    for (const old of legacyEntries) {
      const legacyId = old?.id ? String(old.id) : "";
      if (legacyId && alreadyImported.has(legacyId)) continue;
      try {
        const attachments = [];
        for (const f of [...(old.attachments || []), ...(old.images || [])]) {
          if (!f?.data) continue;
          try {
            const blob = dataUrlToBlob(f.data);
            if (blob.size > MAX_ATTACHMENT_BYTES) { skippedFiles++; continue; }
            const file = new File([blob], f.name || "attachment", { type: f.type || blob.type });
            const { attachment } = await diaryAPI.uploadAttachment(file);
            attachments.push(attachment);
          } catch { skippedFiles++; }
        }
        await diaryAPI.create({
          date: old.date || todayStr(), title: old.title || "", content: old.content || "",
          mood: old.mood || "", tags: old.tags || [], attachments,
          legacyId: legacyId || undefined,
        });
        imported++;
      } catch { failed++; }
    }

    if (failed === 0) { clearLegacyEntries(); setLegacyEntries([]); }
    await load();
    setImporting(false);
    setToast({
      ok: failed === 0,
      msg: failed
        ? `Imported ${imported}, ${failed} failed — try again`
        : `Imported ${imported} entr${imported===1?"y":"ies"}${skippedFiles ? ` (${skippedFiles} file(s) skipped)` : ""}`,
    });
  };

  const dismissLegacy = () => {
    if (!window.confirm("Remove the old diary entries stored in this browser? They will not be imported into your account.")) return;
    clearLegacyEntries();
    setLegacyEntries([]);
  };

  const openNew  = () => { setEditEntry({ date:selectedDate }); setShowEditor(true); };
  const openEdit = (e) => { setEditEntry(e); setShowEditor(true); };

  const filtered = entries.filter(e => {
    if (search && !e.content?.toLowerCase().includes(search.toLowerCase()) && !e.title?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterTag && !e.tags?.includes(filterTag)) return false;
    return true;
  });

  const activeEntry = entries.find(e => e.date===selectedDate);

  return (
    <>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600;700&display=swap');

        .diary-root * { box-sizing: border-box; }
        .diary-root { font-family: 'DM Sans', sans-serif; }

        .diary-sidebar-card {
          background: #fff;
          border: 1.5px solid #e2e8f0;
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 1px 4px rgba(0,0,0,.04);
        }

        .diary-panel {
          background: #fff;
          border: 1.5px solid #e2e8f0;
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 1px 4px rgba(0,0,0,.04);
        }

        .tab-btn {
          padding: 8px 18px;
          border-radius: 9px;
          border: 1.5px solid;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          transition: all .15s;
          letter-spacing: .01em;
        }

        .new-entry-btn {
          padding: 10px 22px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #16a34a, #15803d);
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          box-shadow: 0 4px 16px rgba(22,163,74,.28);
          transition: all .18s;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .new-entry-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(22,163,74,.36);
        }

        .search-field {
          width: 100%;
          padding: 9px 12px 9px 38px;
          border-radius: 10px;
          border: 1.5px solid #e2e8f0;
          font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          color: #1e293b;
          background: #fafafa;
          outline: none;
          transition: border-color .15s;
        }
        .search-field:focus { border-color: #86efac; background: #fff; }

        .tag-filter-btn {
          padding: 4px 12px;
          border-radius: 99px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          border: 1.5px solid;
          transition: all .12s;
        }

        /* Toast */
        @keyframes slideUp {
          from { opacity:0; transform: translateY(12px); }
          to   { opacity:1; transform: translateY(0); }
        }

        /* Scrollbar */
        .diary-scroll::-webkit-scrollbar { width: 4px; }
        .diary-scroll::-webkit-scrollbar-track { background: transparent; }
        .diary-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
        .diary-scroll:hover::-webkit-scrollbar-thumb { background: #cbd5e1; }
      `}</style>

      <div className="diary-root">

        {/* ── Toast ── */}
        {toast && (
          <div style={{
            position:"fixed", bottom:28, right:28, zIndex:10000,
            padding:"12px 22px", borderRadius:12, fontSize:13, fontWeight:600,
            background: toast.ok ? "#15803d" : "#475569",
            color:"#fff", boxShadow:"0 8px 28px rgba(0,0,0,.2)",
            animation:"slideUp .3s ease",
            display:"flex", alignItems:"center", gap:8,
          }}>
            {toast.ok ? <CheckCircleIcon size={16} color="#fff" /> : <TrashIcon size={16} color="#fff" />} {toast.msg}
          </div>
        )}

        {/* ── Confirm Delete ── */}
        {deleteId && (
          <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,.6)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 }}>
            <div style={{ background:"#fff", borderRadius:20, padding:"32px 28px", maxWidth:380, width:"100%", boxShadow:"0 40px 100px rgba(0,0,0,.25)", textAlign:"center" }}>
              <div style={{ marginBottom:14, display:"flex", justifyContent:"center" }}><TrashIcon size={40} color="#e11d48" /></div>
              <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:20, color:"#0f172a", marginBottom:8 }}>Delete this entry?</div>
              <p style={{ fontSize:13, color:"#64748b", marginBottom:24, lineHeight:1.6 }}>This diary entry and all its attachments will be permanently removed. This action cannot be undone.</p>
              <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
                <button onClick={() => setDeleteId(null)} style={{ padding:"10px 24px", borderRadius:11, border:"1.5px solid #e2e8f0", background:"#f8fafc", color:"#475569", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
                <button onClick={() => del(deleteId)} style={{ padding:"10px 24px", borderRadius:11, border:"none", background:"#e11d48", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 4px 14px rgba(225,29,72,.3)" }}>Yes, Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Editor ── */}
        {showEditor && (
          <EntryEditor entry={editEntry} onSave={save} onClose={() => { setShowEditor(false); setEditEntry(null); }} />
        )}

        {/* ── Page header ── */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:24, flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:28, color:"#0f172a", lineHeight:1.2, marginBottom:4 }}>
              My Diary
            </div>
            <div style={{ fontSize:13, color:"#94a3b8" }}>
              {loading ? "Loading…" : <>{entries.length} {entries.length===1?"entry":"entries"} · Private &amp; personal</>}
            </div>
          </div>
          <button className="new-entry-btn" onClick={openNew}>
            + New Entry
          </button>
        </div>

        {/* ── Load error ── */}
        {loadError && (
          <div style={{ marginBottom:16, padding:"12px 16px", borderRadius:12, background:"#fff1f2", border:"1.5px solid #fecdd3", color:"#be123c", fontSize:13, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
            <span>{loadError}</span>
            <button onClick={load} style={{ padding:"6px 14px", borderRadius:9, border:"1px solid #fecdd3", background:"#fff", color:"#be123c", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Retry</button>
          </div>
        )}

        {/* ── Old browser-only diary found: offer import ── */}
        {!loading && !loadError && legacyEntries.length > 0 && (
          <div style={{ marginBottom:16, padding:"14px 16px", borderRadius:12, background:"#f0fdf4", border:"1.5px solid #bbf7d0", color:"#166534", fontSize:13, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
            <span>
              Found <strong>{legacyEntries.length}</strong> diary entr{legacyEntries.length===1?"y":"ies"} saved only in this browser by the old diary.
              Import them into your account, or remove them if they belong to someone else who used this browser.
            </span>
            <span style={{ display:"flex", gap:8 }}>
              <button onClick={dismissLegacy} disabled={importing} style={{ padding:"7px 14px", borderRadius:9, border:"1px solid #bbf7d0", background:"#fff", color:"#475569", fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Not mine — remove</button>
              <button onClick={importLegacy} disabled={importing} style={{ padding:"7px 16px", borderRadius:9, border:"none", background:"#16a34a", color:"#fff", fontWeight:700, cursor: importing ? "default" : "pointer", fontFamily:"inherit" }}>{importing ? "Importing…" : "Import to my account"}</button>
            </span>
          </div>
        )}

        {/* ── Main layout ── */}
        <div style={{ display:"grid", gridTemplateColumns:"280px 1fr 340px", gap:20, alignItems:"start" }}>

          {/* ══ LEFT SIDEBAR ══ */}
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

            {/* Calendar */}
            <div className="diary-sidebar-card">
              <div style={{ padding:"16px 16px 20px" }}>
                <MiniCalendar entries={entries} selected={selectedDate} onSelect={d => { setSelectedDate(d); setView("day"); }} />
              </div>
            </div>

            {/* On This Day */}
            <OnThisDay entries={entries} />

            {/* Tag filter */}
            <div className="diary-sidebar-card">
              <div style={{ padding:"14px 16px", borderBottom:"1px solid #f1f5f9" }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", letterSpacing:".08em", textTransform:"uppercase" }}>Filter by Tag</div>
              </div>
              <div style={{ padding:"12px 16px", display:"flex", flexWrap:"wrap", gap:6 }}>
                <button onClick={() => setFilterTag("")} className="tag-filter-btn" style={{
                  borderColor: !filterTag ? "#16a34a" : "#e2e8f0",
                  background: !filterTag ? "#f0fdf4" : "#fafafa",
                  color: !filterTag ? "#16a34a" : "#64748b",
                }}>All</button>
                {Object.keys(TAG_PALETTE).map(t => {
                  const c = TAG_PALETTE[t];
                  const active = filterTag===t;
                  return (
                    <button key={t} onClick={() => setFilterTag(active?"":t)} className="tag-filter-btn" style={{
                      borderColor: active ? c.border : "#e2e8f0",
                      background: active ? c.bg : "#fafafa",
                      color: active ? c.fg : "#64748b",
                    }}>{t}</button>
                  );
                })}
              </div>
            </div>

            {/* Analytics */}
            <div className="diary-sidebar-card">
              <div style={{ padding:"14px 16px", borderBottom:"1px solid #f1f5f9" }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", letterSpacing:".08em", textTransform:"uppercase" }}>Analytics</div>
              </div>
              <div style={{ padding:"16px" }}>
                <Analytics entries={entries} />
              </div>
            </div>
          </div>

          {/* ══ MIDDLE — Entry list ══ */}
          <div>
            {/* Search + view toggle */}
            <div style={{ display:"flex", gap:10, marginBottom:16, alignItems:"center" }}>
              <div style={{ flex:1, position:"relative" }}>
                <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:14, color:"#94a3b8" }}>🔍</span>
                <input className="search-field" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entries…" />
              </div>
              {[{ v:"list", label:"List" }, { v:"day", label:"Day View" }].map(({ v, label }) => (
                <button key={v} className="tab-btn" onClick={() => setView(v)} style={{
                  borderColor: view===v ? "#16a34a" : "#e2e8f0",
                  background: view===v ? "#f0fdf4" : "#fafafa",
                  color: view===v ? "#16a34a" : "#64748b",
                }}>{label}</button>
              ))}
            </div>

            {/* Date banner */}
            <div style={{
              padding:"10px 16px", borderRadius:12,
              background:"#f8fafc", border:"1.5px solid #e2e8f0",
              marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center",
            }}>
              <span style={{ fontSize:12, fontWeight:600, color:"#475569" }}>📅 {fmtDate(selectedDate)}</span>
              {!activeEntry && (
                <button onClick={openNew} style={{ fontSize:12, fontWeight:700, color:"#16a34a", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit" }}>+ Write entry for this day</button>
              )}
            </div>

            {/* Entries */}
            {filtered.length === 0 ? (
              <div style={{ textAlign:"center", padding:"60px 20px" }}>
                <div style={{ fontSize:48, marginBottom:14, opacity:.3 }}>📭</div>
                <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:20, color:"#cbd5e1", marginBottom:8 }}>
                  {search||filterTag ? "No matching entries" : "Your diary is empty"}
                </div>
                <div style={{ fontSize:13, color:"#94a3b8", marginBottom:24 }}>
                  {search||filterTag ? "Try different search terms or filters" : "Start by writing your first entry"}
                </div>
                {!search && !filterTag && (
                  <button className="new-entry-btn" onClick={openNew} style={{ margin:"0 auto" }}>✨ Write First Entry</button>
                )}
              </div>
            ) : (
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", letterSpacing:".08em", textTransform:"uppercase", marginBottom:12 }}>
                  {filtered.length} {filtered.length===1?"entry":"entries"}
                </div>
                {filtered.map(e => (
                  <EntryCard
                    key={e.id} entry={e}
                    isActive={e.date===selectedDate && view==="day"}
                    onClick={() => { setSelectedDate(e.date); setView("day"); }}
                    onEdit={openEdit}
                    onDelete={id => setDeleteId(id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ══ RIGHT — Detail panel ══ */}
          <div className="diary-panel" style={{ position:"sticky", top:20, minHeight:400 }}>
            <EntryDetail
              entry={activeEntry}
              onEdit={openEdit}
              onDelete={id => setDeleteId(id)}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default DiaryPage;