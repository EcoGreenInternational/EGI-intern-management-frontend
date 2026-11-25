// pages/social/PostCard.jsx – a post on the board.
import { PLATFORM, fmtWhen, projectName } from "./constants";
import { Avatar, StatusPill } from "./ui";

export default function PostCard({ post, onOpen, showStatus = false }) {
  const plat = PLATFORM[post.platform] || PLATFORM.Other;
  const image = (post.media || []).find(m => m.resourceType === "image");
  const overdue = post.dueAt && new Date(post.dueAt) < new Date() && !["Posted", "Reviewed", "Missed"].includes(post.status);
  const text = post.caption || post.contentDescription;
  return (
    <button className="sm-card" style={{ "--plat": plat.color }} onClick={() => onOpen(post)}
      aria-label={`${projectName(post)}, ${plat.label}, ${fmtWhen(post)}`}>
      <div className="sm-card-top">
        <span className={`sm-card-when${overdue ? " sm-overdue" : ""}`}>{fmtWhen(post)}</span>
        <span className="sm-plat"><span className="sm-dot" style={{ background: plat.color }} aria-hidden="true" />{plat.short}</span>
      </div>
      <span className="sm-card-project" title={projectName(post)}>{projectName(post)}</span>
      {image && <img className="sm-card-thumb" src={image.url} alt="" loading="lazy" />}
      <div className={`sm-card-text${post.caption ? "" : " sm-empty-text"}`}>
        {post.caption ? text : post.contentDescription ? `Brief: ${post.contentDescription}` : "No caption yet"}
      </div>
      <div className="sm-card-foot">
        <span className="sm-card-icons">
          {post.commentCount > 0 && <span title={`${post.commentCount} comments`}>💬 {post.commentCount}</span>}
          {post.status === "Rejected" && <span className="sm-flag">Needs changes</span>}
          {post.routine && <span className="sm-flag sm-flag--routine">Routine</span>}
          {post.postedLate && <span className="sm-flag">Late</span>}
        </span>
        {showStatus ? <StatusPill status={post.status} /> : <Avatar person={post.assignedTo} />}
      </div>
    </button>
  );
}
