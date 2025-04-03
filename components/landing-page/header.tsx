"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"

export default function Header({ activeSection, scrollToSection }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="border-b sticky top-0 bg-white z-50">
      <div className="container mx-auto max-w-7xl flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold">
            Story<span className="text-orange-500">InColor</span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-6">
          <button
            onClick={() => scrollToSection("examples")}
            className={`text-sm font-medium transition-colors ${
              activeSection === "examples" ? "text-orange-500" : "hover:text-orange-500"
            }`}
          >
            Examples
          </button>
          <button
            onClick={() => scrollToSection("how-it-works")}
            className={`text-sm font-medium transition-colors ${
              activeSection === "how-it-works" ? "text-orange-500" : "hover:text-orange-500"
            }`}
          >
            How It Works
          </button>
          <button
            onClick={() => scrollToSection("pricing")}
            className={`text-sm font-medium transition-colors ${
              activeSection === "pricing" ? "text-orange-500" : "hover:text-orange-500"
            }`}
          >
            Pricing
          </button>
          <button
            onClick={() => scrollToSection("testimonials")}
            className={`text-sm font-medium transition-colors ${
              activeSection === "testimonials" ? "text-orange-500" : "hover:text-orange-500"
            }`}
          >
            Testimonials
          </button>
          <button
            onClick={() => scrollToSection("faq")}
            className={`text-sm font-medium transition-colors ${
              activeSection === "faq" ? "text-orange-500" : "hover:text-orange-500"
            }`}
          >
            FAQ
          </button>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white" asChild>
            <Link href="/login">Login</Link>
          </Button>
        </nav>
        <div className="flex items-center">
          <Button className="md:hidden" size="icon" variant="ghost" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <line x1="4" x2="20" y1="12" y2="12" />
              <line x1="4" x2="20" y1="6" y2="6" />
              <line x1="4" x2="20" y1="18" y2="18" />
            </svg>
            <span className="sr-only">Toggle menu</span>
          </Button>
        </div>
      </div>
      {mobileMenuOpen && (
        <div className="absolute top-16 left-0 right-0 bg-white z-50 border-b md:hidden">
          <div className="container mx-auto py-4 flex flex-col space-y-4">
            <button
              onClick={() => scrollToSection("examples")}
              className={`text-sm font-medium px-4 py-2 hover:bg-gray-100 rounded-md text-left ${
                activeSection === "examples" ? "bg-gray-100 text-orange-500" : ""
              }`}
            >
              Examples
            </button>
            <button
              onClick={() => scrollToSection("how-it-works")}
              className={`text-sm font-medium px-4 py-2 hover:bg-gray-100 rounded-md text-left ${
                activeSection === "how-it-works" ? "bg-gray-100 text-orange-500" : ""
              }`}
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection("pricing")}
              className={`text-sm font-medium px-4 py-2 hover:bg-gray-100 rounded-md text-left ${
                activeSection === "pricing" ? "bg-gray-100 text-orange-500" : ""
              }`}
            >
              Pricing
            </button>
            <button
              onClick={() => scrollToSection("testimonials")}
              className={`text-sm font-medium px-4 py-2 hover:bg-gray-100 rounded-md text-left ${
                activeSection === "testimonials" ? "bg-gray-100 text-orange-500" : ""
              }`}
            >
              Testimonials
            </button>
            <button
              onClick={() => scrollToSection("faq")}
              className={`text-sm font-medium px-4 py-2 hover:bg-gray-100 rounded-md text-left ${
                activeSection === "faq" ? "bg-gray-100 text-orange-500" : ""
              }`}
            >
              FAQ
            </button>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white mx-4" asChild>
              <Link href="/login">Login</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  )
}

