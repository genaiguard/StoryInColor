import type { Tool } from "@/lib/tools/types";
import { CREDIT_PACKAGES } from "@/app/firebase/credits-helpers";

export function ToolJsonLd({ tool }: { tool: Tool }) {
  // Read prices from CREDIT_PACKAGES (small pack as canonical retail rate).
  const smallPack = CREDIT_PACKAGES.find((p) => p.id === "small")!;
  const priceForTool = (
    (tool.creditCost * smallPack.pricePerCredit) /
    100
  ).toFixed(2);

  const json = {
    "@context": "https://schema.org",
    "@graph": [
      {
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
          price: priceForTool,
          priceCurrency: "USD",
          description: `${tool.creditCost} credit${tool.creditCost > 1 ? "s" : ""} per generation`,
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: tool.seo.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
