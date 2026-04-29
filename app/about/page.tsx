import type { Metadata } from "next";
import Link from "next/link";
import { Play } from "lucide-react";
import Header from "@/components/landing-page/header";
import Footer from "@/components/landing-page/footer";
import { CinematicSection } from "@/components/cinematic/cinematic-section";

const SHORT_DESCRIPTION =
  "StoryInColor turns a single photo into an editorial reading — magazine-quality spreads designed to be saved, shared, and printed.";

export const metadata: Metadata = {
  title: "About — StoryInColor",
  description: SHORT_DESCRIPTION,
  alternates: { canonical: "https://storyincolor.com/about" },
  openGraph: {
    title: "About — StoryInColor",
    description: SHORT_DESCRIPTION,
    type: "website",
    url: "https://storyincolor.com/about",
  },
  twitter: {
    card: "summary_large_image",
    title: "About — StoryInColor",
    description: SHORT_DESCRIPTION,
  },
};

const PRINCIPLES: Array<{ eyebrow: string; title: string; body: string }> = [
  {
    eyebrow: "01 — Editorial",
    title: "Written like a magazine, not an algorithm.",
    body: "Each reading is composed as an editorial spread — typeset with intention, paced like a feature, and finished to print quality. The voice is warm and restrained: never breathless, never cold.",
  },
  {
    eyebrow: "02 — Honest",
    title: "Reflective, not predictive.",
    body: "We frame readings as cultural and lifestyle reflections — palmistry as tradition, beauty as observation, room vibes as styling. Where wellness brushes the edges of medicine, we say so plainly.",
  },
  {
    eyebrow: "03 — Saveable",
    title: "Made to keep.",
    body: "Every reading is exported in a high-resolution, print-ready format. Some end up framed. Some end up on the fridge. Either is the right answer.",
  },
];

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <Header />

      <main className="flex-1 pt-24 md:pt-28">
        <CinematicSection
          eyebrow="About"
          headingLevel="h1"
          title={
            <>
              Photos as the start of a{" "}
              <span className="italic font-light text-gray-400">story.</span>
            </>
          }
          description="StoryInColor is an editorial AI studio that turns a single photo — your palm, your face, your handwriting, your plate, your room — into a magazine-quality reading. One spread, designed to be saved."
          spotlight
          containerWidth="default"
        >
          <div className="grid gap-5 md:grid-cols-3">
            {PRINCIPLES.map((p) => (
              <div
                key={p.title}
                className="liquid-glass rounded-2xl p-6 md:p-7"
              >
                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
                  {p.eyebrow}
                </div>
                <h3
                  className="mt-3 text-xl font-normal text-white md:text-2xl"
                  style={{ letterSpacing: "-0.03em" }}
                >
                  {p.title}
                </h3>
                <p className="mt-3 text-sm text-gray-400 md:text-base">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </CinematicSection>

        <CinematicSection
          eyebrow="What we make"
          title={
            <>
              Twelve readings,{" "}
              <span className="italic font-light text-gray-400">one voice.</span>
            </>
          }
          description="From mystical traditions like palmistry and Mian Xiang face reading, to data-driven reports like the beauty report and skincare glow, to lifestyle reflections like room vibes and plate analysis — every reading is finished in the same editorial register."
          topBorder
          containerWidth="default"
        >
          <div className="flex flex-wrap gap-3">
            <Link
              href="/readings"
              className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-base font-medium text-black transition-colors hover:bg-gray-200"
            >
              <Play className="h-[18px] w-[18px] fill-black" />
              See the reading room
            </Link>
            <Link
              href="/contact"
              className="liquid-glass inline-flex items-center rounded-full px-7 py-3 text-base font-medium"
            >
              Get in touch
            </Link>
          </div>
        </CinematicSection>

        <CinematicSection
          eyebrow="Behind the work"
          title={
            <>
              Built with{" "}
              <span className="italic font-light text-gray-400">care.</span>
            </>
          }
          topBorder
          containerWidth="narrow"
        >
          <div className="space-y-5 text-base leading-relaxed text-gray-300 md:text-lg">
            <p>
              StoryInColor is built on top of OpenAI's image models, with each
              reading composed by a long-form prompt tuned for editorial layout
              — thin hairlines, generous whitespace, refined typography. The
              prompts were written by hand, not by an LLM, and are revised the
              same way magazine art direction is revised: print, look, edit,
              repeat.
            </p>
            <p>
              We don't sell your photos and we don't use them to train models.
              Uploads stay on your account so you can re-download a spread you
              loved, and you can delete everything from your settings at any
              time.
            </p>
            <p>
              Most readings finish in roughly 20 to 40 seconds. If something
              goes wrong on our end, the reading is refunded to your balance
              automatically — no support ticket required.
            </p>
          </div>
        </CinematicSection>
      </main>

      <Footer />
    </div>
  );
}
