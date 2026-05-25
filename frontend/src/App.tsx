import { AuthProvider, useAuth } from "./auth/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { AuditorPage } from "./pages/AuditorPage";
import { CorporativoPage } from "./pages/CorporativoPage";

function AppRoutes() {
  const { token, user } = useAuth();

  if (!token) {
    return <LoginPage />;
  }

  if (user?.role === "corporativo") {
    return <CorporativoPage />;
  }

  return <AuditorPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
