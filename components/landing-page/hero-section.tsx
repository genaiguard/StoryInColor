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

  const title = "Turn Your Photos Into Custom Coloring Pages"
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
            <motion.div 
              variants={textVariants}
              initial="hidden"
              animate="visible"
              className="space-y-4"
            >
              <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl flex flex-wrap">
                {words.map((word, i) => (
                  <motion.span 
                    key={i} 
                    variants={wordVariants}
                    className="mr-3 inline-block"
                  >
                    {word === "Photos" ? (
                <span className="bg-gradient-to-r from-purple-600 via-red-500 to-orange-500 bg-clip-text text-transparent">
                        {word}
                </span>
                    ) : (
                      word
                    )}
                  </motion.span>
                ))}
              </h1>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, type: "spring", damping: 12 }}
                className="max-w-[600px] text-gray-700 md:text-xl"
              >
                Upload your vacation photos and we'll create beautiful custom coloring pages you can download and print instantly.
              </motion.p>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ 
                delay: 1.2, 
                type: "spring", 
                stiffness: 200, 
                damping: 15 
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              className="flex flex-col gap-2 min-[400px]:flex-row"
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
            </motion.div>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.4 }}
              className="text-sm text-gray-500"
            >
              Sign up today! Free pages for a limited time.
            </motion.p>
          </motion.div>
          <div
            className="relative flex items-center justify-center lg:justify-end opacity-0 animate-fadeInHeroImage"
          >
            <Image
              src="/images/best-6.webp"
              alt="Coloring page of a family at the beach alongside the original framed photo and colored pencils"
              width={600}
              height={600}
              className="w-full h-auto"
              priority
              sizes="(max-width: 767px) 100vw, (max-width: 1023px) 80vw, 600px"
            />
          </div>
        </div>
      </div>
    </section>
  )
}

