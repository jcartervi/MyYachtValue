import * as React from "react";

type Level = "Low" | "Medium" | "High";

export function ConfidenceBadge({ level }: { level?: string | null }) {
  const lv = (level || "Medium") as Level;
  const color =
    lv === "High" ? "bg-green-100 text-green-800"
    : lv === "Low" ? "bg-amber-100 text-amber-800"
    : "bg-sky-100 text-sky-800";

  const text =
    lv === "High"
      ? "High: recent comps and clear market signals."
      : lv === "Low"
      ? "Low: limited comps or variable market signals — verify before listing."
      : "Medium: reasonable comps available, but pricing can vary with equipment, timing, and presentation.";

  return (
    <div className="inline-flex items-center gap-2">
      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${color}`}>
        Confidence: {lv}
      </span>
      <span className="group relative cursor-help text-xs text-slate-500">
        What’s this?
        <span className="invisible group-hover:visible absolute z-10 mt-2 w-72 rounded-md bg-white p-3 text-left text-[11px] leading-5 text-slate-700 shadow-lg ring-1 ring-black/5">
          {text}
        </span>
      </span>
    </div>
  );
}
