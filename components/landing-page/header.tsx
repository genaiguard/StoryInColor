"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X } from "lucide-react"
import { useFirebase } from "@/app/firebase/firebase-provider"

interface HeaderProps {
  activeSection?: string
  scrollToSection?: (id: string) => void
}

interface NavItem {
  id: string
  label: string
  href: string
}

const NAV_ITEMS: NavItem[] = [
  { id: "tools", label: "Tools", href: "/tools" },
  { id: "pricing", label: "Pricing", href: "/#pricing" },
  { id: "faq", label: "FAQ", href: "/#faq" },
]

export default function Header({ activeSection, scrollToSection }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user, initialized } = useFirebase()

  const closeMobile = () => setMobileMenuOpen(false)

  const renderDesktopNavItem = (item: NavItem) => {
    const isActive = activeSection === item.id
    const baseClass = `text-sm font-medium transition-colors ${
      isActive ? "text-orange-500" : "hover:text-orange-500"
    }`

    if (scrollToSection) {
      return (
        <motion.button
          key={item.id}
          onClick={() => scrollToSection(item.id)}
          className={baseClass}
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          {item.label}
        </motion.button>
      )
    }

    return (
      <motion.div
        key={item.id}
        whileHover={{ scale: 1.05 }}
        transition={{ type: "spring", stiffness: 400, damping: 10 }}
      >
        <Link href={item.href} className={baseClass}>
          {item.label}
        </Link>
      </motion.div>
    )
  }

  const renderMobileNavItem = (item: NavItem) => {
    const isActive = activeSection === item.id
    const className = `text-sm font-medium px-4 py-2 hover:bg-gray-100 rounded-md text-left ${
      isActive ? "bg-gray-100 text-orange-500" : ""
    }`

    if (scrollToSection) {
      return (
        <button
          key={item.id}
          onClick={() => {
            scrollToSection(item.id)
            closeMobile()
          }}
          className={className}
        >
          {item.label}
        </button>
      )
    }

    return (
      <Link
        key={item.id}
        href={item.href}
        onClick={closeMobile}
        className={className}
      >
        {item.label}
      </Link>
    )
  }

  return (
    <header className="border-b sticky top-0 bg-white/95 backdrop-blur z-50">
      <div className="container mx-auto max-w-7xl flex h-16 items-center justify-between px-4 md:px-6">
        <div>
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold">
              Story<span className="text-orange-500">InColor</span>
            </span>
          </Link>
        </div>
        <nav className="hidden md:flex items-center gap-6">
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <Link
              href="/tools"
              className="text-sm font-medium transition-colors hover:text-orange-500"
            >
              Readings
            </Link>
          </motion.div>
          {NAV_ITEMS.map(renderDesktopNavItem)}
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <Link
              href="/blog"
              className="text-sm font-medium transition-colors hover:text-orange-500"
            >
              Blog
            </Link>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            {!initialized ? (
              // Skeleton while Firebase auth resolves so signed-in users
              // don't see "Sign in" flash on first paint.
              <div className="h-10 w-24 rounded-full bg-orange-100 animate-pulse" aria-hidden="true" />
            ) : user ? (
              <Button
                className="bg-orange-500 hover:bg-orange-600 text-white rounded-full px-5"
                asChild
              >
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <Button
                className="bg-orange-500 hover:bg-orange-600 text-white rounded-full px-5"
                asChild
              >
                <Link href="/login">Sign in</Link>
              </Button>
            )}
          </motion.div>
        </nav>
        <div className="flex items-center md:hidden">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
            <span className="sr-only">Toggle menu</span>
          </Button>
        </div>
      </div>
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute top-16 left-0 right-0 bg-white z-50 border-b md:hidden overflow-hidden shadow-sm"
          >
            <div className="container mx-auto py-4 flex flex-col space-y-2 px-2">
              <Link
                href="/tools"
                onClick={closeMobile}
                className="text-sm font-medium px-4 py-2 hover:bg-gray-100 rounded-md text-left"
              >
                Readings
              </Link>
              {NAV_ITEMS.map(renderMobileNavItem)}
              <Link
                href="/blog"
                onClick={closeMobile}
                className="text-sm font-medium px-4 py-2 hover:bg-gray-100 rounded-md text-left"
              >
                Blog
              </Link>
              <div className="px-2 pt-2">
                {!initialized ? (
                  <div className="h-10 w-full rounded-full bg-orange-100 animate-pulse" aria-hidden="true" />
                ) : user ? (
                  <Button
                    className="bg-orange-500 hover:bg-orange-600 text-white w-full rounded-full"
                    asChild
                  >
                    <Link href="/dashboard" onClick={closeMobile}>
                      Dashboard
                    </Link>
                  </Button>
                ) : (
                  <Button
                    className="bg-orange-500 hover:bg-orange-600 text-white w-full rounded-full"
                    asChild
                  >
                    <Link href="/login" onClick={closeMobile}>
                      Sign in
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
