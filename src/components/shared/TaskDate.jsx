// components/shared/TaskDate.jsx
// Date cell for task tables: a leave range is shown as one entry ("from → to").
import { isLeaveRange, leaveDayCount } from "../../utils/helpers";

const fmt = (s) =>
  new Date(`${s}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export default function TaskDate({ task }) {
  if (!task?.date) return null;
  if (!isLeaveRange(task)) return <>{task.date}</>;
  return (
    <span title={`${fmt(task.date)} – ${fmt(task.leaveEndDate)} (${leaveDayCount(task)} days)`} style={{ whiteSpace: "nowrap", lineHeight: 1.4 }}>
      {task.date}
      <br />
      <span style={{ fontSize: 11, color: "#92400e", fontWeight: 600 }}>→ {task.leaveEndDate}</span>
    </span>
  );
}
