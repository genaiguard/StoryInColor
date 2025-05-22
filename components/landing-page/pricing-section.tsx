"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Check, Gift, Sparkles, Folders, Download } from "lucide-react"
import { PathImg } from "@/components/ui/pathed-image"
import { motion, useScroll, useTransform } from "framer-motion"
import { useRef, useState } from "react"

export default function PricingSection() {
  const sectionRef = useRef(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  })

  const [hoverLeft, setHoverLeft] = useState(false)
  const [hoverRight, setHoverRight] = useState(false)

  // Scroll-based animations
  const opacity = useTransform(scrollYProgress, [0, 0.2], [0, 1])
  const y = useTransform(scrollYProgress, [0, 0.2], [100, 0])
  const scale = useTransform(scrollYProgress, [0, 0.2], [0.9, 1])

  // Card animation variants
  const cardVariants = {
    hidden: { 
      opacity: 0, 
      y: 50, 
      rotateX: 10,
      transformPerspective: 1000
    },
    visible: (custom: number) => ({ 
      opacity: 1, 
      y: 0, 
      rotateX: 0,
      transition: { 
        type: "spring", 
        damping: 20, 
        stiffness: 100, 
        delay: 0.1 * custom 
      } 
    }),
    hover: { 
      y: -20,
      scale: 1.02,
      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 20
      }
    }
  }

  // Title animation
  const titleVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        damping: 15,
        stiffness: 50
      }
    }
  }

  // Feature item animations
  const featureVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        type: "spring",
        damping: 10,
        stiffness: 100,
        delay: 0.05 * i
      }
    })
  }

  const featureList1 = [
    { icon: <Gift className="h-5 w-5 text-orange-500" />, text: "Free starter credits included" },
    { icon: <Sparkles className="h-5 w-5 text-orange-500" />, text: "Pay per AI generation" },
    { icon: <Folders className="h-5 w-5 text-orange-500" />, text: "Create multiple projects" },
    { icon: <Download className="h-5 w-5 text-orange-500" />, text: "Instant download of print-ready coloring pages" }
  ]

  const featureList2 = [
    { icon: <Check className="h-5 w-5 text-gray-400" />, text: "Professionally printed" },
    { icon: <Check className="h-5 w-5 text-gray-400" />, text: "Softcover & Hardcover options" },
    { icon: <Check className="h-5 w-5 text-gray-400" />, text: "Delivered to your door" },
    { icon: <Check className="h-5 w-5 text-gray-400" />, text: "Perfect for gifts" }
  ]

  return (
    <section id="pricing" ref={sectionRef} className="py-12 md:py-16 lg:py-20 bg-amber-50 overflow-hidden relative">
      {/* Background decoration elements */}
      <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-gradient-to-b from-orange-100 to-transparent opacity-70 rounded-bl-full"></div>
      <div className="absolute bottom-0 left-0 w-1/4 h-1/4 bg-gradient-to-t from-orange-200 to-transparent opacity-50 rounded-tr-full"></div>
      
      <motion.div 
        style={{ opacity, y, scale }}
        className="container mx-auto max-w-7xl px-4 md:px-6 relative z-10"
      >
        <motion.div 
          variants={titleVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="flex flex-col items-center justify-center space-y-4 text-center"
        >
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">Simple, Transparent Pricing</h2>
            <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Create your personalized coloring pages with no hidden fees. Print instantly at home!
            </p>
          </div>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-2 mt-12 justify-center">
          <motion.div 
            custom={0}
            variants={cardVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            whileHover="hover"
            onHoverStart={() => setHoverLeft(true)}
            onHoverEnd={() => setHoverLeft(false)}
            className="flex flex-col rounded-xl border-2 border-orange-500 bg-white p-6 shadow-lg order-1 lg:order-none relative overflow-hidden"
          >
            {/* Card accent */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-orange-500 to-pink-500"></div>
            
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-2xl font-bold">Print at Home Coloring Pages</h3>
            </div>
            <motion.div 
              animate={hoverLeft ? { y: -5, scale: 1.05 } : {}}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
              className="mb-4 flex justify-center"
            >
              <PathImg
                src="/images/product-pdf.webp"
                alt="Print at home coloring pages"
                width={120}
                height={120}
                className="h-auto"
              />
            </motion.div>
            <div className="mt-4 text-center">
              <motion.span 
                animate={hoverLeft ? { scale: 1.05 } : {}}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                className="text-4xl font-bold inline-block"
              >
                Simple Pricing
              </motion.span>
              <span className="text-base font-normal text-gray-500 block mt-1">Starting at $0.45 per generation</span>
            </div>
            <ul className="mt-6 space-y-4 flex-1">
              {featureList1.map((feature, i) => (
                <motion.li 
                  key={i}
                  custom={i}
                  variants={featureVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="flex items-center gap-2"
                >
                  <motion.div
                    whileHover={{ rotate: 15, scale: 1.2 }}
                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  >
                    {feature.icon}
                  </motion.div>
                  <span>{feature.text}</span>
                </motion.li>
              ))}
            </ul>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="mt-6"
            >
              <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white" asChild>
              <Link href="/login?register=true">Try For Free</Link>
            </Button>
            </motion.div>
          </motion.div>

          <motion.div 
            custom={1}
            variants={cardVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            whileHover="hover"
            onHoverStart={() => setHoverRight(true)}
            onHoverEnd={() => setHoverRight(false)}
            className="flex flex-col rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 shadow-sm order-2 lg:order-none relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-2xl font-bold text-gray-500">Physical Books</h3>
              <div className="rounded-full bg-gray-200 px-2.5 py-0.5 text-sm text-gray-600">Coming Soon</div>
            </div>
            <motion.div 
              animate={hoverRight ? { y: -5, scale: 1.05 } : {}}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
              className="mb-4 flex justify-center opacity-50"
            >
              <PathImg
                src="/images/product-standard.webp"
                alt="Physical coloring book option - coming soon"
                width={120}
                height={120}
                className="h-auto"
              />
            </motion.div>
            <div className="mt-4 text-center text-gray-400">
              <motion.span 
                animate={hoverRight ? { scale: 1.05 } : {}}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                className="text-4xl font-bold inline-block"
              >
                Coming Soon
              </motion.span>
            </div>
            <ul className="mt-6 space-y-4 flex-1 text-gray-500">
              {featureList2.map((feature, i) => (
                <motion.li 
                  key={i}
                  custom={i}
                  variants={featureVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="flex items-center gap-2"
                >
                  {feature.icon}
                  <span>{feature.text}</span>
                </motion.li>
              ))}
            </ul>
            <div className="mt-6">
              <Button className="w-full bg-gray-300 text-gray-500 cursor-not-allowed" disabled>
              Coming Soon
            </Button>
          </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  )
}

