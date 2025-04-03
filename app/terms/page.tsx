import Link from "next/link"

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-white">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold">
              Story<span className="text-orange-500">InColor</span>
            </span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/" className="text-sm font-medium hover:text-orange-500">
              Back to Home
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <section className="py-12 md:py-16 lg:py-20">
          <div className="container px-4 md:px-6">
            <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl mb-6">Terms of Service</h1>
            <div className="prose max-w-none">
              <p>Last updated: March 29, 2025</p>
              <p>
                Welcome to StoryInColor. By accessing or using our service, you agree to be bound by these Terms of
                Service. Please read them carefully.
              </p>
              <h2>1. Use of Service</h2>
              <p>
                StoryInColor provides a platform for creating custom coloring books from your photos. You may use our
                service only as permitted by these terms and applicable law.
              </p>
              <h2>2. User Content</h2>
              <p>
                You retain ownership of any photos you upload to our service. By uploading content, you grant
                StoryInColor a license to use, reproduce, and process your photos solely for the purpose of creating
                your coloring book.
              </p>
              <h2>3. Privacy</h2>
              <p>
                Your privacy is important to us. Please review our Privacy Policy to understand how we collect and use
                your information.
              </p>
              <h2>4. Payment and Refunds</h2>
              <p>
                All payments are processed securely. If you're not satisfied with your coloring book, please contact us
                within 14 days of receiving your order for our satisfaction guarantee.
              </p>
              <h2>5. Intellectual Property</h2>
              <p>
                The StoryInColor service, including all content, features, and functionality, is owned by StoryInColor
                and is protected by copyright, trademark, and other intellectual property laws.
              </p>
              <h2>6. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, StoryInColor shall not be liable for any indirect, incidental,
                special, consequential, or punitive damages, or any loss of profits or revenues.
              </p>
              <h2>7. Governing Law</h2>
              <p>
                These Terms shall be governed by the laws of the state of California, without regard to its conflict of
                law provisions.
              </p>
              <h2>8. Changes to Terms</h2>
              <p>
                We may update these Terms from time to time. We will notify you of any changes by posting the new Terms
                on this page.
              </p>
              <h2>9. Contact Us</h2>
              <p>If you have any questions about these Terms, please contact us at support@storyincolor.com.</p>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t bg-gray-50">
        <div className="container mx-auto px-4 md:px-6 py-6 md:py-10">
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
    </div>
  )
}

