import Link from "next/link";
import Image from "next/image";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import Header from "@/components/landing-page/header";
import Footer from "@/components/landing-page/footer";
import type { Tool } from "@/lib/tools/types";
import { TOOLS } from "@/lib/tools/registry";

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
 */
export default function MarketingView({ tool }: { tool: Tool }) {
  const ctaHref = `/login?register=true&next=/tools/${tool.slug}`;
  const sample = tool.seo.sampleImage || tool.coverImage;
  const showSample = sample !== tool.coverImage;
  const wellnessNotice = WELLNESS_DISCLAIMER[tool.id];

  return (
    <div data-tool-marketing className="min-h-screen bg-[#f7f4f3]">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-10 md:py-16">
        {/* Breadcrumb */}
        <nav className="mb-4 text-xs text-gray-500" aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5">
            <li>
              <Link href="/tools" className="hover:text-orange-600">
                Tools
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-gray-800">{tool.name}</li>
          </ol>
        </nav>

        {/* Hero */}
        <section className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <span className="inline-flex items-center rounded-full bg-orange-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-orange-700">
              {tool.category}
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 md:text-5xl">
              {tool.name}
            </h1>
            <p className="mt-3 text-xl text-gray-700">{tool.tagline}</p>
            <p className="mt-4 text-base text-gray-600">{tool.heroCopy}</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="bg-orange-500 text-white hover:bg-orange-600"
              >
                <Link href={ctaHref}>Try free — sign in</Link>
              </Button>
              <Link
                href="/tools"
                className="text-sm font-medium text-gray-700 hover:text-orange-600"
              >
                See all {TOOLS.length} tools
              </Link>
            </div>
            <p className="mt-4 text-xs text-gray-500">
              {tool.creditCost === 1
                ? "1 credit"
                : `${tool.creditCost} credits`}{" "}
              per generation. Free starter credits when you sign up.
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <Image
              src={tool.coverImage}
              alt={`${tool.name} preview`}
              width={600}
              height={800}
              priority
              className="h-full w-full object-cover"
            />
          </div>
        </section>

        {/* Inline non-medical disclaimer for wellness-adjacent tools */}
        {wellnessNotice && (
          <aside
            role="note"
            className="mt-10 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            <p>
              <strong>Important:</strong> {wellnessNotice}
            </p>
          </aside>
        )}

        {/* What you get */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
            What you get
          </h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {tool.seo.whatYouGet.map((bullet) => (
              <li
                key={bullet}
                className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4"
              >
                <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.41 0l-3.5-3.5a1 1 0 111.41-1.42L8.5 12.08l6.79-6.79a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                <p className="text-sm text-gray-800">{bullet}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
            How it works
          </h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            <li className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-semibold text-orange-600">Step 1</div>
              <h3 className="mt-1 text-lg font-semibold text-gray-900">Upload</h3>
              <p className="mt-2 text-sm text-gray-600">{tool.inputHint}</p>
            </li>
            <li className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-semibold text-orange-600">Step 2</div>
              <h3 className="mt-1 text-lg font-semibold text-gray-900">Generate</h3>
              <p className="mt-2 text-sm text-gray-600">
                We process your photo and craft your {tool.name.toLowerCase()} in
                roughly 20 to 40 seconds.
              </p>
            </li>
            <li className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-semibold text-orange-600">Step 3</div>
              <h3 className="mt-1 text-lg font-semibold text-gray-900">Download</h3>
              <p className="mt-2 text-sm text-gray-600">
                Save the high-resolution image, share the link, or generate
                another.
              </p>
            </li>
          </ol>
        </section>

        {/* Sample output — only shown when distinct from the cover image */}
        {showSample && (
          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
              Sample output
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              A preview of the editorial layout you receive.
            </p>
            <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sample}
                alt={`${tool.name} sample output`}
                width={1200}
                height={800}
                className="h-full w-full object-cover"
              />
            </div>
          </section>
        )}

        {/* FAQ */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
            Frequently asked
          </h2>
          <Accordion
            type="single"
            collapsible
            className="mt-6 rounded-xl border border-gray-200 bg-white"
          >
            {tool.seo.faq.map((entry, idx) => (
              <AccordionItem
                key={entry.q}
                value={`faq-${idx}`}
                className="px-5"
              >
                <AccordionTrigger className="text-left text-base font-medium text-gray-900">
                  {entry.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-gray-600">
                  {entry.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* Final CTA */}
        <section className="mt-16 rounded-2xl bg-gradient-to-r from-orange-50 to-rose-50 p-8 text-center md:p-12">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
            Ready to try {tool.name}?
          </h2>
          <p className="mt-2 text-base text-gray-700">
            Sign in to upload your photo and get your result in about half a
            minute.
          </p>
          <div className="mt-6">
            <Button
              asChild
              size="lg"
              className="bg-orange-500 text-white hover:bg-orange-600"
            >
              <Link href={ctaHref}>Try free — sign in</Link>
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
