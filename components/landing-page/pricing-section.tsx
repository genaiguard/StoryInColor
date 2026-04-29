"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle, Play } from "lucide-react";
import { trackEvent } from "@/components/tracking/facebook-pixel";
import { CinematicSection } from "@/components/cinematic/cinematic-section";
import { CREDIT_PACKAGES } from "@/app/firebase/credits-helpers";

// Pack copy. Mirrors /credits/page.tsx — kept duplicated so the landing
// section is self-contained and can be reordered independently.
const PACK_HEADLINES: Record<string, string> = {
  single: "Just one",
  trio: "Most loved",
  set: "Save 35%",
};

const PACK_BULLETS: Record<string, string> = {
  single: "One reading of your choice",
  trio: "Any three readings",
  set: "Any six readings — make it a gift",
};

export default function PricingSection() {
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
          const headline = PACK_HEADLINES[pack.id] ?? "";
          const bullet = PACK_BULLETS[pack.id] ?? "";
          const perReading = (pack.pricePerCredit / 100).toFixed(2);
          const price = (pack.price / 100).toFixed(2);
          return (
            <div
              key={pack.id}
              className={`relative flex flex-col rounded-2xl p-6 transition-all duration-300 md:p-7 ${
                isHighlight
                  ? "bg-white text-black"
                  : "liquid-glass text-white"
              }`}
            >
              {isHighlight && (
                <span className="absolute -top-3 left-6 rounded-full bg-black px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-white">
                  {headline}
                </span>
              )}
              <div
                className={`text-sm ${
                  isHighlight ? "text-gray-600" : "text-gray-400"
                }`}
              >
                {pack.credits === 1
                  ? "1 reading"
                  : `${pack.credits} readings`}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className="text-4xl font-normal"
                  style={{ letterSpacing: "-0.03em" }}
                >
                  ${price}
                </span>
              </div>
              <div
                className={`mt-1 text-sm ${
                  isHighlight ? "text-gray-600" : "text-gray-400"
                }`}
              >
                ${perReading} / reading
              </div>
              {!isHighlight && headline && (
                <div className="mt-3 text-xs font-medium uppercase tracking-wider text-gray-300">
                  {headline}
                </div>
              )}

              <ul
                className={`mt-5 flex-1 space-y-2 text-sm ${
                  isHighlight ? "text-gray-700" : "text-gray-300"
                }`}
              >
                <li className="flex items-start gap-2">
                  <CheckCircle
                    className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                      isHighlight ? "text-black" : "text-white"
                    }`}
                  />
                  <span>{bullet}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle
                    className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                      isHighlight ? "text-black" : "text-white"
                    }`}
                  />
                  <span>Editorial quality, print-ready</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle
                    className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                      isHighlight ? "text-black" : "text-white"
                    }`}
                  />
                  <span>Never expire, no subscription</span>
                </li>
              </ul>
            </div>
          );
        })}
      </div>

      <div className="mt-14 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <p className="max-w-xl text-sm text-gray-400">
          Sign up free — no card required.
        </p>
        <Link
          href="/login?register=true"
          onClick={() => {
            trackEvent("InitiateCheckout", {
              content_name: "Pricing CTA",
              content_category: "pricing",
            });
          }}
          className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-base font-medium text-black transition-colors hover:bg-gray-200"
        >
          <Play className="h-[18px] w-[18px] fill-black" />
          Start free
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </CinematicSection>
  );
}
