import { useState } from "react";
import { Link as LinkIcon, MagnifyingGlass, CircleNotch, TextAlignLeft } from "@phosphor-icons/react";
import { toast } from "sonner";

const EXAMPLES = [
  { label: "BBC", url: "https://www.bbc.com/news/world-us-canada-68707628" },
  { label: "Reuters", url: "https://www.reuters.com/technology/" },
  { label: "Onion (Satire)", url: "https://www.theonion.com/" },
];

export default function Analyzer({ onAnalyze, loading, urlInput, setUrlInput }) {
  const [focused, setFocused] = useState(false);
  const [inputMode, setInputMode] = useState("url"); // "url" or "text"

  const submit = (e) => {
    e.preventDefault();
    
    if (inputMode === "url") {
      const url = urlInput.trim();
      if (!url) {
        toast.error("Please paste a news article URL");
        return;
      }
      if (!/^https?:\/\//i.test(url)) {
        toast.error("URL must start with http:// or https://");
        return;
      }
      onAnalyze(url, false); // false = URL mode
    } else {
      // Text mode - send text directly to backend
      const text = urlInput.trim();
      if (!text) {
        toast.error("Please paste article text");
        return;
      }
      onAnalyze(text, true); // true = text mode
    }
  };

  return (
    <section id="analyzer" className="border border-slate-300 bg-white" data-testid="analyzer-section">
      <div className="border-b border-slate-300 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs tracking-[0.25em] uppercase font-bold text-slate-600">
          <span className="w-2 h-2 bg-emerald-500 inline-block"></span>
          01 · URL Analyzer
        </div>
        <span className="text-[10px] tracking-[0.25em] uppercase text-slate-500">BERT Classification</span>
      </div>

      <div className="p-6 md:p-8">
        <h1 className="font-chivo text-4xl sm:text-5xl font-black tracking-tighter text-slate-900 leading-[1.05]" data-testid="analyzer-title">
          Detect misinformation.<br />
          <span className="text-slate-400">In two seconds.</span>
        </h1>
        <p className="mt-4 text-slate-600 max-w-2xl">
          Paste any news article URL or text. A <strong className="text-slate-900">Gemini</strong> fact-checker
          delivers the primary verdict — <strong className="text-emerald-700">REAL</strong> or{" "}
          <strong className="text-red-700">FAKE</strong> — backed by a fine-tuned{" "}
          <strong className="text-slate-900">RoBERTa</strong> BERT classifier as a secondary signal,
          plus a forensic explanation.
        </p>

        {/* Mode Toggle Buttons */}
        <div className="mt-6 flex gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setInputMode("url")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              inputMode === "url" 
                ? "text-slate-900 border-b-2 border-slate-900" 
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <LinkIcon size={16} className="inline mr-1" />
            URL Mode
          </button>
          <button
            type="button"
            onClick={() => setInputMode("text")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              inputMode === "text" 
                ? "text-slate-900 border-b-2 border-slate-900" 
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <TextAlignLeft size={16} className="inline mr-1" />
            Text Mode
          </button>
        </div>

        <form onSubmit={submit} className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
          <div
            className={`flex items-start border bg-slate-50 px-4 transition-colors ${
              focused ? "border-slate-900" : "border-slate-300"
            }`}
          >
            {inputMode === "url" ? (
              <LinkIcon size={18} className="text-slate-500 shrink-0 mt-4" />
            ) : (
              <TextAlignLeft size={18} className="text-slate-500 shrink-0 mt-4" />
            )}
            {inputMode === "url" ? (
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="https://example.com/news-article"
                className="w-full bg-transparent py-3.5 px-3 outline-none text-slate-900 placeholder:text-slate-400"
                disabled={loading}
              />
            ) : (
              <textarea
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="Paste the news article text here... (e.g., 'Breaking news: Scientists discover miracle cure...')"
                rows={4}
                className="w-full bg-transparent py-3.5 px-3 outline-none text-slate-900 placeholder:text-slate-400 font-mono text-sm"
                disabled={loading}
              />
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-slate-900 text-white px-6 py-3.5 font-bold uppercase tracking-[0.15em] text-sm hover:bg-slate-800 transition-colors disabled:bg-slate-400 flex items-center justify-center gap-2"
            data-testid="analyze-button"
          >
            {loading ? (
              <>
                <CircleNotch size={18} className="animate-spin" />
                Analyzing
              </>
            ) : (
              <>
                <MagnifyingGlass size={18} weight="bold" />
                Verify {inputMode === "url" ? "Article" : "Text"}
              </>
            )}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 tracking-[0.2em] uppercase font-bold mr-1">Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.url}
              type="button"
              onClick={() => setUrlInput(ex.url)}
              className="border border-slate-300 bg-white px-3 py-1 hover:border-slate-900 hover:bg-slate-900 hover:text-white transition-colors"
              data-testid={`example-${ex.label}`}
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}