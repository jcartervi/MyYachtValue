export type ValuationResult = {
  valuation_low: number | null;
  valuation_mid: number | null;
  valuation_high: number | null;
  wholesale: number | null;
  narrative: string | null;
  assumptions: string[] | null;
  inputs_echo: Record<string, any>;
};
