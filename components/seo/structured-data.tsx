import Script from 'next/script';

export default function StructuredData() {
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
    <Script id="schema-structured-data" type="application/ld+json" strategy="afterInteractive">
      {JSON.stringify(structuredData)}
    </Script>
  );
} 