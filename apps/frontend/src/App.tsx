import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/dashboard/app-shell";
import { AlertsPage } from "@/pages/AlertsPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { DevicesPage } from "@/pages/DevicesPage";
import { FacilitiesPage } from "@/pages/FacilitiesPage";
import { InsightsPage } from "@/pages/InsightsPage";
import { LoginPage } from "@/pages/LoginPage";
import { useAuthStore } from "@/store/use-auth-store";

function ProtectedLayout() {
  const accessToken = useAuthStore((state) => state.accessToken);
  if (!accessToken) return <Navigate to="/login" replace />;
  return <AppShell />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="facilities" element={<FacilitiesPage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="insights" element={<InsightsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
