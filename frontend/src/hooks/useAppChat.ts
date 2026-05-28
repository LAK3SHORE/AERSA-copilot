import { useCallback, useState } from "react";
import { streamChat, streamCorporativoChat, streamNl2Sql } from "../api/chat";
import type { ChatHistoryMessage } from "../types";
import type { FindingContextPayload } from "../lib/findingPrompt";
import type { ChatMessage, ChatMode, SqlResultPayload } from "../lib/chatTypes";

export interface ChatContext {
  idempresa: number | null;
  periodo: string | null;
  sessionId: number | null;
  tabla: string;
}

export function useAppChat(ctx: ChatContext) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);

  const clearMessages = useCallback(() => setMessages([]), []);

  const sendMessage = useCallback(
    async (
      text: string,
      mode: ChatMode,
      opts?: { suggested?: boolean; findingContext?: FindingContextPayload },
    ) => {
      const history: ChatHistoryMessage[] = messages
        .filter((m) => !m.pending)
        .map((m) => ({ role: m.role, content: m.content }));

      const userMsg: ChatMessage = { role: "user", content: text };
      const pendingAssistant: ChatMessage = {
        role: "assistant",
        content: "",
        toolCalls: [],
        pending: true,
      };

      setMessages((prev) => [...prev, userMsg, pendingAssistant]);
      setPending(true);

      const tools: NonNullable<ChatMessage["toolCalls"]> = [];
      let buf = "";

      const updateAssistant = (patch: Partial<ChatMessage>) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = { ...last, ...patch };
          }
          return next;
        });
      };

      try {
        if (mode === "analytics") {
          await streamCorporativoChat(
            { message: text, history, days: 30 },
            {
              onEvent: (evt) => {
                if (evt.type === "token") {
                  buf += evt.content;
                  updateAssistant({ content: buf });
                } else if (evt.type === "done") {
                  if (evt.content) buf = evt.content;
                  updateAssistant({ content: buf, pending: false });
                } else if (evt.type === "error") {
                  updateAssistant({ content: `⚠ ${evt.message}`, pending: false });
                }
              },
            },
          );
        } else if (mode === "sql") {
          if (ctx.idempresa == null || !ctx.periodo) {
            updateAssistant({
              content: "⚠ Selecciona empresa y período en Datos Raw.",
              pending: false,
            });
            return;
          }
          await streamNl2Sql(
            {
              message: text,
              history,
              idempresa: ctx.idempresa,
              periodo: ctx.periodo,
              tabla: ctx.tabla,
            },
            {
              onEvent: (evt) => {
                if (evt.type === "sql_result") {
                  const sqlResult: SqlResultPayload = {
                    sql: evt.sql,
                    explanation: evt.explanation,
                    columns: evt.columns,
                    rows: evt.rows,
                    row_count: evt.row_count,
                  };
                  updateAssistant({
                    sqlResult,
                    content: evt.explanation,
                  });
                } else if (evt.type === "done") {
                  if (evt.content) updateAssistant({ content: evt.content, pending: false });
                  else updateAssistant({ pending: false });
                } else if (evt.type === "error") {
                  updateAssistant({ content: `⚠ ${evt.message}`, pending: false });
                }
              },
            },
          );
        } else {
          if (ctx.idempresa == null || !ctx.periodo) {
            updateAssistant({
              content: "⚠ Carga un Cierre antes de chatear.",
              pending: false,
            });
            return;
          }
          await streamChat(
            {
              idempresa: ctx.idempresa,
              periodo: ctx.periodo,
              message: text,
              history,
              session_id: ctx.sessionId,
              suggested: opts?.suggested ?? false,
              finding_context: opts?.findingContext ?? null,
            },
            {
              onEvent: (evt) => {
                switch (evt.type) {
                  case "token":
                    buf += evt.content;
                    updateAssistant({ content: buf });
                    break;
                  case "tool_call":
                    tools.push({
                      name: evt.name,
                      status: "running",
                      arguments: evt.arguments,
                    });
                    updateAssistant({ toolCalls: [...tools] });
                    break;
                  case "tool_result": {
                    const t = tools.find((x) => x.name === evt.name && x.status === "running");
                    if (t) t.status = evt.status;
                    updateAssistant({ toolCalls: [...tools] });
                    break;
                  }
                  case "done":
                    if (evt.content) buf = evt.content;
                    updateAssistant({ content: buf, pending: false });
                    break;
                  case "error":
                    updateAssistant({ content: `⚠ ${evt.message}`, pending: false });
                    break;
                }
              },
            },
          );
        }
      } finally {
        setPending(false);
      }
    },
    [ctx.idempresa, ctx.periodo, ctx.sessionId, ctx.tabla, messages],
  );

  return { messages, pending, sendMessage, clearMessages };
}
