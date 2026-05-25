import type { AuditBrief, AuditBriefAction } from "../types";

interface Props {
  brief: AuditBrief | null;
  loading?: boolean;
  onAction: (action: AuditBriefAction) => void;
}

export function GuidedBriefing({ brief, loading, onAction }: Props) {
  if (loading) {
    return (
      <section className="px-7 py-4 border-b hairline bg-accent-3/20 animate-fade-in">
        <p className="label-eyebrow text-accent">¿Por dónde empiezo?</p>
        <p className="font-mono text-[11px] text-ink-3 mt-2">Generando briefing…</p>
      </section>
    );
  }

  if (!brief) return null;

  return (
    <section className="px-7 py-4 border-b hairline bg-accent-3/25 space-y-3">
      <div>
        <p className="label-eyebrow text-accent">¿Por dónde empiezo?</p>
        <h2 className="mt-1 font-sans font-medium text-lg text-ink leading-snug">
          {brief.headline}
        </h2>
        <p className="mt-1.5 font-mono text-[11px] text-ink-3 leading-relaxed">
          {brief.summary}
        </p>
      </div>

      <ol className="space-y-2">
        {brief.actions.map((a) => (
          <li key={a.idinventariomesdetalle}>
            <button
              type="button"
              onClick={() => onAction(a)}
              className="w-full text-left border hairline px-3 py-2.5 bg-cream hover:bg-cream-3 hover:border-accent transition-colors group"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[10px] text-accent uppercase tracking-wide2">
                  {String(a.rank).padStart(2, "0")} · {a.severity_label}
                </span>
                <span className="font-mono text-[10px] text-ink-4 opacity-0 group-hover:opacity-100">
                  preguntar →
                </span>
              </div>
              <p className="mt-1 font-sans font-medium text-sm text-ink">{a.title}</p>
              <p className="mt-0.5 font-mono text-[10px] text-ink-3 truncate">{a.reason}</p>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
