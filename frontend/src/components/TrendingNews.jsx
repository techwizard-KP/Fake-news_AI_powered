import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Newspaper, ArrowSquareOut, Lightning, ArrowClockwise } from "@phosphor-icons/react";

const TOPICS = [
  { id: "top", label: "Top" },
  { id: "world", label: "World" },
  { id: "technology", label: "Tech" },
  { id: "business", label: "Business" },
  { id: "science", label: "Science" },
  { id: "health", label: "Health" },
];

export default function TrendingNews({ onVerify }) {
  const [topic, setTopic] = useState("top");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (t) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/trending?topic=${t}`);
      setItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(topic);
  }, [topic, load]);

  return (
    <section id="trending" className="border border-slate-300 bg-white sticky top-4" data-testid="trending-section">
      <div className="border-b border-slate-300 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs tracking-[0.25em] uppercase font-bold text-slate-600">
          <Newspaper size={14} weight="bold" />
          Google News · Live
        </div>
        <button
          onClick={() => load(topic)}
          className="text-slate-500 hover:text-slate-900 transition-colors"
          title="Refresh"
          data-testid="refresh-trending"
        >
          <ArrowClockwise size={14} weight="bold" className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="border-b border-slate-300 px-3 py-2 flex gap-1 flex-wrap">
        {TOPICS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTopic(t.id)}
            className={`px-3 py-1 text-xs tracking-[0.15em] uppercase font-bold border transition-colors ${
              topic === t.id
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-300 hover:border-slate-900"
            }`}
            data-testid={`topic-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-h-[680px] overflow-y-auto divide-y divide-slate-200">
        {loading && items.length === 0 && (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 bg-slate-100 animate-pulse" />
            ))}
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="p-6 text-sm text-slate-500 text-center">No articles found.</div>
        )}
        {items.map((item, idx) => (
          <div key={idx} className="px-5 py-4 hover:bg-slate-50 group" data-testid={`trending-item-${idx}`}>
            <div className="flex items-start gap-2">
              <span className="font-chivo font-black text-slate-300 text-sm pt-0.5 w-6">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 leading-snug line-clamp-3">
                  {item.title}
                </p>
                <div className="flex items-center gap-2 mt-1.5 text-[10px] tracking-[0.15em] uppercase text-slate-500 font-bold">
                  <span className="truncate">{item.source || "Unknown"}</span>
                </div>
                <div className="flex gap-2 mt-2 opacity-80 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onVerify(item.link)}
                    className="flex items-center gap-1 text-[10px] tracking-[0.15em] uppercase font-bold bg-slate-900 text-white px-2 py-1 hover:bg-slate-800 transition-colors"
                    data-testid={`verify-trending-${idx}`}
                  >
                    <Lightning size={10} weight="fill" /> Verify
                  </button>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[10px] tracking-[0.15em] uppercase font-bold border border-slate-300 px-2 py-1 hover:border-slate-900 transition-colors"
                  >
                    Read <ArrowSquareOut size={10} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
