import { useRef, forwardRef } from "react";
import { WarningOctagon, SealCheck, ArrowSquareOut, Brain, Scales, FilePdf, ImageSquare } from "@phosphor-icons/react";
import DOMPurify from "dompurify";
import { downloadPdf, downloadPng } from "@/lib/exportCard";
import { toast } from "sonner";

function inline(s) {
  const html = s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, '<code class="bg-slate-100 px-1">$1</code>');
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: ["strong", "code"], ALLOWED_ATTR: ["class"] });
}

function ExplanationMarkdown({ text }) {
  if (!text) return null;
  const lines = text.split("\n").filter((l) => l.trim().length);
  const elements = [];
  let listBuffer = [];
  const flushList = (idx) => {
    if (listBuffer.length) {
      const items = [...listBuffer];
      elements.push(
        <ul key={`ul-${idx}-${items.length}`}>
          {items.map((l, i) => (
            <li key={`li-${idx}-${i}-${l.slice(0, 20)}`} dangerouslySetInnerHTML={{ __html: inline(l) }} />
          ))}
        </ul>
      );
      listBuffer = [];
    }
  };
  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (/^[-*•]\s+/.test(line)) {
      listBuffer.push(line.replace(/^[-*•]\s+/, ""));
    } else {
      flushList(idx);
      elements.push(
        <p key={`p-${idx}-${line.slice(0, 20)}`} dangerouslySetInnerHTML={{ __html: inline(line) }} />
      );
    }
  });
  flushList(lines.length);
  return <div className="ai-prose text-sm">{elements}</div>;
}

function ConfidenceBar({ verdict, confidence }) {
  const pct = Math.round((confidence || 0) * 100);
  const { color, bar } = VERDICT_STYLES[verdict] || VERDICT_STYLES.UNKNOWN;
  return (
    <div data-testid="confidence-bar">
      <div className="flex items-end justify-between mb-2">
        <span className="text-[10px] tracking-[0.3em] uppercase font-bold text-slate-500">
          {verdict === "UNCERTAIN" ? "Agreement Level" : "Model Confidence"}
        </span>
        <span className={`font-chivo font-black text-2xl ${color}`}>
          {pct}%
        </span>
      </div>
      <div className="h-3 bg-slate-100 border border-slate-300 relative overflow-hidden">
        <div className={`h-full ${bar} confidence-fill`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between mt-1 text-[10px] tracking-[0.2em] uppercase text-slate-400 font-bold">
        <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
      </div>
    </div>
  );
}

const VERDICT_STYLES = {
  FAKE: { color: "text-red-600", bar: "bg-red-500" },
  REAL: { color: "text-emerald-600", bar: "bg-emerald-500" },
  UNCERTAIN: { color: "text-amber-600", bar: "bg-amber-500" },
  UNKNOWN: { color: "text-slate-500", bar: "bg-slate-300" },
};

function ModelCard({ label, verdict, confidence, reason, testid }) {
  const pct = Math.round((confidence || 0) * 100);
  const { color, bar } = VERDICT_STYLES[verdict] || VERDICT_STYLES.UNKNOWN;
  return (
    <div className="p-5" data-testid={testid}>
      <div className="text-[10px] tracking-[0.3em] uppercase font-bold text-slate-500">{label}</div>
      <div className={`font-chivo font-black text-2xl mt-1 ${color}`}>{verdict || "—"}</div>
      <div className="flex items-center gap-3 mt-3">
        <div className="flex-1 h-2 bg-slate-100 border border-slate-200 overflow-hidden">
          <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`text-xs font-bold ${color}`}>{pct}%</span>
      </div>
      {reason && <p className="text-xs text-slate-600 mt-2 italic">&ldquo;{reason}&rdquo;</p>}
    </div>
  );
}

function ExportButtons({ cardRef, title }) {
  const safeName = (title || "verdict").replace(/[^a-z0-9-_]+/gi, "_").slice(0, 60);
  const handle = async (kind) => {
    if (!cardRef.current) return;
    try {
      if (kind === "pdf") {
        await downloadPdf(cardRef.current, `${safeName}_verdict.pdf`);
        toast.success("PDF downloaded");
      } else {
        await downloadPng(cardRef.current, `${safeName}_verdict.png`);
        toast.success("Image downloaded");
      }
    } catch {
      toast.error("Export failed");
    }
  };
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handle("png")}
        className="text-[10px] tracking-[0.2em] uppercase font-bold text-slate-600 hover:text-slate-900 border border-slate-300 hover:border-slate-900 px-2.5 py-1 flex items-center gap-1 transition-colors"
        data-testid="export-png-button"
        title="Download as PNG"
      >
        <ImageSquare size={12} weight="bold" /> PNG
      </button>
      <button
        onClick={() => handle("pdf")}
        className="text-[10px] tracking-[0.2em] uppercase font-bold text-slate-600 hover:text-slate-900 border border-slate-300 hover:border-slate-900 px-2.5 py-1 flex items-center gap-1 transition-colors"
        data-testid="export-pdf-button"
        title="Download as PDF"
      >
        <FilePdf size={12} weight="bold" /> PDF
      </button>
    </div>
  );
}

const ResultPanel = forwardRef(function ResultPanel({ result, loading }, ref) {
  const cardRef = useRef(null);
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

  const v = result.verdict;
  const isFake = v === "FAKE";
  const isReal = v === "REAL";
  const isUncertain = v === "UNCERTAIN";
  let verdictBg = "bg-slate-50 border-slate-300";
  let verdictText = "text-slate-700";
  let verdictBorder = "border-slate-400";
  let verdictIcon = <Brain size={30} weight="fill" className="text-slate-500" />;
  let subCopy = "Verdict not available";
  if (isFake) {
    verdictBg = "bg-red-50 border-red-300";
    verdictText = "text-red-700";
    verdictBorder = "border-red-500";
    verdictIcon = <WarningOctagon size={30} weight="fill" className="text-red-500" />;
    subCopy = "Article shows signals of misinformation";
  } else if (isReal) {
    verdictBg = "bg-emerald-50 border-emerald-300";
    verdictText = "text-emerald-700";
    verdictBorder = "border-emerald-500";
    verdictIcon = <SealCheck size={30} weight="fill" className="text-emerald-500" />;
    subCopy = "Article appears to be genuine reporting";
  } else if (isUncertain) {
    verdictBg = "bg-amber-50 border-amber-300";
    verdictText = "text-amber-700";
    verdictBorder = "border-amber-500";
    verdictIcon = <Scales size={30} weight="fill" className="text-amber-500" />;
    subCopy = "Models disagreed · review both opinions below";
  }

  return (
    <section ref={ref} className="border border-slate-300 bg-white" data-testid="result-panel">
      <div className="border-b border-slate-300 px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs tracking-[0.25em] uppercase font-bold text-slate-600">
          02 · Classification Result
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons cardRef={cardRef} title={result.title} />
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
      </div>

      {/* Captured area for PDF/PNG export */}
      <div ref={cardRef}>

      <div className={`p-6 md:p-8 border-b-4 ${verdictBg}`}>
        <div className="flex items-start gap-4">
          <div className={`w-14 h-14 flex items-center justify-center border-2 ${verdictBorder} bg-white`}>
            {verdictIcon}
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
              {subCopy}
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

      {(result.bert_verdict || result.gemini_verdict) && (
        <div className="border-b border-slate-300 grid grid-cols-2 divide-x divide-slate-300" data-testid="model-breakdown">
          <ModelCard
                label="Gemini · 2.5 Flash (primary)"  // ← LEFT
                verdict={result.gemini_verdict}
                confidence={result.gemini_confidence}
                reason={result.gemini_reason}
                testid="gemini-card"
              />
              <ModelCard
                label="BERT · RoBERTa (secondary)"  // ← RIGHT
                verdict={result.bert_verdict}
                confidence={result.bert_confidence}
                testid="bert-card"
              />
          {result.agreement === false && (
            <div className="col-span-2 px-6 py-3 bg-amber-50 border-t border-amber-300 text-xs tracking-[0.15em] uppercase font-bold text-amber-800 flex items-center gap-2" data-testid="disagreement-banner">
            <span className="w-2 h-2 bg-amber-500 inline-block" />
            Gemini (primary) and BERT (secondary- legendary 2017 Dataset) disagreed · Gemini verdict was used
          </div>
          )}
        </div>
      )}

      <div className="p-6 md:p-8">
        <div className="flex items-center gap-2 mb-3">
          <Brain size={16} className="text-slate-900" weight="duotone" />
          <div className="text-[10px] tracking-[0.3em] uppercase font-bold text-slate-600">
            Forensic Explanation · Ensemble Review
          </div>
        </div>
        <div data-testid="explanation">
          <ExplanationMarkdown text={result.explanation} />
        </div>
      </div>
      </div>{/* /cardRef */}
    </section>
  );
});

export default ResultPanel;
