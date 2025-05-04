import Head from 'next/head';

export default function LandingPageSEO() {
  // Website URL
  const siteUrl = 'https://storyincolor.com';
  
  // Define structured data for rich search results
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "StoryInColor",
    "applicationCategory": "MultimediaApplication",
    "description": "Turn your photos into beautiful custom coloring pages instantly with AI. Create personalized coloring books from vacation photos, family pictures, and pet portraits.",
    "offers": {
      "@type": "Offer",
      "price": "0.45",
      "priceCurrency": "USD",
      "description": "Pay per coloring page generation with credits"
    },
    "screenshot": `${siteUrl}/images/best-6.webp`,
    "featureList": "AI photo conversion, instant PDF download, multiple art styles",
    "operatingSystem": "Web browser"
  };
  
  return (
    <Head>
      {/* Enhanced Meta Tags */}
      <meta name="description" content="Turn your photos into beautiful custom coloring pages instantly with AI. Create personalized coloring books from vacation photos, family pictures, and pet portraits." />
      <meta name="keywords" content="custom coloring pages, coloring books, AI coloring pages, personalized coloring book, photo to coloring page, family coloring book, pet coloring pages" />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={siteUrl} />
      <meta property="og:title" content="StoryInColor - Turn Photos Into Custom Coloring Pages" />
      <meta property="og:description" content="Create beautiful personalized coloring pages from your photos. Family pictures, pet portraits, vacations and more - instantly transform them into coloring pages with AI." />
      <meta property="og:image" content={`${siteUrl}/images/best-6.webp`} />
      
      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={siteUrl} />
      <meta property="twitter:title" content="StoryInColor - AI Coloring Books" />
      <meta property="twitter:description" content="Turn your photos into beautiful coloring pages instantly with AI. Create personalized coloring books from vacation photos, family pictures, and pet portraits." />
      <meta property="twitter:image" content={`${siteUrl}/images/best-6.webp`} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={siteUrl} />
      
      {/* Structured Data / JSON-LD */}
      <script 
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </Head>
  );
} 