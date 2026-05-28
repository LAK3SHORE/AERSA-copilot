import { AppShell } from "../components/AppShell";
import { AuditorView } from "../components/auditor/AuditorView";

export function AuditorPage() {
  return (
    <AppShell isAdmin={false}>
      {(shell) => <AuditorView shell={shell} />}
    </AppShell>
  );
}
