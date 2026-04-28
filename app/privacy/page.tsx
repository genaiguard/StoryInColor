import Link from "next/link";
import Header from "@/components/landing-page/header";
import Footer from "@/components/landing-page/footer";

const SECTIONS: Array<{ heading: string; body: React.ReactNode }> = [
  {
    heading: "1. Information we collect",
    body: (
      <>
        <p>
          We collect information you provide directly to us, such as your name,
          email address, and the photos you upload to create your selected
          AI-generated output. We may also collect information about your usage
          of our service, including your interactions with our website and any
          communications you have with us.
        </p>
        <p>
          Automatically collected information may include your IP address,
          browser type, operating system, referring URLs, device information,
          pages viewed, links clicked, user interactions, timestamps, and
          similar data.
        </p>
      </>
    ),
  },
  {
    heading: "2. How we use your information",
    body: (
      <>
        <p>We use your information to:</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Provide, maintain, and improve our services</li>
          <li>
            Process transactions and send related information including
            confirmations, receipts, and customer experience surveys
          </li>
          <li>Create and process your selected AI-generated outputs</li>
          <li>
            Send technical notices, updates, security alerts, and
            administrative messages
          </li>
          <li>
            Respond to your comments, questions, and customer service requests
          </li>
          <li>
            Monitor and analyze trends, usage, and activities in connection
            with our service
          </li>
          <li>
            Detect, investigate, and prevent fraudulent transactions and other
            illegal activities
          </li>
          <li>Improve and develop new products, services, and features</li>
        </ul>
      </>
    ),
  },
  {
    heading: "3. Photo processing and AI technology",
    body: (
      <>
        <p>
          When you upload photos to our service, we use advanced artificial
          intelligence technology to transform them into personalized readings
          and keepsakes. This process involves:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Temporary storage of your original photos</li>
          <li>Processing through our AI transformation systems</li>
          <li>Generation of the result for the tool you selected</li>
          <li>Creation of your final output file</li>
        </ul>
        <p className="mt-3">
          We take measures to ensure your photos are handled securely
          throughout this process. Your original photos and the resulting
          transformations are associated with your account and are not shared
          with other users.
        </p>
      </>
    ),
  },
  {
    heading: "4. Data security",
    body: (
      <p>
        We implement industry-standard security measures to protect your
        personal information and uploaded content. Your photos and data are
        stored using secure cloud infrastructure with encryption during
        transit and at rest. However, no method of electronic transmission or
        storage is 100% secure, and we cannot guarantee absolute security.
      </p>
    ),
  },
  {
    heading: "5. Payment information",
    body: (
      <p>
        When you make a purchase through our service, payment information is
        collected and processed by secure, PCI-compliant third-party payment
        processors. We do not store your complete credit card details on our
        servers.
      </p>
    ),
  },
  {
    heading: "6. Your rights",
    body: (
      <p>
        Depending on your location, you may have certain rights regarding
        your personal information. These might include the right to access,
        correct, or delete your personal information, or to object to or
        restrict certain processing activities. We will honor valid requests
        when required by applicable law.
      </p>
    ),
  },
  {
    heading: "7. Cookies and tracking technologies",
    body: (
      <>
        <p>
          We use cookies and similar tracking technologies to collect
          information about your browsing activities and to analyze site
          traffic. These technologies help us understand how users interact
          with our service, remember your preferences, and optimize your
          experience.
        </p>
        <p className="mt-3">
          You can control cookie settings through your browser preferences,
          but please note that disabling certain cookies may affect the
          functionality of our service.
        </p>
      </>
    ),
  },
  {
    heading: "8. Third-party services",
    body: (
      <>
        <p>
          We work with various third-party service providers to deliver
          specific functionality for our service, including:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Cloud storage and hosting services</li>
          <li>Payment processing services</li>
          <li>Authentication and identity verification services</li>
          <li>Analytics and performance monitoring services</li>
          <li>Customer support systems</li>
          <li>Email and communication services</li>
          <li>Advanced image processing and AI technologies</li>
        </ul>
      </>
    ),
  },
  {
    heading: "9. Data retention",
    body: (
      <p>
        We retain your personal information for as long as necessary to
        fulfill the purposes outlined in this Privacy Policy, unless a longer
        retention period is required or permitted by law.
      </p>
    ),
  },
  {
    heading: "10. Children's privacy",
    body: (
      <p>
        Our service does not address anyone under the age of 13. We do not
        knowingly collect personally identifiable information from children
        under 13.
      </p>
    ),
  },
  {
    heading: "11. International data transfers",
    body: (
      <p>
        Your information may be transferred to, and maintained on, computers
        located outside of your state, province, country, or other
        governmental jurisdiction where the data protection laws may differ
        from those in your jurisdiction.
      </p>
    ),
  },
  {
    heading: "12. Changes to this Privacy Policy",
    body: (
      <p>
        We may update our Privacy Policy from time to time. We will notify
        you of any changes by posting the new Privacy Policy on this page
        and updating the "Last Updated" date.
      </p>
    ),
  },
  {
    heading: "13. Contact us",
    body: (
      <p>
        If you have any questions about this Privacy Policy, please contact
        us at{" "}
        <a
          href="mailto:privacy@storyincolor.com"
          className="text-white underline hover:no-underline"
        >
          privacy@storyincolor.com
        </a>
        .
      </p>
    ),
  },
  {
    heading: "14. Facebook Pixel and tracking technologies",
    body: (
      <>
        <p>
          We use Facebook Pixel to understand user interactions and improve
          our advertising efforts. Facebook Pixel may collect information
          such as your IP address and actions on our site. This data is used
          in accordance with Facebook's Data Policy.
        </p>
        <p className="mt-3">
          You can manage your preferences through Facebook ad settings or
          your browser settings.
        </p>
      </>
    ),
  },
];

export const metadata = {
  title: "Privacy Policy | StoryInColor",
  description:
    "How StoryInColor collects, uses, and protects your personal information when you use our service.",
};

export default function PrivacyPage() {
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
              Privacy{" "}
              <span className="italic font-light text-gray-400">policy.</span>
            </h1>
            <p className="mt-3 text-sm text-gray-500">
              Last updated: April 4, 2024
            </p>
            <p className="mt-5 text-base text-gray-300 md:text-lg">
              At StoryInColor, we take your privacy seriously. This Privacy
              Policy explains how we collect, use, and protect your personal
              information when you use our service.
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
