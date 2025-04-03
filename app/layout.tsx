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
            
            clarity("set", "iframeSelector", "iframe[src*='firebaseapp.com'], iframe[src*='web.app']");
          `}
        </Script>
        <Script id="spa-routing-script" strategy="beforeInteractive">
          {`
            (function() {
              if (typeof window === 'undefined') return;
              
              var query = window.location.search.substring(1);
              var params = {};
              query.split('&').forEach(function(param) {
                if (!param) return;
                var pair = param.split('=');
                params[pair[0]] = pair[1];
              });
              
              if (params.p) {
                var path = params.p.replace(/~and~/g, '&');
                var query = params.q ? '?' + params.q.replace(/~and~/g, '&') : '';
                var hash = window.location.hash;
                
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
      </head>
      <body>
        <FirebaseProvider>
          {children}
        </FirebaseProvider>
      </body>
    </html>
  )
}
