import type { Tool } from "@/lib/tools/types";
import { CREDIT_PACKAGES } from "@/app/firebase/credits-helpers";

const PACK_NAME: Record<string, string> = {
  single: "Single Issue",
  trio: "Three pack",
  set: "Six pack",
};

export function ToolJsonLd({ tool }: { tool: Tool }) {
  // Compute the actual purchasable price range for ONE reading of this tool
  // across every pack a visitor can buy. Schema.org rejects a single
  // misleading "lowest unit rate" price, so emit AggregateOffer with
  // lowPrice/highPrice and one Offer per pack — Google's rich-result tester
  // accepts this without "Misleading price" warnings. The free coloring
  // page is special-cased to a single Offer at $0.
  const isFree = tool.creditCost === 0;

  const offers = isFree
    ? [
        {
          "@type": "Offer",
          price: "0.00",
          priceCurrency: "USD",
          description: "Free for any signed-in visitor.",
          eligibleQuantity: {
            "@type": "QuantitativeValue",
            value: 1,
            unitText: "reading",
          },
        },
      ]
    : CREDIT_PACKAGES.map((pack) => {
        const perReadingCents = pack.price / pack.credits;
        const priceForTool = (
          (tool.creditCost * perReadingCents) /
          100
        ).toFixed(2);
        const packLabel = PACK_NAME[pack.id] ?? pack.id;
        return {
          "@type": "Offer",
          price: priceForTool,
          priceCurrency: "USD",
          description: `One reading from the ${packLabel} pack (${pack.credits} reading${pack.credits === 1 ? "" : "s"} for $${(pack.price / 100).toFixed(2)}).`,
          eligibleQuantity: {
            "@type": "QuantitativeValue",
            value: 1,
            unitText: "reading",
          },
        };
      });

  const prices = offers.map((o) => parseFloat(o.price));
  const lowPrice = Math.min(...prices).toFixed(2);
  const highPrice = Math.max(...prices).toFixed(2);

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
        url: new URL(
          `/readings/${tool.slug}`,
          "https://storyincolor.com",
        ).toString(),
        image: new URL(
          tool.coverImage,
          "https://storyincolor.com",
        ).toString(),
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "USD",
          lowPrice,
          highPrice,
          offerCount: offers.length,
          offers,
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
