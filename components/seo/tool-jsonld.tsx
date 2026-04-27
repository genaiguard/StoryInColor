import type { Tool } from "@/lib/tools/types";

export function ToolJsonLd({ tool }: { tool: Tool }) {
  const json = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: tool.name,
    description: tool.seo.metaDescription,
    provider: {
      "@type": "Organization",
      name: "StoryInColor",
      url: "https://storyincolor.com",
    },
    areaServed: { "@type": "Country", name: "Worldwide" },
    url: `https://storyincolor.com/tools/${tool.slug}`,
    image: `https://storyincolor.com${tool.coverImage}`,
    offers: {
      "@type": "Offer",
      price: tool.creditCost === 1 ? "0.70" : "6.00",
      priceCurrency: "USD",
      description: `${tool.creditCost} credit${tool.creditCost > 1 ? "s" : ""} per generation`,
    },
    mainEntity: {
      "@type": "FAQPage",
      mainEntity: tool.seo.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
