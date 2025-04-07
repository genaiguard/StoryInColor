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
      <main className="flex-1 bg-gray-50">
        <section className="py-12 md:py-16 lg:py-20">
          <div className="container px-4 md:px-6 max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm p-6 md:p-8 lg:p-10">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl mb-6 text-center">Terms of Service</h1>
              <p className="text-sm text-gray-500 text-center mb-8">Last updated: April 4, 2024</p>
              
              <div className="prose max-w-none">
                <div className="mb-8">
                  <p className="text-gray-700 mb-6">
                    Welcome to StoryInColor. By accessing or using our service, you agree to be bound by these Terms of
                    Service. Please read them carefully.
                  </p>
                </div>

                <div className="mb-10 pb-8 border-b border-gray-200">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">1. Use of Service</h2>
                  <p className="text-gray-700">
                    StoryInColor provides a platform for creating custom coloring books from your photos using advanced artificial intelligence technology. You may use our
                    service only as permitted by these terms and applicable law. We reserve the right to refuse service, terminate accounts, or remove content at our discretion.
                  </p>
                  <p className="text-gray-700">
                    You agree not to use the service for any unlawful or prohibited activities, including but not limited to, infringing on intellectual property rights, distributing harmful or malicious content, or engaging in fraudulent activities.
                  </p>
                </div>

                <div className="mb-10 pb-8 border-b border-gray-200">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">2. User Content and Rights</h2>
                  <p className="text-gray-700 mb-4">
                    You retain ownership of any photos you upload to our service. By uploading content, you grant
                    StoryInColor a non-exclusive, worldwide, royalty-free, perpetual, irrevocable license to use, reproduce, modify, and process your photos solely for the purpose of creating
                    your coloring book and improving our AI algorithms.
                  </p>
                  <p className="text-gray-700">
                    You represent and warrant that you own or have the necessary rights to the photos you upload, and that your content does not violate any third-party rights, including copyright, trademark, privacy, publicity, or other personal or proprietary rights. You agree to indemnify StoryInColor for any claims arising from your content.
                  </p>
                </div>

                <div className="mb-10 pb-8 border-b border-gray-200">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">3. AI-Generated Content</h2>
                  <p className="text-gray-700 mb-4">
                    Our service uses advanced artificial intelligence to transform your photos into coloring book pages. The AI-generated artwork is created specifically for you based on your uploaded photos. While we strive for high-quality results, you acknowledge that:
                  </p>
                  <ul className="list-disc pl-5 mb-4 text-gray-700">
                    <li className="mb-2">The AI conversion process may produce variations from your original photos</li>
                    <li className="mb-2">The quality of the resulting coloring pages depends on the quality and clarity of your uploaded photos</li>
                    <li className="mb-2">Not all images are equally suitable for conversion to coloring book format</li>
                  </ul>
                  <p className="text-gray-700">
                    You accept that AI-generated content may not perfectly represent the original photos, and StoryInColor is not liable for artistic variations in the conversion process. You agree to use the AI-generated content for personal, non-commercial purposes only.
                  </p>
                </div>

                <div className="mb-10 pb-8 border-b border-gray-200">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">4. Privacy</h2>
                  <p className="text-gray-700">
                    Your privacy is important to us. Please review our <Link href="/privacy" className="text-orange-500 hover:underline">Privacy Policy</Link> to understand how we collect, use, and safeguard your information, including your uploaded photos. By using our service, you consent to the collection and use of your information as outlined in our Privacy Policy.
                  </p>
                </div>

                <div className="mb-10 pb-8 border-b border-gray-200">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">5. Payment and Refunds</h2>
                  <p className="text-gray-700 mb-4">
                    All payments are processed securely through our payment processors. By purchasing our products, you agree to pay all charges at the prices listed at the time of your purchase. Prices for our products are subject to change without notice.
                  </p>
                  <p className="text-gray-700 mb-4">
                    Preview images are provided before purchase to help you make an informed decision. If you're not satisfied with your coloring book due to manufacturing defects or shipping damage, please contact us within 14 days of receiving your order for our satisfaction guarantee. We do not offer refunds for:
                  </p>
                  <ul className="list-disc pl-5 text-gray-700">
                    <li className="mb-2">Stylistic or artistic preferences regarding the AI conversion</li>
                    <li className="mb-2">Digital products that have been downloaded</li>
                    <li className="mb-2">Customized physical products unless damaged or defective</li>
                  </ul>
                </div>

                <div className="mb-10 pb-8 border-b border-gray-200">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">6. Prohibited Uses</h2>
                  <p className="text-gray-700 mb-4">
                    You agree not to use StoryInColor to:
                  </p>
                  <ul className="list-disc pl-5 text-gray-700">
                    <li className="mb-2">Upload photos containing obscene, illegal, offensive, or inappropriate content</li>
                    <li className="mb-2">Upload photos that you do not have the rights to use</li>
                    <li className="mb-2">Attempt to reverse-engineer our AI algorithms or technology</li>
                    <li className="mb-2">Resell or commercially distribute the coloring books created through our service</li>
                    <li className="mb-2">Engage in any activity that could harm our platform or interfere with other users' experiences</li>
                  </ul>
                </div>

                <div className="mb-10 pb-8 border-b border-gray-200">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">7. Intellectual Property</h2>
                  <p className="text-gray-700 mb-4">
                    The StoryInColor service, including all software, algorithms, features, and functionality, is owned by StoryInColor and is protected by copyright, trademark, and other intellectual property laws. Our name, logo, and the look and feel of our service are trademarks of StoryInColor.
                  </p>
                  <p className="text-gray-700">
                    While you retain rights to your original photos, the specific AI-transformed artwork created through our service is licensed to you for personal, non-commercial use only. You may not reproduce, distribute, or create derivative works from the AI-generated content without our express written permission.
                  </p>
                </div>

                <div className="mb-10 pb-8 border-b border-gray-200">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">8. Limitation of Liability</h2>
                  <p className="text-gray-700 mb-4 font-medium">
                    TO THE MAXIMUM EXTENT PERMITTED BY LAW, STORYINCOLOR AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
                  </p>
                  <p className="text-gray-700 mb-4 font-medium">
                    IN NO EVENT SHALL OUR TOTAL LIABILITY FOR ALL CLAIMS RELATED TO THE SERVICE EXCEED THE GREATER OF $100 USD OR THE AMOUNT YOU PAID TO STORYINCOLOR IN THE PAST SIX MONTHS.
                  </p>
                  <p className="text-gray-700">
                    SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OR LIMITATION OF CERTAIN DAMAGES, SO SOME OR ALL OF THE EXCLUSIONS AND LIMITATIONS IN THIS SECTION MAY NOT APPLY TO YOU.
                  </p>
                </div>

                <div className="mb-10 pb-8 border-b border-gray-200">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">9. Indemnification</h2>
                  <p className="text-gray-700">
                    You agree to indemnify, defend, and hold harmless StoryInColor and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorneys' fees and costs, arising out of or in any way connected with your access to or use of the service, your violation of these Terms, or your violation of any rights of another.
                  </p>
                </div>

                <div className="mb-10 pb-8 border-b border-gray-200">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">10. Governing Law</h2>
                  <p className="text-gray-700">
                    These Terms shall be governed by and construed in accordance with the laws of the state of California, without regard to its conflict of law provisions. Any legal action or proceeding relating to these Terms shall be brought exclusively in the state or federal courts located in San Francisco, California.
                  </p>
                </div>

                <div className="mb-10 pb-8 border-b border-gray-200">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">11. Dispute Resolution</h2>
                  <p className="text-gray-700">
                    Any dispute arising from or relating to these Terms or our services shall first be attempted to be resolved through informal negotiation. If the dispute cannot be resolved through negotiation, both parties agree to resolve the dispute through binding arbitration in accordance with the rules of the American Arbitration Association.
                  </p>
                </div>

                <div className="mb-10 pb-8 border-b border-gray-200">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">12. Changes to Terms</h2>
                  <p className="text-gray-700">
                    We may update these Terms from time to time at our discretion. We will notify you of any significant changes by posting the new Terms on this page and updating the "Last Updated" date. Your continued use of the service after such modifications constitutes your acceptance of the revised Terms.
                  </p>
                </div>

                <div className="mb-4">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">13. Contact Us</h2>
                  <p className="text-gray-700">
                    If you have any questions about these Terms, please contact us at <a href="mailto:support@storyincolor.com" className="text-orange-500 hover:underline">support@storyincolor.com</a>.
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

