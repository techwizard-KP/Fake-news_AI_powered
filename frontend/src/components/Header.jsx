import { ShieldCheck } from "@phosphor-icons/react";

export default function Header() {
  return (
    <header className="border-b border-slate-300 bg-white" data-testid="app-header">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 flex items-center justify-center">
            <ShieldCheck size={22} weight="duotone" color="#fff" />
          </div>
          <div>
            <div className="font-chivo font-black text-lg leading-none caret" data-testid="brand-name">
              VERITAS.BERT
            </div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-slate-500 mt-1">
              Fake News Detection System
            </div>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-xs tracking-[0.2em] uppercase font-bold text-slate-600">
          <a href="#analyzer" className="hover:text-slate-900 transition-colors">Analyzer</a>
          <a href="#trending" className="hover:text-slate-900 transition-colors">Trending</a>
          <a href="#history" className="hover:text-slate-900 transition-colors">History</a>
          <span className="border border-slate-300 px-3 py-1.5 bg-emerald-50 text-emerald-700">
            ● Model Online
          </span>
        </nav>
      </div>
    </header>
  );
}
