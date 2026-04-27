import Head from 'next/head';
import { TOOLS } from '@/lib/tools/registry';
import { TOOL_COUNT_WORD } from '@/lib/tools/copy';

export default function CoreSEO() {
  const siteUrl = 'https://storyincolor.com';
  const description = `Upload a photo, get something incredible back. ${TOOL_COUNT_WORD} AI photo tools — coloring book, palm reading, face reading, aura, iridology, handwriting, style audit, skincare, plate analysis, plant care, room vibes — in one place.`;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "StoryInColor",
    "applicationCategory": "MultimediaApplication",
    "description": description,
    "offers": {
      "@type": "AggregateOffer",
      "priceCurrency": "USD",
      "lowPrice": "0.45",
      "highPrice": "10.00",
      "offerCount": 4,
      "description": "Credit packs starting at $3.50 for 5 credits."
    },
    "screenshot": `${siteUrl}/images/SHARING.webp`,
    "featureList": TOOLS.map((t) => t.name).join(", "),
    "operatingSystem": "Web browser"
  };

  return (
    <Head>
      <meta name="description" content={description} />
      <meta name="keywords" content="AI photo tools, photo to coloring page, palm reading from photo, face reading, aura reading, iridology, graphology, style audit AI, skincare AI, plate analysis, plant care AI, room vibes" />

      <link rel="canonical" href={siteUrl} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </Head>
  );
}
