export function AppFooter({ sessionId }: { sessionId?: number | null }) {
  return (
    <footer className="h-[26px] shrink-0 border-t border-accent-3 bg-cream-2 flex items-center px-4 justify-between">
      <span className="font-mono text-[9.5px] text-ink-5 tracking-widish">
        TALOS Copiloto v0.3 · Session 15 UI refactor
        {sessionId != null && (
          <span className="text-ink-4 ml-2">sesión #{sessionId}</span>
        )}
      </span>
      <span className="font-mono text-[9.5px] text-ink-5 tracking-widish">
        datos read-only · MariaDB talos_tecmty
      </span>
    </footer>
  );
}
