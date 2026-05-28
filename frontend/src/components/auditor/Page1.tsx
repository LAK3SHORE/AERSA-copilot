import type { AuditBrief, CierreReport } from "../../types/cierre";
import type { Herramienta } from "../../types/cierre";
import type { OpenChatFn } from "../../lib/chatTypes";
import { BriefingSection } from "./BriefingSection";
import { KPIsSection } from "./KPIsSection";
import { ToolsSection } from "./ToolsSection";

export function Page1({
  report,
  brief,
  briefLoading,
  tools,
  openChat,
}: {
  report: CierreReport;
  brief: AuditBrief | null;
  briefLoading: boolean;
  tools: Herramienta[];
  openChat: OpenChatFn;
}) {
  return (
    <div className="px-7 py-6 overflow-y-auto h-full">
      <KPIsSection report={report} openChat={openChat} />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <ToolsSection tools={tools} openChat={openChat} />
        <BriefingSection
          report={report}
          brief={brief}
          loading={briefLoading}
          openChat={openChat}
        />
      </div>
    </div>
  );
}
