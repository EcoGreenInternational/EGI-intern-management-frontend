import { useState, useEffect } from "react";
import { userAPI, authAPI, resolveImageUrl } from "../../utils/api";
import { Avatar, Toast } from "../../components/shared/index.jsx";
import { useAuth } from "../../hooks/useAuth";
import { TrashIcon, KeyIcon } from "../../components/shared/Icons.jsx";

// ─── Modal Shell ─────────────────────────────────────────────────────────────
function Modal({ children, onBgClick, maxWidth = 540 }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onBgClick()}
    >
      <div
        style={{
          background: "white",
          borderRadius: 18,
          maxWidth,
          width: "100%",
          maxHeight: "92vh",
          overflowY: "auto",
          padding: "30px 28px",
          boxShadow: "0 24px 80px rgba(0,0,0,.3)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Role Badges ─────────────────────────────────────────────────────────────
function getRoleBadge(user) {
  if (user.role === "intern") {
    return { label: "Intern Trainee", bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" };
  }
  if (user.supervisorLevel === "senior") {
    return { label: "Senior Supervisor", bg: "#faf5ff", color: "#7c3aed", border: "#ddd6fe" };
  }
  if (user.supervisorLevel === "junior") {
    return { label: "Junior Supervisor", bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" };
  }
  return { label: "Supervisor", bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" };
}

// ─── Staff Member Card ───────────────────────────────────────────────────────
function StaffCard({ staff, isSenior, currentUserId, onSelect, onDelete, onResetPassword }) {
  const badge = getRoleBadge(staff);
  const isSelf = String(staff._id) === String(currentUserId);
  const docsCount = [staff.documents?.cv?.url, staff.documents?.policeReport?.url, staff.documents?.gramaNiladhari?.url].filter(Boolean).length;

  return (
    <div className="intern-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div>
        <div className="flex items-center gap-12 mb-16">
          <Avatar initials={staff.avatar || staff.name?.charAt(0)} color={staff.avatarColor || "#10b981"} size="lg" src={staff.profilePicture} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: "Syne,sans-serif",
                fontWeight: 800,
                fontSize: 15,
                color: "var(--green-900)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {staff.name}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 3 }}>
              <span
                style={{
                  padding: "2px 9px",
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 700,
                  background: badge.bg,
                  color: badge.color,
                  border: `1px solid ${badge.border}`,
                }}
              >
                {badge.label}
              </span>
            </div>
          </div>

          {isSenior && !isSelf && (
            <button
              onClick={() => onDelete(staff)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}
              title="Remove staff member"
            >
              <TrashIcon size={16} color="#ef4444" />
            </button>
          )}
        </div>

        <div style={{ fontSize: 12, color: "var(--gray-500)", marginBottom: 14, display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{staff.email}</span>
          </div>

          {staff.contact && (
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <span>{staff.contact}</span>
            </div>
          )}

          {staff.position && (
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
              <span>{staff.position}</span>
            </div>
          )}

          {staff.department && (
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <path d="M9 22v-4h6v4" />
                <path d="M8 6h.01" />
                <path d="M16 6h.01" />
                <path d="M8 10h.01" />
                <path d="M16 10h.01" />
              </svg>
              <span>{staff.department}</span>
            </div>
          )}

          {/* Quick indicator badges */}
          <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                padding: "2px 7px",
                borderRadius: 6,
                background: docsCount > 0 ? "#ecfdf5" : "#f1f5f9",
                color: docsCount > 0 ? "#059669" : "#64748b",
                border: `1px solid ${docsCount > 0 ? "#a7f3d0" : "#e2e8f0"}`,
              }}
            >
              📄 {docsCount}/3 Docs
            </span>

            {staff.bankDetails?.accountNumber && (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  padding: "2px 7px",
                  borderRadius: 6,
                  background: "#eff6ff",
                  color: "#2563eb",
                  border: "1px solid #bfdbfe",
                }}
              >
                🏦 Bank Info
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
        <button
          onClick={() => onSelect(staff)}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #10b981",
            background: "#ecfdf5",
            color: "#065f46",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            transition: "all .12s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#10b981";
            e.currentTarget.style.color = "#ffffff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#ecfdf5";
            e.currentTarget.style.color = "#065f46";
          }}
        >
          <span>👁️</span> View Full Profile
        </button>

        {isSenior && !isSelf && (
          <button
            onClick={() => onResetPassword(staff)}
            style={{
              width: "100%",
              padding: "6px",
              borderRadius: 8,
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#dc2626",
              fontSize: 11.5,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
            }}
          >
            <KeyIcon size={12} color="#dc2626" /> Reset Password
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Full Profile Details Modal ──────────────────────────────────────────────
function FullProfileModal({ staffId, initialData, onClose }) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!staffId) return;
    setLoading(true);
    userAPI
      .getOne(staffId)
      .then((res) => {
        setData(res.user || initialData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [staffId, initialData]);

  const badge = getRoleBadge(data);
  const docs = data.documents || {};

  const infoItem = (label, val) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#1f2937", wordBreak: "break-word" }}>{val || "—"}</span>
    </div>
  );

  const docItem = (title, doc, color) => {
    const hasDoc = !!doc?.url;
    const url = hasDoc ? resolveImageUrl(doc.url) : null;
    const dateStr = doc?.uploadedAt
      ? new Date(doc.uploadedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : null;

    return (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          borderRadius: 10,
          background: hasDoc ? "#f8fafc" : "#fafafa",
          border: `1px solid ${hasDoc ? "#e2e8f0" : "#f1f5f9"}`,
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: hasDoc ? `${color}15` : "#f1f5f9",
              color: hasDoc ? color : "#9ca3af",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            📄
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1f2937" }}>{title}</div>
            <div style={{ fontSize: 11, color: hasDoc ? "#059669" : "#9ca3af", marginTop: 2, fontWeight: 500 }}>
              {hasDoc ? `✓ Uploaded ${dateStr ? `· ${dateStr}` : ""}` : "Not uploaded yet"}
            </div>
          </div>
        </div>

        {hasDoc && url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "6px 14px",
              borderRadius: 7,
              background: "#0f6240",
              color: "#ffffff",
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span>View</span> ↗
          </a>
        ) : (
          <span style={{ fontSize: 11.5, color: "#9ca3af", fontStyle: "italic" }}>None</span>
        )}
      </div>
    );
  };

  return (
    <Modal onBgClick={onClose} maxWidth={680}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar
            initials={data.avatar || data.name?.charAt(0)}
            color={data.avatarColor || "#10b981"}
            size="xl"
            src={data.profilePicture}
          />
          <div>
            <h3 style={{ margin: 0, fontFamily: "Syne,sans-serif", fontSize: 20, fontWeight: 800, color: "#072a1d" }}>
              {data.name}
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <span
                style={{
                  padding: "2px 10px",
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 700,
                  background: badge.bg,
                  color: badge.color,
                  border: `1px solid ${badge.border}`,
                }}
              >
                {badge.label}
              </span>
              <span style={{ fontSize: 12, color: "#6b7280" }}>{data.position || "Staff"}</span>
              {data.department && <span style={{ fontSize: 12, color: "#6b7280" }}>· {data.department}</span>}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#9ca3af", lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      {loading && (
        <div style={{ padding: "8px 0", fontSize: 11.5, color: "#10b981", textAlign: "right" }}>Refreshing latest data...</div>
      )}

      {/* Main Details Sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Section 1: Personal & Contact Information */}
        <div style={{ background: "#f8faf9", borderRadius: 12, padding: "16px 18px", border: "1px solid #e5ede8" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#072a1d", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <span>👤</span> Personal & Contact Details
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {infoItem("Email", data.email)}
            {infoItem("Username", data.username)}
            {infoItem("Contact Phone", data.contact)}
            {infoItem("NIC Number", data.nic)}
            {infoItem("Gender", data.gender)}
            {infoItem("Date of Birth", data.dateOfBirth)}
            {infoItem("Start Date", data.startDate)}
            {infoItem("End Date", data.endDate || "Present")}
            {infoItem("Residential Address", data.address)}
            {infoItem("Emergency Contact Name", data.emergencyContactName)}
            {infoItem("Emergency Contact Phone", data.emergencyContactPhone)}
          </div>
        </div>

        {/* Section 2: Bank Details */}
        <div style={{ background: "#f8faf9", borderRadius: 12, padding: "16px 18px", border: "1px solid #e5ede8" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#072a1d", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <span>🏦</span> Bank Details
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {infoItem("Bank Name", data.bankDetails?.bankName)}
            {infoItem("Account Holder", data.bankDetails?.accountHolderName)}
            {infoItem("Account Number", data.bankDetails?.accountNumber)}
            {infoItem("Branch Name", data.bankDetails?.branchName)}
            {infoItem("IFSC / SWIFT", data.bankDetails?.ifscOrSwift)}
          </div>
        </div>

        {/* Section 3: Family Details */}
        <div style={{ background: "#f8faf9", borderRadius: 12, padding: "16px 18px", border: "1px solid #e5ede8" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#072a1d", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <span>👨‍👩‍👧</span> Family Details
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {infoItem(
              "Father",
              data.familyDetails?.father?.name
                ? `${data.familyDetails.father.name} (${data.familyDetails.father.occupation || "N/A"})`
                : null
            )}
            {infoItem(
              "Mother",
              data.familyDetails?.mother?.name
                ? `${data.familyDetails.mother.name} (${data.familyDetails.mother.occupation || "N/A"})`
                : null
            )}
            {infoItem(
              "Spouse",
              data.familyDetails?.spouse?.name
                ? `${data.familyDetails.spouse.name} (${data.familyDetails.spouse.occupation || "N/A"})`
                : null
            )}
            {data.familyDetails?.children?.length > 0 && (
              <div style={{ gridColumn: "1/-1" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase" }}>Children</span>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1f2937", marginTop: 2 }}>
                  {data.familyDetails.children.map((c) => c.name || c).join(", ")}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Uploaded Documents */}
        <div style={{ background: "#f8faf9", borderRadius: 12, padding: "16px 18px", border: "1px solid #e5ede8" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#072a1d", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <span>📁</span> Uploaded Documents
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {docItem("Curriculum Vitae (CV)", docs.cv, "#059669")}
            {docItem("Police Report", docs.policeReport, "#2563eb")}
            {docItem("Grama Niladhari Report", docs.gramaNiladhari, "#b45309")}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
        <button
          onClick={onClose}
          style={{
            padding: "9px 24px",
            borderRadius: 8,
            border: "none",
            background: "#072a1d",
            color: "#ffffff",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Close Profile
        </button>
      </div>
    </Modal>
  );
}

// ─── Main Staff Profiles Page ────────────────────────────────────────────────
export function SupervisorsPage() {
  const { user, isSenior } = useAuth();
  const [allStaff, setAllStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [newPass, setNewPass] = useState("");
  const [resetting, setResetting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    username: "",
    password: "",
    email: "",
    contact: "",
    position: "",
    department: "",
    supervisorLevel: "supervisor",
  });

  const loadData = () => {
    setLoading(true);
    Promise.all([
      userAPI.getAll("supervisor").catch(() => ({ users: [] })),
      userAPI.getAll("intern").catch(() => ({ users: [] })),
    ])
      .then(([svRes, inRes]) => {
        const svs = svRes.users || [];
        const ins = inRes.users || [];
        const staffMap = new Map();
        [...svs, ...ins].forEach((u) => {
          if (u && u._id) staffMap.set(String(u._id), u);
        });
        setAllStaff(Array.from(staffMap.values()));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = async () => {
    if (!form.name || !form.username || !form.password || !form.email) {
      setToast({ msg: "Name, username, password and email are required.", type: "error" });
      return;
    }
    setAdding(true);
    try {
      await authAPI.registerSupervisor(form);
      setToast({ msg: `${form.name} added successfully!`, type: "success" });
      setShowAdd(false);
      setForm({
        name: "",
        username: "",
        password: "",
        email: "",
        contact: "",
        position: "",
        department: "",
        supervisorLevel: "supervisor",
      });
      loadData();
    } catch (e) {
      setToast({ msg: e.message, type: "error" });
    }
    setAdding(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.role === "intern") {
        await userAPI.delete(deleteTarget._id);
      } else {
        await authAPI.deleteSupervisor(deleteTarget._id);
      }
      setAllStaff((prev) => prev.filter((u) => u._id !== deleteTarget._id));
      setToast({ msg: `${deleteTarget.name} removed.`, type: "success" });
      setDeleteTarget(null);
    } catch (e) {
      setToast({ msg: e.message, type: "error" });
    }
    setDeleting(false);
  };

  const handleResetPassword = async () => {
    if (!newPass || newPass.length < 6) {
      setToast({ msg: "Password must be at least 6 characters.", type: "error" });
      return;
    }
    setResetting(true);
    try {
      await authAPI.resetPassword(resetTarget._id, { newPassword: newPass });
      setToast({ msg: `Password reset for ${resetTarget.name}.`, type: "success" });
      setResetTarget(null);
      setNewPass("");
    } catch (e) {
      setToast({ msg: e.message, type: "error" });
    }
    setResetting(false);
  };

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <div className="spinner" />
      </div>
    );
  }

  // Filter categories
  const seniors = allStaff.filter((s) => s.role === "supervisor" && s.supervisorLevel === "senior");
  const plains = allStaff.filter((s) => s.role === "supervisor" && (s.supervisorLevel === "supervisor" || !s.supervisorLevel));
  const juniors = allStaff.filter((s) => s.role === "supervisor" && s.supervisorLevel === "junior");
  const interns = allStaff.filter((s) => s.role === "intern");

  // Tab Filtering
  let tabFiltered = allStaff;
  if (activeTab === "senior") tabFiltered = seniors;
  else if (activeTab === "supervisor") tabFiltered = plains;
  else if (activeTab === "junior") tabFiltered = juniors;
  else if (activeTab === "intern") tabFiltered = interns;

  // Search Filtering
  const q = searchQuery.trim().toLowerCase();
  const visibleStaff = q
    ? tabFiltered.filter(
        (s) =>
          s.name?.toLowerCase().includes(q) ||
          s.username?.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q) ||
          s.department?.toLowerCase().includes(q) ||
          s.position?.toLowerCase().includes(q) ||
          s.contact?.toLowerCase().includes(q)
      )
    : tabFiltered;

  return (
    <div className="animate-fadeUp">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Full Profile View Modal */}
      {selectedStaff && (
        <FullProfileModal
          staffId={selectedStaff._id}
          initialData={selectedStaff}
          onClose={() => setSelectedStaff(null)}
        />
      )}

      {/* Add Supervisor Modal */}
      {showAdd && (
        <Modal onBgClick={() => setShowAdd(false)}>
          <div style={{ width: "100%" }}>
            <div style={{ fontFamily: "Syne,sans-serif", fontWeight: 800, fontSize: 18, color: "#0a2e1a", marginBottom: 6 }}>
              ➕ Add Supervisor
            </div>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>Fill in the details to register a new supervisor.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                ["Full Name *", "name", "text"],
                ["Username *", "username", "text"],
                ["Password *", "password", "password"],
                ["Email *", "email", "email"],
                ["Contact", "contact", "text"],
                ["Position", "position", "text"],
                ["Department", "department", "text"],
              ].map(([label, key, type]) => (
                <div key={key} style={{ gridColumn: key === "name" ? "1/-1" : "auto" }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>{label}</label>
                  <input
                    type={type}
                    className="form-input"
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div style={{ gridColumn: "1/-1" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Role *</label>
                <div style={{ display: "flex", gap: 10 }}>
                  {[
                    { value: "supervisor", label: "Supervisor", bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" },
                    { value: "junior", label: "Junior Supervisor", bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setForm((f) => ({ ...f, supervisorLevel: opt.value }))}
                      style={{
                        flex: 1,
                        padding: "10px 14px",
                        borderRadius: 10,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        border: form.supervisorLevel === opt.value ? `2px solid ${opt.border}` : "2px solid #e5e7eb",
                        background: form.supervisorLevel === opt.value ? opt.bg : "#f9fafb",
                        color: form.supervisorLevel === opt.value ? opt.color : "#6b7280",
                        fontWeight: form.supervisorLevel === opt.value ? 700 : 500,
                        fontSize: 13,
                        transition: "all .15s",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleAdd} disabled={adding}>
                {adding ? "Adding…" : "Add Supervisor"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <Modal onBgClick={() => setResetTarget(null)} maxWidth={400}>
          <div style={{ width: "100%" }}>
            <div style={{ fontFamily: "Syne,sans-serif", fontWeight: 800, fontSize: 18, color: "#0a2e1a", marginBottom: 6 }}>
              🔑 Reset Password
            </div>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
              New temporary password for <strong>{resetTarget.name}</strong>.
            </p>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>New Password</label>
            <input
              type="password"
              className="form-input"
              style={{ marginBottom: 20 }}
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="Min. 6 characters"
              onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => { setResetTarget(null); setNewPass(""); }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleResetPassword} disabled={resetting}>
                {resetting ? "Resetting…" : "Reset Password"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <Modal onBgClick={() => setDeleteTarget(null)} maxWidth={400}>
          <div style={{ width: "100%" }}>
            <div style={{ fontFamily: "Syne,sans-serif", fontWeight: 800, fontSize: 18, color: "#dc2626", marginBottom: 6 }}>
              🗑 Remove Staff Member
            </div>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
              Remove <strong>{deleteTarget.name}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button
                style={{
                  padding: "9px 20px",
                  borderRadius: 9,
                  border: "none",
                  background: "#ef4444",
                  color: "white",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22, flexWrap: "wrap", gap: 14 }}>
        <div>
          <h2 style={{ fontFamily: "Syne,sans-serif", fontSize: 22, fontWeight: 800, color: "var(--green-900)", margin: 0 }}>
            👥 Staff Profiles
          </h2>
          <p style={{ fontSize: 13, color: "var(--gray-500)", marginTop: 4, margin: 0 }}>
            Comprehensive directory of all staff members (Senior Supervisors, Supervisors, Junior Supervisors, and Interns)
          </p>
        </div>

        {isSenior && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            + Add Supervisor
          </button>
        )}
      </div>

      {/* Controls: Search and Role Filter Tabs */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        {/* Role Tabs */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { key: "all", label: "All Staff", count: allStaff.length },
            { key: "senior", label: "Senior Supervisors", count: seniors.length },
            { key: "supervisor", label: "Supervisors", count: plains.length },
            { key: "junior", label: "Junior Supervisors", count: juniors.length },
            { key: "intern", label: "Interns", count: interns.length },
          ].map(({ key, label, count }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 999,
                  border: "1px solid",
                  borderColor: isActive ? "var(--green-600)" : "#e2e8f0",
                  background: isActive ? "#0f6240" : "#ffffff",
                  color: isActive ? "#ffffff" : "#4b5563",
                  fontSize: 12.5,
                  fontWeight: isActive ? 700 : 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s ease",
                  boxShadow: isActive ? "0 2px 8px rgba(15,98,64,0.2)" : "none",
                }}
              >
                <span>{label}</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "1px 7px",
                    borderRadius: 99,
                    background: isActive ? "rgba(255,255,255,0.2)" : "#f1f5f9",
                    color: isActive ? "#ffffff" : "#64748b",
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div style={{ position: "relative", minWidth: 260 }}>
          <input
            type="text"
            placeholder="Search staff by name, email, department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 14px 8px 34px",
              borderRadius: 999,
              border: "1px solid #d1d5db",
              fontSize: 12.5,
              outline: "none",
              fontFamily: "inherit",
              background: "#ffffff",
            }}
          />
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontSize: 13 }}>
            🔍
          </span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "#9ca3af",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Staff Grid */}
      {visibleStaff.length === 0 ? (
        <div className="empty-state" style={{ padding: "60px 20px" }}>
          <div className="empty-icon">👥</div>
          <h3>No staff members found</h3>
          <p>{searchQuery ? "Try refining your search query." : "No members match the selected filter."}</p>
        </div>
      ) : (
        <div className="grid-3">
          {visibleStaff.map((staff) => (
            <StaffCard
              key={staff._id}
              staff={staff}
              isSenior={isSenior}
              currentUserId={user?._id || user?.id}
              onSelect={setSelectedStaff}
              onDelete={setDeleteTarget}
              onResetPassword={setResetTarget}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default SupervisorsPage;