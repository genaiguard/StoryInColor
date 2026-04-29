import Link from "next/link";
import { ORDERED_TOOLS } from "@/lib/tools/registry";

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-black">
      <div className="container mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="grid gap-10 md:grid-cols-12">
          {/* Brand column */}
          <div className="flex flex-col gap-3 md:col-span-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-base font-semibold tracking-[-0.02em] text-white sm:text-lg">
                <span className="font-light">Story</span>
                <span className="font-semibold">In</span>
                <span className="font-light">Color</span>
              </span>
            </Link>
            <p className="max-w-xs text-sm text-gray-400">
              Editorial readings, written from a single photo of you.
            </p>
            <div className="flex gap-3 pt-1">
              <Link
                href="https://www.facebook.com/profile.php?id=61576557967079"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 transition-colors hover:text-white"
                aria-label="Follow us on Facebook"
              >
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Readings column */}
          <div className="md:col-span-4">
            <h3 className="mb-4 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
              Readings
            </h3>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
              {ORDERED_TOOLS.map((tool) => (
                <li key={tool.id}>
                  <Link
                    href={`/readings/${tool.slug}`}
                    className="text-sm text-gray-400 transition-colors hover:text-white"
                  >
                    {tool.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company column */}
          <div className="md:col-span-2">
            <h3 className="mb-4 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
              Company
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/about"
                  className="text-sm text-gray-400 transition-colors hover:text-white"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-sm text-gray-400 transition-colors hover:text-white"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal column */}
          <div className="md:col-span-2">
            <h3 className="mb-4 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
              Legal
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/terms"
                  className="text-sm text-gray-400 transition-colors hover:text-white"
                >
                  Terms
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-sm text-gray-400 transition-colors hover:text-white"
                >
                  Privacy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-12 flex flex-col gap-2 border-t border-white/5 pt-6 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} Story In Color. All rights reserved.
          </p>
          <p className="text-xs text-gray-500">Made with care.</p>
        </div>
      </div>
    </footer>
  );
}
