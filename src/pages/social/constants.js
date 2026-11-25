// pages/social/constants.js
export const PLATFORMS = ["Instagram", "Facebook", "Twitter", "LinkedIn", "TikTok", "YouTube", "Other"];

// color: thin stripe/dot only. limit: caption length the platform allows.
export const PLATFORM = {
  Instagram: { label: "Instagram", short: "IG", color: "#d62976", limit: 2200 },
  Facebook:  { label: "Facebook",  short: "FB", color: "#1877f2", limit: 63206 },
  Twitter:   { label: "X (Twitter)", short: "X", color: "#14171a", limit: 280 },
  LinkedIn:  { label: "LinkedIn",  short: "in", color: "#0a66c2", limit: 3000 },
  TikTok:    { label: "TikTok",    short: "TT", color: "#00a3a3", limit: 2200 },
  YouTube:   { label: "YouTube",   short: "YT", color: "#e62117", limit: 5000 },
  Other:     { label: "Other",     short: "•",  color: "#6b7280", limit: null },
};

// User-facing names for the workflow statuses.
export const STATUS = {
  "Planned":          { label: "To do",                tone: "todo" },
  "Rejected":         { label: "Needs changes",        tone: "changes" },
  "Pending Approval": { label: "Waiting for approval", tone: "waiting" },
  "Approved":         { label: "Ready to post",        tone: "ready" },
  "Posted":           { label: "Posted",               tone: "posted" },
  "Reviewed":         { label: "Results added",        tone: "results" },
  "Missed":           { label: "Missed",               tone: "missed" },
};

export const BOARD_COLUMNS = [
  { key: "todo",    title: "To do",                statuses: ["Planned", "Rejected"] },
  { key: "waiting", title: "Waiting for approval", statuses: ["Pending Approval"] },
  { key: "ready",   title: "Ready to post",        statuses: ["Approved"] },
  { key: "posted",  title: "Posted",               statuses: ["Posted", "Reviewed"] },
  { key: "missed",  title: "Missed",               statuses: ["Missed"] },
];

export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

const pad = (n) => String(n).padStart(2, "0");
export const localISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return localISO(d); };
export const startOfWeek = (iso) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() - d.getDay()); return localISO(d); };
export const dayOf = (post) => (post?.plannedPostDate || "").slice(0, 10);

export const fmtDay = (iso, opts = { weekday: "short", day: "numeric", month: "short" }) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", opts) : "";
export const fmtTime = (hhmm) => {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
};
export const fmtWhen = (post) => {
  const day = dayOf(post);
  const today = localISO();
  const label = day === today ? "Today" : day === addDays(today, 1) ? "Tomorrow" : day === addDays(today, -1) ? "Yesterday" : fmtDay(day);
  return post.plannedTime ? `${label}, ${fmtTime(post.plannedTime)}` : label;
};
export const fmtStamp = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";

export const initials = (name = "") => name.split(" ").filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
export const idOf = (v) => String(v?._id || v || "");
export const projectName = (p) => p?.socialProject?.name || p?.title || "Untitled project";
