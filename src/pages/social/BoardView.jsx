// pages/social/BoardView.jsx – posts grouped by where they are in the workflow.
import { BOARD_COLUMNS } from "./constants";
import PostCard from "./PostCard";

export default function BoardView({ posts, onOpen }) {
  return (
    <div className="sm-board">
      {BOARD_COLUMNS.map(col => {
        const items = posts.filter(p => col.statuses.includes(p.status));
        return (
          <section key={col.key} className={`sm-col sm-col--${col.key}`} aria-label={`${col.title}, ${items.length} posts`}>
            <div className="sm-col-head">
              <span className="sm-col-title">{col.title}</span>
              <span className="sm-col-n">{items.length}</span>
            </div>
            {items.length === 0
              ? <div className="sm-col-empty">Nothing here.</div>
              : items.map(p => <PostCard key={p._id} post={p} onOpen={onOpen} />)}
          </section>
        );
      })}
    </div>
  );
}
