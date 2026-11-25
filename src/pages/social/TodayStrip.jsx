// pages/social/TodayStrip.jsx – what needs posting today, in time order.
import { PLATFORM, fmtDay, fmtTime, localISO, projectName } from "./constants";
import { Avatar, StatusPill } from "./ui";

// The single next step for a post, from the viewer's point of view.
export function nextStep(post) {
  const a = post.allowed || {};
  if (a.approve && post.status === "Pending Approval") return "Review";
  if (post.status === "Rejected" && a.edit) return "Fix and resend";
  if (a.submit && !post.caption && !(post.media || []).length) return "Write caption";
  if (a.submit) return "Send for approval";
  if (a.markPosted && post.status !== "Missed") return "Mark as posted";
  if (a.addMetrics && post.status === "Posted") return "Add results";
  return "Open";
}

export default function TodayStrip({ posts, onOpen, canPlan, onPlan, loading }) {
  const today = localISO();
  const sorted = [...posts].sort((a, b) => (a.plannedTime || "99").localeCompare(b.plannedTime || "99"));
  const done = sorted.filter(p => ["Posted", "Reviewed"].includes(p.status)).length;

  return (
    <section className="sm-today" aria-label="Today's posts">
      <div className="sm-today-head">
        <div className="sm-today-title">
          {loading ? "Today" : sorted.length === 0 ? "Nothing to post today" : `${sorted.length} post${sorted.length > 1 ? "s" : ""} today, ${done} done`}
        </div>
        <div className="sm-today-date">{fmtDay(today, { weekday: "long", day: "numeric", month: "long" })}</div>
      </div>
      {sorted.length === 0 ? (
        !loading && (
          <div className="sm-today-empty">
            Planned and routine posts for today show up here.
            {canPlan && <button className="sm-btn sm-btn--sm" onClick={onPlan}>Plan a post</button>}
          </div>
        )
      ) : (
        <div className="sm-today-row">
          {sorted.map(p => {
            const plat = PLATFORM[p.platform] || PLATFORM.Other;
            const [time, ampm] = p.plannedTime ? fmtTime(p.plannedTime).split(" ") : ["Any time", ""];
            return (
              <button key={p._id} className="sm-today-card" style={{ "--plat": plat.color }} onClick={() => onOpen(p)}>
                <div className="sm-today-time">{time}{ampm && <small>{ampm}</small>}</div>
                <div className="sm-today-meta">
                  <span>{plat.label}</span><span aria-hidden="true">/</span><span>{projectName(p)}</span>
                </div>
                <div className="sm-today-caption">{p.caption || p.contentDescription || "No caption yet"}</div>
                <div className="sm-today-foot">
                  <StatusPill status={p.status} />
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 650, color: "#fff" }}>{nextStep(p)}</span>
                    <Avatar person={p.assignedTo} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
