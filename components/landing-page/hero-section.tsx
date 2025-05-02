"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { PathImg } from "@/components/ui/pathed-image"

export default function HeroSection({ scrollToSection }: { scrollToSection?: any }) {
  return (
    <section className="relative overflow-hidden bg-[#f7f4f3] border-b py-12 md:py-16 lg:py-20">
      <div className="container mx-auto max-w-7xl px-6 md:px-8">
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-12">
          <div className="flex flex-col justify-center space-y-4">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl">
                <span className="text-[#111827]">Turn Your </span>
                <span className="bg-gradient-to-r from-purple-600 via-red-500 to-orange-500 bg-clip-text text-transparent">
                  Photos
                </span>
                <span className="text-[#111827]"> Into Custom Coloring Books</span>
              </h1>
              <p className="max-w-[600px] text-gray-700 md:text-xl">
                Upload your vacation photos and we'll create a beautiful physical coloring book that's shipped directly
                to your door.
              </p>
            </div>
            <div className="flex flex-col gap-2 min-[400px]:flex-row">
              <Button className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 text-base font-medium" asChild>
                <Link href="/login?register=true">Start Creating</Link>
              </Button>
            </div>
            <p className="text-sm text-gray-500">No credit card required to preview your book</p>
          </div>
          <div className="relative flex items-center justify-center lg:justify-end">
            <PathImg
              src="/images/best-6.webp"
              alt="Coloring book page of a family at the beach alongside the original framed photo and colored pencils"
              width={600}
              height={600}
              className="w-full h-auto"
              priority={true}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

