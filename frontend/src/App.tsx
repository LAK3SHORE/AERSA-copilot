import { useState } from "react";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { AuditorPage } from "./pages/AuditorPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";

type View = "copilot" | "analytics";

function AppRoutes() {
  const { token } = useAuth();
  const [view, setView] = useState<View>("copilot");

  if (!token) {
    return <LoginPage />;
  }

  if (view === "analytics") {
    return <AnalyticsPage onBack={() => setView("copilot")} />;
  }

  return <AuditorPage onOpenAnalytics={() => setView("analytics")} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
