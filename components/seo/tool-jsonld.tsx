import type { Tool } from "@/lib/tools/types";
import { CREDIT_PACKAGES } from "@/app/firebase/credits-helpers";

export function ToolJsonLd({ tool }: { tool: Tool }) {
  // Compute the actual purchasable price range for ONE generation of this
  // tool across every credit pack the user can buy. Schema.org rejects a
  // single misleading "lowest unit rate" price, so emit AggregateOffer with
  // lowPrice/highPrice and one Offer per pack — Google's rich result tester
  // accepts this without "Misleading price" warnings.
  const offers = CREDIT_PACKAGES.map((pack) => {
    const perCreditCents = pack.price / pack.credits;
    const priceForTool = ((tool.creditCost * perCreditCents) / 100).toFixed(2);
    return {
      "@type": "Offer",
      price: priceForTool,
      priceCurrency: "USD",
      description: `${tool.creditCost} credit${tool.creditCost > 1 ? "s" : ""} from the ${pack.id} pack (${pack.credits} credits / $${(pack.price / 100).toFixed(2)})`,
      eligibleQuantity: {
        "@type": "QuantitativeValue",
        value: 1,
        unitText: "generation",
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
        url: new URL(`/readings/${tool.slug}`, "https://storyincolor.com").toString(),
        image: new URL(tool.coverImage, "https://storyincolor.com").toString(),
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
