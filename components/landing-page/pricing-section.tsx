"use client";

import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { trackEvent } from "@/components/tracking/facebook-pixel";
import { CinematicSection } from "@/components/cinematic/cinematic-section";

const PACKS = [
  { credits: 5, price: "$3.50", per: "$0.70 / credit", note: "Try it" },
  {
    credits: 10,
    price: "$6",
    per: "$0.60 / credit",
    note: "Most popular",
    highlight: true,
  },
  { credits: 20, price: "$10", per: "$0.50 / credit", note: "Save 29%" },
  { credits: 40, price: "$18", per: "$0.45 / credit", note: "Save 36%" },
] as const;

export default function PricingSection() {
  return (
    <CinematicSection
      id="pricing"
      eyebrow="Pricing"
      title={
        <>
          Pay-as-you-go{" "}
          <span className="italic font-light text-gray-400">credits.</span>
        </>
      }
      description="Buy a pack, spend them on any tool. No subscriptions, no expiry, no surprise charges."
      topBorder
      containerWidth="default"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PACKS.map((pack) => (
          <div
            key={pack.credits}
            className={`relative rounded-2xl p-6 transition-all duration-300 ${
              pack.highlight
                ? "bg-white text-black"
                : "liquid-glass text-white"
            }`}
          >
            {pack.highlight && (
              <span className="absolute -top-3 left-6 rounded-full bg-black px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-white">
                {pack.note}
              </span>
            )}
            <div
              className={`text-sm ${
                pack.highlight ? "text-gray-600" : "text-gray-400"
              }`}
            >
              {pack.credits} credits
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className="text-4xl font-normal"
                style={{ letterSpacing: "-0.03em" }}
              >
                {pack.price}
              </span>
            </div>
            <div
              className={`mt-2 text-sm ${
                pack.highlight ? "text-gray-600" : "text-gray-400"
              }`}
            >
              {pack.per}
            </div>
            {!pack.highlight && (
              <div className="mt-4 text-xs font-medium uppercase tracking-wider text-gray-300">
                {pack.note}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-14 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <p className="max-w-xl text-sm text-gray-400">
          Most readings use 10 credits. The coloring page uses 1. New accounts
          start with free credits — no card required.
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
