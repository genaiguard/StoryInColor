// Editorial pull-quote between the hero and the reading room. Cinematic
// dark canvas with a soft top spotlight and restrained typography.

export default function EditorialQuoteSection() {
  return (
    <section className="relative overflow-hidden bg-black py-28 md:py-40">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-full bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.06),_transparent_60%)]"
      />
      <div className="container relative mx-auto max-w-4xl px-6 md:px-8">
        <div className="mb-6 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
          <span className="h-px w-8 bg-white/20" aria-hidden="true" />
          Editorial
        </div>
        <p
          className="text-3xl font-normal leading-[1.1] text-white sm:text-4xl md:text-5xl lg:text-6xl"
          style={{ letterSpacing: "-0.04em" }}
        >
          A photo says a lot.
          <br className="hidden sm:block" />{" "}
          <span className="italic font-light text-gray-400">
            We just write it down.
          </span>
        </p>
      </div>
    </section>
  );
}
