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
  "What does your photo know about you? Editorial readings of your palm, your face, your beauty, your handwriting, your style, and more. Designed to be saved.";

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
    lowPrice: "9.99",
    highPrice: "39.00",
    offerCount: 3,
    description:
      "Pay-as-you-go. Single Issue $9.99, Three pack $24, Six pack $39. No subscription, no expiry.",
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
        text: "Each reading takes a different photo: your open palm for palm reading, a clear front-facing selfie for face, beauty, aura, hairstyle, color, and skincare, a close-up of your iris for iridology, your handwriting for graphology, an outfit shot for style audit. JPG, PNG, or WEBP up to 10 MB. The clearer and better-lit, the better the reading.",
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
        text: "Pay-as-you-go. Single Issue is $9.99 for one reading; Three pack is $24 ($8 each, 20% off); Six pack is $39 ($6.50 each, 35% off). Signing up is free, no card required. No subscription, no expiry.",
      },
    },
    {
      "@type": "Question",
      name: "Are wellness-style readings medical advice?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Iridology and skincare readings are intended for entertainment and gentle wellness reflection only — not medical advice, diagnosis, or treatment. Consult a qualified professional for any health concern.",
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
