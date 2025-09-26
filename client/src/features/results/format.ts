export function formatUSD(value: number): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "$0";
  }

  try {
    return value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
  } catch (error) {
    const safe = Math.round(value);
    return `$${safe.toLocaleString("en-US")}`;
  }
}
