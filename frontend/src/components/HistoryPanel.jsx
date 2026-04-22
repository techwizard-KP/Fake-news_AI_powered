import { ClockCounterClockwise, Trash, TrashSimple } from "@phosphor-icons/react";

function verdictBadge(v) {
  if (v === "FAKE") return "bg-red-50 text-red-700 border-red-300";
  if (v === "REAL") return "bg-emerald-50 text-emerald-700 border-emerald-300";
  return "bg-slate-50 text-slate-700 border-slate-300";
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function HistoryPanel({ history, onSelect, onDelete, onClear }) {
  return (
    <section id="history" className="border border-slate-300 bg-white" data-testid="history-section">
      <div className="border-b border-slate-300 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs tracking-[0.25em] uppercase font-bold text-slate-600">
          <ClockCounterClockwise size={14} weight="bold" />
          03 · Analysis History ({history.length})
        </div>
        {history.length > 0 && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 text-[10px] tracking-[0.2em] uppercase font-bold text-slate-500 hover:text-red-600 transition-colors"
            data-testid="clear-history"
          >
            <TrashSimple size={12} /> Clear All
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="p-10 text-center">
          <ClockCounterClockwise size={36} className="mx-auto text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">
            No analyses yet. Your verified articles will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-300">
              <tr className="text-left text-[10px] tracking-[0.25em] uppercase font-bold text-slate-500">
                <th className="px-5 py-3 w-[90px]">Verdict</th>
                <th className="px-5 py-3 w-[90px]">Confidence</th>
                <th className="px-5 py-3">Article</th>
                <th className="px-5 py-3 w-[140px]">When</th>
                <th className="px-5 py-3 w-[60px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {history.map((h) => (
                <tr
                  key={h.id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => onSelect(h)}
                  data-testid={`history-row-${h.id}`}
                >
                  <td className="px-5 py-4">
                    <span className={`border text-[10px] font-bold uppercase tracking-[0.15em] px-2 py-1 ${verdictBadge(h.verdict)}`}>
                      {h.verdict}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-chivo font-bold text-slate-900">
                      {Math.round((h.confidence || 0) * 100)}%
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-900 line-clamp-1">{h.title}</div>
                    <div className="text-xs text-slate-500 line-clamp-1">{h.url}</div>
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-500">{formatDate(h.created_at)}</td>
                  <td className="px-5 py-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(h.id);
                      }}
                      className="text-slate-400 hover:text-red-600 transition-colors"
                      data-testid={`delete-${h.id}`}
                    >
                      <Trash size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
