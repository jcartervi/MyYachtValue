import * as React from "react";
import ResultsCard from "@/features/results/ResultsCard";

const DEFAULTS = {
  wholesale: 990_000,
  market: 1_650_000,
  replacement: 2_227_500,
};

function parsePositiveNumber(q: URLSearchParams, key: string, fallback: number) {
  const raw = Number(q.get(key));
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

type ErrorBoundaryState = { hasError: boolean };

class ResultsErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Boat valuation results failed to render", error);
  }

  private reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto w-full max-w-3xl px-4 py-12 text-center">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">We couldn't show your valuation</h2>
            <p className="mt-2 text-sm text-slate-500">
              Please refresh the page or try again with different inputs.
            </p>
            <button
              type="button"
              onClick={this.reset}
              className="mt-6 inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function BoatValuationPage() {
  React.useEffect(() => {
    const previous = document.title;
    document.title = "Boat Valuation | HullPrice";
    return () => {
      document.title = previous;
    };
  }, []);

  const q = new URLSearchParams(window.location.search);
  const parsedWholesale = parsePositiveNumber(q, "wholesale", DEFAULTS.wholesale);
  const parsedReplacement = parsePositiveNumber(q, "replacement", DEFAULTS.replacement);

  const [wholesale, replacement] = parsedWholesale <= parsedReplacement
    ? [parsedWholesale, parsedReplacement]
    : [parsedReplacement, parsedWholesale];

  const rawMarket = parsePositiveNumber(q, "market", DEFAULTS.market);
  const market = Math.min(Math.max(rawMarket, wholesale), replacement);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 md:px-6 py-8">
      <title>Boat Valuation | HullPrice</title>
      <ResultsErrorBoundary>
        <ResultsCard wholesale={wholesale} market={market} replacement={replacement} />
      </ResultsErrorBoundary>
    </main>
  );
}
