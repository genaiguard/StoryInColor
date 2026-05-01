"use client";

import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { trackPricingCtaClick } from "@/lib/analytics/events";
import { CinematicSection } from "@/components/cinematic/cinematic-section";
import { CREDIT_PACKAGES } from "@/app/firebase/credits-helpers";

// Pack tier labels — mirrors app/credits/page.tsx so the marketing
// landing surface and the actual purchase page agree on framing. The
// "Most popular" / "Best value" badges anchor middle / heaviest packs;
// the smaller "Try one" tier title makes the entry SKU read as a
// low-commitment first purchase rather than a leftover.
const PACK_TIER_LABELS: Record<string, { title: string; badge?: string }> = {
  single: { title: "Try one" },
  trio: { title: "Most popular", badge: "Save 20%" },
  set: { title: "Best value", badge: "Save 35%" },
};

const PACK_DIFFERENTIATOR: Record<string, string> = {
  single: "Try a single editorial reading",
  trio: "Three readings to mix and match",
  set: "Six readings at the lowest per-reading price",
};

type PricingSectionProps = {
  ctaHref?: string;
  ctaLabel?: string;
  ctaNote?: string;
  trackingName?: string;
};

export default function PricingSection({
  ctaHref = "/login?register=true",
  ctaLabel = "Start free",
  ctaNote = "Sign up free.",
  trackingName = "Pricing CTA",
}: PricingSectionProps) {
  return (
    <CinematicSection
      id="pricing"
      eyebrow="Pricing"
      title={
        <>
          Pay only for what you{" "}
          <span className="italic font-light text-gray-400">read.</span>
        </>
      }
      description="Pay-as-you-go. No subscription, no expiry, no surprise charges."
      topBorder
      containerWidth="default"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CREDIT_PACKAGES.map((pack) => {
          const isHighlight = pack.id === "trio";
          const tier = PACK_TIER_LABELS[pack.id] ?? { title: "" };
          const perReading = (pack.pricePerCredit / 100).toFixed(2);
          const packTotal = (pack.price / 100).toFixed(2);
          return (
            <div
              key={pack.id}
              className={`relative flex flex-col rounded-2xl p-6 transition-all duration-300 md:p-7 ${
                isHighlight
                  ? "bg-white text-black ring-2 ring-white"
                  : "liquid-glass text-white"
              }`}
            >
              {/* Tier label + discount badge — same anchoring as
                  /credits so the marketing teaser and the purchase
                  page show identical framing. */}
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`text-xs font-medium uppercase tracking-wider ${
                    isHighlight ? "text-gray-700" : "text-gray-300"
                  }`}
                >
                  {tier.title}
                </span>
                {tier.badge && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      isHighlight
                        ? "bg-black text-white"
                        : "bg-white/10 text-white"
                    }`}
                  >
                    {tier.badge}
                  </span>
                )}
              </div>

              {/* Per-reading price BIG. Pack total + count smaller
                  below — the per-unit cost is what comparison shoppers
                  scan first. */}
              <div className="mt-5 flex items-baseline gap-1">
                <span
                  className="text-5xl font-normal"
                  style={{ letterSpacing: "-0.03em" }}
                >
                  ${perReading}
                </span>
                <span
                  className={`text-sm ${
                    isHighlight ? "text-gray-600" : "text-gray-400"
                  }`}
                >
                  / reading
                </span>
              </div>
              <div
                className={`mt-1 text-sm ${
                  isHighlight ? "text-gray-600" : "text-gray-400"
                }`}
              >
                ${packTotal} for{" "}
                {pack.credits === 1 ? "1 reading" : `${pack.credits} readings`}
              </div>

              {/* One differentiator line — the previous three-bullet
                  stack had near-identical content across tiers and
                  made the cards harder to scan. */}
              <p
                className={`mt-5 flex-1 text-sm ${
                  isHighlight ? "text-gray-700" : "text-gray-300"
                }`}
              >
                {PACK_DIFFERENTIATOR[pack.id]}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-14 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <p className="max-w-xl text-sm text-gray-400">{ctaNote}</p>
        <Link
          href={ctaHref}
          onClick={() => {
            // Renamed from InitiateCheckout — that event is reserved for the
            // moment we actually dispatch a Stripe redirect (see
            // app/credits/page.tsx). Pre-auth pricing intent is a Lead.
            trackPricingCtaClick({ contentName: trackingName });
          }}
          className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-base font-medium text-black transition-colors hover:bg-gray-200"
        >
          <Play className="h-[18px] w-[18px] fill-black" />
          {ctaLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </CinematicSection>
  );
}
