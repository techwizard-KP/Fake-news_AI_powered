import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import Header from "@/components/Header";
import Analyzer from "@/components/Analyzer";
import ResultPanel from "@/components/ResultPanel";
import TrendingNews from "@/components/TrendingNews";
import HistoryPanel from "@/components/HistoryPanel";
import StatsBar from "@/components/StatsBar";

export default function Dashboard() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ total: 0, fake: 0, real: 0 });
  const [urlInput, setUrlInput] = useState("");

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await api.get("/history");
      setHistory(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get("/stats");
      setStats(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadHistory();
    loadStats();
  }, [loadHistory, loadStats]);

  const analyze = async (url) => {
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post("/analyze", { url });
      setResult(data);
      toast.success(`Classified as ${data.verdict}`);
      loadHistory();
      loadStats();
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message || "Analysis failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const selectHistoryItem = (item) => {
    setResult(item);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteItem = async (id) => {
    try {
      await api.delete(`/history/${id}`);
      toast.success("Deleted");
      loadHistory();
      loadStats();
    } catch (e) {
      toast.error("Delete failed");
    }
  };

  const clearAll = async () => {
    try {
      await api.delete("/history");
      toast.success("History cleared");
      setResult(null);
      loadHistory();
      loadStats();
    } catch (e) {
      toast.error("Clear failed");
    }
  };

  return (
    <div className="min-h-screen bg-grid" data-testid="dashboard">
      <Header />
      <StatsBar stats={stats} />
      <main className="max-w-[1400px] mx-auto px-4 md:px-8 py-8 space-y-8">
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <Analyzer
              onAnalyze={analyze}
              loading={loading}
              urlInput={urlInput}
              setUrlInput={setUrlInput}
            />
            <ResultPanel result={result} loading={loading} />
          </div>
          <div className="lg:col-span-2">
            <TrendingNews
              onVerify={(url) => {
                setUrlInput(url);
                analyze(url);
              }}
            />
          </div>
        </section>

        <section>
          <HistoryPanel
            history={history}
            onSelect={selectHistoryItem}
            onDelete={deleteItem}
            onClear={clearAll}
          />
        </section>

        <footer className="border-t border-slate-300 pt-6 pb-12 text-xs tracking-[0.2em] uppercase text-slate-500 flex flex-wrap justify-between gap-3">
          <span>Fake News Detection / BERT (RoBERTa-Fake-News-Classification)</span>
          <span>Sources: Google News RSS · Gemini Explainer</span>
        </footer>
      </main>
    </div>
  );
}
