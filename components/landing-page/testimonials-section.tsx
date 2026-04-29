import { CinematicSection } from "@/components/cinematic/cinematic-section";

interface Testimonial {
  quote: string;
  attribution: string;
  reading: string;
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
      "Showed my stylist the hairstyle reading instead of explaining what I wanted. She said, 'finally — a brief.'",
    attribution: "Jennifer L.",
    reading: "Hairstyle",
  },
];

export default function TestimonialsSection() {
  return (
    <CinematicSection
      id="testimonials"
      eyebrow="Reviews"
      title={
        <>
          What readers{" "}
          <span className="italic font-light text-gray-400">say.</span>
        </>
      }
      topBorder
      containerWidth="default"
    >
      <div className="grid gap-x-12 gap-y-12 md:grid-cols-3">
        {QUOTES.map((q) => (
          <figure key={q.attribution} className="flex flex-col gap-5">
            <blockquote className="text-lg leading-relaxed text-gray-200 md:text-xl">
              <span className="select-none text-white/20" aria-hidden="true">
                &ldquo;
              </span>
              {q.quote}
            </blockquote>
            <figcaption className="text-sm text-gray-500">
              <span className="font-medium text-gray-300">{q.attribution}</span>
              <span className="mx-2 text-white/20" aria-hidden="true">
                ·
              </span>
              {q.reading}
            </figcaption>
          </figure>
        ))}
      </div>
    </CinematicSection>
  );
}
