"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { trackEvent } from "@/components/tracking/facebook-pixel"

const PACKS = [
  { credits: 5,  price: "$3.50", per: "$0.70 / credit", note: "Try it" },
  { credits: 10, price: "$6",    per: "$0.60 / credit", note: "Most popular", highlight: true },
  { credits: 20, price: "$10",   per: "$0.50 / credit", note: "Save 29%" },
  { credits: 40, price: "$18",   per: "$0.45 / credit", note: "Save 36%" },
] as const

export default function PricingSection() {
  return (
    <section id="pricing" className="bg-white py-24 md:py-32">
      <div className="container mx-auto max-w-6xl px-6 md:px-8">
        {/* Editorial header */}
        <div className="mb-14 max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
            <span className="h-px w-8 bg-gray-300" aria-hidden="true" />
            Pricing
          </div>
          <h2 className="text-4xl font-bold tracking-[-0.02em] text-gray-900 md:text-5xl">
            Pay-as-you-go credits.
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Buy a pack, spend them on any tool. No subscriptions, no expiry, no surprise charges.
          </p>
        </div>

        {/* Credit pack grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PACKS.map((pack) => (
            <div
              key={pack.credits}
              className={`relative rounded-2xl border bg-white p-6 transition-shadow ${
                pack.highlight
                  ? "border-gray-900 shadow-md"
                  : "border-gray-200 hover:shadow-sm"
              }`}
            >
              {pack.highlight && (
                <span className="absolute -top-3 left-6 rounded-full bg-gray-900 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-white">
                  {pack.note}
                </span>
              )}
              <div className="text-sm text-gray-500">{pack.credits} credits</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight text-gray-900">{pack.price}</span>
              </div>
              <div className="mt-2 text-sm text-gray-500">{pack.per}</div>
              {!pack.highlight && (
                <div className="mt-4 text-xs font-medium uppercase tracking-wider text-orange-600">
                  {pack.note}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Single CTA + clarifier */}
        <div className="mt-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <p className="max-w-xl text-sm text-gray-500">
            Most readings use 10 credits. The coloring page uses 1.
            New accounts start with free credits — no card required.
          </p>
          <Button
            className="rounded-full bg-gray-900 px-7 py-6 text-base font-medium text-white hover:bg-gray-800"
            asChild
          >
            <Link
              href="/login?register=true"
              onClick={() => {
                trackEvent("InitiateCheckout", {
                  content_name: "Pricing CTA",
                  content_category: "pricing",
                })
              }}
            >
              Start free <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
