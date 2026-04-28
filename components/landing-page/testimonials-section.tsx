// Lightweight testimonials. Editorial typography, no avatar dots, no
// generic SaaS card chrome. Quotes are about the reading experience itself,
// not coloring-book-specific.

interface Testimonial {
  quote: string
  attribution: string
  reading: string
}

const QUOTES: Testimonial[] = [
  {
    quote:
      "It read my handwriting better than my therapist. I keep the page on my fridge.",
    attribution: "Sarah T.",
    reading: "Handwriting",
  },
  {
    quote:
      "Sent my friend her aura reading after a rough week. She cried, in the good way.",
    attribution: "Michael R.",
    reading: "Aura",
  },
  {
    quote:
      "Pulled my plate out at brunch and we all read each other's. Better than a personality test.",
    attribution: "Jennifer L.",
    reading: "Plate",
  },
]

export default function TestimonialsSection() {
  return (
    <section
      id="testimonials"
      className="border-b border-gray-200 bg-white py-24 md:py-32"
    >
      <div className="container mx-auto max-w-6xl px-6 md:px-8">
        <div className="mb-12 max-w-2xl">
          <h2 className="text-4xl font-bold tracking-[-0.02em] text-gray-900 md:text-5xl">
            What people <span className="italic text-gray-500">save.</span>
          </h2>
        </div>

        <div className="grid gap-x-12 gap-y-10 md:grid-cols-3">
          {QUOTES.map((q) => (
            <figure key={q.attribution} className="flex flex-col gap-4">
              <blockquote className="text-lg leading-relaxed text-gray-800 md:text-xl">
                <span className="select-none text-gray-300" aria-hidden="true">
                  &ldquo;
                </span>
                {q.quote}
              </blockquote>
              <figcaption className="text-sm text-gray-500">
                <span className="font-medium text-gray-700">
                  {q.attribution}
                </span>
                <span className="mx-2 text-gray-300" aria-hidden="true">
                  ·
                </span>
                {q.reading}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
