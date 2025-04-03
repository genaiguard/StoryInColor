import type { Metadata } from 'next'
import './globals.css'
import { FirebaseProvider } from './firebase/firebase-provider'
import Script from 'next/script'

export const metadata: Metadata = {
  title: 'StoryInColor - AI Coloring Books',
  description: 'Create personalized coloring books with AI',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <Script id="clarity-tracking" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "qxtkvqson7");
            
            // Configure Clarity to ignore cross-origin iframes
            clarity("set", "iframeSelector", "iframe[src*='firebaseapp.com'], iframe[src*='web.app']");
          `}
        </Script>
        <Script id="spa-routing-script" strategy="beforeInteractive">
          {`
            // SPA redirect script for GitHub Pages
            (function() {
              if (typeof window === 'undefined') return;
              
              // Parse query parameters
              var query = window.location.search.substring(1);
              var params = {};
              query.split('&').forEach(function(param) {
                if (!param) return;
                var pair = param.split('=');
                params[pair[0]] = pair[1];
              });
              
              // Handle redirect from 404 page
              if (params.p) {
                var path = params.p.replace(/~and~/g, '&');
                var query = params.q ? '?' + params.q.replace(/~and~/g, '&') : '';
                var hash = window.location.hash;
                
                // Cleanup URL
                window.history.replaceState(
                  null,
                  null,
                  window.location.pathname.split('?')[0] + (path === '/' ? '' : path) + query + hash
                );
              }
            })();
          `}
        </Script>
        <Script id="fix-image-paths" strategy="afterInteractive">
          {`
            // Fix image paths for GitHub Pages
            (function() {
              if (typeof window === 'undefined') return;
              
              // Only fix paths on GitHub Pages (not on custom domain)
              if (window.location.hostname.includes('github.io')) {
                // Run after a slight delay to ensure DOM is loaded
                setTimeout(function() {
                  // Fix all image src attributes
                  document.querySelectorAll('img').forEach(function(img) {
                    if (img.src && img.src.startsWith(window.location.origin + '/') && 
                        !img.src.includes('/StoryInColor/')) {
                      // Replace origin/ with origin/StoryInColor/
                      img.src = img.src.replace(window.location.origin + '/', window.location.origin + '/StoryInColor/');
                    }
                  });
                  
                  // Also fix background images in style tags
                  document.querySelectorAll('[style*="background-image"]').forEach(function(el) {
                    if (el.style.backgroundImage && 
                        el.style.backgroundImage.startsWith('url("/') && 
                        !el.style.backgroundImage.includes('/StoryInColor/')) {
                      // Replace url("/ with url("/StoryInColor/
                      el.style.backgroundImage = el.style.backgroundImage.replace('url("/', 'url("/StoryInColor/');
                    }
                  });
                }, 300);
              }
            })();
          `}
        </Script>
      </head>
      <body>
        <FirebaseProvider>
          {children}
        </FirebaseProvider>
      </body>
    </html>
  )
}
