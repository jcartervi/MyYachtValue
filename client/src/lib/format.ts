/**
 * Currency formatting utilities for yacht valuations.
 * Provides both full and compact formatting options for responsive layouts.
 */

/**
 * Formats a number as full US Dollar currency string.
 * @param value - The numeric value to format
 * @returns Full currency format (e.g., "$2,300,000")
 * @example formatUSD(2300000) // "$2,300,000"
 */
export function formatUSD(value: number): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "$0";
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  } catch (error) {
    const safe = Math.round(value);
    return `$${safe.toLocaleString("en-US")}`;
  }
}

/**
 * Formats a number as compact US Dollar currency string.
 * Uses compact notation (K/M/B) for large values, with special rules:
 * - Values < $1M: Returns full format with no decimals (e.g., "$999,000")
 * - Values >= $1M: Returns compact format with uppercase suffix (e.g., "$2.3M")
 * 
 * @param value - The numeric value to format
 * @returns Compact currency format (e.g., "$2.3M") or full format for values < $1M
 * @example
 * formatUSDCompact(500000)   // "$500,000"
 * formatUSDCompact(2300000)  // "$2.3M"
 * formatUSDCompact(1500000000) // "$1.5B"
 */
export function formatUSDCompact(value: number): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "$0";
  }

  // For values < $1M, use full format with 0 decimals
  if (Math.abs(value) < 1_000_000) {
    return formatUSD(value);
  }

  try {
    // Use Intl.NumberFormat with compact notation
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    });

    let formatted = formatter.format(value);

    // Normalize to uppercase suffix and remove spaces
    // Intl may produce: "$2.3M", "$2.3 M", "$2.3m", etc.
    formatted = formatted
      .replace(/\s+/g, "") // Remove all spaces
      .replace(/k$/i, "K") // Normalize 'k' to 'K'
      .replace(/m$/i, "M") // Normalize 'm' to 'M'
      .replace(/b$/i, "B") // Normalize 'b' to 'B'
      .replace(/t$/i, "T"); // Normalize 't' to 'T' (trillion)

    return formatted;
  } catch (error) {
    // Fallback: manual compact formatting
    const absValue = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    
    if (absValue >= 1_000_000_000_000) {
      return `${sign}$${(absValue / 1_000_000_000_000).toFixed(1)}T`;
    } else if (absValue >= 1_000_000_000) {
      return `${sign}$${(absValue / 1_000_000_000).toFixed(1)}B`;
    } else if (absValue >= 1_000_000) {
      return `${sign}$${(absValue / 1_000_000).toFixed(1)}M`;
    } else if (absValue >= 1_000) {
      return `${sign}$${(absValue / 1_000).toFixed(1)}K`;
    }
    
    return formatUSD(value);
  }
}
