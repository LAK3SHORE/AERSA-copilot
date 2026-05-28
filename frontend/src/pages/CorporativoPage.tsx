import { AppShell } from "../components/AppShell";
import { AdminView } from "../components/admin/AdminView";

export function CorporativoPage() {
  return (
    <AppShell isAdmin>
      {(shell) => <AdminView shell={shell} />}
    </AppShell>
  );
}
