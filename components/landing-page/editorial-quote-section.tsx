// Single editorial pull-quote between the hero and the reading room.
// Magazine-style: a big, restrained statement on plain white. No CTA.

export default function EditorialQuoteSection() {
  return (
    <section className="border-b border-gray-200 bg-white py-24 md:py-36">
      <div className="container mx-auto max-w-4xl px-6 md:px-8">
        <p className="text-3xl font-semibold leading-[1.15] tracking-[-0.02em] text-gray-900 sm:text-4xl md:text-5xl">
          A photo says a lot.
          <br className="hidden sm:block" />{" "}
          <span className="italic text-gray-500">We just write it down.</span>
        </p>
      </div>
    </section>
  );
}
