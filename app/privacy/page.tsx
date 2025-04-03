import Link from "next/link"

export default function PrivacyPage() {
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
            <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl mb-6">Privacy Policy</h1>
            <div className="prose max-w-none">
              <p>Last updated: March 29, 2025</p>
              <p>
                At StoryInColor, we take your privacy seriously. This Privacy Policy explains how we collect, use, and
                protect your personal information.
              </p>
              <h2>1. Information We Collect</h2>
              <p>
                We collect information you provide directly to us, such as your name, email address, shipping address,
                and the photos you upload to create your coloring book.
              </p>
              <h2>2. How We Use Your Information</h2>
              <p>
                We use your information to provide our service, process payments, ship your orders, and communicate with
                you about your order status.
              </p>
              <h2>3. Data Security</h2>
              <p>
                We implement appropriate security measures to protect your personal information. Your photos are stored
                securely and are only used to create your coloring book.
              </p>
              <h2>4. Your Rights</h2>
              <p>
                You have the right to access, correct, or delete your personal information. Please contact us if you
                wish to exercise these rights.
              </p>
              <h2>5. Cookies and Tracking Technologies</h2>
              <p>
                We use cookies and similar tracking technologies to track the activity on our service and hold certain
                information. Cookies are files with a small amount of data which may include an anonymous unique
                identifier.
              </p>
              <h2>6. Third-Party Services</h2>
              <p>
                We may employ third-party companies and individuals to facilitate our service, provide the service on
                our behalf, perform service-related services, or assist us in analyzing how our service is used.
              </p>
              <h2>7. Children's Privacy</h2>
              <p>
                Our service does not address anyone under the age of 13. We do not knowingly collect personally
                identifiable information from children under 13.
              </p>
              <h2>8. Changes to This Privacy Policy</h2>
              <p>
                We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new
                Privacy Policy on this page.
              </p>
              <h2>9. Contact Us</h2>
              <p>If you have any questions about this Privacy Policy, please contact us at privacy@storyincolor.com.</p>
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

