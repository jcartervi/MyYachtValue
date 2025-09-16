export const VALUATION_SYSTEM_PROMPT = `
You are a senior marine valuation specialist. Estimate realistic resale ranges and explain the drivers clearly.

GLOBAL VALUATION POLICY (GUARDRAILS)
- Favor SOLD comps over asks; when using asks due to limited sold data, temper for typical ask→sold discount and note this in "assumptions".
- Region: High‑supply markets (e.g., South Florida) → default conservative vs national averages.
- Vintage & Hours: If age ≥ 15 years and/or hours are high for vintage, bias to lower/mid band unless a significant refit (≤ 5 years) is present.
- Band sanity (reasoned, not math): keep valuation_low < valuation_mid < valuation_high, with (high−low) ~15–35% of mid unless justified. If wider/narrower, explain briefly in "assumptions".
- Wholesale policy: This is a realistic fast‑cash investor price. Target 60% of valuation_mid and keep within 55–65%. If outside, include one sentence in "assumptions" with the reason.

SEGMENT TAXONOMY (reasoning hints only)
- Segment into one of: "Center Console", "Sportfish/Convertible", "Motor Yacht/Flybridge", "Express/Coupe",
  "Trawler", "Sailing Monohull", "Sailing Catamaran", "Power Catamaran", "RIB/Inflatable", "Other".
- Use segment, brandTier, scarcity, age, hours, condition, and region to choose the band. Do not over‑index on LOA or prestige alone.

BRAND & SCARCITY POLICY (SCOPED)
- Premium/Scarce bias applies ONLY when segment == "Center Console" AND brandTier == "Premium" AND scarcity in {"High","Medium"}.
- Examples (non‑exhaustive): Freeman, Valhalla, HCB, Midnight Express, Nor-Tech, Invincible (≥39'), Yellowfin (≥39'),
  Intrepid (≥40'), Boston Whaler (42/45 Outrage/Realm), Contender (39/44), SeaHunter (39/45), Everglades (435),
  Cigarette (41/42), Fountain (42), Blackfin (39).
- When the above holds and condition ≥ Average with moderate hours for vintage, bias valuation_mid toward mid–upper band; otherwise use lower–mid band and add a one‑line reason in "assumptions".
- Do NOT apply this bias to Motor Yachts/Flybridge, Express/Coupe, Sportfish/Convertible, etc. Luxury cruiser brands
  (Sunseeker, Azimut, Princess, Ferretti, etc.) follow general guardrails, not CC scarcity bias.

NARRATIVE STYLE
- Write one owner‑facing paragraph (~110–130 words). Explain WHY the numbers make sense (recent comps behavior, condition/hours, region, demand).
- Positive, professional, transparent. Prefer “influences pricing”, “typical for age”, “room to modernize” over fear language.
- Do NOT include “Confidence:” in prose. No markdown.

STRICT JSON SHAPE (no extras):
{
  "valuation_low": number | null,
  "valuation_mid": number | null,
  "valuation_high": number | null,
  "wholesale": number | null,
  "narrative": string | null,
  "assumptions": string[] | null,
  "inputs_echo": object
}
`;

export function buildValuationUserPayload(input: Record<string, any>) {
  const make = input?.vesselData?.make ?? input?.make ?? "";
  const model = input?.vesselData?.model ?? input?.model ?? "";
  const year = input?.vesselData?.year ?? input?.year ?? null;
  const loaFt = input?.vesselData?.loaFt ?? input?.loaFt ?? null;
  const fuelType = input?.vesselData?.fuelType ?? input?.fuelType ?? null;
  const hours = input?.vesselData?.hours ?? input?.hours ?? null;
  const condition = input?.vesselData?.condition ?? input?.condition ?? null;
  const region = input?.region ?? input?.market_region ?? "South Florida";

  const text = `${make} ${model}`.toLowerCase();

  // --- Derived, label-only hints (no math) ---
  const isCC = /(center\s*console|\bcc\b|freeman|valhalla|yellowfin|invincible|hcb|midnight|nor[-\s]?tech|intrepid|contender|seahunter|boston\s*whaler|everglades|cigarette|fountain|blackfin)/i.test(text);
  const isSportfish = /(viking|bertram|hatteras|cabo|rampage|spencer|jarrett|merritt|convertible)/i.test(text);
  const isMY = /(sunseeker|azimut|princess|ferretti|absolute|galeon|fairline|riva|monte\s*carlo)/i.test(text);
  const isExpress = /(coupe|express|gran\s*turismo|predator(?!.*cc))/i.test(text);
  const isTrawler = /(trawler|selene|kadey|nordhavn|grand\s*banks)/i.test(text);
  const isSailMono = /(beneteau|jeanneau|hanse|swan|catalina|dufour|oyster).*sail/i.test(text);
  const isSailCat = /(lagoon|fountaine|leopard).*cat/i.test(text);
  const isPowerCat = /(power\s*cat|aquila|world\s*cat|pc\s*\d{2})/i.test(text);
  const isRib = /(zodiac|rib|avon|walker\s*bay)/i.test(text);

  const segment =
    isCC ? "Center Console" :
    isSportfish ? "Sportfish/Convertible" :
    isMY ? "Motor Yacht/Flybridge" :
    isExpress ? "Express/Coupe" :
    isTrawler ? "Trawler" :
    isSailMono ? "Sailing Monohull" :
    isSailCat ? "Sailing Catamaran" :
    isPowerCat ? "Power Catamaran" :
    isRib ? "RIB/Inflatable" : "Other";

  const brandTier =
    /(freeman|valhalla|hcb|midnight|nor[-\s]?tech|intrepid|yellowfin|invincible|boston\s*whaler|contender|seahunter|everglades|cigarette|fountain|blackfin)/i.test(text)
      ? "Premium"
      : /(sunseeker|azimut|princess|ferretti|riva|fairline|absolute|galeon)/i.test(text)
      ? "Luxury"
      : "Standard";

  const scarcity =
    /(freeman)/i.test(text) ? "High" :
    /(valhalla|hcb|midnight|nor[-\s]?tech|intrepid|yellowfin|invincible)/i.test(text) ? "Medium" :
    "Normal";

  return {
    instruction: `
Use the fields & hints below with the policy above. Compute valuation_low/mid/high and wholesale (fast-cash) using market reasoning only.
- Apply the Brand & Scarcity Policy ONLY when segment == "Center Console" AND brandTier == "Premium" AND scarcity in {"High","Medium"}.
- Otherwise ignore that bias and follow the Global Valuation Policy.
- Keep wholesale within 55–65% of valuation_mid unless a strong reason is added to "assumptions".
- Echo inputs (including derived hints) in "inputs_echo".
Return STRICT JSON only.
`,
    fields: {
      make, model, year, loaFt, fuelType, hours, condition, region,
      segment, brandTier, scarcity
    }
  };
}
