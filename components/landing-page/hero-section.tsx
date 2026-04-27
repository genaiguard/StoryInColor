"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { PathImg } from "@/components/ui/pathed-image"
import Image from 'next/image'
import { motion, useScroll, useTransform } from "framer-motion"
import { useRef } from "react"
import { trackEvent, trackLead } from "@/components/tracking/facebook-pixel"

export default function HeroSection({ scrollToSection }: { scrollToSection?: any }) {
  const containerRef = useRef(null)
  const { scrollY } = useScroll()
  
  // Parallax effect values
  const y1 = useTransform(scrollY, [0, 500], [0, -100])
  const y2 = useTransform(scrollY, [0, 500], [0, -50])
  const opacity = useTransform(scrollY, [0, 300], [1, 0.5])

  // Text animation variants
  const textVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      }
    }
  }

  const wordVariants = {
    hidden: { 
      opacity: 0,
      y: 20
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        damping: 12,
        stiffness: 100
      }
    }
  }

  const title = "Upload a photo. Get something incredible back."
  const words = title.split(" ")

  return (
    <section ref={containerRef} className="relative overflow-hidden bg-[#f7f4f3] border-b py-12 md:py-16 lg:py-20">
      {/* Background shape */}
      <motion.div 
        className="absolute -top-[10%] -right-[5%] w-[50%] h-[50%] rounded-full bg-gradient-to-r from-purple-100 to-pink-100 blur-3xl opacity-60 force-hardware-acceleration"
        style={{ y: y1 }}
      />
      <motion.div 
        className="absolute bottom-[10%] -left-[5%] w-[30%] h-[30%] rounded-full bg-gradient-to-r from-orange-100 to-amber-100 blur-3xl opacity-50 force-hardware-acceleration"
        style={{ y: y2 }}
      />

      <div className="container mx-auto max-w-7xl px-6 md:px-8 relative z-10">
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-12">
          <motion.div 
            style={{ opacity }}
            className="flex flex-col justify-center space-y-6"
          >
            <div 
              className="space-y-4 opacity-0 animate-fadeInHeroTextContainer"
            >
              <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl flex flex-wrap">
                {words.map((word, i) => (
                  <span 
                    key={i} 
                    className="mr-3 inline-block whitespace-nowrap"
                  >
                    {word.replace(/\W/g, "") === "incredible" ? (
                <span className="bg-gradient-to-r from-purple-600 via-red-500 to-orange-500 bg-clip-text text-transparent pr-1">
                        {word}
                </span>
                    ) : (
                      word
                    )}
                  </span>
                ))}
              </h1>
              <p
                className="max-w-[600px] text-gray-700 md:text-xl"
              >
                Eleven AI photo tools — palm reads, style audits, plant care cards, custom coloring pages, and more — all from a single upload.
              </p>
            </div>
            <div 
              className="flex flex-col gap-2 min-[400px]:flex-row opacity-0 animate-fadeInHeroButton"
            >
              <Button className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 text-base font-medium" asChild>
                <Link 
                  href="/login?register=true"
                  onClick={() => {
                    trackEvent('Lead', { 
                      content_name: 'Hero CTA - Start Free',
                      content_category: 'sign_up'
                    })
                  }}
                >
                  Start Free
                </Link>
              </Button>
            </div>
            <p
              className="text-sm text-gray-500 opacity-0 animate-fadeInHeroSubtext"
            >
              Sign up — 2 free credits to try any tool.
            </p>
          </motion.div>
          <div
            className="relative flex items-center justify-center lg:justify-end opacity-0 animate-fadeInHeroImage"
          >
            <Image
              src="/images/tools/palm-reading.webp"
              alt="Preview of a StoryInColor AI photo tool result"
              width={600}
              height={600}
              className="w-full h-auto opacity-90"
              priority
              sizes="(max-width: 767px) 100vw, (max-width: 1023px) 80vw, 600px"
            />
          </div>
        </div>
      </div>
    </section>
  )
}