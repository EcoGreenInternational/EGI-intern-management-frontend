// pages/social/ui.jsx – small building blocks shared by the Social section.
import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { resolveImageUrl } from "../../utils/api";
import { PLATFORM, STATUS, initials } from "./constants";

export function StatusPill({ status }) {
  const s = STATUS[status] || { label: status, tone: "todo" };
  return <span className={`sm-pill sm-tone-${s.tone}`}>{s.label}</span>;
}

export function Avatar({ person, size }) {
  if (!person) return null;
  const src = person.profilePicture ? resolveImageUrl(person.profilePicture) : null;
  return (
    <span className={`sm-avatar${size === "lg" ? " sm-avatar--lg" : ""}`} style={{ background: person.avatarColor || "#3c5246" }} title={person.name}>
      {src ? <img src={src} alt="" /> : initials(person.name)}
    </span>
  );
}

export function Platform({ name, showLabel = true }) {
  const p = PLATFORM[name] || PLATFORM.Other;
  return (
    <span className="sm-plat">
      <span className="sm-dot" style={{ background: p.color }} aria-hidden="true" />
      {showLabel ? p.label : <span className="sr-only">{p.label}</span>}
    </span>
  );
}

export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const show = useCallback((msg, type = "ok") => {
    clearTimeout(timer.current);
    setToast({ msg, type });
    timer.current = setTimeout(() => setToast(null), type === "error" ? 6000 : 3000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const node = toast ? createPortal(
    <div className={`sm sm-toast${toast.type === "error" ? " sm-toast--error" : ""}`} role="status">
      {toast.msg}
      <button className="sm-btn sm-btn--ghost sm-btn--sm" style={{ color: "#fff" }} onClick={() => setToast(null)} aria-label="Dismiss">✕</button>
    </div>, document.body
  ) : null;
  return [node, show];
}

// Closes on Escape; restores focus to what was focused before.
export function useEscape(onClose) {
  useEffect(() => {
    const prev = document.activeElement;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [onClose]);
}

export function Dialog({ title, onClose, children, footer, width }) {
  useEscape(onClose);
  return createPortal(
    <div className="sm">
      <div className="sm-scrim" onClick={onClose} />
      <div className="sm-dialog" onMouseDown={e => e.target === e.currentTarget && onClose()}>
        <div className="sm-dialog-card" role="dialog" aria-modal="true" aria-label={title} style={width ? { width: `min(${width}px, 100%)` } : undefined}>
          <div className="sm-dialog-head">
            <h2>{title}</h2>
            <button className="sm-btn sm-btn--ghost sm-icon-btn" onClick={onClose} aria-label="Close">✕</button>
          </div>
          <div className="sm-dialog-body">{children}</div>
          {footer && <div className="sm-dialog-foot">{footer}</div>}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function DaysMini({ days = [] }) {
  const letters = ["S", "M", "T", "W", "T", "F", "S"];
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return (
    <span className="sm-days-mini" aria-label={`Posts on ${days.map(d => names[d]).join(", ")}`}>
      {letters.map((l, i) => <span key={i} className={days.includes(i) ? "sm-on" : ""}>{l}</span>)}
    </span>
  );
}
