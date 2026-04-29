"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X, User, LogIn } from "lucide-react";
import { useFirebase } from "@/app/firebase/firebase-provider";

interface HeaderProps {
  activeSection?: string;
  scrollToSection?: (id: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  href: string;
  scrollTarget?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "readings", label: "Readings", href: "/readings" },
  { id: "pricing", label: "Pricing", href: "/#pricing", scrollTarget: "pricing" },
  { id: "testimonials", label: "Reviews", href: "/#testimonials", scrollTarget: "testimonials" },
  { id: "faq", label: "FAQ", href: "/#faq", scrollTarget: "faq" },
];

export default function Header({ activeSection, scrollToSection }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, initialized } = useFirebase();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMobile = () => setMobileMenuOpen(false);

  const handleNavClick = (item: NavItem) => {
    if (item.scrollTarget && scrollToSection) {
      scrollToSection(item.scrollTarget);
    }
    closeMobile();
  };

  const renderNavLink = (item: NavItem, delay: number) => {
    const isActive = activeSection === item.id;
    const className = `text-sm transition-colors animate-blur-fade-up ${
      isActive ? "text-white" : "text-gray-300 hover:text-white"
    }`;

    if (item.scrollTarget && scrollToSection) {
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => handleNavClick(item)}
          className={className}
          style={{ animationDelay: `${delay}ms` }}
        >
          {item.label}
        </button>
      );
    }

    return (
      <Link
        key={item.id}
        href={item.href}
        className={className}
        style={{ animationDelay: `${delay}ms` }}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
          scrolled
            ? "bg-black/60 backdrop-blur-md border-b border-white/5"
            : "bg-transparent"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4 sm:px-6 md:px-12 md:py-6">
          {/* Logo */}
          <Link
            href="/"
            className="animate-blur-fade-up text-base font-semibold tracking-[-0.02em] text-white sm:text-lg"
            style={{ animationDelay: "0ms" }}
          >
            <span className="font-light">Story</span>
            <span className="font-semibold">In</span>
            <span className="font-light">Color</span>
          </Link>

          {/* Center desktop nav */}
          <nav className="hidden lg:flex items-center gap-8">
            {NAV_ITEMS.map((item, i) => renderNavLink(item, 100 + i * 50))}
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Sign in / Dashboard pill — visible sm+ */}
            <div
              className="hidden animate-blur-fade-up sm:block"
              style={{ animationDelay: "350ms" }}
            >
              {!initialized ? (
                <div
                  className="liquid-glass h-10 w-28 rounded-full"
                  aria-hidden="true"
                />
              ) : user ? (
                <Link
                  href="/dashboard"
                  className="liquid-glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium md:px-6"
                >
                  Dashboard
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="liquid-glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium md:px-6"
                >
                  <LogIn size={16} />
                  Sign in
                </Link>
              )}
            </div>

            {/* Hamburger — visible only below lg */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="liquid-glass animate-blur-fade-up relative inline-flex h-10 w-10 items-center justify-center rounded-full lg:hidden"
              style={{ animationDelay: "350ms" }}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              <Menu
                size={18}
                className={`absolute transition-all duration-500 ease-out ${
                  mobileMenuOpen
                    ? "rotate-180 scale-50 opacity-0"
                    : "rotate-0 scale-100 opacity-100"
                }`}
              />
              <X
                size={18}
                className={`absolute transition-all duration-500 ease-out ${
                  mobileMenuOpen
                    ? "rotate-0 scale-100 opacity-100"
                    : "-rotate-180 scale-50 opacity-0"
                }`}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile dropdown */}
      <div
        className={`fixed left-0 right-0 top-[72px] z-40 border-b border-t border-white/10 bg-black/95 backdrop-blur-lg shadow-2xl transition-all duration-500 ease-out lg:hidden ${
          mobileMenuOpen
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-4 opacity-0"
        }`}
      >
        <nav className="flex flex-col gap-1 px-4 py-4 sm:px-6">
          {NAV_ITEMS.map((item, i) => {
            const baseClass =
              "rounded-lg px-3 py-3 text-sm text-gray-200 transition-all hover:bg-white/5";
            const style = {
              transitionDelay: mobileMenuOpen ? `${i * 50}ms` : "0ms",
            };
            if (item.scrollTarget && scrollToSection) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item)}
                  className={`${baseClass} text-left ${
                    mobileMenuOpen
                      ? "translate-x-0 opacity-100"
                      : "-translate-x-2 opacity-0"
                  }`}
                  style={style}
                >
                  {item.label}
                </button>
              );
            }
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={closeMobile}
                className={`${baseClass} ${
                  mobileMenuOpen
                    ? "translate-x-0 opacity-100"
                    : "-translate-x-2 opacity-0"
                }`}
                style={style}
              >
                {item.label}
              </Link>
            );
          })}

          {/* Auth row — visible only below sm where the desktop button is hidden */}
          <div className="mt-3 border-t border-white/10 pt-3 sm:hidden">
            {!initialized ? (
              <div
                className="liquid-glass h-11 w-full rounded-full"
                aria-hidden="true"
              />
            ) : user ? (
              <Link
                href="/dashboard"
                onClick={closeMobile}
                className="liquid-glass flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-medium"
              >
                <User size={16} />
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                onClick={closeMobile}
                className="liquid-glass flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-medium"
              >
                <LogIn size={16} />
                Sign in
              </Link>
            )}
          </div>
        </nav>
      </div>
    </>
  );
}
