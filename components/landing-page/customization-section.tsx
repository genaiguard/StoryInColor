"use client"

import { PathImg } from "@/components/ui/pathed-image"

export default function CustomizationSection() {
  return (
    <section className="py-12 md:py-16 lg:py-20" style={{ backgroundColor: '#ffffff' }}>
      <div className="container mx-auto max-w-7xl px-6 md:px-8">
        <div className="flex flex-col gap-8">
          <div className="text-center mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl mb-4">
              Easy Customization
            </h2>
            <p className="text-gray-700 md:text-lg mb-6">
              Our intuitive interface makes it simple to create your perfect coloring book in minutes.
            </p>
          </div>

          <div className="w-full max-w-[75%] mx-auto" style={{ position: 'relative' }}>
            <div style={{ 
              position: 'relative', 
              overflow: 'visible'
            }}>
              <div 
                style={{
                  position: 'absolute',
                  top: '-5px',
                  left: '-5px',
                  right: '-5px',
                  bottom: '-5px',
                  borderRadius: '8px',
                  boxShadow: 'inset 0 0 10px 5px #ffffff',
                  pointerEvents: 'none',
                  zIndex: 2
                }}
              />
              <div 
                style={{
                  position: 'absolute',
                  top: '0',
                  left: '0',
                  right: '0',
                  bottom: '0',
                  border: '5px solid #ffffff',
                  borderRadius: '4px',
                  pointerEvents: 'none',
                  zIndex: 1
                }}
              />
              <video 
                src="/images/VideoDemo.mov" 
                className="w-full h-auto relative z-0"
                style={{ 
                  backgroundColor: 'transparent',
                  boxShadow: 'none',
                  border: 'none',
                  transition: 'none',
                  transform: 'none',
                  outline: 'none'
                }}
                autoPlay
                playsInline
                muted
                loop
                disablePictureInPicture
                disableRemotePlayback
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-start">
              <svg
                className="h-6 w-6 text-orange-500 mr-2 flex-shrink-0"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Upload any photos from your phone or computer</span>
            </div>
            <div className="flex items-start">
              <svg
                className="h-6 w-6 text-orange-500 mr-2 flex-shrink-0"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Arrange pages in your preferred order</span>
            </div>
            <div className="flex items-start">
              <svg
                className="h-6 w-6 text-orange-500 mr-2 flex-shrink-0"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Choose between softcover, hardcover, or digital options</span>
            </div>
            <div className="flex items-start">
              <svg
                className="h-6 w-6 text-orange-500 mr-2 flex-shrink-0"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Preview before you purchase</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

