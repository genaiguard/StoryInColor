"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Check, Gift, Sparkles, Folders, Download } from "lucide-react"
import { PathImg } from "@/components/ui/pathed-image"

export default function PricingSection() {
  return (
    <section id="pricing" className="py-12 md:py-16 lg:py-20 bg-amber-50">
      <div className="container mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">Simple, Transparent Pricing</h2>
            <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Create your personalized coloring pages with no hidden fees. Print instantly at home!
            </p>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-2 mt-12 justify-center">
          <div className="flex flex-col rounded-lg border-2 border-orange-500 bg-white p-6 shadow-lg order-1 lg:order-none">
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-2xl font-bold">Print at Home Coloring Pages</h3>
            </div>
            <div className="mb-4 flex justify-center">
              <PathImg
                src="/images/product-pdf.webp"
                alt="Print at home coloring pages"
                width={120}
                height={120}
                className="h-auto"
              />
            </div>
            <div className="mt-4 text-center">
              <span className="text-4xl font-bold">Simple Pricing</span>
              <span className="text-base font-normal text-gray-500 block mt-1">Starting at $0.45 per generation</span>
            </div>
            <ul className="mt-6 space-y-4 flex-1">
              <li className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-orange-500" />
                <span>Free starter credits included</span>
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-orange-500" />
                <span>Pay per AI generation</span>
              </li>
              <li className="flex items-center gap-2">
                <Folders className="h-5 w-5 text-orange-500" />
                <span>Create multiple projects</span>
              </li>
              <li className="flex items-center gap-2">
                <Download className="h-5 w-5 text-orange-500" />
                <span>Instant download of print-ready coloring pages</span>
              </li>
            </ul>
            <Button className="mt-6 bg-orange-500 hover:bg-orange-600 text-white" asChild>
              <Link href="/login?register=true">Try For Free</Link>
            </Button>
          </div>

          <div className="flex flex-col rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 shadow-sm order-2 lg:order-none">
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-2xl font-bold text-gray-500">Physical Books</h3>
              <div className="rounded-full bg-gray-200 px-2.5 py-0.5 text-sm text-gray-600">Coming Soon</div>
            </div>
            <div className="mb-4 flex justify-center opacity-50">
              <PathImg
                src="/images/product-standard.webp"
                alt="Physical coloring book option - coming soon"
                width={120}
                height={120}
                className="h-auto"
              />
            </div>
            <div className="mt-4 text-center text-gray-400">
              <span className="text-4xl font-bold">Coming Soon</span>
            </div>
            <ul className="mt-6 space-y-4 flex-1 text-gray-500">
              <li className="flex items-center gap-2">
                <Check className="h-5 w-5 text-gray-400" />
                <span>Professionally printed</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-5 w-5 text-gray-400" />
                <span>Softcover & Hardcover options</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-5 w-5 text-gray-400" />
                <span>Delivered to your door</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-5 w-5 text-gray-400" />
                <span>Perfect for gifts</span>
              </li>
            </ul>
            <Button className="mt-6 bg-gray-300 text-gray-500 cursor-not-allowed" disabled>
              Coming Soon
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

