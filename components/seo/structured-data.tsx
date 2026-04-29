/**
 * Site-level structured data injected on the homepage. Sits alongside the
 * page-specific schemas in landing-page-seo.tsx — together they give
 * Google a Brand + Site + WebApp + FAQ description of the homepage.
 *
 * Mounted only on the homepage (app/page.tsx renders <StructuredData />).
 * Per-reading detail pages get their own Service + FAQ schemas via
 * components/seo/tool-jsonld.tsx.
 */
const SITE_URL = "https://storyincolor.com";
const SITE_NAME = "StoryInColor";
const SITE_DESCRIPTION =
  "Editorial AI photo readings, written from a single photo of you. Designed to be saved.";
const LOGO_URL = `${SITE_URL}/web-app-manifest-512x512.png`;

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  legalName: "Story In Color",
  url: SITE_URL,
  logo: {
    "@type": "ImageObject",
    url: LOGO_URL,
    width: 512,
    height: 512,
  },
  description: SITE_DESCRIPTION,
  sameAs: ["https://www.facebook.com/profile.php?id=61576557967079"],
  contactPoint: [
    {
      "@type": "ContactPoint",
      email: "support@storyincolor.com",
      contactType: "customer support",
      availableLanguage: "English",
    },
  ],
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  inLanguage: "en",
  publisher: {
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
  },
};

export default function StructuredData() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
    </>
  );
}
