import { useState } from "react";
import { api } from "@/lib/api";
import { MagnifyingGlass, CircleNotch, Sparkle } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function RAGSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const { data } = await api.post("/rag/search", { query, limit: 10 });
      setResults(data.results);
      if (data.count === 0) {
        toast.info("No matching articles found");
      }
    } catch (e) {
      toast.error("Search failed: " + (e?.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <section className="border border-slate-300 bg-white mt-8">
      <div className="border-b border-slate-300 px-5 py-3 flex items-center gap-2">
        <Sparkle size={14} className="text-purple-600" />
        <span className="text-xs tracking-[0.25em] uppercase font-bold text-slate-600">
          AI-Powered Search
        </span>
      </div>

      <div className="p-5">
        <p className="text-sm text-slate-600 mb-4">
          Search your analysis history using natural language. Example:{" "}
          <span className="text-purple-600 italic">"Show me fake news about technology"</span>
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask anything about your analysis history..."
            className="flex-1 border border-slate-300 px-4 py-2 outline-none focus:border-purple-500"
            disabled={loading}
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="bg-purple-900 text-white px-6 py-2 font-bold uppercase tracking-[0.15em] text-sm hover:bg-purple-800 transition-colors disabled:bg-purple-400 flex items-center gap-2"
          >
            {loading ? (
              <CircleNotch size={16} className="animate-spin" />
            ) : (
              <MagnifyingGlass size={16} weight="bold" />
            )}
            Search
          </button>
        </div>

        {searched && !loading && (
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-bold text-slate-700">
              Found {results.length} result{results.length !== 1 ? "s" : ""}
            </h3>
            {results.map((result, idx) => (
              <div
                key={result.id}
                className="p-4 border border-slate-200 hover:border-purple-300 transition-colors cursor-pointer"
                onClick={() => {
                  // Dispatch event to load this analysis
                  window.dispatchEvent(new CustomEvent('load-analysis', { detail: result.id }));
                }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900">{result.title || "Untitled"}</h4>
                    <div className="flex gap-3 mt-2 text-xs">
                      <span className={`font-bold ${
                        result.verdict === "FAKE" ? "text-red-600" : "text-emerald-600"
                      }`}>
                        {result.verdict}
                      </span>
                      <span className="text-slate-500">
                        Confidence: {(result.confidence * 100).toFixed(1)}%
                      </span>
                      <span className="text-slate-500">
                        Match: {(100 - result.similarity_score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                      {result.excerpt}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}