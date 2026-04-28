import Link from "next/link";
import Header from "@/components/landing-page/header";
import Footer from "@/components/landing-page/footer";

const SECTIONS: Array<{ heading: string; body: React.ReactNode }> = [
  {
    heading: "1. Use of service",
    body: (
      <>
        <p>
          StoryInColor provides a platform for creating personalized AI
          readings and keepsakes from your photos. Our service operates on a
          credit-based system, where each credit allows you to generate one
          result from your uploaded photo.
        </p>
        <p>
          You may use our service only as permitted by these terms and
          applicable law. We reserve the right to refuse service, terminate
          accounts, or remove content at our discretion.
        </p>
        <p>
          You agree not to use the service for any unlawful or prohibited
          activities, including but not limited to, infringing on intellectual
          property rights, distributing harmful or malicious content, or
          engaging in fraudulent activities.
        </p>
      </>
    ),
  },
  {
    heading: "2. User content and rights",
    body: (
      <>
        <p>
          You retain ownership of any photos you upload to our service. By
          uploading content, you grant StoryInColor a non-exclusive, worldwide,
          royalty-free, perpetual, irrevocable license to use, reproduce,
          modify, and process your photos solely for the purpose of creating
          your selected AI-generated output and improving our AI algorithms.
        </p>
        <p>
          You represent and warrant that you own or have the necessary rights
          to the photos you upload, and that your content does not violate any
          third-party rights, including copyright, trademark, privacy,
          publicity, or other personal or proprietary rights.
        </p>
      </>
    ),
  },
  {
    heading: "3. AI-generated content",
    body: (
      <>
        <p>
          Our service uses advanced artificial intelligence to transform your
          photos into personalized readings and keepsakes. While we strive
          for high-quality results, you acknowledge that:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            The AI conversion process may produce variations from your
            original photos
          </li>
          <li>
            The quality of the result depends on the quality and clarity of
            your uploaded photos
          </li>
          <li>Not all images are equally suitable for every available tool</li>
        </ul>
        <p className="mt-3">
          You accept that AI-generated content may not perfectly represent
          the original photos, and StoryInColor is not liable for artistic
          variations in the conversion process.
        </p>
      </>
    ),
  },
  {
    heading: "4. Privacy",
    body: (
      <p>
        Your privacy is important to us. Please review our{" "}
        <Link
          href="/privacy"
          className="text-white underline hover:no-underline"
        >
          Privacy Policy
        </Link>{" "}
        to understand how we collect, use, and safeguard your information,
        including your uploaded photos.
      </p>
    ),
  },
  {
    heading: "5. Payment and credits",
    body: (
      <>
        <p>
          Our service operates on a credit-based system. All payments for
          credits are processed securely through our payment processors. By
          purchasing credits, you agree to pay all charges at the prices
          listed at the time of your purchase.
        </p>
        <p className="mt-3">
          Each credit allows you to generate one result from your uploaded
          photo. Once used, credits cannot be refunded except in the
          following circumstances:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Technical failure where the generation process was not completed
            despite credit deduction
          </li>
          <li>
            Service outage preventing delivery of purchased credits to your
            account
          </li>
        </ul>
        <p className="mt-3">We do not offer refunds for:</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Stylistic or artistic preferences regarding the AI conversion
            results
          </li>
          <li>Credits that have been successfully used to generate results</li>
          <li>Unused credits in your account after purchase</li>
        </ul>
      </>
    ),
  },
  {
    heading: "6. Prohibited uses",
    body: (
      <>
        <p>You agree not to use StoryInColor to:</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Upload photos containing obscene, illegal, offensive, or
            inappropriate content
          </li>
          <li>Upload photos that you do not have the rights to use</li>
          <li>
            Attempt to reverse-engineer our AI algorithms or technology
          </li>
          <li>
            Resell or commercially distribute outputs created through our
            service
          </li>
          <li>
            Engage in any activity that could harm our platform or interfere
            with other users' experiences
          </li>
        </ul>
      </>
    ),
  },
  {
    heading: "7. Intellectual property",
    body: (
      <>
        <p>
          The StoryInColor service, including all software, algorithms,
          features, and functionality, is owned by StoryInColor and is
          protected by copyright, trademark, and other intellectual property
          laws.
        </p>
        <p className="mt-3">
          While you retain rights to your original photos, the specific
          AI-generated output created through our service is licensed to you
          for personal, non-commercial use only.
        </p>
      </>
    ),
  },
  {
    heading: "8. Limitation of liability",
    body: (
      <>
        <p className="font-medium text-gray-200">
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, STORYINCOLOR AND ITS
          OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR
          ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
          DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES.
        </p>
        <p className="mt-3 font-medium text-gray-200">
          IN NO EVENT SHALL OUR TOTAL LIABILITY FOR ALL CLAIMS RELATED TO THE
          SERVICE EXCEED THE GREATER OF $100 USD OR THE AMOUNT YOU PAID TO
          STORYINCOLOR IN THE PAST SIX MONTHS.
        </p>
        <p className="mt-3">
          Some jurisdictions do not allow the exclusion or limitation of
          certain damages, so some or all of the exclusions and limitations
          in this section may not apply to you.
        </p>
      </>
    ),
  },
  {
    heading: "9. Indemnification",
    body: (
      <p>
        You agree to indemnify, defend, and hold harmless StoryInColor and
        its officers, directors, employees, and agents from and against any
        claims, liabilities, damages, losses, and expenses arising out of or
        in any way connected with your access to or use of the service.
      </p>
    ),
  },
  {
    heading: "10. Governing law",
    body: (
      <p>
        These Terms shall be governed by and construed in accordance with the
        laws of the state of California, without regard to its conflict of
        law provisions.
      </p>
    ),
  },
  {
    heading: "11. Dispute resolution",
    body: (
      <p>
        Any dispute arising from or relating to these Terms or our services
        shall first be attempted to be resolved through informal negotiation.
        If the dispute cannot be resolved through negotiation, both parties
        agree to resolve the dispute through binding arbitration in
        accordance with the rules of the American Arbitration Association.
      </p>
    ),
  },
  {
    heading: "12. Changes to terms",
    body: (
      <p>
        We may update these Terms from time to time at our discretion. We
        will notify you of any significant changes by posting the new Terms
        on this page and updating the "Last Updated" date.
      </p>
    ),
  },
  {
    heading: "13. Contact us",
    body: (
      <p>
        If you have any questions about these Terms, please contact us at{" "}
        <a
          href="mailto:support@storyincolor.com"
          className="text-white underline hover:no-underline"
        >
          support@storyincolor.com
        </a>
        .
      </p>
    ),
  },
];

export const metadata = {
  title: "Terms of Service | StoryInColor",
  description:
    "Terms of Service for StoryInColor — credit-based AI photo readings and keepsakes.",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <Header />

      <main className="flex-1 px-4 pb-20 pt-32 md:px-8 md:pt-36">
        <div className="container mx-auto max-w-3xl">
          <div className="mb-10">
            <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
              <span className="h-px w-8 bg-white/20" aria-hidden="true" />
              Legal
            </div>
            <h1
              className="text-3xl font-normal tracking-[-0.04em] sm:text-4xl md:text-5xl"
            >
              Terms of{" "}
              <span className="italic font-light text-gray-400">service.</span>
            </h1>
            <p className="mt-3 text-sm text-gray-500">
              Last updated: May 15, 2024
            </p>
            <p className="mt-5 text-base text-gray-300 md:text-lg">
              Welcome to StoryInColor. By accessing or using our service, you
              agree to be bound by these Terms of Service. Please read them
              carefully.
            </p>
          </div>

          <div className="space-y-8 text-sm leading-relaxed text-gray-300 md:text-base">
            {SECTIONS.map((section) => (
              <section
                key={section.heading}
                className="border-t border-white/5 pt-8 first:border-0 first:pt-0"
              >
                <h2 className="mb-3 text-xl font-medium text-white md:text-2xl">
                  {section.heading}
                </h2>
                <div className="space-y-3">{section.body}</div>
              </section>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
