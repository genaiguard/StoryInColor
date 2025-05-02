import Link from "next/link"

export default function Footer() {
  return (
    <footer className="border-t bg-gray-50">
      <div className="container mx-auto max-w-7xl px-4 md:px-6 py-6 md:py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1 md:gap-2">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-lg font-bold">
                Story<span className="text-orange-500">InColor</span>
              </span>
            </Link>
            <p className="text-xs text-gray-500">© 2023 StoryInColor. All rights reserved.</p>
          </div>
          <nav className="flex gap-4 md:gap-6">
            <Link href="/terms" className="text-xs hover:underline underline-offset-4">
              Terms
            </Link>
            <Link href="/privacy" className="text-xs hover:underline underline-offset-4">
              Privacy
            </Link>
            <Link href="/contact" className="text-xs hover:underline underline-offset-4">
              Contact
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}

