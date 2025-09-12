export default function HeroHeader() {
  return (
    <header className="relative isolate">
      {/* Background image */}
      <div className="absolute inset-0 -z-10">
        <img
          src="https://cdn.yachtbroker.org/images/highdef/2832550_150828e9_1.jpg"
          alt="Premium yacht underway at sunset"
          className="h-full w-full object-cover"
          loading="eager"
          fetchPriority="high"
        />
        {/* Overlay gradient for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/60" />
      </div>

      {/* Top bar / logo slot */}
      <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/your-logo.svg" alt="DeckWorth" className="h-10 w-auto" />
          <div className="text-white/90">
            <div className="font-semibold leading-none text-white">DeckWorth</div>
            <div className="text-xs opacity-80">Instant Boat Valuations</div>
          </div>
        </div>

        <nav className="hidden sm:flex items-center gap-4 text-white/85">
          <a href="#how" className="hover:text-white">How it works</a>
          <a href="#estimate" className="hover:text-white">Get Estimate</a>
          <a href="#contact" className="rounded-lg px-3 py-2 bg-white/10 hover:bg-white/20">Contact</a>
        </nav>
      </div>

      {/* Hero copy */}
      <div className="max-w-7xl mx-auto px-6 py-16 md:py-24 lg:py-28">
        <div className="max-w-2xl">
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-white">
            Know what your boat is worth—instantly.
          </h1>
          <p className="mt-3 md:mt-5 text-lg text-white/85">
            Advanced valuation using real market signals, tailored to your make, model, year, and condition.
          </p>

          <div className="mt-6 flex items-center gap-3">
            <a href="#estimate" className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90">
              Get My Boat Value
            </a>
            <a href="#how" className="inline-flex items-center justify-center px-5 py-3 rounded-xl border border-white/40 text-white hover:bg-white/10">
              See how it works
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}