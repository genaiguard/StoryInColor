import { Button } from "@/components/ui/button"
import Link from "next/link"
import { PathImg } from "@/components/ui/pathed-image"
import { motion } from "framer-motion"

export default function PetPortraitsSection() {
  return (
    <section id="pet-portraits" className="bg-white py-12 md:py-16 lg:py-20">
      <div className="container mx-auto max-w-7xl px-6 md:px-8">
        <div className="grid gap-8 md:grid-cols-2 md:gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ 
              type: "spring",
              stiffness: 100,
              damping: 20
            }}
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl mb-4">
              Turn your pet photos into coloring pages
            </h2>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.5 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 text-base font-medium" asChild>
                <Link href="/login">Create Pet Pages</Link>
              </Button>
            </motion.div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ 
              type: "spring",
              stiffness: 100,
              damping: 20,
              delay: 0.1
            }}
            className="mt-8 md:mt-0"
          >
            <div className="aspect-[5/3.8] overflow-hidden">
              <PathImg
                src="/images/dog-coloring-hero.webp"
                alt="A side-by-side comparison showing an original color photo of a golden retriever and its converted line art version suitable for coloring"
                width={600}
                height={500}
                className="w-full h-full object-cover object-top"
                priority={true}
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

