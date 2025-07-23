import Head from 'next/head';

export default function CoreSEO() {
  // Website URL
  const siteUrl = 'https://storyincolor.com';
  
  // Define structured data for rich search results:
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