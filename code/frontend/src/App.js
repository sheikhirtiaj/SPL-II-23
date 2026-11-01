import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { LanguageProvider } from "./i18n/LanguageProvider";

import LandingPage from "./pages/LandingPage";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import VerifyEmail from "./pages/auth/VerifyEmail";
import Dashboard from "./pages/Dashboard";
import CouncillorDashboard from "./pages/councillor/CouncillorDashboard";
import ComplaintDetails from "./pages/councillor/ComplaintDetails";
import InspectorDashboard from "./pages/inspector/InspectorDashboard";
import InspectorComplaintPage from "./pages/inspector/InspectorComplaintPage";
import MasterAdminDashboard from "./pages/admin/MasterAdminDashboard";
import ReportIssue from "./pages/ReportIssue";
import MagistrateHotspotDetails from "./pages/MagistrateHotspotDetails";
import HotspotProximityMonitor from "./components/HotspotProximityMonitor";

function HomeRoute() {
  return <LandingPage />;
}

function RoleGuard({ allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="app-loading">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  const userRole = String(user.role || "").trim().toLowerCase();
  const allowed = allowedRoles.map((role) => role.toLowerCase());

  if (!allowed.includes(userRole)) {
    if (userRole === "councillor") return <Navigate to="/councillor" replace />;
    if (userRole === "inspector") return <Navigate to="/inspector" replace />;
    if (userRole === "master admin") return <Navigate to="/admin" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

function AppRoutes() {
  return (
    <>
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      {/* Public, read-only hotspot view; access is controlled by a 48-hour token. */}
      <Route path="/magistrate-alert/:token" element={<MagistrateHotspotDetails />} />

      <Route element={<RoleGuard allowedRoles={["citizen"]} />}>
        <Route path="/report" element={<ReportIssue />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>

      <Route element={<RoleGuard allowedRoles={["councillor"]} />}>
        <Route path="/councillor" element={<CouncillorDashboard />} />
        <Route path="/councillor/complaint/:id" element={<ComplaintDetails />} />
      </Route>

      <Route element={<RoleGuard allowedRoles={["inspector"]} />}>
        <Route path="/inspector" element={<InspectorDashboard />} />
        <Route path="/inspector/complaint/:id" element={<InspectorComplaintPage />} />
      </Route>

      <Route element={<RoleGuard allowedRoles={["master admin"]} />}>
        <Route path="/admin" element={<MasterAdminDashboard />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <HotspotProximityMonitor />
    </>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </LanguageProvider>
  );
}
