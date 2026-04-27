"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight } from "lucide-react"

interface HeroSectionProps {
  scrollToSection?: (id: string) => void
}

export default function HeroSection({ scrollToSection }: HeroSectionProps) {
  const handleHowItWorks = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (scrollToSection) {
      e.preventDefault()
      scrollToSection("how-it-works")
    }
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#fbf8f6] via-[#f7f4f3] to-[#f7f4f3] border-b py-14 md:py-20 lg:py-24">
      {/* Soft background blobs */}
      <div className="pointer-events-none absolute -top-[10%] -right-[5%] w-[50%] h-[50%] rounded-full bg-gradient-to-r from-purple-100 to-pink-100 blur-3xl opacity-60" />
      <div className="pointer-events-none absolute bottom-[10%] -left-[5%] w-[35%] h-[35%] rounded-full bg-gradient-to-r from-orange-100 to-amber-100 blur-3xl opacity-50" />

      <div className="container mx-auto max-w-7xl px-6 md:px-8 relative z-10">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-12 items-center">
          {/* Left: text + CTAs */}
          <div className="flex flex-col justify-center space-y-6">
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-[64px] lg:leading-[1.05]">
              Upload a photo.
              <br className="hidden md:block" />{" "}
              <span className="bg-gradient-to-r from-purple-600 via-red-500 to-orange-500 bg-clip-text text-transparent">
                Get something incredible
              </span>{" "}
              back.
            </h1>
            <p className="max-w-[600px] text-gray-700 md:text-xl">
              Eleven AI photo tools — palmistry, face reading, style audits, plant care, and more. One upload.
              One credit click. A finished, magazine-quality result in seconds.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 text-base font-medium rounded-full"
                asChild
              >
                <Link href="/tools">
                  Try a tool free <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="outline"
                className="px-6 py-3 text-base font-medium rounded-full border-gray-300"
                asChild
              >
                <Link href="#how-it-works" onClick={handleHowItWorks}>
                  How it works
                </Link>
              </Button>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="flex text-orange-500" aria-hidden>
                {"★ ★ ★ ★ ★"}
              </span>
              <span>Trusted by thousands of creators</span>
            </div>
          </div>

          {/* Right: 2x2 layered editorial collage */}
          <div className="relative flex items-center justify-center lg:justify-end">
            <div className="relative w-full max-w-[560px] aspect-square">
              {/* Top-left card - palm-reading */}
              <div className="absolute left-0 top-0 w-1/2 h-1/2 p-2 md:p-3">
                <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-xl ring-1 ring-black/5 -rotate-3 bg-white">
                  <Image
                    src="/images/tools/palm-reading.webp"
                    alt="Palm reading sample result"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1023px) 50vw, 280px"
                    priority
                  />
                </div>
              </div>

              {/* Top-right card - style-audit */}
              <div className="absolute right-0 top-0 w-1/2 h-1/2 p-2 md:p-3">
                <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-xl ring-1 ring-black/5 rotate-3 bg-white">
                  <Image
                    src="/images/tools/style-audit.webp"
                    alt="Style audit sample result"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1023px) 50vw, 280px"
                  />
                </div>
              </div>

              {/* Bottom-left card - aura-reading */}
              <div className="absolute left-0 bottom-0 w-1/2 h-1/2 p-2 md:p-3">
                <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-xl ring-1 ring-black/5 rotate-2 bg-white">
                  <Image
                    src="/images/tools/aura-reading.webp"
                    alt="Aura reading sample result"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1023px) 50vw, 280px"
                  />
                </div>
              </div>

              {/* Bottom-right card - coloring-book */}
              <div className="absolute right-0 bottom-0 w-1/2 h-1/2 p-2 md:p-3">
                <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-xl ring-1 ring-black/5 -rotate-2 bg-white">
                  <Image
                    src="/images/tools/coloring-book.webp"
                    alt="Coloring book sample result"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1023px) 50vw, 280px"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
