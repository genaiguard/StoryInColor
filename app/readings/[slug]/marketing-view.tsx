"use client";

import Link from "next/link";
import { Check, Wand2, Play, AlertTriangle, ArrowRight } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Header from "@/components/landing-page/header";
import Footer from "@/components/landing-page/footer";
import { CinematicHero } from "@/components/cinematic/cinematic-hero";
import { CinematicSection } from "@/components/cinematic/cinematic-section";
import type { Tool } from "@/lib/tools/types";

// Tools that touch wellness-adjacent territory need an inline, visible
// non-medical disclaimer for legal cover — burying it inside an FAQ accordion
// is not enough.
const WELLNESS_DISCLAIMER: Record<string, string> = {
  iridology:
    "For entertainment only. This is not medical or diagnostic advice. Consult a qualified healthcare professional for any health concern.",
  "skincare-glow":
    "For entertainment only. Cosmetic guidance — not medical advice, diagnosis, or treatment. See a dermatologist for any skin concern.",
  "plate-analysis":
    "For entertainment only. General wellness reflection — not medical or prescriptive nutrition advice. See a registered dietitian for personalized guidance.",
};

/**
 * Server-rendered SEO marketing view for a tool. Always emitted in the static
 * HTML so search engines can crawl rich content. Hidden client-side once a
 * signed-in visitor's authenticated workflow mounts (see tool-workflow.tsx).
 *
 * Visually mirrors the landing page — same Header, CinematicHero (with the
 * tool's cover image as the bg), CinematicSection editorial pattern for the
 * sub-sections, and the same Footer.
 */
export default function MarketingView({ tool }: { tool: Tool }) {
  const ctaHref = `/login?register=true&next=/readings/${tool.slug}`;
  const input = tool.seo.inputImage;
  const sample = tool.seo.sampleImage || tool.coverImage;
  const isPlaceholderSample = sample === tool.coverImage;
  const wellnessNotice = WELLNESS_DISCLAIMER[tool.id];

  return (
    <div data-tool-marketing className="flex min-h-screen flex-col bg-black">
      <Header />

      <main className="flex-1">
        <CinematicHero
          video={{ src: "/videos/hero.mp4" }}
          eyebrow={`${tool.category} reading`}
          title={tool.name}
          italicTagline={`${tool.tagline}.`}
          description={tool.heroCopy}
          primaryCta={{
            label: "Try free — sign in",
            href: ctaHref,
            icon: <Play className="h-[18px] w-[18px] fill-black" />,
          }}
          secondaryCta={{
            label: "All readings",
            href: "/readings",
            hideIcon: true,
          }}
        />

        {/* Breadcrumb (below hero, accessible) */}
        <nav
          className="border-t border-white/5 bg-black"
          aria-label="Breadcrumb"
        >
          <ol className="container mx-auto flex max-w-7xl items-center gap-1.5 px-6 py-4 text-xs text-gray-500 md:px-8">
            <li>
              <Link
                href="/readings"
                className="transition-colors hover:text-white"
              >
                Readings
              </Link>
            </li>
            <li aria-hidden="true" className="text-white/20">
              /
            </li>
            <li className="text-gray-300">{tool.name}</li>
          </ol>
        </nav>

        {wellnessNotice && (
          <section className="bg-black px-6 py-6 md:px-8">
            <div
              role="note"
              className="container mx-auto flex max-w-4xl items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 text-sm text-amber-100"
            >
              <AlertTriangle
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400"
                aria-hidden="true"
              />
              <p>
                <strong className="font-medium">Important:</strong>{" "}
                {wellnessNotice}
              </p>
            </div>
          </section>
        )}

        <CinematicSection
          eyebrow="What you get"
          title={
            <>
              In your{" "}
              <span className="italic font-light text-gray-400">spread.</span>
            </>
          }
          topBorder
          containerWidth="default"
        >
          <ul className="grid gap-4 md:grid-cols-2">
            {tool.seo.whatYouGet.map((bullet) => (
              <li
                key={bullet}
                className="liquid-glass flex items-start gap-3 rounded-xl p-5"
              >
                <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white/10">
                  <Check className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                </span>
                <p className="text-sm text-gray-200">{bullet}</p>
              </li>
            ))}
          </ul>
        </CinematicSection>

        <CinematicSection
          eyebrow="How it works"
          title={
            <>
              From photo{" "}
              <span className="italic font-light text-gray-400">to spread.</span>
            </>
          }
          topBorder
          containerWidth="default"
        >
          {/* Two cards (Upload → Download) with a centered visual transition
              between them. The transition is a small icon + label on
              desktop, and a flow arrow on mobile, replacing the old "Step 2:
              Generate" card so the editorial spread reads as the
              destination, not a third equal step. */}
          <div className="grid items-center gap-5 md:grid-cols-[1fr_auto_1fr] md:gap-4">
            <div className="liquid-glass overflow-hidden rounded-2xl">
              <div className="relative flex h-56 items-center justify-center overflow-hidden border-b border-white/5 bg-black">
                {input ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={input}
                    alt={`${tool.name} upload example`}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="text-xs uppercase tracking-[0.18em] text-gray-500">
                    Your photo
                  </div>
                )}
              </div>
              <div className="p-5">
                <h3 className="text-lg font-medium text-white">
                  Upload your photo
                </h3>
                <p className="mt-2 text-sm text-gray-400">{tool.inputHint}</p>
              </div>
            </div>

            {/* Transition visual — vertical (mobile) and horizontal (desktop) */}
            <div
              aria-hidden="true"
              className="flex flex-row items-center justify-center gap-3 py-2 md:flex-col md:px-2 md:py-0"
            >
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent md:h-12 md:w-px md:flex-none md:bg-gradient-to-b" />
              <span className="liquid-glass flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full">
                <Wand2 className="h-5 w-5 text-white" />
              </span>
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent md:h-12 md:w-px md:flex-none md:bg-gradient-to-b" />
              <ArrowRight
                className="h-4 w-4 text-white/40 md:hidden"
                aria-hidden="true"
              />
            </div>

            <div className="liquid-glass overflow-hidden rounded-2xl">
              <div className="relative flex h-56 items-center justify-center overflow-hidden border-b border-white/5 bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sample}
                  alt={`${tool.name} sample output`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-contain"
                />
                {isPlaceholderSample && (
                  <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-medium text-gray-200 ring-1 ring-white/10">
                    Sample coming soon
                  </span>
                )}
              </div>
              <div className="p-5">
                <h3 className="text-lg font-medium text-white">
                  Save your spread
                </h3>
                <p className="mt-2 text-sm text-gray-400">
                  A high-resolution editorial spread, ready to download, share,
                  or print.
                </p>
              </div>
            </div>
          </div>
        </CinematicSection>

        <CinematicSection
          eyebrow="FAQ"
          title={
            <>
              Frequently{" "}
              <span className="italic font-light text-gray-400">asked.</span>
            </>
          }
          topBorder
          containerWidth="narrow"
        >
          <Accordion type="single" collapsible className="space-y-3">
            {tool.seo.faq.map((entry, idx) => (
              <AccordionItem
                key={entry.q}
                value={`faq-${idx}`}
                className="liquid-glass overflow-hidden rounded-2xl px-6 [&[data-state=open]]:bg-white/[0.04]"
              >
                <AccordionTrigger className="text-left text-base font-medium text-white hover:no-underline md:text-lg">
                  {entry.q}
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-gray-300">{entry.a}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CinematicSection>

        <section className="relative overflow-hidden border-t border-white/5 bg-black px-6 py-20 md:px-8 md:py-24">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.06),_transparent_60%)]"
          />
          <div className="relative mx-auto max-w-3xl text-center">
            <h2
              className="text-3xl font-normal text-white sm:text-4xl md:text-5xl"
              style={{ letterSpacing: "-0.04em" }}
            >
              Ready to try{" "}
              <span className="italic font-light text-gray-300">
                {tool.name}?
              </span>
            </h2>
            <p className="mt-4 text-base text-gray-400 md:text-lg">
              Sign in to upload your photo and get your result in about half a
              minute.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href={ctaHref}
                className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-base font-medium text-black transition-colors hover:bg-gray-200"
              >
                <Play className="h-[18px] w-[18px] fill-black" />
                Try free
              </Link>
              <Link
                href="/readings"
                className="liquid-glass inline-flex items-center rounded-full px-7 py-3 text-base font-medium"
              >
                See all readings
              </Link>
            </div>
            <p className="mt-4 text-xs text-gray-500">
              Free starter credits when you sign up — no card required.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
