import { ReactNode } from 'react'
import Link from 'next/link'

interface BlogLayoutProps {
  children: ReactNode
}

export function BlogLayout({ children }: BlogLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-orange-500">
              StoryInColor
            </Link>
            <nav className="flex gap-6">
              <Link href="/" className="text-gray-600 hover:text-orange-500">
                Home
              </Link>
              <Link href="/blog" className="text-orange-500 font-medium">
                Blog
              </Link>
              <Link href="/create" className="text-gray-600 hover:text-orange-500">
                Create
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-12">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-gray-600">
            <p>&copy; 2024 StoryInColor. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
