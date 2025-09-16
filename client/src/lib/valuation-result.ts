import { z } from "zod";

export const valuationResultSchema = z.object({
  valuation_low: z.number().nullable(),
  valuation_mid: z.number().nullable(),
  valuation_high: z.number().nullable(),
  wholesale: z.number().nullable(),
  narrative: z.string().nullable(),
  assumptions: z.array(z.string()).nullable(),
  inputs_echo: z.record(z.any()),
});

export type ValuationResult = z.infer<typeof valuationResultSchema>;

const numberLikeKeys = [
  "low",
  "valuation_low",
  "min",
  "minimum",
  "floor",
];

const midNumberKeys = [
  "mid",
  "valuation_mid",
  "median",
  "midpoint",
  "average",
  "mean",
  "mostLikely",
  "most_likely",
];

const highNumberKeys = [
  "high",
  "valuation_high",
  "max",
  "maximum",
  "ceiling",
];

const wholesaleNumberKeys = [
  "wholesale",
  "valuation_wholesale",
  "wholesale_estimate",
];

const assumptionKeys = ["assumptions", "valuation_assumptions"];

const narrativeKeys = ["narrative", "valuation_narrative", "analysis"];

const inputsKeys = [
  "inputs_echo",
  "inputsEcho",
  "inputs",
  "valuation_inputs",
];

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return null;
}

function extractFirstNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    if (key in source) {
      const value = coerceNumber(source[key]);
      if (value !== null) {
        return value;
      }
    }
  }
  return null;
}

function extractAssumptions(source: Record<string, unknown>): string[] | null {
  for (const key of assumptionKeys) {
    if (key in source) {
      const value = source[key];
      if (Array.isArray(value)) {
        const filtered = value.filter((item): item is string => typeof item === "string");
        return filtered.length > 0 ? filtered : [];
      }
    }
  }
  return null;
}

function extractNarrative(source: Record<string, unknown>): string | null {
  for (const key of narrativeKeys) {
    if (key in source) {
      const value = source[key];
      if (typeof value === "string") {
        return value;
      }
    }
  }
  return null;
}

function extractInputsEcho(source: Record<string, unknown>): Record<string, unknown> {
  for (const key of inputsKeys) {
    if (key in source) {
      const value = source[key];
      if (value && typeof value === "object") {
        return value as Record<string, unknown>;
      }
    }
  }
  return {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function floor10k(n: number | null): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) {
    return null;
  }
  return Math.floor(n / 10000) * 10000;
}

/**
 * Normalizes valuation responses so the UI can rely on a consistent shape regardless of the backend version.
 * If the flat ValuationResult shape is present it is returned directly. Otherwise the function attempts to
 * construct the flat shape from legacy nested payloads. Returns null if no valuation-like data can be found.
 */
export function normalizeValuationResponse(raw: unknown): ValuationResult | null {
  const flatParse = valuationResultSchema.safeParse(raw);
  if (flatParse.success) {
    return flatParse.data;
  }

  if (!isRecord(raw)) {
    return null;
  }

  const rawRecord = raw as Record<string, unknown>;
  const dataSection = isRecord(rawRecord.data) ? (rawRecord.data as Record<string, unknown>) : rawRecord;
  const valuationSection = isRecord(dataSection.valuation)
    ? (dataSection.valuation as Record<string, unknown>)
    : isRecord(rawRecord.valuation)
      ? (rawRecord.valuation as Record<string, unknown>)
      : undefined;

  if (!valuationSection) {
    return null;
  }

  const valuation_low = extractFirstNumber(valuationSection, numberLikeKeys);
  const valuation_mid = extractFirstNumber(valuationSection, midNumberKeys);
  const valuation_high = extractFirstNumber(valuationSection, highNumberKeys);
  const valuation_wholesale = extractFirstNumber(valuationSection, wholesaleNumberKeys);

  const narrative = extractNarrative(dataSection) ?? extractNarrative(rawRecord);
  const assumptions = extractAssumptions(dataSection) ?? extractAssumptions(rawRecord);
  const inputsFromData = extractInputsEcho(dataSection);
  const inputsFromRaw = extractInputsEcho(rawRecord);
  const inputs_echo = Object.keys(inputsFromData).length > 0 ? inputsFromData : inputsFromRaw;

  const midFallback =
    valuation_low !== null && valuation_high !== null
      ? Math.round((valuation_low + valuation_high) / 2)
      : null;
  const midBase = valuation_mid ?? midFallback;
  const computedWholesale = valuation_wholesale ?? floor10k(midBase !== null ? midBase * 0.60 : null);

  const candidate = {
    valuation_low,
    valuation_mid,
    valuation_high,
    wholesale: computedWholesale,
    narrative: narrative ?? null,
    assumptions: assumptions ?? null,
    inputs_echo,
  } satisfies ValuationResult;

  const parsedCandidate = valuationResultSchema.safeParse(candidate);
  if (!parsedCandidate.success) {
    return null;
  }

  const hasAnyContent =
    parsedCandidate.data.valuation_low !== null ||
    parsedCandidate.data.valuation_mid !== null ||
    parsedCandidate.data.valuation_high !== null ||
    parsedCandidate.data.wholesale !== null ||
    (parsedCandidate.data.assumptions?.length ?? 0) > 0 ||
    (parsedCandidate.data.narrative !== null && parsedCandidate.data.narrative.trim().length > 0) ||
    Object.keys(parsedCandidate.data.inputs_echo ?? {}).length > 0;

  if (!hasAnyContent) {
    return null;
  }

  return parsedCandidate.data;
}

