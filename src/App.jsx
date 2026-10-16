import { useState } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { Sidebar, Topbar } from "./components/layout/index.jsx";
import { Spinner } from "./components/shared/index.jsx";
import companyLogo from "./assets/logo.png";

import InternLoginPage from "./components/auth/InternLoginPage.jsx";
import SupervisorLoginPage from "./components/auth/SupervisorLoginPage.jsx";
import ForcedChangePassword from "./components/auth/ForcedChangePassword.jsx";


import { InternDashboard, MyTasksPage } from "./pages/intern/index.jsx";
import ProfilePage from "./pages/shared/ProfilePage.jsx";

import InternSchedulePage from "./pages/intern/Schedule.jsx";

import DiaryPage from "./pages/shared/DiaryPage.jsx"

import {
  SupervisorDashboard,
  AllTasksPage,
  InternsPage,
  ProjectsPage,
  MyTasksPageSupervisor,
} from "./pages/supervisor/index.jsx";
import SupervisorsPage from "./pages/supervisor/SupervisorsPage.jsx";

import SupervisorSchedulePage from "./pages/supervisor/Schedule.jsx";

// Shared Pages
import SocialPage from "./pages/shared/SocialPage.jsx";
import FilesPage from "./pages/shared/FilesPage.jsx";
import ThirdPartyItemsPage from "./pages/supervisor/ThirdPartyItemsPage.jsx";


function LoginChoose({ setView }) {
  return (
    <div className="egi-landing-wrapper">
      {/* Modern Top Header */}
      <header className="egi-landing-header">
        <div className="egi-landing-brand">
          <img src={companyLogo} alt="House of Cambridge Logo" className="egi-landing-brand-logo" />
        </div>
        <div className="egi-landing-tagline">
          Excellence &nbsp;|&nbsp; Professional Management
        </div>
      </header>

      {/* Main Hero & Portal Cards */}
      <main className="egi-landing-content">
        <div className="egi-hero-title-box">
          <div className="egi-hero-accent-bar" />
          <h1 className="egi-hero-heading">House of Cambridge</h1>
          <h2 className="egi-hero-subtitle">Staff Management Portal</h2>
          <p className="egi-hero-desc">
            Manage staff activities, tasks, work logs and performance.
          </p>
        </div>

        <div className="egi-portal-cards-row">
          {/* Staff Portal Card */}
          <div className="egi-portal-card egi-portal-card--intern" onClick={() => setView("intern")}>
            <div className="egi-portal-icon-wrap egi-portal-icon-wrap--intern">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                <path d="M6 12v5c3 3 9 3 12 0v-5"/>
              </svg>
            </div>
            <h3 className="egi-portal-card-title">Staff Portal</h3>
            <p className="egi-portal-card-desc">
              View your assigned tasks, submit work logs and track your progress.
            </p>
            <button className="egi-portal-btn egi-portal-btn--intern">
              Continue as Staff →
            </button>
            <svg className="egi-portal-leaf-watermark" viewBox="0 0 120 120" fill="none">
              <path d="M42 115C32 80 48 45 98 25C98 65 78 100 42 115Z" fill="#a7f3d0" fillOpacity="0.5"/>
              <path d="M42 115C22 90 22 65 37 50C52 60 52 85 42 115Z" fill="#6ee7b7" fillOpacity="0.4"/>
            </svg>
          </div>

          {/* Supervisor Portal Card */}
          <div className="egi-portal-card egi-portal-card--supervisor" onClick={() => setView("supervisor")}>
            <div className="egi-portal-icon-wrap egi-portal-icon-wrap--supervisor">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <circle cx="19" cy="11" r="2"/>
                <path d="M19 8v1"/>
                <path d="M19 13v1"/>
                <path d="M16.5 9.5l.8.5"/>
                <path d="M20.7 12l.8.5"/>
                <path d="M16.5 12.5l.8-.5"/>
                <path d="M20.7 10l.8-.5"/>
              </svg>
            </div>
            <h3 className="egi-portal-card-title">Supervisor Portal</h3>
            <p className="egi-portal-card-desc">
              Manage staff, assign tasks and view performance reports.
            </p>
            <button className="egi-portal-btn egi-portal-btn--supervisor">
              Continue as Supervisor →
            </button>
            <svg className="egi-portal-leaf-watermark" viewBox="0 0 120 120" fill="none">
              <path d="M42 115C32 80 48 45 98 25C98 65 78 100 42 115Z" fill="#fde68a" fillOpacity="0.55"/>
              <path d="M42 115C22 90 22 65 37 50C52 60 52 85 42 115Z" fill="#fcd34d" fillOpacity="0.4"/>
            </svg>
          </div>
        </div>
      </main>

      {/* Modern Footer Bar */}
      <footer className="egi-landing-footer">
        <div className="egi-landing-footer-left" />
        <div className="egi-landing-footer-center">
          © 2026 House of Cambridge Pvt Ltd
        </div>
        <div className="egi-landing-footer-right">
          <span>Privacy Policy</span>
          <span>&nbsp;|&nbsp;</span>
          <span>Support</span>
        </div>
      </footer>
    </div>
  );
}

function LoginRouter() {
  const getInitialView = () => {
    const path = window.location.pathname;
    if (path === "/intern-login") return "intern";
    if (path === "/supervisor-login") return "supervisor";
    return "choose";
  };

  const [view, setView] = useState(getInitialView);

  const goTo = (v) => {
    const paths = { choose: "/", intern: "/intern-login", supervisor: "/supervisor-login" };
    window.history.pushState({}, "", paths[v] || "/");
    setView(v);
  };

  if (view === "intern") return <InternLoginPage onBack={() => goTo("choose")} />;
  if (view === "supervisor") return <SupervisorLoginPage onBack={() => goTo("choose")} />;
  return <LoginChoose setView={goTo} />;
}

function AppContent() {
  const { user, loading, mustChangePassword, isSenior } = useAuth();
  const [page, setPage] = useState("dashboard");

  if (loading) return <Spinner />;
  if (!user) return <LoginRouter />;
  if (mustChangePassword) return <ForcedChangePassword />;

  const renderPage = () => {
    if (user.role === "intern") {
      switch (page) {
         case "diary": return <DiaryPage />;
        case "dashboard": return <InternDashboard setPage={setPage} />;
        case "mytasks":   return <MyTasksPage />;
        case "profile":   return <ProfilePage />;
       
        case "schedule":  return <InternSchedulePage />;
        case "social":    return <SocialPage />;
        case "files":     return <FilesPage />;
        default:          return <div style={{ padding: 40 }}>Page not found</div>;
      }
    }

    if (user.role === "supervisor") {
      switch (page) {
         case "diary": return <DiaryPage />;
        case "dashboard":   return <SupervisorDashboard setPage={setPage} />;
        case "tasks":       return <AllTasksPage />;
        case "mytasks":     return <MyTasksPageSupervisor />;
        case "profile":     return <ProfilePage />;   
        case "interns":     return <InternsPage />;
        case "projects":    return <ProjectsPage />;
       
        case "schedule":    return <SupervisorSchedulePage />;
        case "social":      return <SocialPage />;
        case "content":     return <SocialPage view="calendar" />;
        case "files":       return <FilesPage />;
       case "renewals":
  return isSenior ? <ThirdPartyItemsPage /> : <div>Access Denied</div>;
        case "supervisors": 
          return <SupervisorsPage />;
        default: 
          return <div style={{ padding: 40 }}>Page not found</div>;
      }
    }

    return <div style={{ padding: 40 }}>Page not found.</div>;
  };

  return (
    <div style={{ 
      display: "flex", 
      minHeight: "100vh", 
      background: "var(--gray-50)",
      overflow: "hidden"
    }}>
      {/* Sidebar */}
      <Sidebar page={page} setPage={setPage} />

      {/* Main Content */}
      <div style={{ 
        marginLeft: "var(--sidebar-w)", 
        flex: 1, 
        display: "flex", 
        flexDirection: "column",
        minHeight: "100vh"
      }}>
        <Topbar page={page} />

        <main style={{ 
          flex: 1, 
          padding: "28px 32px", 
          overflow: "auto",
          maxWidth: "1400px",
          width: "100%"
        }}>
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}