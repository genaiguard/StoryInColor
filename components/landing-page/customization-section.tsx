"use client"

import { PathImg } from "@/components/ui/pathed-image"

export default function CustomizationSection() {
  return (
    <section className="py-12 md:py-16 lg:py-20 bg-[#f7f4f3]">
      <div className="container mx-auto max-w-7xl px-6 md:px-8">
        <div className="grid gap-8 md:grid-cols-2 md:gap-12 items-center">
          <div className="order-2 md:order-1">
            <div className="relative overflow-hidden rounded-lg shadow-md">
              <PathImg
                src="/images/customize-interface.png"
                alt="StoryInColor customization interface showing a coloring book page being created"
                width={700}
                height={500}
                className="w-full h-auto"
              />
            </div>
          </div>
          <div className="order-1 md:order-2">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Easy Customization
              </h2>
              <p className="text-gray-700 md:text-lg">
                Our intuitive interface makes it simple to create your perfect coloring book in minutes.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start">
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
                </li>
                <li className="flex items-start">
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
                </li>
                <li className="flex items-start">
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
                </li>
                <li className="flex items-start">
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
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

