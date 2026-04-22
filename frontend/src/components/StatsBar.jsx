export default function StatsBar({ stats }) {
  const total = stats?.total ?? 0;
  const fake = stats?.fake ?? 0;
  const real = stats?.real ?? 0;
  const items = [
    { label: "Articles Analyzed", value: total, color: "text-slate-900" },
    { label: "Flagged Fake", value: fake, color: "text-red-600" },
    { label: "Verified Real", value: real, color: "text-emerald-600" },
    { label: "Model", value: "RoBERTa", color: "text-slate-900", small: true },
  ];
  return (
    <div className="border-b border-slate-300 bg-white" data-testid="stats-bar">
      <div className="max-w-[1400px] mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-300">
        {items.map((it, i) => (
          <div key={i} className="px-4 md:px-8 py-5" data-testid={`stat-${it.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <div className="text-[10px] tracking-[0.3em] uppercase font-bold text-slate-500">{it.label}</div>
            <div className={`font-chivo font-black mt-1 ${it.color} ${it.small ? "text-2xl" : "text-3xl md:text-4xl"}`}>
              {it.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
