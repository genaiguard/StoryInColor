"use client"

import { useState, useEffect } from "react"
import dynamic from 'next/dynamic'
import Header from "@/components/landing-page/header"
import HeroSection from "@/components/landing-page/hero-section"
const ExamplesSection = dynamic(() => import('@/components/landing-page/examples-section'))
const HowItWorksSection = dynamic(() => import('@/components/landing-page/how-it-works-section'))
const PetPortraitsSection = dynamic(() => import('@/components/landing-page/pet-portraits-section'))
const CustomizationSection = dynamic(() => import('@/components/landing-page/customization-section'))
const PricingSection = dynamic(() => import('@/components/landing-page/pricing-section'))
const TestimonialsSection = dynamic(() => import('@/components/landing-page/testimonials-section'))
const FAQSection = dynamic(() => import('@/components/landing-page/faq-section'))
const Footer = dynamic(() => import('@/components/landing-page/footer'))
import LandingPageSEO from "@/components/seo/landing-page-seo"
import StructuredData from "@/components/seo/structured-data"

export default function Home() {
  const [activeSection, setActiveSection] = useState("")

  const scrollToSection = (elementId) => {
    const element = document.getElementById(elementId)
    if (element) {
      const headerOffset = 80
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      })
      setActiveSection(elementId)
    }
  }

  useEffect(() => {
    const hash = window.location.hash
    if (hash) {
      const sectionId = hash.substring(1)
      setTimeout(() => {
        scrollToSection(sectionId)
      }, 500)
    }

    const handleScroll = () => {
      const sections = ["examples", "how-it-works", "pricing", "testimonials", "faq"]
      const scrollPosition = window.scrollY + 100

      for (const section of sections) {
        const element = document.getElementById(section)
        if (element) {
          const offsetTop = element.offsetTop
          const offsetHeight = element.offsetHeight

          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section)
            break
          }
        }
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div className="flex min-h-screen flex-col">
      <LandingPageSEO />
      <StructuredData />
      <Header activeSection={activeSection} scrollToSection={scrollToSection} />
      <main className="flex-1">
        <HeroSection scrollToSection={scrollToSection} />
        <ExamplesSection />
        <HowItWorksSection />
        <PetPortraitsSection />
        <CustomizationSection />
        <PricingSection />
        <TestimonialsSection />
        <FAQSection />
      </main>
      <Footer />
    </div>
  )
}

