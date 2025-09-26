export const LABELS = {
  wholesale: "Wholesale",
  market: "Market Value",
  replacement: "Replacement Cost",
} as const;
export type LabelKey = keyof typeof LABELS;
