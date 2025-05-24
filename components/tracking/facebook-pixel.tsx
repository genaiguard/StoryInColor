"use client"

import { useEffect } from 'react'
import Script from 'next/script'

declare global {
  interface Window {
    fbq: any
  }
}

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

// Helper function to track events
export const trackEvent = (eventName: string, parameters?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', eventName, parameters)
  }
}

// Common event tracking functions
export const trackSignUp = () => {
  trackEvent('CompleteRegistration')
}

export const trackAddToCart = (value?: number, currency = 'USD') => {
  trackEvent('AddToCart', { value, currency })
}

export const trackPurchase = (value: number, currency = 'USD') => {
  trackEvent('Purchase', { value, currency })
}

export const trackInitiateCheckout = () => {
  trackEvent('InitiateCheckout')
}

export const trackViewContent = (contentName?: string) => {
  trackEvent('ViewContent', { content_name: contentName })
}

export const trackLead = () => {
  trackEvent('Lead')
} 