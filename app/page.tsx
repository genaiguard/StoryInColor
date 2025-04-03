"use client"

import { useState, useEffect } from "react"
import Header from "@/components/landing-page/header"
import HeroSection from "@/components/landing-page/hero-section"
import ExamplesSection from "@/components/landing-page/examples-section"
import HowItWorksSection from "@/components/landing-page/how-it-works-section"
import PetPortraitsSection from "@/components/landing-page/pet-portraits-section"
import CustomizationSection from "@/components/landing-page/customization-section"
import PricingSection from "@/components/landing-page/pricing-section"
import TestimonialsSection from "@/components/landing-page/testimonials-section"
import FAQSection from "@/components/landing-page/faq-section"
import Footer from "@/components/landing-page/footer"

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

  // Handle initial hash in URL and scroll to section on page load
  useEffect(() => {
    const hash = window.location.hash
    if (hash) {
      const sectionId = hash.substring(1) // Remove the # character
      setTimeout(() => {
        scrollToSection(sectionId)
      }, 500) // Small delay to ensure page is fully loaded
    }

    // Update active section on scroll
    const handleScroll = () => {
      const sections = ["examples", "how-it-works", "pricing", "testimonials", "faq"]
      const scrollPosition = window.scrollY + 100 // Add offset for header

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
      <Header activeSection={activeSection} scrollToSection={scrollToSection} />
      <main className="flex-1">
        <HeroSection scrollToSection={scrollToSection} />
        <ExamplesSection />
        <HowItWorksSection />
        <PetPortraitsSection />
        <CustomizationSection scrollToSection={scrollToSection} />
        <PricingSection />
        <TestimonialsSection />
        <FAQSection />
      </main>
      <Footer />
    </div>
  )
}

