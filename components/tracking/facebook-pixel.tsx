"use client"

import { useEffect } from 'react'
import Script from 'next/script'
// window.fbq is declared in lib/analytics/globals.d.ts so every tracking
// component shares the same typing. No local declare global block here.

interface FacebookPixelProps {
  pixelId: string
}

export default function FacebookPixel({ pixelId }: FacebookPixelProps) {
  useEffect(() => {
    // Initialize Facebook Pixel
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('init', pixelId)
      window.fbq('track', 'PageView')
    }
  }, [pixelId])

  return (
    <>
      <Script
        id="facebook-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixelId}');
            fbq('track', 'PageView');
          `,
        }}
      />
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  )
}

// Note: legacy trackEvent / trackSignUp / trackAddToCart / trackPurchase /
// trackInitiateCheckout / trackViewContent / trackLead helpers were
// removed when the typed funnel API in lib/analytics/events.ts replaced
// every call site. Use those helpers — they fan out to Pixel + GA4 +
// Clarity with a shared event_id so the Phase-4 server-side CAPI mirror
// can deduplicate against the browser emit.
