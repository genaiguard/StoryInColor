"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

interface HeroSectionProps {
  scrollToSection?: (id: string) => void
}

export default function HeroSection({ scrollToSection: _scrollToSection }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden border-b border-gray-200 bg-white py-20 md:py-28 lg:py-32">
      <div className="container relative z-10 mx-auto max-w-7xl px-6 md:px-8">
        <div className="max-w-4xl">
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
                <Link href="/readings">
                  Start free <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                className="rounded-full px-6 py-6 text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                asChild
              >
                <Link href="/readings">See the reading room</Link>
              </Button>
            </div>

            <p className="text-sm text-gray-500">
              New here? Start with free credits — no card required.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
