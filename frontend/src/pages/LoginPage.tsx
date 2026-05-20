import { FormEvent, useState } from "react";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { login, loading } = useAuth();
  const [username, setUsername] = useState("auditor_956");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(username, password);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md border hairline bg-cream-2 p-8 space-y-6 animate-fade-in">
        <div>
          <p className="label-eyebrow mb-1">Acceso</p>
          <h1 className="font-sans font-semibold text-2xl tracking-tight text-ink">
            TALOS Copiloto
          </h1>
          <p className="font-mono text-[11px] text-ink-4 mt-2">
            AERSA · auditor o corporativo
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="label-eyebrow block mb-1">Usuario</span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border-b hairline-strong bg-transparent pb-1.5 font-sans text-[15px] text-ink outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="label-eyebrow block mb-1">Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border-b hairline-strong bg-transparent pb-1.5 font-sans text-[15px] text-ink outline-none focus:border-accent"
            />
          </label>

          {error && (
            <p className="font-mono text-[11px] text-crit">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full border hairline-strong bg-cream-3 px-5 py-3 font-mono text-[11px] uppercase tracking-wide2 hover:border-accent disabled:opacity-40"
          >
            {loading ? "Entrando…" : "Iniciar sesión"}
          </button>
        </form>

        <p className="font-mono text-[10px] text-ink-4 leading-relaxed">
          Demo: <span className="text-ink-3">admin</span> / aersa2026 (corporativo) ·{" "}
          <span className="text-ink-3">auditor_956</span> / talos2026
        </p>
      </div>
    </div>
  );
}
