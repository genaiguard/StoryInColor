import type { Metadata } from 'next'
import './globals.css'
import { FirebaseProvider } from './firebase/firebase-provider'
import Script from 'next/script'
import StructuredData from '@/components/seo/structured-data'
import FacebookPixel from '@/components/tracking/facebook-pixel'
import { FACEBOOK_PIXEL_CONFIG } from '@/lib/facebook-pixel-config'

export const metadata: Metadata = {
  title: 'StoryInColor - AI Coloring Books',
  description: 'Turn your photos into beautiful custom coloring pages with AI. Create personalized coloring books from family photos, pet portraits, and vacation memories.',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
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
    <html lang="en" className="">
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
      <body className="">
        <FirebaseProvider>
          {children}
        </FirebaseProvider>
      </body>
    </html>
  )
}
