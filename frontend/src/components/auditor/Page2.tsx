import type { FindingStatus, Hallazgo } from "../../types/cierre";
import type { OpenChatFn } from "../../lib/chatTypes";
import { Eyebrow } from "../shared/Eyebrow";
import { SectionNum } from "../shared/SectionNum";
import { FindingCard } from "./FindingCard";
import { FilterBar, type FindingFilters } from "./FilterBar";

const PER_PAGE = 6;

export function Page2({
  filtered,
  totalCount,
  estatusMap,
  onEstatusChange,
  openChat,
  isAdmin,
  page,
  totalPages,
  onPageChange,
  filters,
  onFilterChange,
  allHallazgos,
}: {
  filtered: Hallazgo[];
  totalCount: number;
  estatusMap: Record<number, string>;
  onEstatusChange?: (id: number, s: FindingStatus) => void;
  openChat: OpenChatFn;
  isAdmin?: boolean;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  filters: FindingFilters;
  onFilterChange: (key: string, val: unknown) => void;
  allHallazgos: Hallazgo[];
}) {
  const pageItems = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-7 py-3 border-b-2 border-accent-2 flex items-center justify-between shrink-0"
        style={{ background: "rgb(134, 156, 78)" }}
      >
        <div className="flex items-baseline gap-2.5">
          <Eyebrow className="!text-cream">Hallazgos Priorizados</Eyebrow>
          <span className="font-mono text-[10px] text-cream font-medium">
            {filtered.length} / {totalCount} resultados
          </span>
        </div>
        <SectionNum n={2} className="!text-cream/60" />
      </div>

      <FilterBar filters={filters} hallazgos={allHallazgos} onChange={onFilterChange} />

      <div className="flex-1 overflow-y-auto px-7 py-4">
        {pageItems.length === 0 ? (
          <div className="flex items-center justify-center h-40 font-mono text-[11px] text-ink-5 tracking-widish">
            SIN RESULTADOS · ajusta los filtros
          </div>
        ) : (
          pageItems.map((h) => (
            <FindingCard
              key={h.idinventariomesdetalle}
              h={h}
              estatus={(estatusMap[h.idinventariomesdetalle] ?? "pendiente") as FindingStatus}
              onEstatusChange={onEstatusChange}
              openChat={openChat}
              isAdmin={isAdmin}
            />
          ))
        )}

        {pageItems.length > 0 && (
          <div className="flex items-center justify-between mt-2 pt-3.5 border-t border-accent-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="font-mono text-[10px] tracking-widish px-3 py-1.5 border border-accent-3 disabled:text-ink-5 enabled:text-ink enabled:cursor-pointer"
            >
              ← ANTERIOR
            </button>
            <span className="font-mono text-[10px] text-ink-4">
              página {page} de {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="font-mono text-[10px] tracking-widish px-3 py-1.5 border border-accent-3 disabled:text-ink-5 enabled:text-ink enabled:cursor-pointer"
            >
              SIGUIENTE →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export { PER_PAGE };
