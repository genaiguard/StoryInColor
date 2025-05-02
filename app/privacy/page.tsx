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
      <main className="flex-1 bg-gray-50">
        <section className="py-12 md:py-16 lg:py-20">
          <div className="container px-4 md:px-6 max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm p-6 md:p-8 lg:p-10">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl mb-6 text-center">Privacy Policy</h1>
              <p className="text-sm text-gray-500 text-center mb-8">Last updated: April 4, 2024</p>
              
              <div className="prose max-w-none">
                <div className="mb-8">
                  <p className="text-gray-700 mb-6">
                    At StoryInColor, we take your privacy seriously. This Privacy Policy explains how we collect, use, and
                    protect your personal information when you use our service.
                  </p>
                </div>

                <div className="mb-10 pb-8 border-b border-gray-200">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">1. Information We Collect</h2>
                  <p className="text-gray-700 mb-4">
                    We collect information you provide directly to us, such as your name, email address, shipping address,
                    and the photos you upload to create your coloring book. We may also collect information about your usage of our service, including your interactions with our website and any communications you have with us.
                  </p>
                  <p className="text-gray-700">
                    Automatically collected information may include your IP address, browser type, operating system, referring URLs, device information, pages viewed, links clicked, user interactions, timestamps, and similar data. This information helps us understand how users interact with our service and improve our offerings.
                  </p>
                </div>

                <div className="mb-10 pb-8 border-b border-gray-200">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">2. How We Use Your Information</h2>
                  <p className="text-gray-700 mb-4">
                    We use your information to:
                  </p>
                  <ul className="list-disc pl-5 mb-4 text-gray-700">
                    <li className="mb-2">Provide, maintain, and improve our services</li>
                    <li className="mb-2">Process transactions and send related information including confirmations, receipts, and customer experience surveys</li>
                    <li className="mb-2">Create and process your custom coloring book products</li>
                    <li className="mb-2">Send technical notices, updates, security alerts, and administrative messages</li>
                    <li className="mb-2">Respond to your comments, questions, and customer service requests</li>
                    <li className="mb-2">Monitor and analyze trends, usage, and activities in connection with our service</li>
                    <li className="mb-2">Detect, investigate, and prevent fraudulent transactions and other illegal activities</li>
                    <li className="mb-2">Improve and develop new products, services, and features</li>
                  </ul>
                </div>

                <div className="mb-10 pb-8 border-b border-gray-200">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">3. Photo Processing and AI Technology</h2>
                  <p className="text-gray-700 mb-4">
                    When you upload photos to our service, we use advanced artificial intelligence technology to transform them into coloring book pages. This process involves:
                  </p>
                  <ul className="list-disc pl-5 mb-4 text-gray-700">
                    <li className="mb-2">Temporary storage of your original photos</li>
                    <li className="mb-2">Processing through our AI transformation systems</li>
                    <li className="mb-2">Generation of line-art versions of your photos</li>
                    <li className="mb-2">Creation of your final coloring book product</li>
                  </ul>
                  <p className="text-gray-700">
                    We take measures to ensure your photos are handled securely throughout this process. Your original photos and the resulting transformations are associated with your account and are not shared with other users. We use industry-standard security technologies and procedures to protect your photos during processing.
                  </p>
                </div>

                <div className="mb-10 pb-8 border-b border-gray-200">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">4. Data Security</h2>
                  <p className="text-gray-700">
                    We implement industry-standard security measures to protect your personal information and uploaded content. Your photos and data are stored using secure cloud infrastructure with encryption during transit and at rest. We regularly review our security practices and update them as needed. However, no method of electronic transmission or storage is 100% secure, and we cannot guarantee absolute security.
                  </p>
                </div>

                <div className="mb-10 pb-8 border-b border-gray-200">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">5. Payment Information</h2>
                  <p className="text-gray-700">
                    When you make a purchase through our service, payment information is collected and processed by secure, PCI-compliant third-party payment processors. We do not store your complete credit card details on our servers. Any payment information we retain is encrypted and used only as necessary for processing refunds, preventing fraud, and addressing any issues related to your purchase.
                  </p>
                </div>

                <div className="mb-10 pb-8 border-b border-gray-200">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">6. Your Rights</h2>
                  <p className="text-gray-700">
                    Depending on your location, you may have certain rights regarding your personal information. These might include the right to access, correct, or delete your personal information, or to object to or restrict certain processing activities. We will honor valid requests when required by applicable law. Please contact us if you wish to exercise these rights, and we will respond to your request within a reasonable timeframe.
                  </p>
                </div>

                <div className="mb-10 pb-8 border-b border-gray-200">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">7. Cookies and Tracking Technologies</h2>
                  <p className="text-gray-700 mb-4">
                    We use cookies and similar tracking technologies to collect information about your browsing activities and to analyze site traffic. These technologies help us understand how users interact with our service, remember your preferences, and optimize your experience. 
                  </p>
                  <p className="text-gray-700">
                    Our service may include analytics tools that collect and analyze information about site usage to improve functionality and user experience. You can control cookie settings through your browser preferences, but please note that disabling certain cookies may affect the functionality of our service.
                  </p>
                </div>

                <div className="mb-10 pb-8 border-b border-gray-200">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">8. Third-Party Services</h2>
                  <p className="text-gray-700 mb-4">
                    We work with various third-party service providers to deliver specific functionality for our service, including:
                  </p>
                  <ul className="list-disc pl-5 mb-4 text-gray-700">
                    <li className="mb-2">Cloud storage and hosting services</li>
                    <li className="mb-2">Payment processing services</li>
                    <li className="mb-2">Authentication and identity verification services</li>
                    <li className="mb-2">Analytics and performance monitoring services</li>
                    <li className="mb-2">Customer support systems</li>
                    <li className="mb-2">Email and communication services</li>
                    <li className="mb-2">Advanced image processing and AI technologies</li>
                  </ul>
                  <p className="text-gray-700">
                    These third parties may have access to your personal information only as needed to perform their functions on our behalf and are contractually obligated to maintain the confidentiality and security of your data. They are restricted from using your data for any other purposes than those specified by us.
                  </p>
                </div>

                <div className="mb-10 pb-8 border-b border-gray-200">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">9. Data Retention</h2>
                  <p className="text-gray-700">
                    We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law. We will retain your account information and order history as long as your account remains active. If you close your account, we may still retain certain information to comply with legal obligations, resolve disputes, prevent fraud, enforce agreements, or for legitimate business purposes.
                  </p>
                </div>

                <div className="mb-10 pb-8 border-b border-gray-200">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">10. Children's Privacy</h2>
                  <p className="text-gray-700">
                    Our service does not address anyone under the age of 13. We do not knowingly collect personally
                    identifiable information from children under 13. If you are a parent or guardian and you are aware that your child has provided us with personal information, please contact us. If we become aware that we have collected personal information from children without verification of parental consent, we take steps to remove that information from our servers.
                  </p>
                </div>

                <div className="mb-10 pb-8 border-b border-gray-200">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">11. International Data Transfers</h2>
                  <p className="text-gray-700">
                    Your information may be transferred to, and maintained on, computers located outside of your state, province, country, or other governmental jurisdiction where the data protection laws may differ from those in your jurisdiction. If you are located outside the United States and choose to provide information to us, please note that we transfer the data to the United States and process it there. Your consent to this Privacy Policy followed by your submission of such information represents your agreement to that transfer.
                  </p>
                </div>

                <div className="mb-10 pb-8 border-b border-gray-200">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">12. Changes to This Privacy Policy</h2>
                  <p className="text-gray-700">
                    We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new
                    Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes. Your continued use of the service after such modifications constitutes your acknowledgment of the modified Privacy Policy and your agreement to be bound by it.
                  </p>
                </div>

                <div className="mb-4">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">13. Contact Us</h2>
                  <p className="text-gray-700">
                    If you have any questions about this Privacy Policy, please contact us at <a href="mailto:privacy@storyincolor.com" className="text-orange-500 hover:underline">privacy@storyincolor.com</a>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t bg-gray-100">
        <div className="container mx-auto px-4 md:px-6 py-6 md:py-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-1 md:gap-2">
              <Link href="/" className="flex items-center gap-2">
                <span className="text-lg font-bold">
                  Story<span className="text-orange-500">InColor</span>
                </span>
              </Link>
              <p className="text-xs text-gray-500">© 2024 StoryInColor. All rights reserved.</p>
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

