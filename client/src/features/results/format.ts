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

export function formatCompactUSD(value: number): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "$0";
  }

  // For values < $1,000,000, use full formatting
  if (value < 1_000_000) {
    return formatUSD(value);
  }

  // For values >= $1,000,000, use compact format (e.g., $2.3M)
  try {
    const millions = value / 1_000_000;
    const formatted = millions.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    });
    // Append M suffix (e.g., "$2.3" becomes "$2.3M")
    return formatted + "M";
  } catch (error) {
    // Fallback to manual formatting
    const millions = Math.round(value / 100_000) / 10;
    return `$${millions.toFixed(1)}M`;
  }
}
