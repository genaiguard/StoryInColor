import Script from 'next/script';

export default function StructuredData() {
  // Define structured data for rich search results
  const structuredData = {};
  
  return (
    <Script id="schema-structured-data" type="application/ld+json" strategy="afterInteractive">
      {JSON.stringify(structuredData)}
    </Script>
  );
} 