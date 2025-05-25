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
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
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
            <div className="flex gap-3">
              <Link 
                href="https://www.facebook.com/profile.php?id=61576557967079" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-orange-500 transition-colors"
                aria-label="Follow us on Facebook"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

