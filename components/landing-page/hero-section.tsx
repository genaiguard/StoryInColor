"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight } from "lucide-react"

interface HeroSectionProps {
  scrollToSection?: (id: string) => void
}

export default function HeroSection({ scrollToSection: _scrollToSection }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden border-b border-gray-200 bg-white py-20 md:py-28 lg:py-32">
      {/* Subtle editorial background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(251,146,60,0.08),transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(168,85,247,0.06),transparent_50%)]" />

      <div className="container relative z-10 mx-auto max-w-7xl px-6 md:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          {/* Left: editorial typography */}
          <div className="flex flex-col gap-7">
            <h1 className="font-bold tracking-[-0.025em] text-gray-900 text-[44px] leading-[1.02] sm:text-[56px] md:text-[68px] lg:text-[76px]">
              What does your photo
              <br />
              <span className="italic text-orange-600">know about you?</span>
            </h1>

            <p className="max-w-[560px] text-lg text-gray-600 md:text-xl">
              A reading from your palm, your handwriting, your plate, your room — wherever your life leaves a trace. Saved like a magazine. Just for you.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                className="rounded-full bg-gray-900 px-7 py-6 text-base font-medium text-white hover:bg-gray-800"
                asChild
              >
                <Link href="/tools">
                  Start free <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                className="rounded-full px-6 py-6 text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                asChild
              >
                <Link href="/tools">See the reading room</Link>
              </Button>
            </div>

            <p className="text-sm text-gray-500">
              Written like an editor, not an algorithm.
            </p>
          </div>

          {/* Right: clean editorial collage */}
          <div className="relative">
            <div className="grid grid-cols-2 gap-3">
              <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-gray-100">
                <Image
                  src="/images/tools/palm-reading.webp"
                  alt="Palm reading"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1023px) 50vw, 320px"
                  priority
                />
              </div>

              <div className="relative aspect-[3/4] translate-y-8 overflow-hidden rounded-2xl bg-gray-100">
                <Image
                  src="/images/tools/style-audit.webp"
                  alt="Style audit"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1023px) 50vw, 320px"
                />
              </div>

              <div className="relative aspect-[3/4] -translate-y-2 overflow-hidden rounded-2xl bg-gray-100">
                <Image
                  src="/images/tools/aura-reading.webp"
                  alt="Aura reading"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1023px) 50vw, 320px"
                />
              </div>

              <div className="relative aspect-[3/4] translate-y-6 overflow-hidden rounded-2xl bg-gray-100">
                <Image
                  src="/images/tools/plate-analysis.webp"
                  alt="Plate reading"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1023px) 50vw, 320px"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
