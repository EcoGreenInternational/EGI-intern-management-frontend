// components/shared/NotificationBell.jsx – in-app notifications for everyone.
import { useCallback, useEffect, useRef, useState } from "react";
import useSocket from "../../hooks/useSocket";
import { notificationApi, pendingOpen, OPEN_POST_EVENT, NOTIFICATION_EVENT } from "../../pages/social/socialApi";
import "./notificationBell.css";

const ICON = {
  content_assigned: "📝", approval_requested: "⏳", content_approved: "✅", content_rejected: "↩️",
  content_comment: "💬", missed_post: "⚠️", performance_due: "📊", performance_submitted: "📈",
};

const ago = (d) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24); if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

export default function NotificationBell({ onNavigate }) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { onMessage } = useSocket();

  const load = useCallback(() => {
    notificationApi.list().then(d => { setItems(d.notifications || []); setUnread(d.unread || 0); }).catch(() => {});
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);
  useEffect(() => onMessage("notification", () => { load(); window.dispatchEvent(new Event(NOTIFICATION_EVENT)); }), [onMessage, load]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const openItem = async (n) => {
    setOpen(false);
    if (!n.isRead) {
      setItems(list => list.map(x => (x._id === n._id ? { ...x, isRead: true } : x)));
      setUnread(u => Math.max(0, u - 1));
      notificationApi.read(n._id).catch(() => {});
    }
    if (n.relatedModel === "SocialContent" && n.relatedId) {
      pendingOpen.id = n.relatedId;
      onNavigate?.("social");
      window.dispatchEvent(new CustomEvent(OPEN_POST_EVENT, { detail: { id: n.relatedId } }));
    }
  };

  const readAll = async () => {
    setItems(list => list.map(x => ({ ...x, isRead: true }))); setUnread(0);
    notificationApi.readAll().catch(load);
  };

  return (
    <div className="nb" ref={ref}>
      <button className="nb-btn" onClick={() => { setOpen(o => !o); if (!open) load(); }} aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && <span className="nb-badge">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="nb-panel" role="dialog" aria-label="Notifications">
          <div className="nb-head">
            <strong>Notifications</strong>
            {unread > 0 && <button className="nb-link" onClick={readAll}>Mark all as read</button>}
          </div>
          <div className="nb-list">
            {items.length === 0 ? <div className="nb-empty">You're all caught up. Updates about your posts show up here.</div> : items.map(n => (
              <button key={n._id} className={`nb-item${n.isRead ? "" : " nb-unread"}`} onClick={() => openItem(n)}>
                <span className="nb-icon" aria-hidden="true">{ICON[n.type] || "🔔"}</span>
                <span>
                  <div className="nb-text">{n.message}</div>
                  <div className="nb-time">{ago(n.createdAt)}</div>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
