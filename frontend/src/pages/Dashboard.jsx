import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import Header from "@/components/Header";
import Analyzer from "@/components/Analyzer";
import ResultPanel from "@/components/ResultPanel";
import ChatPanel from "@/components/ChatPanel";
import TrendingNews from "@/components/TrendingNews";
import HistoryPanel from "@/components/HistoryPanel";
import StatsBar from "@/components/StatsBar";

export default function Dashboard() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ total: 0, fake: 0, real: 0 });
  const [urlInput, setUrlInput] = useState("");
  const resultRef = useRef(null);

  const scrollToResult = () => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        const node = resultRef.current;
        if (!node) return;
        const rect = node.getBoundingClientRect();
        const absoluteTop = window.scrollY + rect.top - 80;
        window.scrollTo({ top: absoluteTop, behavior: "smooth" });
      }, 50);
    });
  };

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await api.get("/history");
      setHistory(data);
    } catch (e) {
      logger.error(e);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get("/stats");
      setStats(data);
    } catch (e) {
      logger.error(e);
    }
  }, []);

  useEffect(() => {
    loadHistory();
    loadStats();
  }, [loadHistory, loadStats]);

  const analyze = async (input, isText = false) => {
    setLoading(true);
    setResult(null);
    scrollToResult();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    
    try {
      let response;
      
      if (isText) {
        // Send text in request body for POST
        response = await api.post("/analyze-fast", { text: input }, {
          signal: controller.signal
        });
      } else {
        // Use URL endpoint
        response = await api.post("/analyze", { url: input }, {
          signal: controller.signal
        });
      }
      
      clearTimeout(timeoutId);
      setResult(response.data);
      toast.success(`Classified as ${response.data.verdict}`);
      loadHistory();
      loadStats();
      scrollToResult();
    } catch (e) {
      clearTimeout(timeoutId);
      
      if (e.name === 'AbortError' || e.code === 'ECONNABORTED') {
        toast.error("Analysis is taking too long. Please try again.");
        logger.error("Request timeout:", input);
      } else {
        const msg = e?.response?.data?.detail || e.message || "Analysis failed";
        toast.error(msg);
        logger.error("Analysis error:", e);
        console.error("Full error:", e);
      }
    } finally {
      setLoading(false);
    }
  };

  const selectHistoryItem = (item) => {
    setResult(item);
    scrollToResult();
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
            <div ref={resultRef} style={{ scrollMarginTop: 90 }}>
              <ResultPanel result={result} loading={loading} />
            </div>
            {result?.id && <ChatPanel analysisId={result.id} verdict={result.verdict} />}
          </div>
          <div className="lg:col-span-2">
            <TrendingNews
              onVerify={(url) => {
                setUrlInput(url);
                analyze(url, false);
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