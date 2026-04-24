import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { ChatCircleText, PaperPlaneTilt, CircleNotch, User, Sparkle, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import DOMPurify from "dompurify";

const SUGGESTIONS_BY_VERDICT = {
  REAL: [
    "What is the main claim of this article?",
    "Is this story being reported by other major outlets?",
    "What context is missing from this story?",
    "What are the broader implications?",
  ],
  FAKE: [
    "Why might this article be considered misleading?",
    "What facts in this article can actually be verified?",
    "What is the truth about this topic?",
    "Who would benefit from spreading this narrative?",
  ],
  UNCERTAIN: [
    "Why did the models disagree on this article?",
    "What signals point to this being real or fake?",
    "What sources should I cross-check?",
    "Summarize the article in plain language",
  ],
  DEFAULT: [
    "What is the main claim of this article?",
    "Is this event widely reported elsewhere?",
    "What context is missing from this story?",
    "Who would benefit from this narrative?",
  ],
};

function renderMarkdown(text) {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="bg-slate-100 px-1 rounded">$1</code>')
    .replace(/\n{2,}/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
  html = html.replace(/(?:^|<br\/>)\s*[-*]\s+([^<]+)/g, "<br/>• $1");
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: ["strong", "em", "code", "br"] });
}

export default function ChatPanel({ analysisId, verdict }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const scrollRef = useRef(null);

  // Load persisted chat history when analysis changes
  useEffect(() => {
    let cancelled = false;
    setMessages([]);
    setInput("");
    if (!analysisId) return;
    setHistoryLoading(true);
    api
      .get(`/chat/${analysisId}`)
      .then(({ data }) => {
        if (!cancelled) setMessages(data || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = async (questionOverride) => {
    const question = (questionOverride ?? input).trim();
    if (!question || loading) return;
    const userMsg = { role: "user", content: question };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { data } = await api.post("/chat", {
        analysis_id: analysisId,
        question,
        history: messages,
      });
      setMessages([...next, { role: "assistant", content: data.answer }]);
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message || "Chat failed";
      toast.error(msg);
      setMessages([...next, { role: "assistant", content: `_Sorry — ${msg}_` }]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearChat = async () => {
    if (!analysisId) return;
    try {
      await api.delete(`/chat/${analysisId}`);
      setMessages([]);
      toast.success("Chat cleared");
    } catch {
      toast.error("Could not clear chat");
    }
  };

  const suggestions = SUGGESTIONS_BY_VERDICT[verdict] || SUGGESTIONS_BY_VERDICT.DEFAULT;

  return (
    <section className="border border-slate-300 bg-white" data-testid="chat-panel">
      <div className="border-b border-slate-300 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs tracking-[0.25em] uppercase font-bold text-slate-600">
          <ChatCircleText size={14} weight="bold" />
          04 · Ask About This Article
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1 text-[10px] tracking-[0.2em] uppercase font-bold text-slate-500 hover:text-red-600 transition-colors"
            data-testid="clear-chat-button"
          >
            <Trash size={12} /> Clear
          </button>
        )}
      </div>

      <div ref={scrollRef} className="max-h-[440px] overflow-y-auto px-6 py-5 space-y-4 bg-slate-50/50">
        {historyLoading && (
          <div className="text-center text-xs text-slate-400 tracking-[0.2em] uppercase font-bold">
            Loading chat history…
          </div>
        )}

        {!historyLoading && messages.length === 0 && !loading && (
          <div className="text-center py-6">
            <Sparkle size={28} className="mx-auto text-slate-300" />
            <p className="text-sm text-slate-500 mt-3">
              Ask anything about this article — facts, context, or the verdict.
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs border border-slate-300 bg-white px-3 py-1.5 hover:border-slate-900 hover:bg-slate-900 hover:text-white transition-colors text-left max-w-[280px]"
                  data-testid={`suggested-${s.slice(0, 24)}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, idx) => (
          <div
            key={`${idx}-${m.role}`}
            className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
            data-testid={`chat-msg-${idx}-${m.role}`}
          >
            <div
              className={`w-8 h-8 shrink-0 flex items-center justify-center border ${
                m.role === "user"
                  ? "bg-slate-900 border-slate-900 text-white"
                  : "bg-white border-slate-300 text-slate-900"
              }`}
            >
              {m.role === "user" ? <User size={16} weight="bold" /> : <Sparkle size={16} weight="duotone" />}
            </div>
            <div
              className={`max-w-[75%] px-4 py-3 border text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-800 border-slate-300"
              }`}
            >
              {m.role === "assistant" ? (
                <div
                  className="ai-prose"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
                />
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3" data-testid="chat-loading">
            <div className="w-8 h-8 shrink-0 flex items-center justify-center bg-white border border-slate-300">
              <CircleNotch size={16} className="animate-spin text-slate-500" />
            </div>
            <div className="px-4 py-3 border bg-white text-slate-500 text-sm border-slate-300">
              Thinking…
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-300 p-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
          placeholder="Ask a follow-up question…"
          className="flex-1 bg-slate-50 border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-slate-900"
          data-testid="chat-input"
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          className="bg-slate-900 text-white px-5 py-2.5 text-sm font-bold uppercase tracking-[0.15em] hover:bg-slate-800 transition-colors disabled:bg-slate-400 flex items-center gap-2"
          data-testid="chat-send-button"
        >
          <PaperPlaneTilt size={14} weight="fill" />
          Send
        </button>
      </div>
    </section>
  );
}
