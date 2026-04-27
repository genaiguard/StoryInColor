"use client"

import { LogIn, Image as ImageIcon, Sparkles } from "lucide-react"
import { motion } from "framer-motion"

interface Step {
  number: number
  Icon: typeof LogIn
  title: string
  description: string
  ringClass: string
  iconClass: string
}

const STEPS: Step[] = [
  {
    number: 1,
    Icon: LogIn,
    title: "Sign in",
    description: "Create a free account in seconds — you'll get free starter credits.",
    ringClass: "bg-orange-100",
    iconClass: "text-orange-500",
  },
  {
    number: 2,
    Icon: ImageIcon,
    title: "Pick a tool",
    description: "Choose any of eleven tools and upload one photo.",
    ringClass: "bg-purple-100",
    iconClass: "text-purple-500",
  },
  {
    number: 3,
    Icon: Sparkles,
    title: "Get something incredible",
    description: "Your finished, magazine-quality result is ready to download or share.",
    ringClass: "bg-pink-100",
    iconClass: "text-pink-500",
  },
]

export default function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="bg-gradient-to-b from-[#fbf8f6] to-white py-12 md:py-16 lg:py-20"
    >
      <div className="container mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-3 text-center">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            How it works
          </h2>
          <p className="max-w-[720px] text-gray-600 md:text-lg">
            Get a magazine-quality result from a single photo in three simple steps.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl items-stretch gap-6 py-12 md:grid-cols-3 lg:gap-10">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ type: "spring", damping: 18, stiffness: 100, delay: i * 0.1 }}
              className="flex flex-col items-center space-y-4 rounded-2xl border bg-white p-8 shadow-sm"
            >
              <div className="relative">
                <div className={`rounded-full ${step.ringClass} p-6`}>
                  <step.Icon className={`h-8 w-8 ${step.iconClass}`} />
                </div>
                <div className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white shadow ring-2 ring-white">
                  {step.number}
                </div>
              </div>
              <h3 className="text-xl font-bold text-center">{step.title}</h3>
              <p className="text-center text-gray-600 text-sm md:text-base">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
