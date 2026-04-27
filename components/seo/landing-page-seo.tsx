import Head from 'next/head';
import { TOOLS } from '@/lib/tools/registry';
import { TOOL_COUNT_WORD } from '@/lib/tools/copy';

export default function LandingPageSEO() {
  const siteUrl = 'https://storyincolor.com';

  const webAppSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "StoryInColor",
    "url": siteUrl,
    "applicationCategory": "MultimediaApplication",
    "description": `Upload a photo, get something incredible back. ${TOOL_COUNT_WORD} AI photo tools — coloring book, palm reading, face reading, aura reading, iridology, handwriting, style audit, skincare glow, plate analysis, plant care, room vibes — in one place.`,
    "offers": {
      "@type": "AggregateOffer",
      "priceCurrency": "USD",
      "lowPrice": "0.45",
      "highPrice": "10.00",
      "offerCount": 4,
      "description": "Credit packs starting at $3.50 for 5 credits. Coloring book is 1 credit per generation; premium tools are 10 credits per generation."
    },
    "screenshot": `${siteUrl}/images/SHARING.webp`,
    "featureList": TOOLS.map((t) => t.name).join(", "),
    "operatingSystem": "Any modern web browser"
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What kind of photos can I upload?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Each tool has its own input — palm photos for the palm reader, an outfit photo for the style audit, a meal photo for plate analysis, etc. JPG, PNG, or WEBP up to 10MB. The clearer and better-lit the photo, the better the result."
        }
      },
      {
        "@type": "Question",
        "name": "How long does a generation take?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Most tools finish in 20 to 40 seconds. You stay on the result page while the tool works and the finished image appears as soon as it's ready."
        }
      },
      {
        "@type": "Question",
        "name": "How does pricing work?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "You buy credits and spend them per generation. The coloring book is 1 credit. Premium tools (palm reading, face reading, aura, iridology, handwriting, style audit, skincare, plate, plant care, room vibes) are 10 credits each. Credit packs start at $3.50 for 5 credits."
        }
      },
      {
        "@type": "Question",
        "name": "Are the wellness-style readings medical advice?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No. Iridology, skincare glow, and plate analysis are for entertainment and general wellness reflection only. They are not medical advice, diagnosis, or treatment. Consult a qualified professional for any health concern."
        }
      }
    ]
  };

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to use a StoryInColor AI photo tool",
    "description": "Three simple steps from upload to a finished result.",
    "step": [
      {
        "@type": "HowToStep",
        "name": "Sign in",
        "text": "Create a free StoryInColor account. New accounts come with starter credits.",
        "url": `${siteUrl}#how-it-works`,
        "image": `${siteUrl}/images/how-to-upload.webp`
      },
      {
        "@type": "HowToStep",
        "name": "Pick a tool and upload your photo",
        "text": `Choose from ${TOOLS.length} tools — coloring book, palm reading, face reading, aura, iridology, handwriting, style audit, skincare glow, plate analysis, plant care, or room vibes — and drag in one photo.`,
        "url": `${siteUrl}/tools`,
        "image": `${siteUrl}/images/how-to-customize.webp`
      },
      {
        "@type": "HowToStep",
        "name": "Get your result",
        "text": "Wait 20-40 seconds while the tool processes. Download, share, or generate another.",
        "url": `${siteUrl}#how-it-works`,
        "image": `${siteUrl}/images/how-to-download.webp`
      }
    ]
  };

  const description = `Upload a photo, get something incredible back. ${TOOL_COUNT_WORD} AI photo tools — coloring book, palm reading, face reading, aura, iridology, handwriting, style audit, skincare, plate analysis, plant care, room vibes — in one place.`;

  return (
    <Head>
      <title>StoryInColor — AI Photo Tools</title>
      <meta name="description" content={description} />
      <meta name="keywords" content="AI photo tools, photo to coloring page, palm reading from photo, face reading, aura reading, iridology, graphology, style audit AI, skincare AI, plate analysis, plant care AI, room vibes" />

      <meta property="og:type" content="website" />
      <meta property="og:url" content={siteUrl} />
      <meta property="og:title" content="StoryInColor — AI Photo Tools" />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={`${siteUrl}/images/SHARING.webp`} />

      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={siteUrl} />
      <meta property="twitter:title" content="StoryInColor — AI Photo Tools" />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={`${siteUrl}/images/SHARING.webp`} />

      <link rel="canonical" href={siteUrl} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }}
        key="webapp-schema"
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        key="faq-schema"
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
        key="howto-schema"
      />
    </Head>
  );
}
