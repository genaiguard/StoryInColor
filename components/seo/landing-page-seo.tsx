// JSON-LD structured data for the home page. Renders inline
// <script type="application/ld+json"> elements which crawlers index even
// when emitted from a client component (App Router supports this).
//
// Page-level <title>, <meta description>, OpenGraph, canonical, and
// Twitter tags are emitted by the root layout's `export const metadata`
// (see app/layout.tsx). next/head no-ops in App Router and was the reason
// this file's previous output never reached the static HTML.

import { TOOLS } from "@/lib/tools/registry";
import { TOOL_COUNT_WORD } from "@/lib/tools/copy";

const SITE_URL = "https://storyincolor.com";
const DESCRIPTION = `Upload a photo, get something incredible back. ${TOOL_COUNT_WORD} AI photo tools — coloring book, palm reading, face reading, aura, iridology, handwriting, style audit, skincare, plate analysis, plant care, room vibes — in one place.`;

const webAppSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "StoryInColor",
  url: SITE_URL,
  applicationCategory: "MultimediaApplication",
  description: DESCRIPTION,
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: "0.45",
    highPrice: "10.00",
    offerCount: 4,
    description:
      "Credit packs starting at $3.50 for 5 credits. Coloring book is 1 credit per generation; premium tools are 10 credits per generation.",
  },
  screenshot: `${SITE_URL}/images/SHARING.webp`,
  featureList: TOOLS.map((t) => t.name).join(", "),
  operatingSystem: "Any modern web browser",
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What kind of photos can I upload?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Each tool has its own input — palm photos for the palm reader, an outfit photo for the style audit, a meal photo for plate analysis, etc. JPG, PNG, or WEBP up to 10MB. The clearer and better-lit the photo, the better the result.",
      },
    },
    {
      "@type": "Question",
      name: "How long does a generation take?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Most tools finish in 20 to 40 seconds. You stay on the result page while the tool works and the finished image appears as soon as it's ready.",
      },
    },
    {
      "@type": "Question",
      name: "How does pricing work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You buy credits and spend them per generation. The coloring book is 1 credit. Premium tools (palm reading, face reading, aura, iridology, handwriting, style audit, skincare, plate, plant care, room vibes) are 10 credits each. Credit packs start at $3.50 for 5 credits.",
      },
    },
    {
      "@type": "Question",
      name: "Are the wellness-style readings medical advice?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Iridology, skincare glow, and plate analysis are for entertainment and general wellness reflection only. They are not medical advice, diagnosis, or treatment. Consult a qualified professional for any health concern.",
      },
    },
  ],
};

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to use a StoryInColor AI photo tool",
  description: "Three simple steps from upload to a finished result.",
  step: [
    {
      "@type": "HowToStep",
      name: "Sign in",
      text: "Create a free StoryInColor account. New accounts come with starter credits.",
      url: `${SITE_URL}#how-it-works`,
      image: `${SITE_URL}/images/how-to-upload.webp`,
    },
    {
      "@type": "HowToStep",
      name: "Pick a tool and upload your photo",
      text: `Choose from ${TOOLS.length} tools — coloring book, palm reading, face reading, aura, iridology, handwriting, style audit, skincare glow, plate analysis, plant care, or room vibes — and drag in one photo.`,
      url: `${SITE_URL}/tools`,
      image: `${SITE_URL}/images/how-to-customize.webp`,
    },
    {
      "@type": "HowToStep",
      name: "Get your result",
      text: "Wait 20–40 seconds while the tool processes. Download, share, or generate another.",
      url: `${SITE_URL}#how-it-works`,
      image: `${SITE_URL}/images/how-to-download.webp`,
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />
    </>
  );
}
