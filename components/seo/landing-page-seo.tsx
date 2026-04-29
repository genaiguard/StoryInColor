// JSON-LD structured data for the home page. Rendered as inline
// <script type="application/ld+json"> elements which crawlers index even
// when emitted from a client component (App Router supports this).
//
// Page-level <title>, <meta description>, OpenGraph, canonical, and
// Twitter tags live on the root layout's `export const metadata`
// (app/layout.tsx). next/head no-ops in App Router and was the reason
// this file's previous output never reached the static HTML.

import { ORDERED_TOOLS } from "@/lib/tools/registry";

const SITE_URL = "https://storyincolor.com";
const DESCRIPTION =
  "What does your photo know about you? Editorial readings of your palm, your face, your beauty, your handwriting, your plate, your room, and more. Designed to be saved.";

const webAppSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "StoryInColor",
  url: SITE_URL,
  applicationCategory: "LifestyleApplication",
  description: DESCRIPTION,
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: "0.45",
    highPrice: "10.00",
    offerCount: 4,
    description:
      "Pay-as-you-go credits. Packs start at $3.50. The coloring page uses 1 credit; most readings use 10.",
  },
  screenshot: `${SITE_URL}/images/SHARING.webp`,
  // featureList draws from ORDERED_TOOLS so the JSON-LD catalog matches
  // what visitors see on /readings and the landing section. Adding a new
  // reading to the registry updates the schema automatically.
  featureList: ORDERED_TOOLS.map((t) => t.name).join(", "),
  operatingSystem: "Any modern web browser",
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What kinds of photos can I bring?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Each reading takes a different photo: your open palm for palm reading, a clear selfie for face or aura, a top-down meal for plate, a wide shot of your room for room vibes, your handwriting for graphology, and so on. JPG, PNG, or WEBP up to 10 MB. The clearer and better-lit, the better the reading.",
      },
    },
    {
      "@type": "Question",
      name: "How long does a reading take?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Most readings finish in roughly 20 to 40 seconds. You stay on the result page while we work and the finished spread appears as soon as it's ready.",
      },
    },
    {
      "@type": "Question",
      name: "How does pricing work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You buy a small pack of credits and spend them on whichever photo experience you like. The coloring page uses 1 credit. Readings — palm, face, beauty report, aura, iridology, handwriting, style audit, skincare, plate, plant care, room vibes — use 10 credits each. New accounts start with free credits, no card required.",
      },
    },
    {
      "@type": "Question",
      name: "Are wellness-style readings medical advice?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Iridology, skincare, and plate readings are intended for entertainment and gentle wellness reflection only — not medical advice, diagnosis, or treatment. Consult a qualified professional for any health concern.",
      },
    },
  ],
};

export default function LandingPageSEO() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </>
  );
}
