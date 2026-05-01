"use client"

import { useState, useEffect } from "react"
import Header from "@/components/landing-page/header"
import HeroSection from "@/components/landing-page/hero-section"
// Below-fold sections were previously next/dynamic for code-splitting,
// but next/dynamic from a "use client" component in App Router wraps
// each import in a Suspense/lazy boundary that shifts React's useId
// counter between SSR and CSR — Radix Accordion in FAQSection reads
// these IDs and refuses to hydrate when they disagree (visible as
// "tree hydrated but some attributes didn't match" with offset
// aria-controls / id values on every accordion item). Static imports
// avoid the boundary entirely. Bundle-weight cost is small for this
// marketing surface and the site is a static export anyway, so the
// "below-fold lazy" optimisation wasn't really paying for itself.
import EditorialQuoteSection from "@/components/landing-page/editorial-quote-section"
import ExamplesSection from "@/components/landing-page/examples-section"
import PricingSection from "@/components/landing-page/pricing-section"
import TestimonialsSection from "@/components/landing-page/testimonials-section"
import FAQSection from "@/components/landing-page/faq-section"
import Footer from "@/components/landing-page/footer"
import LandingPageSEO from "@/components/seo/landing-page-seo"
import StructuredData from "@/components/seo/structured-data"

export default function Home() {
  const [activeSection, setActiveSection] = useState("")

  const scrollToSection = (elementId: string) => {
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
      const sections = ["examples", "pricing", "testimonials", "faq"]
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
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <LandingPageSEO />
      <StructuredData />
      <Header activeSection={activeSection} scrollToSection={scrollToSection} />
      <main className="flex-1 overflow-x-hidden">
        <HeroSection />
        <EditorialQuoteSection />
        <ExamplesSection />
        <TestimonialsSection />
        <PricingSection />
        <FAQSection />
      </main>
      <Footer />
    </div>
  )
}

