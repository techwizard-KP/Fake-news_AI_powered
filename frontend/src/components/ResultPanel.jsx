import { WarningOctagon, SealCheck, ArrowSquareOut, Brain } from "@phosphor-icons/react";

function inline(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, '<code class="bg-slate-100 px-1">$1</code>');
}

function ExplanationMarkdown({ text }) {
  if (!text) return null;
  const lines = text.split("\n").filter((l) => l.trim().length);
  const elements = [];
  let listBuffer = [];
  const flushList = () => {
    if (listBuffer.length) {
      elements.push(
        <ul key={`ul-${elements.length}`}>
          {listBuffer.map((l, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: inline(l) }} />
          ))}
        </ul>
      );
      listBuffer = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (/^[-*•]\s+/.test(line)) {
      listBuffer.push(line.replace(/^[-*•]\s+/, ""));
    } else {
      flushList();
      elements.push(
        <p key={`p-${elements.length}`} dangerouslySetInnerHTML={{ __html: inline(line) }} />
      );
    }
  }
  flushList();
  return <div className="ai-prose text-sm">{elements}</div>;
}

function ConfidenceBar({ verdict, confidence }) {
  const pct = Math.round((confidence || 0) * 100);
  const isFake = verdict === "FAKE";
  const fillColor = isFake ? "bg-red-500" : "bg-emerald-500";
  return (
    <div data-testid="confidence-bar">
      <div className="flex items-end justify-between mb-2">
        <span className="text-[10px] tracking-[0.3em] uppercase font-bold text-slate-500">
          Model Confidence
        </span>
        <span className={`font-chivo font-black text-2xl ${isFake ? "text-red-600" : "text-emerald-600"}`}>
          {pct}%
        </span>
      </div>
      <div className="h-3 bg-slate-100 border border-slate-300 relative overflow-hidden">
        <div className={`h-full ${fillColor} confidence-fill`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between mt-1 text-[10px] tracking-[0.2em] uppercase text-slate-400 font-bold">
        <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
      </div>
    </div>
  );
}

export default function ResultPanel({ result, loading }) {
  if (loading) {
    return (
      <section className="border border-slate-300 bg-white" data-testid="result-loading">
        <div className="border-b border-slate-300 px-5 py-3 text-xs tracking-[0.25em] uppercase font-bold text-slate-600">
          02 · Running BERT Inference
        </div>
        <div className="p-8 space-y-4">
          <div className="h-8 bg-slate-100 animate-pulse w-2/3" />
          <div className="h-4 bg-slate-100 animate-pulse w-full" />
          <div className="h-4 bg-slate-100 animate-pulse w-5/6" />
          <div className="h-24 bg-slate-100 animate-pulse" />
          <div className="text-xs tracking-[0.2em] uppercase text-slate-500 font-bold">
            ● Fetching article → Tokenizing → Classifying → Explaining
          </div>
        </div>
      </section>
    );
  }

  if (!result) {
    return (
      <section className="border border-slate-300 bg-white" data-testid="result-empty">
        <div className="border-b border-slate-300 px-5 py-3 text-xs tracking-[0.25em] uppercase font-bold text-slate-600">
          02 · Classification Result
        </div>
        <div className="p-10 text-center">
          <Brain size={40} className="mx-auto text-slate-300" />
          <p className="mt-4 text-slate-500 text-sm">
            Enter a URL above to see the verdict, confidence, and AI explanation.
          </p>
        </div>
      </section>
    );
  }

  const isFake = result.verdict === "FAKE";
  const verdictBg = isFake ? "bg-red-50 border-red-300" : "bg-emerald-50 border-emerald-300";
  const verdictText = isFake ? "text-red-700" : "text-emerald-700";

  return (
    <section className="border border-slate-300 bg-white" data-testid="result-panel">
      <div className="border-b border-slate-300 px-5 py-3 flex items-center justify-between">
        <div className="text-xs tracking-[0.25em] uppercase font-bold text-slate-600">
          02 · Classification Result
        </div>
        <a
          href={result.url}
          target="_blank"
          rel="noreferrer"
          className="text-xs tracking-[0.2em] uppercase text-slate-600 hover:text-slate-900 flex items-center gap-1"
          data-testid="source-link"
        >
          Source <ArrowSquareOut size={12} />
        </a>
      </div>

      <div className={`p-6 md:p-8 border-b-4 ${verdictBg}`}>
        <div className="flex items-start gap-4">
          <div className={`w-14 h-14 flex items-center justify-center border-2 ${isFake ? "border-red-500 bg-white" : "border-emerald-500 bg-white"}`}>
            {isFake ? (
              <WarningOctagon size={30} weight="fill" className="text-red-500" />
            ) : (
              <SealCheck size={30} weight="fill" className="text-emerald-500" />
            )}
          </div>
          <div className="flex-1">
            <div className={`text-[10px] tracking-[0.3em] uppercase font-bold ${verdictText}`}>
              Verdict
            </div>
            <div
              className={`font-chivo font-black text-5xl md:text-6xl tracking-tighter leading-none ${verdictText}`}
              data-testid="verdict-label"
            >
              {result.verdict}
            </div>
            <div className="text-xs text-slate-500 mt-2 tracking-[0.15em] uppercase">
              {isFake
                ? "Article shows signals of misinformation"
                : "Article appears to be genuine reporting"}
            </div>
          </div>
        </div>
        <div className="mt-6">
          <ConfidenceBar verdict={result.verdict} confidence={result.confidence} />
        </div>
      </div>

      <div className="p-6 md:p-8 border-b border-slate-300">
        <div className="text-[10px] tracking-[0.3em] uppercase font-bold text-slate-500 mb-2">
          Analyzed Article
        </div>
        <h3 className="font-chivo font-bold text-xl text-slate-900 leading-tight" data-testid="article-title">
          {result.title}
        </h3>
        {result.description && (
          <p className="text-sm text-slate-600 mt-2">{result.description}</p>
        )}
      </div>

      <div className="p-6 md:p-8">
        <div className="flex items-center gap-2 mb-3">
          <Brain size={16} className="text-slate-900" weight="duotone" />
          <div className="text-[10px] tracking-[0.3em] uppercase font-bold text-slate-600">
            Forensic Explanation · Gemini
          </div>
        </div>
        <div data-testid="explanation">
          <ExplanationMarkdown text={result.explanation} />
        </div>
      </div>
    </section>
  );
}
