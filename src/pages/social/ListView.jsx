// pages/social/ListView.jsx – every post in date order.
import { PLATFORM, fmtWhen, projectName } from "./constants";
import { Avatar, StatusPill } from "./ui";

export default function ListView({ posts, onOpen }) {
  return (
    <div className="sm-list" role="table" aria-label="Posts">
      <div className="sm-row sm-row--head" role="row">
        <span>When</span><span>Post</span><span className="sm-hide-md">Platform</span><span>Person</span><span>Status</span><span className="sm-hide-md">Results</span>
      </div>
      {posts.map(p => (
        <button key={p._id} className="sm-row" role="row" onClick={() => onOpen(p)}>
          <span>{fmtWhen(p)}</span>
          <span className="sm-row-post">
            <strong>{projectName(p)}</strong>
            <span>{p.caption || p.contentDescription || "No caption yet"}</span>
          </span>
          <span className="sm-hide-md"><span className="sm-plat"><span className="sm-dot" style={{ background: (PLATFORM[p.platform] || PLATFORM.Other).color }} />{(PLATFORM[p.platform] || PLATFORM.Other).label}</span></span>
          <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <Avatar person={p.assignedTo} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.assignedTo?.name}</span>
          </span>
          <span className="sm-row-status"><StatusPill status={p.status} /></span>
          <span className="sm-hide-md sm-results">
            {p.metrics?.performanceScore > 0 ? `${p.metrics.views.toLocaleString()} views, ${p.metrics.engagementRate}% eng.` : "—"}
          </span>
        </button>
      ))}
    </div>
  );
}
