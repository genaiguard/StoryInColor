import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { FirebaseProvider } from './firebase/firebase-provider'
import Script from 'next/script'
import StructuredData from '@/components/seo/structured-data'
import FacebookPixel from '@/components/tracking/facebook-pixel'
import { FACEBOOK_PIXEL_CONFIG } from '@/lib/facebook-pixel-config'

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
})

// One canonical site description used by every social card and the SEO
// JSON-LD. Updating this in one place keeps every share preview in sync.
const SITE_TITLE = 'StoryInColor — Editorial AI Photo Readings';
const SITE_DESCRIPTION =
  'What does your photo know about you? Editorial readings of your palm, your face, your beauty, your handwriting, your plate, your room, and more. Designed to be saved.';
const SITE_URL = 'https://storyincolor.com';
// NOTE: the SHARING.webp file currently in /public/images is from the
// pre-pivot coloring-book era and is on the to-replace list. The metadata
// below already points at the right URL — once the file is regenerated
// (cinematic dark composition with brand text), shared cards update with
// no further code change.
const SITE_OG_IMAGE = `${SITE_URL}/images/SHARING.webp`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: 'StoryInColor',
  manifest: '/site.webmanifest',
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: 'website',
    siteName: 'StoryInColor',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    images: [
      {
        url: SITE_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'StoryInColor — Editorial AI Photo Readings',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [SITE_OG_IMAGE],
  },
  icons: [
    { rel: 'icon', url: '/favicon.ico', type: 'image/x-icon' },
    { rel: 'icon', url: '/favicon.svg', type: 'image/svg+xml' },
    { rel: 'icon', type: 'image/png', sizes: '16x16', url: '/favicon-16x16.png' },
    { rel: 'icon', type: 'image/png', sizes: '32x32', url: '/favicon-32x32.png' },
    { rel: 'icon', type: 'image/png', sizes: '96x96', url: '/favicon-96x96.png' },
    { rel: 'icon', type: 'image/png', sizes: '192x192', url: '/web-app-manifest-192x192.png' },
    { rel: 'icon', type: 'image/png', sizes: '512x512', url: '/web-app-manifest-512x512.png' },
    { rel: 'apple-touch-icon', url: '/apple-touch-icon.png', type: 'image/png' },
  ],
  other: {
    'apple-mobile-web-app-title': 'StoryInColor',
  }
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark bg-black ${inter.variable}`}>
      <head>
        <Script id="clarity-tracking" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "qxtkvqson7");
            
            clarity("set", "iframeSelector", "iframe[src*='firebaseapp.com'], iframe[src*='web.app']");
          `}
        </Script>
        <Script id="fix-image-paths" strategy="afterInteractive">
          {`
            (function() {
              if (typeof window === 'undefined') return;
              
              if (window.location.hostname.includes('github.io')) {
                setTimeout(function() {
                  document.querySelectorAll('img').forEach(function(img) {
                    if (img.src && img.src.startsWith(window.location.origin + '/') && 
                        !img.src.includes('/StoryInColor/')) {
                      img.src = img.src.replace(window.location.origin + '/', window.location.origin + '/StoryInColor/');
                    }
                  });
                  
                  document.querySelectorAll('[style*="background-image"]').forEach(function(el) {
                    if (el.style.backgroundImage && 
                        el.style.backgroundImage.startsWith('url("/') && 
                        !el.style.backgroundImage.includes('/StoryInColor/')) {
                      el.style.backgroundImage = el.style.backgroundImage.replace('url("/', 'url("/StoryInColor/');
                    }
                  });
                }, 300);
              }
            })();
          `}
        </Script>
        {/* Facebook Pixel - Only load in production or when explicitly enabled */}
        {FACEBOOK_PIXEL_CONFIG.ENABLED && (
          <FacebookPixel pixelId={FACEBOOK_PIXEL_CONFIG.PIXEL_ID} />
        )}
      </head>
      <body className="bg-black text-white antialiased">
        <FirebaseProvider>
          {children}
        </FirebaseProvider>
      </body>
    </html>
  )
}
