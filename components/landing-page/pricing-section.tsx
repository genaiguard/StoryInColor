"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
import { PathImg } from "@/components/ui/pathed-image"

export default function PricingSection() {
  return (
    <section id="pricing" className="py-12 md:py-16 lg:py-20 bg-amber-50">
      <div className="container mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">Simple, Transparent Pricing</h2>
            <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Create your personalized coloring book with no hidden fees
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-12">
          <div className="flex flex-col rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold">Standard</h3>
              <div className="rounded-full bg-orange-100 px-2.5 py-0.5 text-sm text-orange-600">Popular</div>
            </div>
            <div className="mb-4 flex justify-center">
              <PathImg
                src="/images/product-standard.webp"
                alt="Standard coloring booklet option - softcover with 10 pages"
                width={120}
                height={120}
                className="h-auto"
              />
            </div>
            <div className="mt-4 text-center">
              <span className="text-4xl font-bold">$24.90</span>
            </div>
            <ul className="mt-6 space-y-4 flex-1">
              <li className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 text-orange-500"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>10-page coloring booklet</span>
              </li>
              <li className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 text-orange-500"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Standard paper quality</span>
              </li>
              <li className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 text-orange-500"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Softcover binding</span>
              </li>
            </ul>
            <Button className="mt-6 bg-orange-500 hover:bg-orange-600 text-white" asChild>
              <Link href="/login?register=true">Try for Free</Link>
            </Button>
          </div>

          <div className="flex flex-col rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold">Premium</h3>
            </div>
            <div className="mb-4 flex justify-center">
              <PathImg
                src="/images/product-premium.webp"
                alt="Premium coloring book option - hardcover with 30 pages"
                width={120}
                height={120}
                className="h-auto"
              />
            </div>
            <div className="mt-4 text-center">
              <span className="text-4xl font-bold">$39.50</span>
            </div>
            <ul className="mt-6 space-y-4 flex-1">
              <li className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 text-orange-500"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>30-page coloring book</span>
              </li>
              <li className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 text-orange-500"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Premium paper quality</span>
              </li>
              <li className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 text-orange-500"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Hardcover binding</span>
              </li>
            </ul>
            <Button className="mt-6 bg-orange-500 hover:bg-orange-600 text-white" asChild>
              <Link href="/login?register=true">Try for Free</Link>
            </Button>
          </div>

          <div className="flex flex-col rounded-lg border-2 border-orange-500 bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold">Digital</h3>
              <div className="rounded-full bg-orange-500 px-2.5 py-0.5 text-sm text-white">Best Value</div>
            </div>
            <div className="mb-4 flex justify-center">
              <PathImg
                src="/images/product-pdf.webp"
                alt="PDF Download option - digital coloring book"
                width={120}
                height={120}
                className="h-auto"
              />
            </div>
            <div className="mt-4 text-center">
              <span className="text-4xl font-bold">$9.90</span>
            </div>
            <ul className="mt-6 space-y-4 flex-1">
              <li className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 text-orange-500"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>10-page digital coloring book</span>
              </li>
              <li className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 text-orange-500"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>PDF download</span>
              </li>
              <li className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 text-orange-500"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Print at home</span>
              </li>
            </ul>
            <Button className="mt-6 bg-orange-500 hover:bg-orange-600 text-white" asChild>
              <Link href="/login?register=true">Try for Free</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

