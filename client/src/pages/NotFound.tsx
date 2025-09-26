import { Link } from "wouter";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 py-16 text-center">
      <div className="w-full rounded-3xl border border-slate-200 bg-white px-6 py-12 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">404</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">We couldn&apos;t find that page.</h1>
        <p className="mt-3 text-sm text-slate-500">
          Let&apos;s get you back to HullPrice so you can complete your valuation.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex min-w-[180px] items-center justify-center rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900"
          >
            Go to homepage
          </Link>
          <Link
            href="/boat-valuation"
            className="inline-flex min-w-[180px] items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            View valuation flow
          </Link>
        </div>
      </div>
    </main>
  );
}
