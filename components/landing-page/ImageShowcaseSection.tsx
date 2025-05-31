"use client"

import Image from "next/image"
import { motion } from "framer-motion"

export default function ImageShowcaseSection() {
  return (
    <section className="py-12 md:py-16 lg:py-20 bg-slate-50">
      <div className="container mx-auto max-w-5xl px-6 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center mb-8"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Transform Your Photos into Coloring Pages
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Watch how your regular photos magically transform into beautiful, detailed coloring pages perfect for printing and sharing.
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="shadow-2xl rounded-xl overflow-hidden border border-slate-200"
        >
          <Image
            src="/images/SHARING.webp"
            alt="Example showing the transformation of a regular photo into a coloring page"
            width={1920} 
            height={1080}
            layout="responsive"
            className="w-full h-auto"
          />
        </motion.div>
      </div>
    </section>
  )
} 